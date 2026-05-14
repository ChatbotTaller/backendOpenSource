const aiService = require('../services/aiService');

const { classifyIntent } = require('../agents/classifierAgent');
const inventoryAgent = require('../agents/inventoryAgent');
const servicesAgent = require('../agents/servicesAgent');
const scheduleAgent = require('../agents/scheduleAgent');
const infoAgent = require('../agents/infoAgent');
const appointmentAgent = require('../agents/appointmentAgent');

const {
  getOrCreateSession,
  saveMessage,
  updateConversationContext,
  getLastContext
} = require('../agents/memoryAgent');

async function procesarMensaje(req, res) {
  const inicio = Date.now();

  try {
    const userMsg =
      req.body.user_message ||
      req.body.message ||
      req.body.text ||
      req.body.content ||
      "Hola";

    const sessionId = req.body.session_id || req.ip || "web_demo";

    const { usuario, conversacion } = await getOrCreateSession(sessionId);

    let intent = classifyIntent(userMsg);
    const lastContext = getLastContext(conversacion);

    if (intent === "follow_up" && conversacion.ultima_intencion) {
      intent = conversacion.ultima_intencion;
    }

    let agentResult;

    // CITAS
    const citaResult = await appointmentAgent(userMsg, usuario.id);

    if (citaResult) {
      agentResult = {
        intent: "appointment",
        data: [],
        keyword: null,
        directReply: citaResult.reply
      };
    }

    // INVENTARIO
    else if (intent === "inventory") {

      const messageForAgent =
        classifyIntent(userMsg) === "follow_up" && lastContext?.keyword
          ? lastContext.keyword
          : userMsg;

      agentResult = await inventoryAgent(messageForAgent);
    }

    // SERVICIOS
    else if (intent === "services") {

      const messageForAgent =
        classifyIntent(userMsg) === "follow_up" && lastContext?.keyword
          ? lastContext.keyword
          : userMsg;

      agentResult = await servicesAgent(messageForAgent);
    }

    // HORARIOS
    else if (intent === "schedule") {
      agentResult = await scheduleAgent();
    }

    // INFO GENERAL
    else {
      agentResult = await infoAgent();
    }

    const contextoIA = {
      usuario,
      intent,
      pregunta_usuario: userMsg,
      resultado_agente: agentResult,
      contexto_anterior: lastContext
    };

    let respuestaIA;

    // Si el agente ya respondió directamente
    if (agentResult?.directReply) {

      respuestaIA = agentResult.directReply;

    } else {

      respuestaIA = await aiService.generarRespuesta(
        JSON.stringify(contextoIA),
        userMsg
      );

    }

    const tiempoRespuesta = Date.now() - inicio;

    await saveMessage(
      conversacion.id,
      "usuario",
      userMsg,
      intent,
      null
    );

    await saveMessage(
      conversacion.id,
      "bot",
      respuestaIA,
      intent,
      tiempoRespuesta
    );

    await updateConversationContext(conversacion.id, intent, {
      keyword: agentResult?.keyword || lastContext?.keyword || null,
      intent,
      data: agentResult?.data ? agentResult.data.slice(0, 3) : []
    });

    res.json({
      reply: respuestaIA,
      intent,
      response_time_ms: tiempoRespuesta
    });

  } catch (error) {
    console.error("❌ Error en webhookController:", error);
    res.json({
      reply: "Lo siento, ocurrió un problema procesando tu consulta. Inténtalo nuevamente."
    });
  }
}

module.exports = { procesarMensaje };