const db = require('../config/database');

function getOrCreateSession(sessionId) {
  return new Promise((resolve, reject) => {
    const sqlUsuario = `
      INSERT INTO usuarios (session_id, nombre, canal, ultima_interaccion)
      VALUES (?, 'Visitante web', 'web', NOW())
      ON DUPLICATE KEY UPDATE ultima_interaccion = NOW()
    `;

    db.query(sqlUsuario, [sessionId], (err) => {
      if (err) return reject(err);

      db.query(
        `SELECT id, nombre, email, telefono, preferencias, observaciones
         FROM usuarios
         WHERE session_id = ?
         LIMIT 1`,
        [sessionId],
        (err, usuarios) => {
          if (err) return reject(err);
          if (!usuarios.length) return reject(new Error("Usuario no encontrado"));

          const usuario = usuarios[0];

          const sqlConversacion = `
            INSERT INTO conversaciones (usuario_id, canal, fecha_inicio)
            SELECT ?, 'web', NOW()
            WHERE NOT EXISTS (
              SELECT 1 FROM conversaciones
              WHERE usuario_id = ? AND canal = 'web'
            )
          `;

          db.query(sqlConversacion, [usuario.id, usuario.id], (err) => {
            if (err) return reject(err);

            db.query(
              `SELECT *
               FROM conversaciones
               WHERE usuario_id = ? AND canal = 'web'
               ORDER BY id DESC
               LIMIT 1`,
              [usuario.id],
              (err, conversaciones) => {
                if (err) return reject(err);
                if (!conversaciones.length) return reject(new Error("Conversación no encontrada"));

                resolve({
                  usuario,
                  conversacion: conversaciones[0]
                });
              }
            );
          });
        }
      );
    });
  });
}

function saveMessage(conversacionId, remitente, mensaje, intent, tiempoRespuestaMs = null) {
  return new Promise((resolve, reject) => {
    const sql = `
      INSERT INTO mensajes
      (conversacion_id, remitente, mensaje, intent_detectado, tiempo_respuesta_ms)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [conversacionId, remitente, mensaje, intent, tiempoRespuestaMs], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

function updateConversationContext(conversacionId, intent, contextObject) {
  return new Promise((resolve, reject) => {
    const sql = `
      UPDATE conversaciones
      SET ultima_intencion = ?, ultimo_contexto = ?
      WHERE id = ?
    `;

    db.query(sql, [intent, JSON.stringify(contextObject), conversacionId], (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
  });
}

function getLastContext(conversacion) {
  if (!conversacion || !conversacion.ultimo_contexto) return null;

  try {
    return JSON.parse(conversacion.ultimo_contexto);
  } catch (error) {
    return null;
  }
}

module.exports = {
  getOrCreateSession,
  saveMessage,
  updateConversationContext,
  getLastContext
};