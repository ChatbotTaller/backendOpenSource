function normalize(message) {
  return String(message || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(?:cacelar|canelar|canselar)\b/g, 'cancelar')
    .trim();
}

function isNegatedCancellation(text) {
  return /\bno\s+(?:(?:quiero|deseo|necesito|debes|vayas a)\s+)?(?:cancelar|canceles|anular|eliminar|borrar|quitar)\b/.test(text);
}

function wantsToCancelBookingFlow(message) {
  const text = normalize(message);
  if (isNegatedCancellation(text)) return false;
  return /^(?:(?:quiero|deseo|necesito)\s+)?(?:cancelar|cancela|salir|detener)(?:\s+por\s*favor|\s+porfa)?$/.test(text) ||
    /\b(?:cancelar|cancela|detener|salir de)\s+(?:(?:el|mi|este)\s+)?(?:proceso|agendamiento)\b/.test(text) ||
    /\b(?:ya\s+)?no\s+(?:quiero|deseo|necesito)\s+(?:agendar|reservar|registrar una cita|una cita|cita)\b/.test(text);
}

function wantsToListAppointments(message) {
  const text = normalize(message);
  return /\b(?:mis citas|mi cita|citas (?:agendadas|pendientes|registradas)|citas que tengo|citas tengo|tengo (?:alguna |una )?cita|cuando (?:es|tengo) (?:mi )?cita)\b/.test(text);
}

function wantsToCreateAppointment(message) {
  const text = normalize(message);
  if (wantsToCancelBookingFlow(message) || wantsToCancelExistingAppointment(message)) return false;
  return /\b(?:agendar|agendame|reservar|reservame|programar|sacar|separar|registrar)\s+(?:(?:una|mi|la|otra|nueva)\s+)*(?:cita|turno|reserva)\b/.test(text) ||
    /\b(?:quiero|quisiera|deseo|necesito)\s+(?:(?:una|otra|nueva)\s+)*(?:cita|turno|reserva)\b/.test(text);
}

function wantsToCancelExistingAppointment(message) {
  const text = normalize(message);
  const cancellationVerb = /\b(?:cancelar|cancela|anular|anula|eliminar|elimina|borrar|quitar)\b/;
  const appointment = /\b(?:cita|citas|reserva|reservas|turno|turnos)\b/;

  if (isNegatedCancellation(text) || wantsToCancelBookingFlow(message)) return false;

  // "Cancelar" sin objeto cancela el agendamiento en curso; no una cita guardada.
  return cancellationVerb.test(text) && (
    appointment.test(text) ||
    /\b(?:cancelar|anular|eliminar|borrar|quitar)\s+(?:una|la|esa|alguna)(?:\s+(?:por favor|porfa))?$/.test(text)
  );
}

function appointmentNumberToCancel(message) {
  if (!wantsToCancelExistingAppointment(message)) return null;
  // Una pregunta sobre cómo cancelar no es autorización para cancelar.
  if (/[¿?]/.test(String(message || '')) && !/^\s*¿?\s*(?:quiero|deseo|necesito|por favor)\b/i.test(String(message || ''))) return null;
  const text = normalize(message);
  if (/\b(?:como|que pasa si|que ocurre si|puedo)\b/.test(text)) return null;
  const match = text.match(/\b(?:cancelar|cancela|anular|anula|eliminar|elimina|borrar|quitar)\s+(?:(?:mi|la|esa|una)\s+)?(?:cita|reserva|turno)\s+(?:(?:numero|nro)\s+)?(\d+|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b/);
  if (!match) return null;
  const numbers = { uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };
  return numbers[match[1]] || Number(match[1]);
}

module.exports = { wantsToCancelExistingAppointment, appointmentNumberToCancel, wantsToCancelBookingFlow, wantsToListAppointments, wantsToCreateAppointment };
