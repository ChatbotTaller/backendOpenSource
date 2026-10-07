const db = require('../config/database');
const { isPositiveInteger } = require('../utils/validators');

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });
}

async function cancelarCitaPropiaPorId(usuarioId, citaId) {
  if (!isPositiveInteger(usuarioId) || !isPositiveInteger(citaId)) {
    return { status: 'invalid' };
  }

  const rows = await query(
    `SELECT id, usuario_id, estado, google_event_id
     FROM citas
     WHERE id = ?
     LIMIT 1`,
    [Number(citaId)]
  );

  if (!rows.length) return { status: 'not_found' };
  if (Number(rows[0].usuario_id) !== Number(usuarioId)) return { status: 'forbidden' };
  if (!['pendiente', 'confirmada'].includes(rows[0].estado)) {
    return { status: 'conflict', appointment: rows[0] };
  }

  const result = await query(
    `UPDATE citas
     SET estado = 'cancelada'
     WHERE id = ? AND usuario_id = ? AND estado IN ('pendiente', 'confirmada')`,
    [Number(citaId), Number(usuarioId)]
  );

  if (!result.affectedRows) return { status: 'conflict', appointment: rows[0] };
  return { status: 'cancelled', appointment: rows[0] };
}

async function cancelarCitaPropiaPorDatos(usuarioId, fecha, hora, telefono) {
  const rows = await query(
    `SELECT id
     FROM citas
     WHERE usuario_id = ?
       AND fecha = ?
       AND hora = ?
       AND cliente_telefono = ?
       AND estado IN ('pendiente', 'confirmada')
     LIMIT 1`,
    [Number(usuarioId), fecha, hora, telefono]
  );

  if (!rows.length) return { status: 'not_found' };
  return cancelarCitaPropiaPorId(usuarioId, rows[0].id);
}

module.exports = {
  cancelarCitaPropiaPorId,
  cancelarCitaPropiaPorDatos
};
