const db = require('../config/database');
const aiService = require('../services/aiService');

const procesarMensaje = (req, res) => {
    const userMsg = req.body.user_message || "Hola";
    let userMsgLower = userMsg.toLowerCase();

    // LÓGICA DE AGENTES
    let tabla = "info_taller";
    if (userMsgLower.includes("filtro") || userMsgLower.includes("precio") || userMsgLower.includes("repuesto")) {
        tabla = "inventario";
    } else if (userMsgLower.includes("horario") || userMsgLower.includes("abierto")) {
        tabla = "horarios";
    } else if (userMsgLower.includes("garantia") || userMsgLower.includes("mantenimiento")) {
        tabla = "servicios";
    }

    let sql = `SELECT * FROM ${tabla}`;
    if (tabla === "inventario") {
        sql = `SELECT * FROM inventario WHERE descripcion LIKE '%${userMsg}%' LIMIT 5`;
    }

    db.query(sql, async (err, results) => {
        if (err) {
            console.error("❌ Error en DB:", err);
            return res.json({ reply: "Error consultando la base de datos." });
        }
        
        const contexto = JSON.stringify(results);
        const respuestaIA = await aiService.generarRespuesta(contexto, userMsg);
        res.json({ reply: respuestaIA });
    });
};

module.exports = { procesarMensaje };