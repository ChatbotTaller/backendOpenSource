const { classifyIntent } = require('../agents/classifierAgent');
const { telefonoValido } = require('../utils/dataExtractor');

function validarDni(dni) {
  return /^\d{8}$/.test(String(dni || '').trim()) &&
    String(dni).trim() !== '00000000';
}

function generarSessionId(dni) {
  return `dni_${String(dni || '').trim()}`;
}

function validarSessionId(sessionId) {
  return /^dni_\d{8}$/.test(String(sessionId || '').trim());
}

function validarDatosCita(cita = {}) {
  return Boolean(
    cita.nombre &&
    cita.telefono &&
    cita.vehiculo &&
    cita.fecha &&
    cita.hora
  );
}

function validarEstadoCita(estado) {
  const estadosPermitidos = [
    'pendiente',
    'confirmada',
    'completada',
    'cancelada'
  ];

  return estadosPermitidos.includes(
    String(estado || '').trim().toLowerCase()
  );
}

function procesarFlujoGeneral({
  dni,
  mensaje,
  cita = null,
  estado = 'pendiente'
}) {
  if (!validarDni(dni)) {
    return {
      success: false,
      etapa: 'validacion_dni',
      error: 'DNI inválido'
    };
  }

  const sessionId = generarSessionId(dni);

  if (!validarSessionId(sessionId)) {
    return {
      success: false,
      etapa: 'creacion_sesion',
      error: 'Identificador de sesión inválido'
    };
  }

  const intent = classifyIntent(String(mensaje || ''));

  if (intent !== 'appointment') {
    return {
      success: true,
      etapa: 'respuesta_chatbot',
      sessionId,
      intent
    };
  }

  if (!validarDatosCita(cita)) {
    return {
      success: false,
      etapa: 'validacion_cita',
      sessionId,
      intent,
      error: 'Faltan datos obligatorios para la cita'
    };
  }

  if (!telefonoValido(cita.telefono)) {
    return {
      success: false,
      etapa: 'validacion_telefono',
      sessionId,
      intent,
      error: 'Teléfono inválido'
    };
  }

  if (!validarEstadoCita(estado)) {
    return {
      success: false,
      etapa: 'validacion_estado',
      sessionId,
      intent,
      error: 'Estado de cita inválido'
    };
  }

  return {
    success: true,
    etapa: 'cita_lista_para_registro',
    sessionId,
    intent,
    cita: {
      ...cita,
      estado: String(estado).trim().toLowerCase()
    }
  };
}

module.exports = {
  validarDni,
  generarSessionId,
  validarSessionId,
  validarDatosCita,
  validarEstadoCita,
  procesarFlujoGeneral
};
