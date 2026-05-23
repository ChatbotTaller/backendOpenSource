const db = require('../config/database');
const aiService = require('../services/aiService');
const { guardarMetrica } = require('../services/metricsService');

const { classifyIntent } = require('../agents/classifierAgent');
const {obtenerHoraPeru, obtenerFechaActualPeru, obtenerDiaActualPeru} = require('../utils/time');
const inventoryAgent = require('../agents/inventoryAgent');
const servicesAgent = require('../agents/servicesAgent');
const scheduleAgent = require('../agents/scheduleAgent');
const infoAgent = require('../agents/infoAgent');
const appointmentAgent = require('../agents/appointmentAgent');

const agentSkills = require('../agents/agentSkills');

function esSaludo(message) {
    const msg = message.toLowerCase();

    return (
      msg === "hola" ||
      msg === "buenas" ||
      msg === "buenos dias" ||
      msg === "buenos días" ||
      msg === "buenas tardes" ||
      msg === "buenas noches" ||
      msg.includes("hola")
    );
  }

  function extraerNombreDesdeMensaje(message) {
  const msg = String(message || '').trim();

  const patrones = [
    /mi nombre es\s+([a-záéíóúñ\s]+)/i,
    /me llamo\s+([a-záéíóúñ\s]+)/i,
    /soy\s+([a-záéíóúñ\s]+)/i
  ];

  for (const patron of patrones) {
    const match = msg.match(patron);

    if (match && match[1]) {
      return match[1]
        .trim()
        .replace(/[.,!?]/g, '')
        .split(/\s+/)
        .slice(0, 3)
        .join(' ');
    }
  }

  return null;
}

  function guardarNombreUsuario(usuarioId, nombre) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE usuarios
        SET nombre = ?
        WHERE id = ?
      `;

      db.query(sql, [nombre, usuarioId], (err, result) => {
        if (err) return reject(err);
        resolve(result);
      });
    });
  }

  function obtenerNombreUsuario(usuarioId) {
    return new Promise((resolve, reject) => {
      db.query(
        `
        SELECT nombre
        FROM usuarios
        WHERE id = ?
        LIMIT 1
        `,
        [usuarioId],
        (err, results) => {
          if (err) return reject(err);
          resolve(results[0]?.nombre || null);
        }
      );
    });
  }

    function obtenerClientePorTelefono(telefono) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT *
        FROM clientes
        WHERE telefono = ?
        LIMIT 1
      `;

      db.query(sql, [telefono], (err, results) => {
        if (err) return reject(err);
        resolve(results[0] || null);
      });
    });
  }

  function extraerTelefonoDesdeMensaje(message) {
    const match = String(message || '').match(/\b9\d{8}\b/);
    return match ? match[0] : null;
  }

  function preguntaPorNombre(message) {
    const msg = String(message || '').toLowerCase();

    return (
      msg.includes('como me llamo') ||
      msg.includes('cómo me llamo') ||
      msg.includes('cual es mi nombre') ||
      msg.includes('cuál es mi nombre') ||
      msg.includes('sabes mi nombre')
    );
  }

    function extraerVehiculoDesdeMensaje(message) {
    const msg = String(message || '');

    const marcas = [
      'toyota', 'nissan', 'hyundai', 'honda', 'kia',
      'mazda', 'ford', 'chevrolet', 'mitsubishi',
      'xpander', 'hilux', 'frontier', 'navara'
    ];

    const texto = msg.toLowerCase();

    if (!marcas.some(marca => texto.includes(marca))) {
      return null;
    }

    const match =
      msg.match(/(?:tengo|cuento con|mi vehiculo es|mi carro es|para mi)\s+(.+?)(?:\s+y\s+|\s+con\s+|\s+esta\s+|\s+está\s+|$)/i);

    if (match && match[1]) {
      return match[1].trim();
    }

    return msg.trim();
  }

  function extraerMotivoDesdeMensaje(message) {
    const msg = String(message || '');
    const texto = msg.toLowerCase();

    const palabrasProblema = [
      'averiado', 'averiada', 'falla', 'problema',
      'reparar', 'arreglar', 'revision', 'revisión',
      'cambio', 'mantenimiento', 'valvula', 'válvula',
      'transmision', 'transmisión', 'motor', 'freno',
      'aceite', 'suspension', 'suspensión'
    ];

    if (!palabrasProblema.some(p => texto.includes(p))) {
      return null;
    }

    const match =
      msg.match(/(?:averiado|averiada|falla|problema|reparar|arreglar|revision|revisión|cambio|mantenimiento)\s+(?:de\s+|la\s+|el\s+)?(.+)/i);

    if (match && match[1]) {
      return match[1].trim();
    }

    return msg.trim();
  }

  function obtenerPerfilCliente(usuarioId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT cliente_nombre, cliente_telefono, vehiculo_texto, motivo, fecha, hora
        FROM citas
        WHERE usuario_id = ?
        AND cliente_nombre IS NOT NULL
        ORDER BY id DESC
        LIMIT 1
      `;

      db.query(sql, [usuarioId], (err, results) => {
        if (err) return reject(err);
        resolve(results[0] || null);
      });
    });
  }

  function obtenerEstadoCitaTemporal(usuarioId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT *
        FROM estado_cita_temporal
        WHERE usuario_id = ?
        LIMIT 1
      `;

      db.query(sql, [usuarioId], (err, results) => {
        if (err) return reject(err);
        resolve(results[0] || null);
      });
    });
  }

  function contieneFechaHora(message) {
      return /\d{4}-\d{2}-\d{2}/.test(message) && /\d{2}:\d{2}/.test(message);
    }

