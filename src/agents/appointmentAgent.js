const db = require('../config/database');
const { crearEventoCita } = require('../services/googleCalendarService');

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
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

function detectarIntencionCita(msg) {
  const texto = normalizar(msg);

  return (
    texto.includes('cita') ||
    texto.includes('reservar') ||
    texto.includes('agendar') ||
    texto.includes('programar')
  );
}

function quiereCancelarFlujo(msg) {
  msg = msg.toLowerCase();

  return (
    msg.includes("cancelar") ||
    msg.includes("salir") ||
    msg.includes("detener") ||
    msg.includes("terminar cita") ||
    msg.includes("cancelar cita")
  );
}

function confirmarVehiculoSi(msg) {
  const texto = normalizar(msg);

  return (
    texto === '1' ||
    texto.includes('si') ||
    texto.includes('sí') ||
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

function pareceNombreInvalido(msg) {
  const texto = normalizar(msg);

  return (
    esPreguntaGeneral(texto) ||
    texto.includes('ya lo sabes') ||
    texto.includes('me conoces') ||
    texto.includes('no te acuerdas')
  );
}

function esTelefonoValido(msg) {
  const limpio = String(msg).replace(/\D/g, '');
  return limpio.length >= 9;
}

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

function minutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function esFechaPasada(fecha, hora) {
  const [y, mo, d] = fecha.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);

  const fechaCita = new Date(y, mo - 1, d, h, mi);
  const ahora = new Date();

  return fechaCita < ahora;
}

function obtenerDiaSemana(fecha) {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
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
    const mañanaInicio = minutos('08:30');
    const mañanaFin = minutos('13:00');

    const tardeInicio = minutos('14:00');
    const tardeFin = minutos('18:00');

    const entraManana = inicio >= mañanaInicio && fin <= mañanaFin;
    const entraTarde = inicio >= tardeInicio && fin <= tardeFin;

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
    const sabadoInicio = minutos('08:30');
    const sabadoFin = minutos('14:00');

    if (inicio < sabadoInicio || fin > sabadoFin) {
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
    `
    SELECT hora
    FROM citas
    WHERE fecha = ?
    AND estado != 'cancelada'
    `,
    [fecha]
  );

  return posibles.filter((horaNueva) => {
    const inicioNuevo = minutos(horaNueva);
    const finNuevo = inicioNuevo + 120;

    return !citas.some((cita) => {
      const horaExistente = String(cita.hora).slice(0, 5);
      const inicioExistente = minutos(horaExistente);
      const finExistente = inicioExistente + 120;

      return inicioNuevo < finExistente && finNuevo > inicioExistente;
    });
  });
}

async function existeChoqueHorario(fecha, hora) {
  const citas = await query(
    `
    SELECT hora
    FROM citas
    WHERE fecha = ?
    AND estado != 'cancelada'
    `,
    [fecha]
  );

  const inicioNuevo = minutos(hora);
  const finNuevo = inicioNuevo + 120;

  return citas.some((cita) => {
    const horaExistente = String(cita.hora).slice(0, 5);
    const inicioExistente = minutos(horaExistente);
    const finExistente = inicioExistente + 120;

    return inicioNuevo < finExistente && finNuevo > inicioExistente;
  });
}

async function appointmentAgent(message, usuarioId) {
  const estados = await query(
    `
    SELECT *
    FROM estado_cita_temporal
    WHERE usuario_id = ?
    LIMIT 1
    `,
    [usuarioId]
  );

  if (estados.length === 0) {
    if (!detectarIntencionCita(message)) {
      return null;
    }

    const clientes = await query(
      `
      SELECT cliente_nombre, cliente_telefono, vehiculo_texto
      FROM citas
      WHERE usuario_id = ?
      AND cliente_nombre IS NOT NULL
      AND cliente_telefono IS NOT NULL
      AND vehiculo_texto IS NOT NULL
      ORDER BY id DESC
      LIMIT 1
      `,
      [usuarioId]
    );

    if (clientes.length > 0) {
      const cliente = clientes[0];

      await query(
        `
        INSERT INTO estado_cita_temporal
        (usuario_id, paso, nombre, telefono, vehiculo)
        VALUES (?, 'confirmar_vehiculo', ?, ?, ?)
        `,
        [
          usuarioId,
          cliente.cliente_nombre,
          cliente.cliente_telefono,
          cliente.vehiculo_texto
        ]
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

    await query(
      `
      INSERT INTO estado_cita_temporal
      (usuario_id, paso)
      VALUES (?, 'nombre')
      `,
      [usuarioId]
    );

    return {
      success: true,
      reply: 'Claro, puedo ayudarte con tu cita 🚗\n\n¿Cuál es tu nombre?'
    };
  }

  const estado = estados[0];

    // CANCELAR FLUJO DE CITA


    if (quiereCancelarFlujo(message)) {

      await query(
        `DELETE FROM estado_cita_temporal WHERE usuario_id = ?`,
        [usuarioId]
      );

      return {
        success: true,
        reply:
    `✅ Se canceló el proceso de agendamiento.

    Ahora puedes realizar cualquier otra consulta 😊`
      };
    }

  if (estado.paso === 'nombre') {
    if (pareceNombreInvalido(message)) {
      return {
        success: false,
        reply:
`Para registrar tu cita necesito confirmar tu nombre 😊

Por favor escríbeme tu nombre real.`
      };
    }

    await query(
      `
      UPDATE estado_cita_temporal
      SET nombre = ?, paso = 'telefono'
      WHERE usuario_id = ?
      `,
      [message, usuarioId]
    );

    return {
      success: true,
      reply: 'Perfecto 👍\nAhora envíame tu número de teléfono.'
    };
  }

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

    const clientes = await query(
      `
      SELECT *
      FROM citas
      WHERE cliente_telefono = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [message]
    );

    if (clientes.length > 0) {
      const cliente = clientes[0];

      await query(
        `
        UPDATE estado_cita_temporal
        SET telefono = ?, nombre = ?, vehiculo = ?, paso = 'confirmar_vehiculo'
        WHERE usuario_id = ?
        `,
        [
          message,
          cliente.cliente_nombre,
          cliente.vehiculo_texto,
          usuarioId
        ]
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

    await query(
      `
      UPDATE estado_cita_temporal
      SET telefono = ?, paso = 'vehiculo'
      WHERE usuario_id = ?
      `,
      [message, usuarioId]
    );

    return {
      success: true,
      reply: 'Excelente 🚘\n¿Qué vehículo tienes? (marca/modelo)'
    };
  }

      if (estado.paso === 'confirmar_vehiculo') {

      if (confirmarVehiculoSi(message)) {
        await query(
          `
          UPDATE estado_cita_temporal
          SET paso = 'motivo'
          WHERE usuario_id = ?
          `,
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
          `
          UPDATE estado_cita_temporal
          SET vehiculo = NULL, paso = 'vehiculo'
          WHERE usuario_id = ?
          `,
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

  if (estado.paso === 'vehiculo') {
    if (esPreguntaGeneral(message)) {
      return {
        success: false,
        reply: respuestaDatoEsperado('vehiculo')
      };
    }

    await query(
      `
      UPDATE estado_cita_temporal
      SET vehiculo = ?, paso = 'motivo'
      WHERE usuario_id = ?
      `,
      [message, usuarioId]
    );

    return {
      success: true,
      reply: '¿Qué servicio o problema deseas atender?'
    };
  }

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
      return {
        success: false,
        reply: respuestaDatoEsperado('motivo')
      };
    }

    await query(
      `
      UPDATE estado_cita_temporal
      SET motivo = ?, paso = 'fecha'
      WHERE usuario_id = ?
      `,
      [message, usuarioId]
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

  if (estado.paso === 'fecha') {
    if (esPreguntaGeneral(message)) {
      return {
        success: false,
        reply: respuestaDatoEsperado('fecha')
      };
    }

    const fecha = extraerFecha(message);
    const hora = extraerHora(message);

    if (!fecha || !hora) {
      return {
        success: false,
        reply: 'Formato inválido.\nUsa este formato:\n2026-05-20 09:00'
      };
    }

    if (esFechaPasada(fecha, hora)) {
      return {
        success: false,
        reply: 'No puedo agendar citas en fechas pasadas. Por favor elige una fecha actual o futura.'
      };
    }

    const validacionHorario = validarHorario(fecha, hora);

    if (!validacionHorario.valido) {
      return {
        success: false,
        reply: validacionHorario.mensaje
      };
    }

    const ocupado = await existeChoqueHorario(fecha, hora);

    if (ocupado) {
      const sugerencias = await obtenerSugerencias(fecha);

      return {
        success: false,
        reply:
`Lo siento ❌
Ese horario ya está ocupado o se cruza con otra cita.

Puedes intentar con uno de estos horarios:
${sugerencias.length ? sugerencias.map(h => `- ${fecha} ${h}`).join('\n') : 'No hay horarios disponibles para ese día.'}`
      };
    }

    const result = await query(
      `
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
      `,
      [
        usuarioId,
        fecha,
        hora,
        estado.nombre,
        estado.telefono,
        estado.vehiculo,
        estado.motivo
      ]
    );

    await query(
      `DELETE FROM estado_cita_temporal WHERE usuario_id = ?`,
      [usuarioId]
    );

    let googleEventId = null;

    try {
      const eventoGoogle = await crearEventoCita({
        cliente_nombre: estado.nombre,
        cliente_telefono: estado.telefono,
        vehiculo_texto: estado.vehiculo,
        motivo: estado.motivo,
        fecha,
        hora
      });

      googleEventId = eventoGoogle?.id || null;
    } catch (calendarError) {
      console.error('❌ Error creando evento en Google Calendar:', calendarError);
    }

    if (googleEventId) {
      await query(
        `UPDATE citas SET google_event_id = ? WHERE id = ?`,
        [googleEventId, result.insertId]
      );
    }

    return {
      success: true,
      reply:
`✅ Tu cita fue registrada correctamente.

👤 Cliente: ${estado.nombre}
📞 Teléfono: ${estado.telefono}
🚗 Vehículo: ${estado.vehiculo}
🛠️ Servicio: ${estado.motivo}
📅 Fecha: ${fecha}
⏰ Hora: ${hora}`
    };
  }

  return {
    success: false,
    reply: 'Ocurrió un problema con el flujo de la cita. Inténtalo nuevamente.'
  };
}

module.exports = appointmentAgent;