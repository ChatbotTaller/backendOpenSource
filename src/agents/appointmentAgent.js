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

function esRespuestaDeContexto(message) {
  const texto = normalizar(message);

  const frases = [
    'ya te dije',
    'te dije',
    'ya te mencione',
    'ya te mencioné',
    'te mencione',
    'te mencioné',
    'tambien te mencione',
    'también te mencioné',
    'arriba esta',
    'arriba está',
    'ya lo sabes',
    'lo dije antes',
    'eso mismo',
    'lo mismo'
  ];

  return frases.some(frase => texto.includes(normalizar(frase)));
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

  const palabrasProhibidas = [
    'mierda',
    'carajo',
    'puta',
    'putamadre',
    'webon',
    'huevon',
    'idiota',
    'imbecil',
    'gil',
    'ctm',
    'ptm',
    'xd'
  ];

  return (
    esPreguntaGeneral(texto) ||
    texto.includes('ya lo sabes') ||
    texto.includes('me conoces') ||
    texto.includes('no te acuerdas') ||

    texto === 'hola' ||
    texto === 'hi' ||
    texto === 'hello' ||
    texto === 'buenas' ||
    texto === 'agendar' ||
    texto === 'cita' ||
    texto === 'reservar' ||

    palabrasProhibidas.some(p => texto.includes(p))
  );
}

function esTelefonoValido(msg) {
  return /\b9\d{8}\b/.test(String(msg || ''));
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
    enero: 0,
    febrero: 1,
    marzo: 2,
    abril: 3,
    mayo: 4,
    junio: 5,
    julio: 6,
    agosto: 7,
    septiembre: 8,
    setiembre: 8,
    octubre: 9,
    noviembre: 10,
    diciembre: 11
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

      if (
        periodo.includes('tarde') ||
        periodo.includes('noche') ||
        periodo.includes('pm')
      ) {
        if (h < 12) h += 12;
      }

      if (
        periodo.includes('mañana') ||
        periodo.includes('manana') ||
        periodo.includes('am')
      ) {
        if (h === 12) h = 0;
      }

      hora = `${String(h).padStart(2, '0')}:${min}`;
    }
  }

  return { fecha, hora };
}

