const db = require('../config/database');
const { crearEventoCita } = require('../services/googleCalendarService');

const {
  extraerTelefono,
  telefonoValido,
  extraerNombre,
  extraerVehiculo,
  extraerMotivo
} = require('../utils/dataExtractor');

// ─────────────────────────────────────────────
// UTILIDADES DE BASE DE DATOS
// ─────────────────────────────────────────────

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

// ─────────────────────────────────────────────
// UTILIDADES DE TEXTO
// ─────────────────────────────────────────────

function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

// ─────────────────────────────────────────────
// DETECCIÓN DE INTENCIONES
// ─────────────────────────────────────────────

function detectarIntencionCita(msg) {
  const texto = normalizar(msg);
  const preguntaConsultaCita =
    texto.includes('tengo alguna cita') ||
    texto.includes('tengo una cita') ||
    texto.includes('cuando es mi cita') ||
    texto.includes('cuándo es mi cita') ||
    texto.includes('cita agendada') ||
    texto.includes('cita registrada');

  if (preguntaConsultaCita) return false;
  
  return (
    /\bcita\b/.test(texto) ||
    /\bcitas\b/.test(texto) ||
    texto.includes('reserva') ||
    texto.includes('reservar') ||
    texto.includes('reservame') ||
    texto.includes('agendar') ||
    texto.includes('programar') ||
    texto.includes('turno') ||
    texto.includes('separar turno') ||
    texto.includes('pasado mañana') ||
    texto.includes('pasado manana') ||
    texto.includes('quiero ir') ||
    texto.includes('puedo ir') ||
    texto.includes('generarme mi reserva') ||
    texto.includes('generar reserva')
  );
}

function rechazaAgendamiento(msg) {
  const texto = normalizar(msg);
  return (
    texto.includes('no quiero cita') ||
    texto.includes('no quiero agendar') ||
    texto.includes('no necesito agendar') ||
    texto.includes('no deseo agendar') ||
    texto.includes('no deseo cita') ||
    texto.includes('no necesito cita') ||
    texto.includes('no quiero registrar cita') ||
    texto.includes('solo quiero consultar') ||
    texto.includes('solo quiero saber')
  );
}

function quiereCancelarFlujoActivo(msg) {
  const texto = normalizar(msg);
  return (
    texto === 'cancelar' ||
    texto === 'salir' ||
    texto === 'detener' ||
    texto.includes('cancelar proceso') ||
    texto.includes('cancelar agendamiento') ||
    texto.includes('ya no quiero agendar') ||
    texto.includes('ya no deseo agendar') ||
    texto.includes('no quiero agendar') ||
    texto.includes('no deseo registrar cita') ||
    texto.includes('salir del agendamiento') ||
    texto.includes('detener agendamiento')
  );
}

function quiereCancelarCitaExistente(msg) {
  const texto = normalizar(msg);
  return (
    texto.includes('cancelar mi cita') ||
    texto.includes('cancelar cita') ||
    texto.includes('anular mi cita') ||
    texto.includes('eliminar mi cita')
  );
}

function confirmarVehiculoSi(msg) {
  const texto = normalizar(msg);
  return (
    texto === '1' ||
    texto === 'si' ||
    texto === 'sí' ||
    texto.includes('usar ese') ||
    texto.includes('mismo vehiculo') ||
    texto.includes('mismo carro') ||
    texto.includes('ese vehiculo') ||
    texto.includes('ese carro')
  );
}

function confirmarVehiculoNo(msg) {
  const texto = normalizar(msg);
  return (
    texto === '2' ||
    texto.includes('no') ||
    texto.includes('otro') ||
    texto.includes('nuevo vehiculo') ||
    texto.includes('nuevo carro') ||
    texto.includes('cambiar vehiculo')
  );
}

function esPreguntaGeneral(msg) {
  const texto = normalizar(msg);
  return (
    texto.includes('como me llamo') ||
    texto.includes('que servicios') ||
    texto.includes('horario') ||
    texto.includes('dias atienden') ||
    texto.includes('dias trabajan') ||
    texto.includes('precio') ||
    texto.includes('cuanto cuesta') ||
    texto.includes('atienden')
  );
}

function preguntaPorVehiculo(msg) {
  const texto = normalizar(msg);
  return (
    texto.includes('mi vehiculo') ||
    texto.includes('mi carro') ||
    texto.includes('que vehiculo tengo') ||
    texto.includes('cual es mi vehiculo') ||
    texto.includes('que carro tengo')
  );
}

function preguntaPorNombre(msg) {
  const texto = normalizar(msg);
  return (
    texto.includes('cual es mi nombre') ||
    texto.includes('como me llamo') ||
    texto.includes('sabes mi nombre') ||
    texto.includes('quien soy')
  );
}

