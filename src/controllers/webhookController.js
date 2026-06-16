// ─────────────────────────────────────────────
// UTILIDADES DE BASE DE DATOS
// ─────────────────────────────────────────────

const db = require('../config/database');

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
}

// ─────────────────────────────────────────────
// SERVICIOS Y AGENTES
// ─────────────────────────────────────────────

const aiService = require('../services/aiService');
const { guardarMetrica } = require('../services/metricsService');

const { classifyIntent } = require('../agents/classifierAgent');
const { obtenerHoraPeru, obtenerFechaActualPeru, obtenerDiaActualPeru } = require('../utils/time');
const { obtenerContextoUsuario, guardarContextoUsuario } = require('../agents/contextAgent');
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

const {
  getOrCreateSession,
  saveMessage,
  updateConversationContext,
  getLastContext,
  getConversationMessages
} = require('../agents/memoryAgent');

// ─────────────────────────────────────────────
// UTILIDADES DE TEXTO
// ─────────────────────────────────────────────

function normalizarBase(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ─────────────────────────────────────────────
// DETECCIÓN DE SALUDOS
// ─────────────────────────────────────────────

function esSaludo(message) {
  const msg = normalizarBase(message)
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
  const msg = normalizarBase(message)
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

// ─────────────────────────────────────────────
// USUARIO Y CLIENTE EN BASE DE DATOS
// ─────────────────────────────────────────────

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

// (Disponible pero actualmente no se usa en procesarMensaje)
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

// ─────────────────────────────────────────────
// DETECCIÓN DE PREGUNTAS SOBRE DATOS / CITAS DEL USUARIO
// ─────────────────────────────────────────────

function preguntaPorDatosPersonales(mensaje) {
  const msg = normalizarBase(mensaje);

  return (
    msg.includes('que datos tienes de mi') ||
    msg.includes('que datos sabes de mi') ||
    msg.includes('que datos sabes sobre mi') ||
    msg.includes('mis datos') ||
    msg.includes('mi telefono') ||
    msg.includes('mi celular') ||
    msg.includes('mi vehiculo') ||
    msg.includes('que vehiculo tengo') ||
    msg.includes('sabes que vehiculo tengo')
  );
}

function preguntaPorNombre(message) {
  const msg = normalizarBase(message);

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
  const msg = normalizarBase(message);

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

function preguntaPorCitaExistente(mensaje) {
  const msg = normalizarBase(mensaje);

  return (
    msg.includes('tengo una cita') ||
    msg.includes('tengo cita') ||
    msg.includes('tengo alguna cita') ||
    msg.includes('tengo algun agendamiento') ||
    msg.includes('tengo algún agendamiento') ||

    msg.includes('cuando es mi cita') ||
    msg.includes('cuando tengo cita') ||
    msg.includes('cuando tengo mi cita') ||

    msg.includes('mi cita') ||
    msg.includes('mis citas') ||
    msg.includes('mis citas agendadas') ||
    msg.includes('citas agendadas') ||
    msg.includes('citas pendientes') ||

    msg.includes('que citas tengo') ||
    msg.includes('qué citas tengo') ||
    msg.includes('quiero saber mis citas') ||
    msg.includes('quiero ver mis citas') ||
    msg.includes('ver mi cita') ||
    msg.includes('ver mis citas') ||
    msg.includes('consultar mi cita') ||
    msg.includes('consultar mis citas')
  );
}

function quiereCancelarCitaPorNumero(mensaje) {
  const msg = normalizarBase(mensaje);

  const match = msg.match(/cancelar\s+(?:la\s+)?cita\s+(\d+)/);

  return match ? Number(match[1]) : null;
}

// ─────────────────────────────────────────────
// PERFIL DEL CLIENTE Y ESTADO DE CITA TEMPORAL
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// CONTROLADOR PRINCIPAL
// ─────────────────────────────────────────────

async function procesarMensaje(req, res) {
  const inicio = Date.now();

  try {
    // ── 1. Mensaje entrante y validación de sesión por DNI ──
    const userMsg =
      req.body.user_message ||
      req.body.message ||
      req.body.text ||
      req.body.content ||
      "Hola";

    const sessionId = req.body.session_id;

    const canal = req.body.canal || 'texto';

    const canalesCliente = ['texto', 'voz', 'voz-simli', 'voz-retell'];

    if (canalesCliente.includes(canal)) {
      if (!sessionId || !/^dni_\d{8}$/.test(sessionId)) {
        return res.status(401).json({
          reply: 'Primero debes identificarte con tu DNI para usar el chatbot.',
          intent: 'auth_required'
        });
      }
    }

    const sttExitoso = req.body.stt_exitoso ?? 1;
    const ttsExitoso = req.body.tts_exitoso ?? 1;

    // ── 2. Atajo: fecha y hora actual ──
    const textoFechaHora = normalizarBase(userMsg);

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
        reply: `📅 Fecha actual Perú:
${obtenerDiaActualPeru()} ${obtenerFechaActualPeru()}

⏰ Hora actual Perú:
${obtenerHoraPeru()}`,
        intent: 'datetime',
        response_time_ms: Date.now() - inicio
      });
    }

    // ── 3. Sesión, usuario y contexto persistente ──
    const { usuario, conversacion } = await getOrCreateSession(sessionId);

    const contextoPersistente = await obtenerContextoUsuario(usuario.id);

    // ── 4. Saludo conversacional ("¿cómo estás?") ──
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

    // ── 5. Detección de teléfono en el mensaje ──
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

    // ── 6. Detección de nombre declarado por el usuario ──
    const textoNormalizado = normalizarBase(userMsg);

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

    // ── 7. Preguntas sobre datos personales / nombre / teléfono guardados ──
    if (preguntaPorDatosPersonales(userMsg)) {
      const contextoActual = await obtenerContextoUsuario(usuario.id);

      const nombre = usuario.nombre && usuario.nombre !== 'Visitante web'
        ? usuario.nombre
        : contextoActual?.nombre || 'No registrado';

      const telefono = contextoActual?.telefono || usuario.telefono || 'No registrado';
      // ⚠️ revisar: 'usuario.nombre_vehiculo' no parece existir en el esquema de 'usuarios'
      // (el vehículo se guarda en citas.vehiculo_texto / clientes.vehiculo_modelo)
      const vehiculo = contextoActual?.vehiculo || usuario.nombre_vehiculo || 'No registrado';
      const motivo = contextoActual?.motivo || null;

      let respuestaIA = `Nombre: ${nombre}
Teléfono: ${telefono}
Vehículo registrado: ${vehiculo}
${motivo ? `Motivo reciente: ${motivo}` : ''}`.trim();

      const tiempoRespuesta = Date.now() - inicio;

      await saveMessage(conversacion.id, "usuario", userMsg, "memory", null);
      await saveMessage(conversacion.id, "bot", respuestaIA, "memory", tiempoRespuesta);

      return res.json({
        reply: respuestaIA,
        intent: "memory",
        response_time_ms: tiempoRespuesta
      });
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

    // ── 8. Saludo inicial con perfil de cliente ya existente ──
    const perfilCliente = await obtenerPerfilCliente(usuario.id);

    if (esSaludo(userMsg) && perfilCliente) {
      const respuestaIA = `Hola ${perfilCliente.cliente_nombre} 👋
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

    // ── 9. Clasificación de intención + contexto reciente ──
    let intent = classifyIntent(userMsg);
    const lastContext = getLastContext(conversacion);

    const ultimosMensajes = await getConversationMessages(conversacion.id, 8);

    const contextoConversacion = ultimosMensajes
      .map(m => `${m.remitente}: ${m.mensaje}`)
      .join('\n');

    // ── 10. Mensajes de cierre tras una cita ya completada ──
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

    // ── 11.5 Cancelar cita por número ──
    const numeroCitaACancelar = quiereCancelarCitaPorNumero(userMsg);

    if (numeroCitaACancelar) {
      const citas = await query(
        `
        SELECT id, fecha, hora, motivo, vehiculo_texto
        FROM citas
        WHERE usuario_id = ?
          AND estado IN ('pendiente', 'confirmada')
        ORDER BY fecha ASC, hora ASC
        LIMIT 5
        `,
        [usuario.id]
      );

      const citaSeleccionada = citas[numeroCitaACancelar - 1];

      if (!citaSeleccionada) {
        return res.json({
          reply: `No encontré una cita número ${numeroCitaACancelar}. Primero escribe: "quiero saber mis citas agendadas".`,
          intent: "appointment_cancel"
        });
      }

      await query(
        `UPDATE citas SET estado = 'cancelada' WHERE id = ?`,
        [citaSeleccionada.id]
      );

      return res.json({
        reply:
    `✅ Cancelé tu cita correctamente.

    🚗 Vehículo: ${citaSeleccionada.vehiculo_texto}
    🔧 Servicio: ${citaSeleccionada.motivo}
    📅 Fecha: ${new Date(citaSeleccionada.fecha).toLocaleDateString('es-PE')}
    ⏰ Hora: ${String(citaSeleccionada.hora).slice(0, 5)}`,
        intent: "appointment_cancelled"
      });
    }

    // ── 12. Consulta de cita ya existente ──
    if (preguntaPorCitaExistente(userMsg)) {
      const citas = await query(
        `
        SELECT id, fecha, hora, estado, motivo, cliente_nombre, cliente_telefono, vehiculo_texto
        FROM citas
        WHERE usuario_id = ?
          AND estado IN ('pendiente', 'confirmada')
        ORDER BY fecha ASC, hora ASC
        LIMIT 5
        `,
        [usuario.id]
      );

      const tiempoRespuesta = Date.now() - inicio;

      let respuestaIA;

      if (!citas.length) {
  respuestaIA = 'No encontré citas pendientes o confirmadas a tu nombre. Si deseas, puedo ayudarte a agendar una nueva cita.';
      } else {
        respuestaIA = `Sí 😊 Tienes estas citas registradas:\n\n` +
          citas.map((cita, index) => {
            const fechaFormateada = new Date(cita.fecha).toLocaleDateString('es-PE');

            return `${index + 1}. 
      👤 Cliente: ${cita.cliente_nombre || usuario.nombre || 'No registrado'}
      📞 Teléfono: ${cita.cliente_telefono || 'No registrado'}
      🚗 Vehículo: ${cita.vehiculo_texto || 'No registrado'}
      🔧 Servicio: ${cita.motivo || 'No registrado'}
      📅 Fecha: ${fechaFormateada}
      ⏰ Hora: ${String(cita.hora).slice(0, 5)}
      📌 Estado: ${cita.estado}`;
          }).join('\n\n') +
          `\n\nSi deseas cancelar una, dime por ejemplo: "cancelar la cita 2".`;
      }

      await saveMessage(conversacion.id, "usuario", userMsg, "appointment_query", null);
      await saveMessage(conversacion.id, "bot", respuestaIA, "appointment_query", tiempoRespuesta);

      return res.json({
        reply: respuestaIA,
        intent: "appointment_query",
        response_time_ms: tiempoRespuesta
      });
    }

    // ── 11. Flujo activo de agendamiento (estado_cita_temporal) ──
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
        const respuestaIA = `Primero terminemos de agendar tu cita 😊

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

    // ── 13. Enrutamiento a agentes según intención ──

    // CITAS
    let citaResult = null;

    const textoParaRuta = normalizarBase(userMsg)
      .replace(/[¿?¡!.,]/g, '')
      .trim();

    const esCancelacionFlujo =
      textoParaRuta === 'cancelar' ||
      textoParaRuta === 'salir' ||
      textoParaRuta === 'detener' ||
      textoParaRuta.includes('cancelar agendamiento') ||
      textoParaRuta.includes('cancelar proceso') ||
      textoParaRuta.includes('ya no quiero agendar');

    if (intent === "appointment" || estadoCitaTemporal || esCancelacionFlujo) {
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

    // ── 14. Generación de la respuesta final (agente directo o IA) ──
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

    // ── 15. Guardado de mensajes, métricas y contexto ──
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

    const textoParaFiltro = normalizarBase(userMsg);

    const pareceMotivoServicio =
      textoParaFiltro.includes('revision') ||
      textoParaFiltro.includes('mantenimiento') ||
      textoParaFiltro.includes('suspension') ||
      textoParaFiltro.includes('motor') ||
      textoParaFiltro.includes('freno') ||
      textoParaFiltro.includes('aceite') ||
      textoParaFiltro.includes('falla') ||
      textoParaFiltro.includes('problema') ||
      textoParaFiltro.includes('reparar') ||
      textoParaFiltro.includes('arreglar');

    const vehiculoSeguroFinal =
      pareceMotivoServicio
        ? null
        : vehiculoDetectado;

    const preguntaMemoriaPersonal =
      textoParaFiltro.includes('que datos') ||
      textoParaFiltro.includes('mis datos') ||
      textoParaFiltro.includes('que vehiculo') ||
      textoParaFiltro.includes('que carro') ||
      textoParaFiltro.includes('mi vehiculo') ||
      textoParaFiltro.includes('mi carro') ||
      textoParaFiltro.includes('que celular') ||
      textoParaFiltro.includes('cual es mi celular') ||
      textoParaFiltro.includes('mi celular cual') ||
      textoParaFiltro.includes('que telefono') ||
      textoParaFiltro.includes('cual es mi telefono') ||
      textoParaFiltro.includes('mi telefono cual') ||
      textoParaFiltro.includes('mi numero') ||
      textoParaFiltro.includes('mi nombre');

    const esCancelacion =
      textoParaFiltro.includes('cancelar') ||
      textoParaFiltro.includes('ya no quiero') ||
      textoParaFiltro.includes('no quiero cita') ||
      textoParaFiltro.includes('no deseo agendar') ||
      textoParaFiltro.includes('anular');

    const pareceFechaHora =
      textoParaFiltro.includes('manana') ||
      textoParaFiltro.includes('hoy') ||
      textoParaFiltro.includes('lunes') ||
      textoParaFiltro.includes('martes') ||
      textoParaFiltro.includes('miercoles') ||
      textoParaFiltro.includes('jueves') ||
      textoParaFiltro.includes('viernes') ||
      textoParaFiltro.includes('sabado') ||
      textoParaFiltro.includes('domingo') ||
      /\b\d{4}-\d{2}-\d{2}\b/.test(textoParaFiltro) ||
      /\b\d{1,2}\s*(am|pm)\b/.test(textoParaFiltro) ||
      textoParaFiltro.includes('de la manana') ||
      textoParaFiltro.includes('de la tarde') ||
      textoParaFiltro.includes('de la noche');

    const noDebeGuardarComoMotivo =
      preguntaMemoriaPersonal ||
      esCancelacion ||
      pareceFechaHora;

    const motivoSeguroFinal =
      !noDebeGuardarComoMotivo
        ? (motivoDetectado || (pareceMotivoServicio ? userMsg : null))
        : null;

    const intentFinal = respuestaIA.includes('Tu cita fue registrada correctamente')
      ? 'appointment_completed'
      : intent;

    const nuevoContexto = {
      keyword: agentResult?.keyword || lastContext?.keyword || null,
      intent: intentFinal,
      vehiculo: vehiculoSeguroFinal || lastContext?.vehiculo || contextoPersistente?.vehiculo || null,
      motivo: motivoSeguroFinal || lastContext?.motivo || contextoPersistente?.motivo || null,
      data: agentResult?.data ? agentResult.data.slice(0, 3) : []
    };

    await updateConversationContext(conversacion.id, intentFinal, nuevoContexto);

    const textoLimpio = normalizarBase(userMsg)
      .replace(/[!?.,]/g, '')
      .trim();

    const esMensajeCortoBasura =
      textoLimpio.length <= 20 &&
      (
        /^hola+a*$/.test(textoLimpio) ||
        textoLimpio === 'buenas' ||
        textoLimpio === 'buenos dias' ||
        textoLimpio === 'buenas tardes' ||
        textoLimpio === 'buenas noches' ||
        textoLimpio === 'gracias' ||
        textoLimpio === 'ok' ||
        textoLimpio === 'vale'
      );

    const vehiculoSeguro =
      !esMensajeCortoBasura && vehiculoDetectado
        ? vehiculoDetectado
        : null;

    const motivoSeguro =
      !esMensajeCortoBasura && motivoDetectado
        ? motivoDetectado
        : null;

    const ultimoTemaSeguro =
      !esMensajeCortoBasura
        ? (agentResult?.keyword || motivoSeguro || vehiculoSeguro || null)
        : null;

    await guardarContextoUsuario(usuario.id, conversacion.id, {
      nombre: usuario.nombre && usuario.nombre !== 'Visitante web' ? usuario.nombre : null,
      telefono: telefonoDetectado || contextoPersistente?.telefono || null,
      vehiculo: vehiculoSeguroFinal || contextoPersistente?.vehiculo || lastContext?.vehiculo || null,
      motivo: motivoSeguroFinal || contextoPersistente?.motivo || lastContext?.motivo || null,
      ultimo_intent: intentFinal,
      ultimo_tema: ultimoTemaSeguro,
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