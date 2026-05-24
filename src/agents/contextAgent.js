const db = require('../config/database');

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

async function obtenerContextoUsuario(usuarioId) {
  const rows = await query(
    `
    SELECT *
    FROM chatbot_context
    WHERE usuario_id = ?
    LIMIT 1
    `,
    [usuarioId]
  );

  return rows[0] || null;
}

async function guardarContextoUsuario(usuarioId, conversacionId, data = {}) {
  await query(
    `
    INSERT INTO chatbot_context
    (
      usuario_id,
      conversacion_id,
      nombre,
      telefono,
      vehiculo,
      motivo,
      ultimo_intent,
      ultimo_tema,
      datos_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      conversacion_id = VALUES(conversacion_id),
      nombre = COALESCE(VALUES(nombre), nombre),
      telefono = COALESCE(VALUES(telefono), telefono),
      vehiculo = COALESCE(VALUES(vehiculo), vehiculo),
      motivo = COALESCE(VALUES(motivo), motivo),
      ultimo_intent = COALESCE(VALUES(ultimo_intent), ultimo_intent),
      ultimo_tema = COALESCE(VALUES(ultimo_tema), ultimo_tema),
      datos_json = COALESCE(VALUES(datos_json), datos_json)
    `,
    [
      usuarioId,
      conversacionId,
      data.nombre || null,
      data.telefono || null,
      data.vehiculo || null,
      data.motivo || null,
      data.ultimo_intent || null,
      data.ultimo_tema || null,
      data.datos_json ? JSON.stringify(data.datos_json) : null
    ]
  );
}

module.exports = {
  obtenerContextoUsuario,
  guardarContextoUsuario
};