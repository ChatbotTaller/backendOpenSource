const db = require('../config/database');

function detectarKeywordServicio(message) {
  const msg = message.toLowerCase();

  if (msg.includes("pastilla") || msg.includes("freno")) return "pastillas";
  if (msg.includes("engrase") || msg.includes("suspension") || msg.includes("suspensión")) return "engrase";
  if (msg.includes("inyector") || msg.includes("inyeccion") || msg.includes("inyección")) return "inyectores";
  if (msg.includes("scanner") || msg.includes("escaneo") || msg.includes("falla")) return "fallas";
  if (msg.includes("motor")) return "motor";
  if (msg.includes("transmision") || msg.includes("transmisión")) return "transmisión";
  if (msg.includes("embrague")) return "embrague";
  if (msg.includes("mantenimiento")) return "mantenimiento";

  if (
    msg.includes("servicio") ||
    msg.includes("servicios") ||
    msg.includes("ofrecen") ||
    msg.includes("ofrece")
  ) return "";

  return msg;
}

function servicesAgent(message) {
  return new Promise((resolve, reject) => {
    const keyword = detectarKeywordServicio(message);

    const sql = keyword
      ? `
        SELECT nombre, precio, descripcion, garantia
        FROM servicios
        WHERE nombre LIKE ? OR descripcion LIKE ?
        LIMIT 10
      `
      : `
        SELECT nombre, precio, descripcion, garantia
        FROM servicios
        LIMIT 10
      `;

    const params = keyword
      ? [`%${keyword}%`, `%${keyword}%`]
      : [];

    db.query(sql, params, (err, results) => {
      if (err) return reject(err);

      resolve({
        intent: "services",
        keyword,
        data: results
      });
    });
  });
}

module.exports = servicesAgent;