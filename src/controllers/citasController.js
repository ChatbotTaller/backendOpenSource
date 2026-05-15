const db = require('../config/database');
const { eliminarEventoCita } = require('../services/googleCalendarService');

function obtenerCitas(req, res) {

  const sql = `
    SELECT *
    FROM citas
    ORDER BY fecha ASC, hora ASC
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

        const googleEventId = results[0]?.google_event_id || null;

        const updateSql = `
          UPDATE citas
          SET estado = ?
          WHERE id = ?
        `;

        db.query(updateSql, [estado, id], async (errUpdate) => {
          if (errUpdate) {
            console.error(errUpdate);
            return res.status(500).json({
              error: 'Error actualizando cita'
            });
          }

          if (estado === 'cancelada' && googleEventId) {
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