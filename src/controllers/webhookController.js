const db = require('../config/database');
const aiService = require('../services/aiService');
const { guardarMetrica } = require('../services/metricsService');

const { classifyIntent } = require('../agents/classifierAgent');
const {obtenerHoraPeru, obtenerFechaActualPeru, obtenerDiaActualPeru} = require('../utils/time');
const {obtenerContextoUsuario, guardarContextoUsuario} = require('../agents/contextAgent');
const inventoryAgent = require('../agents/inventoryAgent');
const servicesAgent = require('../agents/servicesAgent');
const scheduleAgent = require('../agents/scheduleAgent');
const infoAgent = require('../agents/infoAgent');
const appointmentAgent = require('../agents/appointmentAgent');

const agentSkills = require('../agents/agentSkills');

const {
  extraerNombre,
  extraerTelefono,
  extraerVehiculo,
  extraerMotivo
} = require('../utils/dataExtractor');

  function esSaludo(message) {
    const msg = String(message || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[¿?¡!.,]/g, '')
      .trim();

    return [
      'hola',
      'buenas',
      'buenos dias',
      'buenas tardes',
      'buenas noches'
    ].includes(msg);
  }

  function esSaludoConversacional(message) {
    const msg = String(message || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[¿?¡!.,]/g, '')
      .trim();

    return (
      msg.includes('como estas') ||
      msg.includes('que tal') ||
      msg.includes('como te va') ||
      msg.includes('como andas') ||
      msg.includes('todo bien')
    );
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


  function preguntaPorNombre(message) {
    const msg = String(message || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return (
      msg.includes('como me llamo') ||
      msg.includes('como me llamaba') ||
      msg.includes('como me llamabas') ||
      msg.includes('cual es mi nombre') ||
      msg.includes('sabes mi nombre') ||
      msg.includes('recuerdas mi nombre') ||
      msg.includes('te acuerdas de mi nombre') ||
      msg.includes('dime mi nombre') ||
      msg.includes('quien soy') ||
      msg.includes('sabes quien soy')
    );
  }

    function preguntaPorTelefono(message) {
    const msg = String(message || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return (
      msg.includes('cual es mi telefono') ||
      msg.includes('cual es mi numero') ||
      msg.includes('sabes mi telefono') ||
      msg.includes('recuerdas mi telefono') ||
      msg.includes('mi numero de celular') ||
      msg.includes('mi celular') ||
      msg.includes('que telefono tengo registrado')
    );
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

    const canal = req.body.canal || 'texto';
    const sttExitoso = req.body.stt_exitoso ?? 1;
    const ttsExitoso = req.body.tts_exitoso ?? 1;

    const textoFechaHora = String(userMsg || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

    if (
      textoFechaHora.includes('que fecha es hoy') ||
      textoFechaHora.includes('qué fecha es hoy') ||
      textoFechaHora.includes('que fecha estamos') ||
      textoFechaHora.includes('qué fecha estamos') ||
      textoFechaHora.includes('que dia es hoy') ||
      textoFechaHora.includes('qué día es hoy') ||
      textoFechaHora.includes('hoy que dia es') ||
      textoFechaHora.includes('que dia estamos') ||
      textoFechaHora.includes('qué día estamos') ||
      textoFechaHora.includes('hora actual') ||
      textoFechaHora.includes('que hora es') ||
      textoFechaHora.includes('qué hora es')
    ) {
      return res.json({
        reply:
    `📅 Fecha actual Perú:
    ${obtenerDiaActualPeru()} ${obtenerFechaActualPeru()}

    ⏰ Hora actual Perú:
    ${obtenerHoraPeru()}`,
        intent: 'datetime',
        response_time_ms: Date.now() - inicio
      });
    }

    const { usuario, conversacion } = await getOrCreateSession(sessionId);

    const contextoPersistente = await obtenerContextoUsuario(usuario.id);

    if (esSaludoConversacional(userMsg)) {
      const respuestaIA =
        `Muy bien, gracias por preguntar 😊 ¿En qué puedo ayudarte hoy?`;

      const tiempoRespuesta = Date.now() - inicio;

      await saveMessage(conversacion.id, "usuario", userMsg, "saludo", null);
      await saveMessage(conversacion.id, "bot", respuestaIA, "saludo", tiempoRespuesta);

      return res.json({
        reply: respuestaIA,
        intent: "saludo",
        response_time_ms: tiempoRespuesta
      });
    }

    const telefonoDetectado = extraerTelefono(userMsg);

    if (telefonoDetectado) {
      const clienteGuardado = await obtenerClientePorTelefono(telefonoDetectado);

      if (clienteGuardado) {
        usuario.nombre = clienteGuardado.nombre;
        usuario.telefono = clienteGuardado.telefono;

        await guardarNombreUsuario(usuario.id, clienteGuardado.nombre);
      }
    }

    if (telefonoDetectado) {
      await guardarContextoUsuario(usuario.id, conversacion.id, {
        ...contextoPersistente,
        telefono: telefonoDetectado
      });
    }

    const textoNormalizado = String(userMsg || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const mensajeDeclaraNombre =
      textoNormalizado.includes('mi nombre es') ||
      textoNormalizado.includes('me llamo') ||
      textoNormalizado.startsWith('soy ');

    const nombreDetectado = mensajeDeclaraNombre
      ? extraerNombre(userMsg)
      : null;

    if (
      nombreDetectado &&
      !esSaludo(userMsg) &&
      nombreDetectado.toLowerCase() !== 'hola'
    ) {
      await guardarNombreUsuario(usuario.id, nombreDetectado);
      usuario.nombre = nombreDetectado;
    }

    if (preguntaPorNombre(userMsg)) {
      const contextoActual = await obtenerContextoUsuario(usuario.id);

      let nombreGuardado =
        usuario.nombre ||
        contextoActual?.nombre ||
        null;

      if (!nombreGuardado || nombreGuardado === 'Visitante web' || nombreGuardado === 'Sabes') {
        nombreGuardado = null;
      }

      const respuestaIA = nombreGuardado
        ? `Sí 😊 Tu nombre registrado es ${nombreGuardado}.`
        : 'Aún no tengo tu nombre registrado. Puedes decirme: “mi nombre es Walter”.';

      const tiempoRespuesta = Date.now() - inicio;

      await saveMessage(conversacion.id, "usuario", userMsg, "memory", null);
      await saveMessage(conversacion.id, "bot", respuestaIA, "memory", tiempoRespuesta);

      return res.json({
        reply: respuestaIA,
        intent: "memory",
        response_time_ms: tiempoRespuesta
      });
    }

    if (preguntaPorTelefono(userMsg)) {
      const contextoActual = await obtenerContextoUsuario(usuario.id);

      const telefonoGuardado =
        extraerTelefono(usuario.telefono) ||
        extraerTelefono(contextoActual?.telefono) ||
        null;

      const telefonoParaVoz = telefonoGuardado
      ? telefonoGuardado.split('').join(' ')
      : null;

    const respuestaIA = telefonoGuardado
      ? canal.includes('voz')
        ? `Sí 😊 Tu teléfono registrado es ${telefonoParaVoz}. Repito: ${telefonoParaVoz}.`
        : `Sí 😊 Tu teléfono registrado es ${telefonoGuardado}.`
      : 'Aún no tengo tu teléfono registrado. Por favor dime tu celular de 9 dígitos. Ejemplo: 987654321.';

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
        tiempo_respuesta_ms: tiempoRespuesta,
        canal,
        stt_exitoso: sttExitoso,
        tts_exitoso: ttsExitoso
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
      paso === 'telefono' &&
      extraerTelefono(userMsg);

      const pasoPermiteTextoLibre =
        paso === 'nombre' ||
        paso === 'vehiculo' ||
        paso === 'motivo' ||
        paso === 'confirmar_vehiculo';

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
    ${paso === 'confirmar_vehiculo' ? '🚗 confirmar si usarás el vehículo registrado' : ''}

    Luego con gusto respondo tu consulta adicional.`;

        const tiempoRespuesta = Date.now() - inicio;

        await saveMessage(conversacion.id, "usuario", userMsg, "appointment_pending", null);
        await saveMessage(conversacion.id, "bot", respuestaIA, "appointment_pending", tiempoRespuesta);

        await guardarMetrica({
          conversacion_id: conversacion.id,
          pregunta: userMsg,
          respuesta: respuestaIA,
          intencion_detectada: "appointment_pending",
          tiempo_respuesta_ms: tiempoRespuesta,
          canal,
          stt_exitoso: sttExitoso,
          tts_exitoso: ttsExitoso
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
      citaResult = await appointmentAgent(userMsg, usuario.id, {
        ...lastContext,
        ...contextoPersistente,
        nombre: usuario.nombre || contextoPersistente?.nombre || lastContext?.nombre || null,
        telefono: contextoPersistente?.telefono || usuario.telefono || lastContext?.telefono || null
      });
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
      tiempo_respuesta_ms: tiempoRespuesta,
      canal,
      stt_exitoso: sttExitoso,
      tts_exitoso: ttsExitoso
    });

    const vehiculoDetectado = extraerVehiculo(userMsg);
    const motivoDetectado = extraerMotivo(userMsg);

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

    await guardarContextoUsuario(usuario.id, conversacion.id, {
      nombre: usuario.nombre && usuario.nombre !== 'Visitante web' ? usuario.nombre : null,
      telefono: telefonoDetectado || contextoPersistente?.telefono || null,
      vehiculo: vehiculoDetectado || contextoPersistente?.vehiculo || lastContext?.vehiculo || null,
      motivo: motivoDetectado || contextoPersistente?.motivo || lastContext?.motivo || null,
      ultimo_intent: intentFinal,
      ultimo_tema: agentResult?.keyword || motivoDetectado || vehiculoDetectado || null,
      datos_json: nuevoContexto
    });

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