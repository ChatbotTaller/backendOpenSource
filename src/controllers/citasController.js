const db = require('../config/database');
const { eliminarEventoCita } = require('../services/googleCalendarService');
const {
  isPositiveInteger,
  normalizeAppointmentState
} = require('../utils/validators');

function obtenerCitas(req, res) {

  const sql = `
    SELECT id, usuario_id, fecha, hora, estado, cliente_nombre,
           cliente_telefono, vehiculo_texto, motivo, canal
    FROM citas
    ORDER BY id DESC
  `;

  db.query(sql, (err, results) => {

    if (err) {
      console.error(err);

      return res.status(500).json({
        error: 'Error obteniendo citas'
      });
    }

    res.json(results);

  });

}

async function actualizarEstado(req, res) {
    try {
      const { id } = req.params;
      const { estado } = req.body;

      if (!isPositiveInteger(id)) {
        return res.status(400).json({ error: 'ID de cita inválido' });
      }

      const estadoValido = normalizeAppointmentState(estado);
      if (!estadoValido) {
        return res.status(400).json({ error: 'Estado de cita inválido' });
      }

      const buscarSql = `
        SELECT google_event_id
        FROM citas
        WHERE id = ?
        LIMIT 1
      `;

      db.query(buscarSql, [id], (errBuscar, results) => {
        if (errBuscar) {
          console.error(errBuscar);
          return res.status(500).json({
            error: 'Error buscando cita'
          });
        }

        if (results.length === 0) {
          return res.status(404).json({
            error: 'Cita no encontrada'
          });
        }

        const googleEventId = results[0]?.google_event_id || null;

        const updateSql = `
          UPDATE citas
          SET estado = ?
          WHERE id = ?
        `;

        db.query(updateSql, [estadoValido, Number(id)], async (errUpdate) => {
          if (errUpdate) {
            console.error(errUpdate);
            return res.status(500).json({
              error: 'Error actualizando cita'
            });
          }

          if (estadoValido === 'cancelada' && googleEventId) {
            try {
              await eliminarEventoCita(googleEventId);

              db.query(
                `UPDATE citas SET google_event_id = NULL WHERE id = ?`,
                [id]
              );
            } catch (calendarError) {
              console.error('Error eliminando evento Google:', calendarError);
            }
          }

          res.json({
            success: true
          });
        });
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: 'Error servidor'
      });
    }
  }

module.exports = {
  obtenerCitas,
  actualizarEstado
};
