const pool = require("../db/connection");

exports.getTodas = async () => {
  const [rows] = await pool.query(`
    SELECT s.*, u.nombre AS nombre_usuario 
    FROM solicitudes_pago s
    JOIN usuarios u ON s.id_usuario = u.id_usuario
  `);

  // Sobrescribir id_usuario con el nombre
  const resultadoTransformado = rows.map((solicitud) => {
    return {
      ...solicitud,
      id_usuario: solicitud.nombre_usuario,
    };
  });

  return resultadoTransformado;
};



// Obtener solicitudes de un usuario específico (rol solicitante)
exports.getPorUsuario = async (id_usuario) => {
  const [rows] = await pool.query(`
    SELECT s.*, u.nombre AS nombre_usuario 
    FROM solicitudes_pago s
    JOIN usuarios u ON s.id_usuario = u.id_usuario
    WHERE s.id_usuario = ?
  `, [id_usuario]);
  return rows;
};


// Obtener solo solicitudes autorizadas (para pagador_banca)
exports.getAutorizadas = async () => {
  const [rows] = await pool.query(`
    SELECT s.*, u.nombre AS nombre_usuario 
    FROM solicitudes_pago s
    JOIN usuarios u ON s.id_usuario = u.id_usuario
    WHERE s.estado = 'autorizada'
  `);
  return rows;
};


// Obtener una sola solicitud por ID
exports.getPorId = async (id_solicitud) => {
  const [rows] = await pool.query(`
    SELECT s.*, u.nombre AS usuario_nombre
    FROM solicitudes_pago s
    JOIN usuarios u ON s.id_usuario = u.id_usuario
    WHERE s.id_solicitud = ?
  `, [id_solicitud]);
  return rows[0];
};

// Crear una nueva solicitud
exports.crear = async (datos) => {
  const {
    id_usuario,
    departamento,
    monto,
    cuenta_destino,
    factura_url,
    concepto,
    tipo_pago,
    fecha_limite_pago
  } = datos;

  await pool.query(
    `INSERT INTO solicitudes_pago 
    (id_usuario, departamento, monto, cuenta_destino, factura_url, concepto, tipo_pago, fecha_limite_pago)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [id_usuario, departamento, monto, cuenta_destino, factura_url, concepto, tipo_pago, fecha_limite_pago]
  );
};

// Aprobar o rechazar solicitud (solo por rol aprobador)
exports.actualizarEstado = async (id_solicitud, estado, comentario_aprobador, id_aprobador) => {
  const [result] = await pool.query(
    `UPDATE solicitudes_pago 
     SET estado = ?, comentario_aprobador = ?, id_aprobador = ?, fecha_revision = NOW() 
     WHERE id_solicitud = ?`,
    [estado, comentario_aprobador, id_aprobador, id_solicitud]
  );

  return result.affectedRows;
};

// Marcar una solicitud como pagada (solo por rol pagador_banca)
exports.marcarComoPagada = async (id_solicitud, id_pagador) => {
  const [result] = await pool.query(
    `UPDATE solicitudes_pago 
     SET estado = 'pagada', id_pagador = ?, fecha_pago = NOW()
     WHERE id_solicitud = ? AND estado = 'autorizada'`,
    [id_pagador, id_solicitud]
  );

  return result.affectedRows;
};

// Eliminar una solicitud (solo admin_general)
exports.eliminar = async (id_solicitud) => {
  await pool.query("DELETE FROM solicitudes_pago WHERE id_solicitud = ?", [id_solicitud]);
};

// Editar una solicitud si es del usuario y está pendiente, o si es admin_general
exports.editarSolicitudSiPendiente = async (id_solicitud, id_usuario, datos, esAdminGeneral = false) => {
  let query, params;
  // Construir SET dinámico según si hay factura_url y/o fecha_limite_pago
  let setFields = [
    'departamento = ?',
    'monto = ?',
    'cuenta_destino = ?',
    'concepto = ?',
    'tipo_pago = ?'
  ];
  let setParams = [
    datos.departamento,
    datos.monto,
    datos.cuenta_destino,
    datos.concepto,
    datos.tipo_pago
  ];
  if (typeof datos.factura_url === 'string' && datos.factura_url.length > 0) {
    setFields.push('factura_url = ?');
    setParams.push(datos.factura_url);
  }
  if (typeof datos.fecha_limite_pago === 'string' && datos.fecha_limite_pago.length > 0) {
    setFields.push('fecha_limite_pago = ?');
    setParams.push(datos.fecha_limite_pago);
  }
  if (esAdminGeneral) {
    query = `UPDATE solicitudes_pago SET ${setFields.join(', ')} WHERE id_solicitud = ? AND estado = 'pendiente'`;
    setParams.push(id_solicitud);
  } else {
    query = `UPDATE solicitudes_pago SET ${setFields.join(', ')} WHERE id_solicitud = ? AND id_usuario = ? AND estado = 'pendiente'`;
    setParams.push(id_solicitud, id_usuario);
  }
  const [result] = await pool.query(query, setParams);
  return result.affectedRows > 0;
};

exports.getPorRecurrente = async (id_recurrente) => {
  const [rows] = await pool.query(
    `SELECT * FROM solicitudes_pago WHERE id_recurrente_origen = ? ORDER BY fecha_creacion DESC`,
    [id_recurrente]
  );
  return rows;
};

// Eliminar una solicitud solo si es del solicitante y está pendiente
exports.eliminarSiSolicitantePendiente = async (id_solicitud, id_usuario) => {
  const [result] = await pool.query(
    "DELETE FROM solicitudes_pago WHERE id_solicitud = ? AND id_usuario = ? AND estado = 'pendiente'",
    [id_solicitud, id_usuario]
  );
  return result.affectedRows > 0;
};
