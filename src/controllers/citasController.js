const db = require('../config/database');

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

    const sql = `
      UPDATE citas
      SET estado = ?
      WHERE id = ?
    `;

    db.query(sql, [estado, id], (err) => {

      if (err) {
        console.error(err);
        return res.status(500).json({
          error: 'Error actualizando cita'
        });
      }

      res.json({
        success: true
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