function esRespuestaDeContexto(msg) {
  const texto = normalizar(msg);
  const frases = [
    'ya te dije', 'te dije', 'ya te mencione', 'ya te mencioné',
    'te mencione', 'te mencioné', 'tambien te mencione', 'también te mencioné',
    'arriba esta', 'arriba está', 'ya lo sabes', 'lo dije antes',
    'eso mismo', 'lo mismo'
  ];
  return frases.some(frase => texto.includes(normalizar(frase)));
}

function pareceNombreInvalido(msg) {
  const texto = normalizar(msg);
  const palabrasProhibidas = [
    'mierda', 'carajo', 'puta', 'putamadre', 'webon',
    'huevon', 'idiota', 'imbecil', 'gil', 'ctm', 'ptm', 'xd'
  ];
  const saludos = ['hola', 'hi', 'hello', 'buenas', 'agendar', 'cita', 'reservar'];

  return (
    esPreguntaGeneral(texto) ||
    texto.includes('ya lo sabes') ||
    texto.includes('me conoces') ||
    texto.includes('no te acuerdas') ||
    saludos.includes(texto) ||
    palabrasProhibidas.some(p => texto.includes(p))
  );
}

// ────────────────────────────────────────────
// VALIDACIONES DE TELÉFONO (EMPIEZA)
// ─────────────────────────────────────────────

function esTelefonoValido(msg) {
  const telefono = extraerTelefono(msg);
  return telefonoValido(telefono);
}

// ─────────────────────────────────────────────
// UTILIDADES DE FECHA / HORA
// ─────────────────────────────────────────────

function obtenerAhoraPeru() {
  return new Date(
    new Date().toLocaleString('en-US', { timeZone: 'America/Lima' })
  );
}

function minutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function extraerFecha(msg) {
  const match = msg.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : null;
}

function extraerHora(msg) {
  const match = msg.match(/\d{1,2}:\d{2}/);
  if (!match) return null;
  const [h, m] = match[0].split(':');
  return `${h.padStart(2, '0')}:${m}`;
}

function fechaValidaReal(anio, mes, dia) {
  const fecha = new Date(anio, mes, dia);
  return (
    fecha.getFullYear() === anio &&
    fecha.getMonth() === mes &&
    fecha.getDate() === dia
  );
}

function extraerFechaHoraNatural(msg) {
  const texto = normalizar(msg);
  const ahora = obtenerAhoraPeru();

  const meses = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, setiembre: 8,
    octubre: 9, noviembre: 10, diciembre: 11
  };

  let fecha = extraerFecha(msg);
  let hora = extraerHora(msg);

  if (!fecha) {
    let fechaObj = null;

    if (texto.includes('pasado manana') || texto.includes('pasado mañana')) {
      fechaObj = new Date(ahora);
      fechaObj.setDate(fechaObj.getDate() + 2);

    } else if (texto.includes('manana') || texto.includes('mañana')) {
      fechaObj = new Date(ahora);
      fechaObj.setDate(fechaObj.getDate() + 1);

    } else {
      const matchDiaSemanaNumero = texto.match(
        /\b(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)\s+(\d{1,2})\b/
      );

      if (matchDiaSemanaNumero) {
        const dia = Number(matchDiaSemanaNumero[2]);
        let mes = ahora.getMonth();
        let anio = ahora.getFullYear();

        if (!fechaValidaReal(anio, mes, dia)) {
          return { fecha: null, hora };
        }

        fechaObj = new Date(anio, mes, dia);

        if (fechaObj < new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())) {
          mes += 1;

          if (mes > 11) {
            mes = 0;
            anio += 1;
          }

          if (!fechaValidaReal(anio, mes, dia)) {
            return { fecha: null, hora };
          }

          fechaObj = new Date(anio, mes, dia);
        }

      } else {
        const matchFecha = texto.match(/(\d{1,2})\s+de\s+([a-z]+)/);

        if (matchFecha && meses[matchFecha[2]] !== undefined) {
          const dia = Number(matchFecha[1]);
          const mes = meses[matchFecha[2]];
          const anio = ahora.getFullYear();

          if (!fechaValidaReal(anio, mes, dia)) {
            return { fecha: null, hora };
          }

          fechaObj = new Date(anio, mes, dia);

          if (fechaObj < new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())) {
            fechaObj.setFullYear(anio + 1);
          }
        }
      }
    }

    if (fechaObj) {
      const y = fechaObj.getFullYear();
      const m = String(fechaObj.getMonth() + 1).padStart(2, '0');
      const d = String(fechaObj.getDate()).padStart(2, '0');
      fecha = `${y}-${m}-${d}`;
    }
  }

  if (!hora) {
    const matchHora =
      texto.match(/a las\s+(\d{1,2})(?::(\d{2}))?\s*(de la tarde|de la mañana|de la manana|de la noche|pm|am)?/) ||
      texto.match(/(\d{1,2})(?::(\d{2}))?\s*(de la tarde|de la mañana|de la manana|de la noche|pm|am)/);

    if (matchHora) {
      let h = Number(matchHora[1]);
      const min = matchHora[2] || '00';
      const periodo = matchHora[3] || '';

      if (periodo.includes('tarde') || periodo.includes('noche') || periodo.includes('pm')) {
        if (h < 12) h += 12;
      }

      if (periodo.includes('mañana') || periodo.includes('manana') || periodo.includes('am')) {
        if (h === 12) h = 0;
      }

      hora = `${String(h).padStart(2, '0')}:${min}`;
    }
  }

  return { fecha, hora };
}

