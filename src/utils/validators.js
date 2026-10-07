const APPOINTMENT_STATES = new Set([
  'pendiente', 'confirmada', 'completada', 'cancelada'
]);

function isPositiveInteger(value) {
  return /^\d+$/.test(String(value || '')) && Number(value) > 0;
}

function normalizeAppointmentState(value) {
  const state = String(value || '').trim().toLowerCase();
  return APPOINTMENT_STATES.has(state) ? state : null;
}

function validateChatMessage(value) {
  if (typeof value !== 'string') {
    return { valid: false, message: 'El mensaje debe ser texto.' };
  }

  const message = value.trim();
  if (!message) return { valid: false, message: 'El mensaje es obligatorio.' };
  if (message.length > 2000) {
    return { valid: false, message: 'El mensaje supera el máximo de 2000 caracteres.' };
  }

  return { valid: true, value: message };
}

function isValidDni(value) {
  const dni = String(value || '').trim();
  return /^\d{8}$/.test(dni) && dni !== '00000000';
}

module.exports = {
  APPOINTMENT_STATES,
  isPositiveInteger,
  normalizeAppointmentState,
  validateChatMessage,
  isValidDni
};
