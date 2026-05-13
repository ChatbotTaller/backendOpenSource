const db = require('../config/database');
const aiService = require('../services/aiService');

const procesarMensaje = (req, res) => {
  const userMsg =
    req.body.user_message ||
    req.body.message ||
    req.body.text ||
    req.body.content ||
    "Hola";

  const msg = userMsg.toLowerCase();

  let sql = "";
  let params = [];

  // HORARIOS
  if (
    msg.includes("horario") ||
    msg.includes("hora") ||
    msg.includes("atienden") ||
    msg.includes("trabajan") ||
    msg.includes("abierto") ||
    msg.includes("cierran") ||
    msg.includes("abren")
  ) {
    sql = "SELECT * FROM horarios";
  }

  // INVENTARIO / REPUESTOS
  else if (
    msg.includes("filtro") ||
    msg.includes("aceite") ||
    msg.includes("aire") ||
    msg.includes("repuesto") ||
    msg.includes("precio") ||
    msg.includes("producto")
  ) {
    let keyword = msg;

    if (msg.includes("filtro de aire")) keyword = "filtro de aire";
    else if (msg.includes("filtro de aceite")) keyword = "filtro de aceite";
    else if (msg.includes("filtro combustible") || msg.includes("filtro de combustible")) keyword = "filtro de combustible";
    else if (msg.includes("cabina")) keyword = "cabina";
    else if (msg.includes("aceite")) keyword = "aceite";
    else if (msg.includes("filtro")) keyword = "filtro";

    sql = `
      SELECT codigo, descripcion, ubicacion, responsable, precio_venta
      FROM inventario
      WHERE descripcion LIKE ?
      LIMIT 10
    `;

    params = [`%${keyword}%`];
  }

  // SERVICIOS
  else if (
    msg.includes("servicio") ||
    msg.includes("mantenimiento") ||
    msg.includes("garantia") ||
    msg.includes("reparacion")
  ) {
    sql = "SELECT * FROM servicios";
  }

  // INFO GENERAL
  else {
    sql = "SELECT * FROM info_taller";
  }

  db.query(sql, params, async (err, results) => {
    if (err) {
      console.error("❌ Error en DB:", err);
      return res.json({ reply: "Error consultando la base de datos." });
    }

    console.log("📩 Mensaje:", userMsg);
    console.log("📊 Resultados BD:", results);

    const contexto = JSON.stringify(results);
    const respuestaIA = await aiService.generarRespuesta(contexto, userMsg);

    res.json({ reply: respuestaIA });
  });
};

module.exports = { procesarMensaje };