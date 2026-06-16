const db = require('../config/database');

async function guardarMetrica(data) {

  return new Promise((resolve, reject) => {

    const sql = `
          INSERT INTO metricas_chatbot
          (
            conversacion_id,
            pregunta,
            respuesta,
            intencion_detectada,
            tiempo_respuesta_ms,
            canal,
            stt_exitoso,
            tts_exitoso
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      sql,
      [
        data.conversacion_id,
        data.pregunta,
        data.respuesta,
        data.intencion_detectada,
        data.tiempo_respuesta_ms,
        data.canal || 'texto',
        data.stt_exitoso ?? 1,
        data.tts_exitoso ?? 1
      ],
      (err, result) => {

        if (err) {
          console.error("❌ Error guardando métrica:", err);
          return reject(err);
        }

        resolve(result);

      }
    );

  });

}

module.exports = {
  guardarMetrica
};