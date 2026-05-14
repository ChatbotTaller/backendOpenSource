const db = require('../config/database');

function detectarKeyword(msg) {
  const texto = msg.toLowerCase();

  if (texto.includes("filtro de aire")) return "filtro de aire";
  if (texto.includes("filtro de aceite")) return "filtro de aceite";
  if (texto.includes("filtro combustible")) return "filtro combustible";
  if (texto.includes("filtro de combustible")) return "filtro combustible";
  if (texto.includes("cabina")) return "cabina";
  if (texto.includes("aceite")) return "aceite";
  if (texto.includes("filtro")) return "filtro";

  return texto;
}

function inventoryAgent(message) {
  return new Promise((resolve, reject) => {

    const keyword = detectarKeyword(message);

    const sql = `
      SELECT 
        codigo,
        descripcion,
        ubicacion,
        responsable,
        precio_venta
      FROM inventario
      WHERE descripcion LIKE ?
      LIMIT 10
    `;

    db.query(sql, [`%${keyword}%`], (err, results) => {
      if (err) {
        return reject(err);
      }

      resolve({
        intent: "inventory",
        keyword,
        data: results
      });
    });
  });
}

module.exports = inventoryAgent;