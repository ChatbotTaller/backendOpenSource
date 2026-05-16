const db = require('../config/database');

function obtenerMetricas(req, res) {
  const sql = `
    SELECT *
    FROM metricas_chatbot
    ORDER BY fecha DESC
    LIMIT 10
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
    [
      respuesta_correcta,
      intencion_correcta || null,
      id
    ],
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
  const sqlRespuestas = `
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN respuesta_correcta = 1 THEN 1 ELSE 0 END) AS correctas,
      SUM(CASE WHEN respuesta_correcta = 0 THEN 1 ELSE 0 END) AS incorrectas,
      AVG(tiempo_respuesta_ms) AS tiempo_promedio
    FROM metricas_chatbot
    WHERE respuesta_correcta IS NOT NULL
  `;

  const sqlIntenciones = `
    SELECT
      intencion_detectada,
      intencion_correcta
    FROM metricas_chatbot
    WHERE intencion_correcta IS NOT NULL
  `;

  db.query(sqlRespuestas, (err, resumenResults) => {
    if (err) {
      console.error("Error obteniendo resumen:", err);
      return res.status(500).json({
        error: "Error obteniendo resumen de métricas"
      });
    }

    db.query(sqlIntenciones, (err2, intentRows) => {
      if (err2) {
        console.error("Error obteniendo intenciones:", err2);
        return res.status(500).json({
          error: "Error obteniendo métricas de intención"
        });
      }

      const data = resumenResults[0];

      const total = Number(data.total || 0);
      const correctas = Number(data.correctas || 0);
      const incorrectas = Number(data.incorrectas || 0);
      const tiempoPromedio = Number(data.tiempo_promedio || 0);

      const accuracy = total > 0 ? (correctas / total) * 100 : 0;

      const clases = [
        ...new Set(
          intentRows.flatMap(row => [
            row.intencion_detectada,
            row.intencion_correcta
          ])
        )
      ].filter(Boolean);

      let precisionTotal = 0;
      let recallTotal = 0;
      let f1Total = 0;

      clases.forEach(clase => {
        let tp = 0;
        let fp = 0;
        let fn = 0;

        intentRows.forEach(row => {
          const detectada = row.intencion_detectada;
          const correcta = row.intencion_correcta;

          if (detectada === clase && correcta === clase) tp++;
          if (detectada === clase && correcta !== clase) fp++;
          if (detectada !== clase && correcta === clase) fn++;
        });

        const precisionClase = tp + fp > 0 ? tp / (tp + fp) : 0;
        const recallClase = tp + fn > 0 ? tp / (tp + fn) : 0;
        const f1Clase =
          precisionClase + recallClase > 0
            ? (2 * precisionClase * recallClase) / (precisionClase + recallClase)
            : 0;

        precisionTotal += precisionClase;
        recallTotal += recallClase;
        f1Total += f1Clase;
      });

      const precision =
        clases.length > 0 ? (precisionTotal / clases.length) * 100 : 0;

      const recall =
        clases.length > 0 ? (recallTotal / clases.length) * 100 : 0;

      const f1Score =
        clases.length > 0 ? (f1Total / clases.length) * 100 : 0;

      res.json({
        total,
        correctas,
        incorrectas,
        accuracy: Number(accuracy.toFixed(2)),
        precision: Number(precision.toFixed(2)),
        recall: Number(recall.toFixed(2)),
        f1_score: Number(f1Score.toFixed(2)),
        tiempo_promedio_ms: Number(tiempoPromedio.toFixed(2))
      });
    });
  });
}

function obtenerMetricasPorIntent(req, res) {
  const sql = `
    SELECT
      intencion_correcta AS intent,
      COUNT(*) AS total,
      SUM(CASE WHEN respuesta_correcta = 1 THEN 1 ELSE 0 END) AS correctas,
      ROUND(
        (SUM(CASE WHEN respuesta_correcta = 1 THEN 1 ELSE 0 END) / COUNT(*)) * 100,
        2
      ) AS accuracy
    FROM metricas_chatbot
    WHERE intencion_correcta IS NOT NULL
    GROUP BY intencion_correcta
    ORDER BY accuracy DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error obteniendo métricas por intent:", err);
      return res.status(500).json({
        error: "Error obteniendo métricas por intención"
      });
    }

    res.json(results);
  });
}

module.exports = {
  obtenerMetricas,
  evaluarMetrica,
  obtenerResumenMetricas,
  obtenerMetricasPorIntent
};