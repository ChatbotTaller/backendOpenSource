const db = require('../config/database');

function obtenerMetricas(req, res) {
  const sql = `
    SELECT *
    FROM metricas_chatbot
    ORDER BY fecha DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error obteniendo métricas:", err);
      return res.status(500).json({
        error: "Error obteniendo métricas"
      });
    }

    res.json(results);
  });
}

function evaluarMetrica(req, res) {
  const { id } = req.params;
  const { respuesta_correcta, intencion_correcta } = req.body;

  const sql = `
    UPDATE metricas_chatbot
    SET respuesta_correcta = ?,
        intencion_correcta = ?
    WHERE id = ?
  `;

  db.query(
    sql,
    [respuesta_correcta, intencion_correcta || null, id],
    (err) => {
      if (err) {
        console.error("Error evaluando métrica:", err);
        return res.status(500).json({
          error: "Error evaluando métrica"
        });
      }

      res.json({
        success: true
      });
    }
  );
}

function obtenerResumenMetricas(req, res) {
  const sql = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN respuesta_correcta = 1 THEN 1 ELSE 0 END) AS correctas,
      SUM(CASE WHEN respuesta_correcta = 0 THEN 1 ELSE 0 END) AS incorrectas,
      AVG(tiempo_respuesta_ms) AS tiempo_promedio
    FROM metricas_chatbot
    WHERE respuesta_correcta IS NOT NULL
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error obteniendo resumen:", err);
      return res.status(500).json({
        error: "Error obteniendo resumen de métricas"
      });
    }

    const data = results[0];

    const total = Number(data.total || 0);
    const correctas = Number(data.correctas || 0);
    const incorrectas = Number(data.incorrectas || 0);
    const tiempoPromedio = Number(data.tiempo_promedio || 0);

    const accuracy = total > 0 ? (correctas / total) * 100 : 0;

    res.json({
      total,
      correctas,
      incorrectas,
      accuracy: Number(accuracy.toFixed(2)),
      precision: Number(accuracy.toFixed(2)),
      recall: Number(accuracy.toFixed(2)),
      f1_score: Number(accuracy.toFixed(2)),
      tiempo_promedio_ms: Number(tiempoPromedio.toFixed(2))
    });
  });
}

module.exports = {
  obtenerMetricas,
  evaluarMetrica,
  obtenerResumenMetricas
};