function pareceConsultaExterna(intent) {
  return (
    intent === 'services' ||
    intent === 'inventory' ||
    intent === 'schedule' ||
    intent === 'info'
  );
}

const {
  getOrCreateSession,
  saveMessage,
  updateConversationContext,
  getLastContext,
  getConversationMessages
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

    const telefonoDetectado = extraerTelefonoDesdeMensaje(userMsg);

    if (telefonoDetectado) {
      const clienteGuardado = await obtenerClientePorTelefono(telefonoDetectado);

      if (clienteGuardado) {
        usuario.nombre = clienteGuardado.nombre;
        usuario.telefono = clienteGuardado.telefono;

        await guardarNombreUsuario(usuario.id, clienteGuardado.nombre);
      }
    }

    const nombreDetectado = extraerNombreDesdeMensaje(userMsg);

    if (nombreDetectado) {
      await guardarNombreUsuario(usuario.id, nombreDetectado);
      usuario.nombre = nombreDetectado;
    }

    if (preguntaPorNombre(userMsg)) {
      const nombreGuardado = await obtenerNombreUsuario(usuario.id);

      const respuestaIA =
        nombreGuardado && nombreGuardado !== 'Visitante web'
          ? `Sí 😊 Tu nombre registrado es ${nombreGuardado}.`
          : 'Aún no tengo tu nombre registrado. Puedes decirme: “mi nombre es Miguel”.';

      const tiempoRespuesta = Date.now() - inicio;

      await saveMessage(conversacion.id, "usuario", userMsg, "memory", null);
      await saveMessage(conversacion.id, "bot", respuestaIA, "memory", tiempoRespuesta);

      return res.json({
        reply: respuestaIA,
        intent: "memory",
        response_time_ms: tiempoRespuesta
      });
    }

    const perfilCliente = await obtenerPerfilCliente(usuario.id);

    if (esSaludo(userMsg) && perfilCliente) {
      const respuestaIA =
    `Hola ${perfilCliente.cliente_nombre} 👋
    Bienvenido nuevamente a Taller Reyes Polo.

    Veo que anteriormente registraste este vehículo:
    🚗 ${perfilCliente.vehiculo_texto}

    Tu última consulta fue sobre:
    🛠️ ${perfilCliente.motivo}

    ¿Deseas agendar otra cita o consultar algún servicio/repuesto?`;

      const tiempoRespuesta = Date.now() - inicio;

      await saveMessage(conversacion.id, "usuario", userMsg, "saludo", null);
      await saveMessage(conversacion.id, "bot", respuestaIA, "saludo", tiempoRespuesta);

      await guardarMetrica({
        conversacion_id: conversacion.id,
        pregunta: userMsg,
        respuesta: respuestaIA,
        intencion_detectada: "saludo",
        tiempo_respuesta_ms: tiempoRespuesta
      });

      return res.json({
        reply: respuestaIA,
        intent: "saludo",
        response_time_ms: tiempoRespuesta
      });
    }

    let intent = classifyIntent(userMsg);
    const lastContext = getLastContext(conversacion);

    const ultimosMensajes = await getConversationMessages(conversacion.id, 8);

    const contextoConversacion = ultimosMensajes
      .map(m => `${m.remitente}: ${m.mensaje}`)
      .join('\n');

    const mensajeCierre = ['ok', 'okay', 'okey', 'gracias', 'listo', 'ya', 'perfecto'];

    if (
      mensajeCierre.includes(userMsg.toLowerCase().trim()) &&
      lastContext?.intent === 'appointment_completed'
    ) {
      const respuestaIA = 'Perfecto 😊 Tu cita ya quedó registrada. Si necesitas consultar otra cosa, aquí estoy.';

      const tiempoRespuesta = Date.now() - inicio;

      await saveMessage(conversacion.id, "usuario", userMsg, "cierre", null);
      await saveMessage(conversacion.id, "bot", respuestaIA, "cierre", tiempoRespuesta);

      return res.json({
        reply: respuestaIA,
        intent: "cierre",
        response_time_ms: tiempoRespuesta
      });
    }

    const estadoCitaTemporal = await obtenerEstadoCitaTemporal(usuario.id);

    if (estadoCitaTemporal) {
      const paso = estadoCitaTemporal.paso;

      const mensajeEsFechaValida =
        paso === 'fecha' && contieneFechaHora(userMsg);

      const mensajeEsTelefonoValido =
        paso === 'telefono' && extraerTelefonoDesdeMensaje(userMsg);

      const pasoPermiteTextoLibre =
        paso === 'nombre' ||
        paso === 'vehiculo' ||
        paso === 'motivo';

      if (
        pareceConsultaExterna(intent) &&
        !mensajeEsFechaValida &&
        !mensajeEsTelefonoValido &&
        !pasoPermiteTextoLibre
      ) {
        const respuestaIA =
    `Primero terminemos de agendar tu cita 😊

    Actualmente estoy esperando este dato:
    ${paso === 'nombre' ? '👤 tu nombre' : ''}
    ${paso === 'telefono' ? '📞 tu número de teléfono' : ''}
    ${paso === 'vehiculo' ? '🚗 tu vehículo' : ''}
    ${paso === 'fecha' ? '📅 la fecha y hora de tu cita' : ''}

    Luego con gusto respondo tu consulta adicional.`;

        const tiempoRespuesta = Date.now() - inicio;

        await saveMessage(conversacion.id, "usuario", userMsg, "appointment_pending", null);
        await saveMessage(conversacion.id, "bot", respuestaIA, "appointment_pending", tiempoRespuesta);

        await guardarMetrica({
          conversacion_id: conversacion.id,
          pregunta: userMsg,
          respuesta: respuestaIA,
          intencion_detectada: "appointment_pending",
          tiempo_respuesta_ms: tiempoRespuesta
        });

        return res.json({
          reply: respuestaIA,
          intent: "appointment_pending",
          response_time_ms: tiempoRespuesta
        });
      }
    }

    if (intent === "follow_up" && conversacion.ultima_intencion) {
      intent = conversacion.ultima_intencion;
    }

    let agentResult;

    // CITAS
      let citaResult = null;

      if (intent === "appointment" || estadoCitaTemporal) {
        citaResult = await appointmentAgent(userMsg, usuario.id, lastContext);
      }

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
      agente_seleccionado: agentSkills[intent] || agentSkills.info,
      resultado_agente: agentResult,
      contexto_anterior: lastContext
    };

    let respuestaIA;

    // Si el agente ya respondió directamente
    if (agentResult?.directReply) {

      respuestaIA = agentResult.directReply;

    } else {

      respuestaIA = await aiService.generarRespuesta(
        `
      ${JSON.stringify(contextoIA)}

      Conversación reciente:
      ${contextoConversacion}
      `,
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

    await guardarMetrica({
      conversacion_id: conversacion.id,
      pregunta: userMsg,
      respuesta: respuestaIA,
      intencion_detectada: intent,
      tiempo_respuesta_ms: tiempoRespuesta
    });

    const vehiculoDetectado = extraerVehiculoDesdeMensaje(userMsg);
    const motivoDetectado = extraerMotivoDesdeMensaje(userMsg);

    const intentFinal = respuestaIA.includes('Tu cita fue registrada correctamente')
      ? 'appointment_completed'
      : intent;

    const nuevoContexto = {
      keyword: agentResult?.keyword || lastContext?.keyword || null,
      intent: intentFinal,
      vehiculo: vehiculoDetectado || lastContext?.vehiculo || null,
      motivo: motivoDetectado || lastContext?.motivo || null,
      data: agentResult?.data ? agentResult.data.slice(0, 3) : []
    };

    await updateConversationContext(conversacion.id, intentFinal, nuevoContexto);

    res.json({
      reply: respuestaIA,
      intent: intentFinal,
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