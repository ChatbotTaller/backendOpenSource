const db = require('../config/database');
const logger = require('../utils/logger');

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
        data.stt_exitoso ?? null,
        data.tts_exitoso ?? null
      ],
      (err, result) => {

        if (err) {
          logger.error('metric_save_failed', {
            code: err.code,
            conversationId: data.conversacion_id
          });
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
