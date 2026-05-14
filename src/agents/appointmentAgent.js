const db = require('../config/database');

function detectarIntencionCita(msg) {
  msg = msg.toLowerCase();

  return (
    msg.includes("cita") ||
    msg.includes("reservar") ||
    msg.includes("agendar") ||
    msg.includes("programar")
  );
}

function extraerFecha(msg) {
  const regex = /\d{4}-\d{2}-\d{2}/;
  const match = msg.match(regex);
  return match ? match[0] : null;
}

function extraerHora(msg) {
  const regex = /\d{2}:\d{2}/;
  const match = msg.match(regex);
  return match ? match[0] : null;
}

async function appointmentAgent(message, usuarioId) {

  return new Promise((resolve, reject) => {

    // BUSCAR SI YA EXISTE FLUJO
    const sqlEstado = `
      SELECT *
      FROM estado_cita_temporal
      WHERE usuario_id = ?
      LIMIT 1
    `;

    db.query(sqlEstado, [usuarioId], (err, estados) => {

      if (err) return reject(err);

      // =========================
      // SI NO EXISTE FLUJO
      // =========================

      if (estados.length === 0) {

        if (!detectarIntencionCita(message)) {
          return resolve(null);
        }

        const crearEstado = `
          INSERT INTO estado_cita_temporal
          (usuario_id, paso)
          VALUES (?, 'nombre')
        `;

        db.query(crearEstado, [usuarioId], (err2) => {

          if (err2) return reject(err2);

          return resolve({
            success: true,
            reply: "Claro, puedo ayudarte con tu cita 🚗\n\n¿Cuál es tu nombre?"
          });

        });

        return;
      }

      // =========================
      // FLUJO YA INICIADO
      // =========================

      const estado = estados[0];

      // PASO NOMBRE
      if (estado.paso === 'nombre') {

        const sql = `
          UPDATE estado_cita_temporal
          SET nombre = ?, paso = 'telefono'
          WHERE usuario_id = ?
        `;

        db.query(sql, [message, usuarioId]);

        return resolve({
          success: true,
          reply: "Perfecto 👍\nAhora envíame tu número de teléfono."
        });
      }

      // PASO TELEFONO
      if (estado.paso === 'telefono') {

        const sql = `
          UPDATE estado_cita_temporal
          SET telefono = ?, paso = 'vehiculo'
          WHERE usuario_id = ?
        `;

        db.query(sql, [message, usuarioId]);

        return resolve({
          success: true,
          reply: "Excelente 🚘\n¿Qué vehículo tienes? (marca/modelo)"
        });
      }

      // PASO VEHICULO
      if (estado.paso === 'vehiculo') {

        const sql = `
          UPDATE estado_cita_temporal
          SET vehiculo = ?, paso = 'motivo'
          WHERE usuario_id = ?
        `;

        db.query(sql, [message, usuarioId]);

        return resolve({
          success: true,
          reply: "¿Qué servicio o problema deseas atender?"
        });
      }

      // PASO MOTIVO
      if (estado.paso === 'motivo') {

        const sql = `
          UPDATE estado_cita_temporal
          SET motivo = ?, paso = 'fecha'
          WHERE usuario_id = ?
        `;

        db.query(sql, [message, usuarioId]);

        return resolve({
          success: true,
          reply: "Perfecto 📅\nAhora envíame la fecha y hora.\n\nEjemplo:\n2026-05-20 09:00"
        });
      }

      // PASO FECHA
      if (estado.paso === 'fecha') {

        const fecha = extraerFecha(message);
        const hora = extraerHora(message);

        if (!fecha || !hora) {

          return resolve({
            success: false,
            reply: "Formato inválido.\nUsa este formato:\n2026-05-20 09:00"
          });

        }

        // VALIDAR BLOQUE DE 2 HORAS

        const verificarSql = `
          SELECT *
          FROM citas
          WHERE fecha = ?
          AND estado != 'cancelada'
          AND ABS(TIMESTAMPDIFF(MINUTE, hora, TIME(?))) < 120
        `;

        db.query(verificarSql, [fecha, hora], (err3, existentes) => {

          if (err3) return reject(err3);

          if (existentes.length > 0) {

            return resolve({
              success: false,
              reply: "Lo siento ❌\nYa existe una cita cerca de ese horario.\nPor favor elige otra hora."
            });

          }

          // INSERTAR CITA FINAL

          const insertSql = `
            INSERT INTO citas
            (
              usuario_id,
              fecha,
              hora,
              estado,
              cliente_nombre,
              cliente_telefono,
              vehiculo_texto,
              motivo,
              canal
            )
            VALUES (?, ?, ?, 'pendiente', ?, ?, ?, ?, 'web')
          `;

          db.query(
            insertSql,
            [
              usuarioId,
              fecha,
              hora,
              estado.nombre,
              estado.telefono,
              estado.vehiculo,
              estado.motivo
            ],
            (err4) => {

              if (err4) return reject(err4);

              // ELIMINAR FLUJO TEMPORAL

              db.query(
                `DELETE FROM estado_cita_temporal WHERE usuario_id = ?`,
                [usuarioId]
              );

              return resolve({
                success: true,
                reply:
`✅ Tu cita fue registrada correctamente.

👤 Cliente: ${estado.nombre}
📞 Teléfono: ${estado.telefono}
🚗 Vehículo: ${estado.vehiculo}
🛠️ Servicio: ${estado.motivo}
📅 Fecha: ${fecha}
⏰ Hora: ${hora}`
              });

            }
          );

        });

      }

    });

  });

}

module.exports = appointmentAgent;