function esFechaPasada(fecha, hora) {
  const [y, mo, d] = fecha.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  const fechaCita = new Date(y, mo - 1, d, h, mi);
  return fechaCita < obtenerAhoraPeru();
}

function obtenerDiaSemana(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function validarHorario(fecha, hora) {
  const dia = obtenerDiaSemana(fecha);
  const inicio = minutos(hora);
  const fin = inicio + 120;

  if (dia === 0) {
    return {
      valido: false,
      mensaje: 'Los domingos el taller está cerrado. Por favor elige otro día.'
    };
  }

  if (dia >= 1 && dia <= 5) {
    const entraManana = inicio >= minutos('08:30') && fin <= minutos('13:00');
    const entraTarde  = inicio >= minutos('14:00') && fin <= minutos('18:00');

    if (!entraManana && !entraTarde) {
      return {
        valido: false,
        mensaje:
`Ese horario no está disponible porque puede cruzar el almuerzo o estar fuera del horario de atención.

Horario:
Lunes a viernes:
08:30 a 13:00
14:00 a 18:00`
      };
    }
  }

  if (dia === 6) {
    if (inicio < minutos('08:30') || fin > minutos('14:00')) {
      return {
        valido: false,
        mensaje:
`Ese horario no está disponible para sábado.

Horario sábado:
08:30 a 14:00`
      };
    }
  }

  return { valido: true };
}

// ─────────────────────────────────────────────
// CONSULTAS DE DISPONIBILIDAD
// ─────────────────────────────────────────────

async function existeChoqueHorario(fecha, hora) {
  const citas = await query(
    `SELECT hora FROM citas WHERE fecha = ? AND estado != 'cancelada'`,
    [fecha]
  );

  const inicioNuevo = minutos(hora);
  const finNuevo = inicioNuevo + 120;

  return citas.some(cita => {
    const horaExistente = String(cita.hora).slice(0, 5);
    const inicioExistente = minutos(horaExistente);
    const finExistente = inicioExistente + 120;
    return inicioNuevo < finExistente && finNuevo > inicioExistente;
  });
}

async function obtenerSugerencias(fecha) {
  const dia = obtenerDiaSemana(fecha);

  let posibles = [];
  if (dia >= 1 && dia <= 5) {
    posibles = ['08:30', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
  } else if (dia === 6) {
    posibles = ['08:30', '09:00', '10:00', '11:00', '12:00'];
  } else {
    return [];
  }

  const citas = await query(
    `SELECT hora FROM citas WHERE fecha = ? AND estado != 'cancelada'`,
    [fecha]
  );

  return posibles.filter(horaNueva => {
    const inicioNuevo = minutos(horaNueva);
    const finNuevo = inicioNuevo + 120;
    return !citas.some(cita => {
      const horaExistente = String(cita.hora).slice(0, 5);
      const inicioExistente = minutos(horaExistente);
      const finExistente = inicioExistente + 120;
      return inicioNuevo < finExistente && finNuevo > inicioExistente;
    });
  });
}

// ─────────────────────────────────────────────
// HELPERS DE USUARIO
// ─────────────────────────────────────────────

async function obtenerUsuario(usuarioId) {
  const usuarios = await query(
    `SELECT nombre, telefono FROM usuarios WHERE id = ? LIMIT 1`,
    [usuarioId]
  );
  return usuarios[0] || null;
}

function nombreUsuarioValido(nombre) {
  return nombre && nombre !== 'Visitante web' && nombre.trim().length >= 2;
}

// ─────────────────────────────────────────────
// EXTRACCIÓN DE CITA EN BLOQUE (mensaje único con todos los datos)
// ─────────────────────────────────────────────

function extraerDatosCitaEnBloque(message) {
  const lineas = String(message)
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const { fecha, hora } = extraerFechaHoraNatural(message);
  const telefono = extraerTelefono(message);

  let nombre = null;
  let vehiculo = null;
  let motivo = null;

  if (lineas.length >= 4) {
    const lineaNombre = lineas.find(l =>
      normalizar(l).includes('nombre') ||
      normalizar(l).includes('me llamo') ||
      normalizar(l).includes('soy')
    ) || lineas[0];

    const lineaVehiculo = lineas.find(l =>
      ['toyota', 'nissan', 'hyundai', 'honda', 'kia', 'mazda', 'ford',
       'chevrolet', 'mitsubishi', 'vehiculo', 'vehículo', 'carro']
        .some(marca => normalizar(l).includes(marca))
    );

    const lineaMotivo = lineas.find(l =>
      ['cambio', 'revision', 'revisión', 'mantenimiento', 'motor',
       'freno', 'aceite', 'filtro', 'problema', 'falla', 'reparar']
        .some(kw => normalizar(l).includes(kw))
    );

    nombre   = extraerNombre(lineaNombre);
    vehiculo = extraerVehiculo(lineaVehiculo);
    motivo   = extraerMotivo(lineaMotivo);
  }

  return {
    nombre,
    telefono,
    vehiculo,
    motivo,
    fecha,
    hora,
    completo: Boolean(nombre && telefono && vehiculo && motivo && fecha && hora)
  };
}

// ─────────────────────────────────────────────
// HELPERS DE RESPUESTA DENTRO DEL FLUJO
// ─────────────────────────────────────────────

function respuestaDatoEsperado(paso) {
  if (paso === 'motivo') {
    return 'Primero terminemos tu cita 😊\n\nAhora necesito que me indiques el servicio o problema del vehículo.\n\nEjemplo: cambio de aceite, frenos, suspensión, radiador.';
  }
  if (paso === 'vehiculo') {
    return 'Primero terminemos tu cita 😊\n\nAhora necesito el vehículo.\n\nEjemplo: Toyota Hilux, Nissan Frontier, Kia Sportage.';
  }
  if (paso === 'fecha') {
    return 'Primero terminemos tu cita 😊\n\nAhora necesito la fecha y hora.\n\nEjemplo: 2026-05-20 09:00';
  }
  return 'Primero terminemos tu cita 😊';
}

// ─────────────────────────────────────────────
// REGISTRO DE CITA EN DB + GOOGLE CALENDAR
// (función unificada para evitar duplicación)
// ─────────────────────────────────────────────

async function registrarCitaEnDB({ usuarioId, fecha, hora, nombre, telefono, vehiculo, motivo }) {
  const result = await query(
    `INSERT INTO citas
     (usuario_id, fecha, hora, estado, cliente_nombre, cliente_telefono, vehiculo_texto, motivo, canal)
     VALUES (?, ?, ?, 'pendiente', ?, ?, ?, ?, 'web')`,
    [usuarioId, fecha, hora, nombre, telefono, vehiculo, motivo]
  );

  await query(
    `INSERT INTO clientes (nombre, telefono, vehiculo_modelo, ultima_consulta, fecha_registro)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE
       nombre = VALUES(nombre),
       vehiculo_modelo = VALUES(vehiculo_modelo),
       ultima_consulta = VALUES(ultima_consulta)`,
    [nombre, telefono, vehiculo, motivo]
  );

  await query(
    `UPDATE usuarios SET nombre = ?, telefono = ? WHERE id = ?`,
    [nombre, telefono, usuarioId]
  );

  await query(
    `DELETE FROM estado_cita_temporal WHERE usuario_id = ?`,
    [usuarioId]
  );

  try {
    const eventoGoogle = await crearEventoCita({
      cliente_nombre: nombre,
      cliente_telefono: telefono,
      vehiculo_texto: vehiculo,
      motivo,
      fecha,
      hora
    });

    if (eventoGoogle?.id) {
      await query(
        `UPDATE citas SET google_event_id = ? WHERE id = ?`,
        [eventoGoogle.id, result.insertId]
      );
    }
  } catch (calendarError) {
    console.error('❌ Error creando evento en Google Calendar:', calendarError);
  }

  return result;
}

// ─────────────────────────────────────────────
// VALIDACIÓN DE DISPONIBILIDAD (fecha + hora)
// Retorna un objeto con { ok, reply } para reutilizar
// ─────────────────────────────────────────────

async function validarDisponibilidad(fecha, hora) {
  if (esFechaPasada(fecha, hora)) {
    return {
      ok: false,
      reply: 'No puedo agendar citas en fechas pasadas. Por favor elige una fecha actual o futura.'
    };
  }

  const horarioResult = validarHorario(fecha, hora);
  if (!horarioResult.valido) {
    return { ok: false, reply: horarioResult.mensaje };
  }

  const ocupado = await existeChoqueHorario(fecha, hora);
  if (ocupado) {
    const sugerencias = await obtenerSugerencias(fecha);
    return {
      ok: false,
      reply:
`Lo siento ❌
Ese horario ya está ocupado o se cruza con otra cita.

Puedes intentar con uno de estos horarios:
${sugerencias.length
  ? sugerencias.map(h => `- ${fecha} ${h}`).join('\n')
  : 'No hay horarios disponibles para ese día.'}`
    };
  }

  return { ok: true };
}

// ─────────────────────────────────────────────
// AGENTE PRINCIPAL
// ─────────────────────────────────────────────

async function appointmentAgent(message, usuarioId, lastContext = null) {

  // ── 1. CANCELAR PROCESO ACTIVO (máxima prioridad) ────────────────────────
  if (quiereCancelarFlujoActivo(message)) {
    await query(`DELETE FROM estado_cita_temporal WHERE usuario_id = ?`, [usuarioId]);
    return {
      success: true,
      intent: 'appointment_cancelled',
      reply: '✅ Se canceló el proceso de agendamiento.\n\nAhora puedes realizar cualquier otra consulta 😊'
    };
  }

  // ── 2. RECHAZAR AGENDAMIENTO ─────────────────────────────────────────────
  if (rechazaAgendamiento(message)) {
    await query(`DELETE FROM estado_cita_temporal WHERE usuario_id = ?`, [usuarioId]);
    return {
      success: true,
      reply:
`Entendido 😊

No voy a continuar con el agendamiento.

Puedes consultarme sobre horarios, servicios, repuestos o información del taller.`
    };
  }

  // ── 3. CANCELAR CITA EXISTENTE ────────────────────────────────────────────
  if (quiereCancelarCitaExistente(message)) {
    const { fecha, hora } = extraerFechaHoraNatural(message);
    const telefono = extraerTelefono(message) || lastContext?.telefono || null;

    if (!fecha || !hora || !telefono) {
      return {
        success: true,
        reply:
`Claro, puedo ayudarte a cancelar tu cita.

Necesito estos datos:
📞 Teléfono
📅 Fecha
⏰ Hora

Ejemplo:
Cancelar mi cita del 2026-06-15 a las 10:00 con teléfono 987654321`
      };
    }

    const result = await query(
      `UPDATE citas
       SET estado = 'cancelada'
       WHERE fecha = ? AND hora = ? AND cliente_telefono = ? AND estado != 'cancelada'`,
      [fecha, hora, telefono]
    );

    await query(`DELETE FROM estado_cita_temporal WHERE usuario_id = ?`, [usuarioId]);

    if (result.affectedRows > 0) {
      return {
        success: true,
        reply:
`✅ Tu cita fue cancelada correctamente.

📞 Teléfono: ${telefono}
📅 Fecha: ${fecha}
⏰ Hora: ${hora}`
      };
    }

    return {
      success: false,
      reply: 'No encontré una cita activa con esos datos.\n\nVerifica teléfono, fecha y hora, por favor.'
    };
  }

  // ── 4. CITA EN BLOQUE (solo si NO hay flujo activo) ──────────────────────
  //    Se evalúa aquí para que un flujo activo no sea interrumpido
  const estados = await query(
    `SELECT * FROM estado_cita_temporal WHERE usuario_id = ? LIMIT 1`,
    [usuarioId]
  );
  const hayFlujoActivo = estados.length > 0;

  if (!hayFlujoActivo) {
    const datosBloque = extraerDatosCitaEnBloque(message);

    if (datosBloque.completo) {
      const telefonoFinal = datosBloque.telefono || lastContext?.telefono || null;

      if (!telefonoFinal) {
        return {
          success: false,
          reply:
`Me falta tu número de teléfono para registrar la cita 📞

Por favor dime tu celular de 9 dígitos.
Ejemplo:
987654321`
        };
      }

      const disponibilidad = await validarDisponibilidad(datosBloque.fecha, datosBloque.hora);
      if (!disponibilidad.ok) {
        return { success: false, reply: disponibilidad.reply };
      }

      await registrarCitaEnDB({
        usuarioId,
        fecha: datosBloque.fecha,
        hora: datosBloque.hora,
        nombre: datosBloque.nombre,
        telefono: telefonoFinal,
        vehiculo: datosBloque.vehiculo,
        motivo: datosBloque.motivo
      });

      return {
        success: true,
        reply:
`✅ Tu cita fue registrada correctamente.

👤 Cliente: ${datosBloque.nombre}
📞 Teléfono: ${telefonoFinal}
🚗 Vehículo: ${datosBloque.vehiculo}
🛠️ Servicio: ${datosBloque.motivo}
📅 Fecha: ${datosBloque.fecha}
⏰ Hora: ${datosBloque.hora}`
      };
    }
  }

  // ── 5. INICIAR FLUJO STEP-BY-STEP (no hay estado activo) ─────────────────
  if (!hayFlujoActivo) {
    if (!detectarIntencionCita(message)) {
      return null; // no es un mensaje para este agente
    }

    const usuarioActual = await obtenerUsuario(usuarioId);

    // 5a. Usuario con nombre válido
    if (nombreUsuarioValido(usuarioActual?.nombre)) {
      const telefonoGuardado = lastContext?.telefono || usuarioActual?.telefono || null;
      const vehiculoGuardado = lastContext?.vehiculo || null;

      if (telefonoGuardado && vehiculoGuardado) {
        await query(
          `INSERT INTO estado_cita_temporal (usuario_id, paso, nombre, telefono, vehiculo)
           VALUES (?, 'confirmar_vehiculo', ?, ?, ?)`,
          [usuarioId, usuarioActual.nombre, telefonoGuardado, vehiculoGuardado]
        );

        return {
          success: true,
          reply:
`Perfecto ${usuarioActual.nombre} 😊

Ya tengo tus datos registrados.

📞 Teléfono: ${telefonoGuardado}
🚗 Vehículo registrado: ${vehiculoGuardado}

¿Deseas usar este vehículo para la cita?

1. Sí, usar este vehículo
2. No, registrar otro vehículo`
        };
      }

      const pasoSiguiente = telefonoGuardado ? 'vehiculo' : 'telefono';

      await query(
        `INSERT INTO estado_cita_temporal (usuario_id, paso, nombre, telefono, vehiculo)
         VALUES (?, ?, ?, ?, ?)`,
        [usuarioId, pasoSiguiente, usuarioActual.nombre, telefonoGuardado, vehiculoGuardado]
      );

      return {
        success: true,
        reply: telefonoGuardado
          ? `Perfecto ${usuarioActual.nombre} 😊\n\nYa tengo tu número de teléfono registrado.\n\nAhora indícame la marca y modelo de tu vehículo.`
          : `Claro ${usuarioActual.nombre} 😊\n\nPuedo ayudarte con tu cita.\n\nAhora envíame tu número de teléfono.`
      };
    }

    // 5b. Buscar en historial de citas
    const historial = await query(
      `SELECT cliente_nombre, cliente_telefono, vehiculo_texto
       FROM citas
       WHERE usuario_id = ?
         AND cliente_nombre IS NOT NULL
         AND cliente_telefono IS NOT NULL
         AND vehiculo_texto IS NOT NULL
       ORDER BY id DESC
       LIMIT 1`,
      [usuarioId]
    );

    if (historial.length > 0) {
      const cliente = historial[0];
      await query(
        `INSERT INTO estado_cita_temporal (usuario_id, paso, nombre, telefono, vehiculo)
         VALUES (?, 'confirmar_vehiculo', ?, ?, ?)`,
        [usuarioId, cliente.cliente_nombre, cliente.cliente_telefono, cliente.vehiculo_texto]
      );

      return {
        success: true,
        reply:
`Claro ${cliente.cliente_nombre} 😊
Ya tengo tus datos registrados.

🚗 Vehículo registrado: ${cliente.vehiculo_texto}

¿Deseas usar este vehículo para la cita?

1. Sí, usar este vehículo
2. No, registrar otro vehículo`
      };
    }

    // 5c. Usuario nuevo: pedir nombre desde cero
    const vehiculoContexto = lastContext?.vehiculo || null;
    const motivoContexto   = lastContext?.motivo   || null;
    const { fecha: fechaCtx, hora: horaCtx } = extraerFechaHoraNatural(message);

    await query(
      `INSERT INTO estado_cita_temporal (usuario_id, paso, vehiculo, motivo, fecha, hora)
       VALUES (?, 'nombre', ?, ?, ?, ?)`,
      [usuarioId, vehiculoContexto, motivoContexto, fechaCtx, horaCtx]
    );

    let mensajeExtra = '';
    if (vehiculoContexto || motivoContexto) {
      mensajeExtra = `\n\nYa tengo estos datos de tu consulta anterior:
${vehiculoContexto ? `🚗 Vehículo: ${vehiculoContexto}` : ''}
${motivoContexto   ? `🛠️ Servicio/problema: ${motivoContexto}` : ''}`;
    }

    return {
      success: true,
      reply: `Claro, puedo ayudarte con tu cita 🚗${mensajeExtra}\n\n¿Cuál es tu nombre?`
    };
  }

  // ── 6. FLUJO ACTIVO: manejo de pasos ─────────────────────────────────────
  const estado = estados[0];

  // ── PASO: nombre ──────────────────────────────────────────────────────────
  if (estado.paso === 'nombre') {
    if (pareceNombreInvalido(message)) {
      return {
        success: false,
        reply:
`Para registrar la cita necesito un nombre válido 😊

Por favor escribe solo tu nombre.
Ejemplo:
Pablo`
      };
    }

    const nombreLimpio = extraerNombre(message);

    if (!nombreLimpio || pareceNombreInvalido(nombreLimpio)) {
      return {
        success: false,
        reply:
`Para registrar la cita necesito un nombre válido 😊

Por favor dime solo tu nombre.
Ejemplo:
Miguel`
      };
    }

    await query(
      `UPDATE estado_cita_temporal SET nombre = ?, paso = 'telefono' WHERE usuario_id = ?`,
      [nombreLimpio, usuarioId]
    );

    return {
      success: true,
      reply: 'Perfecto 👍\nAhora envíame tu número de teléfono.'
    };
  }

  // ── PASO: teléfono ────────────────────────────────────────────────────────
  if (estado.paso === 'telefono') {
    if (!esTelefonoValido(message)) {
      return {
        success: false,
        reply:
`Para continuar necesito un número de teléfono válido 📞

Ejemplo:
987654321`
      };
    }

    const telefonoLimpio = extraerTelefono(message);

    // ¿Ya existe este teléfono en citas previas?
    const citasExistentes = await query(
      `SELECT cliente_nombre, vehiculo_texto
       FROM citas
       WHERE cliente_telefono = ?
       ORDER BY id DESC
       LIMIT 1`,
      [telefonoLimpio]
    );

    if (citasExistentes.length > 0) {
      const cliente = citasExistentes[0];
      await query(
        `UPDATE estado_cita_temporal
         SET telefono = ?, nombre = ?, vehiculo = ?, paso = 'confirmar_vehiculo'
         WHERE usuario_id = ?`,
        [telefonoLimpio, cliente.cliente_nombre, cliente.vehiculo_texto, usuarioId]
      );

      return {
        success: true,
        reply:
`Hola nuevamente ${cliente.cliente_nombre} 👋

Encontré tu información registrada.

🚗 Vehículo registrado: ${cliente.vehiculo_texto}

¿Deseas usar este vehículo para la cita?

1. Sí, usar este vehículo
2. No, registrar otro vehículo`
      };
    }

    const vehiculoGuardado = estado.vehiculo || lastContext?.vehiculo || null;
    const motivoGuardado   = estado.motivo   || lastContext?.motivo   || null;
    const siguientePaso    = (vehiculoGuardado && motivoGuardado) ? 'fecha' : 'vehiculo';

    await query(
      `UPDATE estado_cita_temporal
       SET telefono = ?, vehiculo = ?, motivo = ?, paso = ?
       WHERE usuario_id = ?`,
      [telefonoLimpio, vehiculoGuardado, motivoGuardado, siguientePaso, usuarioId]
    );

    return {
      success: true,
      reply: siguientePaso === 'fecha'
        ? `Perfecto 😊\n\nYa tengo tu vehículo y el problema registrado.\n\nAhora envíame la fecha y hora de la cita.\n\nEjemplo:\n2026-05-20 09:00`
        : 'Excelente 🚘\n¿Qué vehículo tienes? (marca/modelo)'
    };
  }

  // ── PASO: confirmar_vehiculo ──────────────────────────────────────────────
  if (estado.paso === 'confirmar_vehiculo') {
    if (confirmarVehiculoSi(message)) {
      await query(
        `UPDATE estado_cita_temporal SET paso = 'motivo' WHERE usuario_id = ?`,
        [usuarioId]
      );
      return {
        success: true,
        reply:
`Perfecto 😊

Usaremos tu vehículo registrado:
🚗 ${estado.vehiculo}

¿Qué servicio o problema deseas atender?`
      };
    }

    if (confirmarVehiculoNo(message)) {
      await query(
        `UPDATE estado_cita_temporal SET vehiculo = NULL, paso = 'vehiculo' WHERE usuario_id = ?`,
        [usuarioId]
      );
      return {
        success: true,
        reply:
`Claro 😊

Indícame el nuevo vehículo que deseas registrar.

Ejemplo:
Toyota Hilux`
      };
    }

    return {
      success: false,
      reply:
`Por favor elige una opción:

1. Sí, usar tu vehículo registrado
2. No, registrar otro vehículo`
    };
  }

  // ── PASO: vehiculo ────────────────────────────────────────────────────────
  if (estado.paso === 'vehiculo') {
    if (esPreguntaGeneral(message)) {
      return { success: false, reply: respuestaDatoEsperado('vehiculo') };
    }

    const vehiculoFinal = esRespuestaDeContexto(message)
      ? (lastContext?.vehiculo || estado.vehiculo || null)
      : extraerVehiculo(message);

    if (!vehiculoFinal) {
      return {
        success: false,
        reply:
`No pude reconocer bien tu vehículo 😅

Por favor dime la marca y modelo.
Ejemplo:
Toyota Yaris`
      };
    }

    await query(
      `UPDATE estado_cita_temporal SET vehiculo = ?, paso = 'motivo' WHERE usuario_id = ?`,
      [vehiculoFinal, usuarioId]
    );

    return {
      success: true,
      reply: '¿Qué servicio o problema deseas atender?'
    };
  }

  // ── PASO: motivo ──────────────────────────────────────────────────────────
  if (estado.paso === 'motivo') {
    if (preguntaPorNombre(message)) {
      return {
        success: true,
        reply:
`Sí 😊

Tu nombre registrado es: ${estado.nombre}

Ahora continuemos con tu cita:
¿Qué servicio o problema deseas atender?`
      };
    }

    if (preguntaPorVehiculo(message)) {
      return {
        success: true,
        reply:
`Sí 😊

Tu vehículo registrado es: ${estado.vehiculo}

Ahora continuemos con tu cita:
¿Qué servicio o problema deseas atender?`
      };
    }

    if (esPreguntaGeneral(message)) {
      return { success: false, reply: respuestaDatoEsperado('motivo') };
    }

    const motivoFinal = esRespuestaDeContexto(message)
      ? (lastContext?.motivo || estado.motivo || null)
      : extraerMotivo(message);

    if (!motivoFinal) {
      return {
        success: false,
        reply:
`No pude reconocer bien el servicio o problema 😅

Por favor dime qué deseas atender.
Ejemplo:
Cambio de aceite`
      };
    }

    await query(
      `UPDATE estado_cita_temporal SET motivo = ?, paso = 'fecha' WHERE usuario_id = ?`,
      [motivoFinal, usuarioId]
    );

    return {
      success: true,
      reply:
`Perfecto 📅

Ahora envíame la fecha y hora.

Ejemplo:
2026-05-20 09:00`
    };
  }

  // ── PASO: fecha ───────────────────────────────────────────────────────────
  if (estado.paso === 'fecha') {
    if (esPreguntaGeneral(message)) {
      return { success: false, reply: respuestaDatoEsperado('fecha') };
    }

    const { fecha, hora } = extraerFechaHoraNatural(message);

    if (!fecha || !hora) {
      return {
        success: false,
        reply:
`No pude reconocer bien la fecha y hora 😅

Verifica que la fecha exista y escríbela así:
2026-05-21 15:00

O también:
21 de mayo a las 3 de la tarde
mañana a las 10`
      };
    }

    const disponibilidad = await validarDisponibilidad(fecha, hora);
    if (!disponibilidad.ok) {
      return { success: false, reply: disponibilidad.reply };
    }

    const telefonoFinal = estado.telefono || lastContext?.telefono || null;

    if (!telefonoFinal) {
      return {
        success: false,
        reply:
`Me falta tu número de teléfono para registrar la cita 📞

Por favor dime tu celular de 9 dígitos.
Ejemplo:
987654321`
      };
    }

    await registrarCitaEnDB({
      usuarioId,
      fecha,
      hora,
      nombre:   estado.nombre,
      telefono: telefonoFinal,
      vehiculo: estado.vehiculo,
      motivo:   estado.motivo
    });

    return {
      success: true,
      reply:
`✅ Tu cita fue registrada correctamente.

👤 Cliente: ${estado.nombre}
📞 Teléfono: ${telefonoFinal}
🚗 Vehículo: ${estado.vehiculo}
🛠️ Servicio: ${estado.motivo}
📅 Fecha: ${fecha}
⏰ Hora: ${hora}`
    };
  }

  // ── FALLBACK ──────────────────────────────────────────────────────────────
  return {
    success: false,
    reply: 'Ocurrió un problema con el flujo de la cita. Inténtalo nuevamente.'
  };
}

module.exports = appointmentAgent;