function extraerDatosCitaEnBloque(message) {
  const lineas = String(message)
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean);

  const texto = normalizar(message);
  const { fecha, hora } = extraerFechaHoraNatural(message);

  const telefonoMatch = message.match(/\b9\d{8}\b/);
  const telefono = telefonoMatch ? telefonoMatch[0] : null;

  let nombre = null;
  let vehiculo = null;
  let motivo = null;

  if (lineas.length >= 4) {
    nombre = lineas[0];
    vehiculo = lineas.find(l =>
      normalizar(l).includes('toyota') ||
      normalizar(l).includes('nissan') ||
      normalizar(l).includes('hyundai') ||
      normalizar(l).includes('honda') ||
      normalizar(l).includes('kia') ||
      normalizar(l).includes('mazda') ||
      normalizar(l).includes('ford') ||
      normalizar(l).includes('chevrolet')
    );

    motivo = lineas.find(l =>
      normalizar(l).includes('cambio') ||
      normalizar(l).includes('revision') ||
      normalizar(l).includes('mantenimiento') ||
      normalizar(l).includes('motor') ||
      normalizar(l).includes('freno') ||
      normalizar(l).includes('aceite') ||
      normalizar(l).includes('filtro')
    );
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

function minutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function obtenerAhoraPeru() {
  return new Date(
    new Date().toLocaleString('en-US', {
      timeZone: 'America/Lima'
    })
  );
}

function esFechaPasada(fecha, hora) {
  const [y, mo, d] = fecha.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);

  const fechaCita = new Date(y, mo - 1, d, h, mi);

  const ahoraPeru = obtenerAhoraPeru();

  return fechaCita < ahoraPeru;
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

async function obtenerUsuario(usuarioId) {
  const usuarios = await query(
    `
    SELECT nombre, telefono
    FROM usuarios
    WHERE id = ?
    LIMIT 1
    `,
    [usuarioId]
  );

  return usuarios[0] || null;
}

function nombreUsuarioValido(nombre) {
  return (
    nombre &&
    nombre !== 'Visitante web' &&
    nombre.trim().length >= 2
  );
}

async function appointmentAgent(message, usuarioId, lastContext = null) {
  const estados = await query(
    `
    SELECT *
    FROM estado_cita_temporal
    WHERE usuario_id = ?
    LIMIT 1
    `,
    [usuarioId]
  );

    const datosBloque = extraerDatosCitaEnBloque(message);

  if (datosBloque.completo) {
    if (esFechaPasada(datosBloque.fecha, datosBloque.hora)) {
      return {
        success: false,
        reply: 'No puedo agendar citas en fechas pasadas. Por favor elige una fecha actual o futura.'
      };
    }

    const validacionHorario = validarHorario(datosBloque.fecha, datosBloque.hora);

    if (!validacionHorario.valido) {
      return {
        success: false,
        reply: validacionHorario.mensaje
      };
    }

    const ocupado = await existeChoqueHorario(datosBloque.fecha, datosBloque.hora);

    if (ocupado) {
      const sugerencias = await obtenerSugerencias(datosBloque.fecha);

      return {
        success: false,
        reply:
  `Ese horario ya está ocupado o se cruza con otra cita 😅

  Puedes intentar con uno de estos horarios:
  ${sugerencias.length ? sugerencias.map(h => `- ${datosBloque.fecha} ${h}`).join('\n') : 'No hay horarios disponibles para ese día.'}`
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
        datosBloque.fecha,
        datosBloque.hora,
        datosBloque.nombre,
        datosBloque.telefono,
        datosBloque.vehiculo,
        datosBloque.motivo
      ]
    );

        await query(
      `
      INSERT INTO clientes
      (
        nombre,
        telefono,
        vehiculo_modelo,
        ultima_consulta,
        fecha_registro
      )
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        nombre = VALUES(nombre),
        vehiculo_modelo = VALUES(vehiculo_modelo),
        ultima_consulta = VALUES(ultima_consulta)
      `,
      [
        datosBloque.nombre,
        datosBloque.telefono,
        datosBloque.vehiculo,
        datosBloque.motivo
      ]
    );

    await query(
      `
      UPDATE usuarios
      SET nombre = ?, telefono = ?
      WHERE id = ?
      `,
      [datosBloque.nombre, datosBloque.telefono, usuarioId]
    );

    await query(
      `DELETE FROM estado_cita_temporal WHERE usuario_id = ?`,
      [usuarioId]
    );

    try {
      const eventoGoogle = await crearEventoCita({
        cliente_nombre: datosBloque.nombre,
        cliente_telefono: datosBloque.telefono,
        vehiculo_texto: datosBloque.vehiculo,
        motivo: datosBloque.motivo,
        fecha: datosBloque.fecha,
        hora: datosBloque.hora
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

    return {
      success: true,
      reply:
  `✅ Tu cita fue registrada correctamente.

  👤 Cliente: ${datosBloque.nombre}
  📞 Teléfono: ${datosBloque.telefono}
  🚗 Vehículo: ${datosBloque.vehiculo}
  🛠️ Servicio: ${datosBloque.motivo}
  📅 Fecha: ${datosBloque.fecha}
  ⏰ Hora: ${datosBloque.hora}`
    };
  }

  if (estados.length === 0) {
    if (!detectarIntencionCita(message)) {
      return null;
    }

    if (quiereCancelarFlujo(message)) {
      return {
        success: true,
        reply:
    `Claro 😊

    Para cancelar una cita existente, necesito que me indiques al menos:
    📞 Teléfono
    📅 Fecha
    ⏰ Hora

    Ejemplo:
    Cancelar mi cita del 2026-05-22 a las 10:00`
      };
    }

    const usuarioActual = await obtenerUsuario(usuarioId);

  if (nombreUsuarioValido(usuarioActual?.nombre)) {
    await query(
      `
      INSERT INTO estado_cita_temporal
      (usuario_id, paso, nombre)
      VALUES (?, 'telefono', ?)
      `,
      [usuarioId, usuarioActual.nombre]
    );

    const { fecha, hora } = extraerFechaHoraNatural(message);

    let mensajeFecha = '';

    if (fecha && hora) {
      mensajeFecha = `

  Ya entendí que deseas la cita para:
   ${fecha}
   ${hora}

  Primero necesito completar tus datos.`;
    }

    return {
      success: true,
      reply:
  `Claro ${usuarioActual.nombre} 😊
  Puedo ayudarte con tu cita.${mensajeFecha}

  Ahora envíame tu número de teléfono.`
    };
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

      const vehiculoContexto = lastContext?.vehiculo || null;
      const motivoContexto = lastContext?.motivo || null;

      const fechaHoraMensaje = extraerFechaHoraNatural(message);
      const fechaContexto = fechaHoraMensaje.fecha || null;
      const horaContexto = fechaHoraMensaje.hora || null;

      let pasoInicial = 'nombre';

      if (vehiculoContexto && motivoContexto) {
        pasoInicial = 'nombre';
      }

      await query(
        `
      INSERT INTO estado_cita_temporal
      (usuario_id, paso, vehiculo, motivo, fecha, hora)
      VALUES (?, ?, ?, ?, ?, ?)
        `,
        [usuarioId, pasoInicial, vehiculoContexto, motivoContexto, fechaContexto, horaContexto]
      );

      let mensajeExtra = '';

      if (vehiculoContexto || motivoContexto) {
        mensajeExtra =
      `\n\nYa tengo estos datos de tu consulta anterior:
      ${vehiculoContexto ? `🚗 Vehículo: ${vehiculoContexto}` : ''}
      ${motivoContexto ? `🛠️ Servicio/problema: ${motivoContexto}` : ''}`;
      }

      return {
        success: true,
        reply:
      `Claro, puedo ayudarte con tu cita 🚗${mensajeExtra}

      ¿Cuál es tu nombre?`
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
    `Para registrar la cita necesito un nombre válido 😊

    Por favor escribe solo tu nombre.
    Ejemplo:
    Pablo`
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

    const telefonoLimpio = String(message).match(/\b9\d{8}\b/)?.[0];

    const clientes = await query(
      `
      SELECT *
      FROM citas
      WHERE cliente_telefono = ?
      ORDER BY id DESC
      LIMIT 1
      `,
      [telefonoLimpio]
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
          telefonoLimpio,
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

      const vehiculoGuardado = estado.vehiculo || lastContext?.vehiculo || null;
      const motivoGuardado = estado.motivo || lastContext?.motivo || null;

      const siguientePaso =
        vehiculoGuardado && motivoGuardado
          ? 'fecha'
          : 'vehiculo';

      await query(
        `
        UPDATE estado_cita_temporal
        SET telefono = ?, vehiculo = ?, motivo = ?, paso = ?
        WHERE usuario_id = ?
        `,
        [telefonoLimpio, vehiculoGuardado, motivoGuardado, siguientePaso, usuarioId]
      );

      return {
        success: true,
        reply:
          siguientePaso === 'fecha'
            ? `Perfecto 😊

      Ya tengo tu vehículo y el problema registrado.

      Ahora envíame la fecha y hora de la cita.

      Ejemplo:
      2026-05-20 09:00`
            : 'Excelente 🚘\n¿Qué vehículo tienes? (marca/modelo)'
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

    let vehiculoFinal = message;

    if (esRespuestaDeContexto(message)) {
      vehiculoFinal = lastContext?.vehiculo || estado.vehiculo || null;

      if (!vehiculoFinal) {
        return {
          success: false,
          reply:
  `Aún no tengo claro tu vehículo 😅

  Por favor indícame la marca y modelo.
  Ejemplo:
  Mitsubishi Xpander`
        };
      }
    }

    await query(
      `
      UPDATE estado_cita_temporal
      SET vehiculo = ?, paso = 'motivo'
      WHERE usuario_id = ?
      `,
      [vehiculoFinal, usuarioId]
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

    let motivoFinal = message;

    if (esRespuestaDeContexto(message)) {
      motivoFinal = lastContext?.motivo || estado.motivo || null;

      if (!motivoFinal) {
        return {
          success: false,
          reply:
  `Aún no tengo claro el servicio o problema 😅

  Por favor indícame qué deseas atender.
  Ejemplo:
  Válvula de transmisión`
        };
      }
    }

    await query(
      `
      UPDATE estado_cita_temporal
      SET motivo = ?, paso = 'fecha'
      WHERE usuario_id = ?
      `,
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

  if (estado.paso === 'fecha') {
    if (esPreguntaGeneral(message)) {
      return {
        success: false,
        reply: respuestaDatoEsperado('fecha')
      };
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
      `
      INSERT INTO clientes
      (
        nombre,
        telefono,
        vehiculo_modelo,
        ultima_consulta,
        fecha_registro
      )
      VALUES (?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        nombre = VALUES(nombre),
        vehiculo_modelo = VALUES(vehiculo_modelo),
        ultima_consulta = VALUES(ultima_consulta)
      `,
      [
        estado.nombre,
        estado.telefono,
        estado.vehiculo,
        estado.motivo
      ]
    );

    await query(
      `
      UPDATE usuarios
      SET nombre = ?, telefono = ?
      WHERE id = ?
      `,
      [estado.nombre, estado.telefono, usuarioId]
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