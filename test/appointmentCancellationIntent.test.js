process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters';
process.env.OPENAI_API_KEY = 'test-openai-key';

jest.mock('../src/config/database', () => ({ query: jest.fn() }));
jest.mock('../src/agents/contextAgent', () => ({ obtenerContextoUsuario: jest.fn(), guardarContextoUsuario: jest.fn() }));
jest.mock('../src/agents/memoryAgent', () => ({
  getOrCreateSession: jest.fn(), saveMessage: jest.fn(), updateConversationContext: jest.fn(),
  getLastContext: jest.fn(), getConversationMessages: jest.fn()
}));
jest.mock('../src/agents/appointmentAgent', () => jest.fn());
jest.mock('../src/services/metricsService', () => ({ guardarMetrica: jest.fn() }));
jest.mock('../src/services/citaOwnershipService', () => ({ cancelarCitaPropiaPorId: jest.fn() }));
jest.mock('../src/agents/scheduleAgent', () => jest.fn());
jest.mock('../src/services/aiService', () => ({ generarRespuesta: jest.fn() }));

const db = require('../src/config/database');
const appointmentAgent = require('../src/agents/appointmentAgent');
const memory = require('../src/agents/memoryAgent');
const { guardarMetrica } = require('../src/services/metricsService');
const { cancelarCitaPropiaPorId } = require('../src/services/citaOwnershipService');
const scheduleAgent = require('../src/agents/scheduleAgent');
const aiService = require('../src/services/aiService');
const { classifyIntent } = require('../src/agents/classifierAgent');
const {
  appointmentNumberToCancel,
  wantsToCancelExistingAppointment,
  wantsToCancelBookingFlow,
  wantsToListAppointments,
  wantsToCreateAppointment
} = require('../src/utils/appointmentCancellationIntent');
const { procesarMensaje } = require('../src/controllers/webhookController');

beforeEach(() => {
  jest.clearAllMocks();
  memory.getOrCreateSession.mockResolvedValue({
    usuario: { id: 10, nombre: 'Cliente Prueba' },
    conversacion: { id: 20 }
  });
  memory.saveMessage.mockResolvedValue();
  cancelarCitaPropiaPorId.mockResolvedValue({ status: 'cancelled' });
  scheduleAgent.mockResolvedValue({ intent: 'schedule', data: [{ dia: 'Lunes', horario: '08:00-18:00' }] });
  aiService.generarRespuesta.mockResolvedValue('Atendemos de lunes a viernes de 08:00 a 18:00.');
  db.query.mockImplementation((sql, params, callback) => {
    if (sql.includes('FROM citas') && sql.includes('estado IN')) {
      return callback(null, [{
        id: 3, fecha: '2026-11-20', hora: '09:00', estado: 'pendiente',
        motivo: 'Cambio de aceite', vehiculo_texto: 'Toyota Yaris'
      }]);
    }
    callback(null, sql.includes('SELECT') ? [] : { affectedRows: 1 });
  });
});

function solicitud(message) {
  return {
    body: { user_message: message, canal: 'texto' },
    cliente: { id: 10, nombre: 'Cliente Prueba' },
    clientSessionId: `cs_${'A'.repeat(43)}`,
    authType: 'client'
  };
}

function respuesta() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

test.each([
  'quiero eliminar una cita',
  'Quiero eliminar esa cita, por favor.',
  'quiero cancelar mi cita',
  'quiero eliminar una',
  'quiero cancelar una cita que ha sido registrada',
  'Quiero eliminar una cita que he tenido registrada, por favor.'
])('solicitud de cancelación no inicia agendamiento: %s', async message => {
  const req = {
    body: { user_message: message, canal: 'texto' },
    cliente: { id: 10, nombre: 'Cliente Prueba' },
    clientSessionId: `cs_${'A'.repeat(43)}`,
    authType: 'client'
  };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };

  await procesarMensaje(req, res);

  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    intent: 'appointment_cancel',
    reply: expect.stringContaining('dime cuál deseas cancelar')
  }));
  expect(db.query).toHaveBeenCalledWith(
    'DELETE FROM estado_cita_temporal WHERE usuario_id = ?', [10], expect.any(Function)
  );
  expect(appointmentAgent).not.toHaveBeenCalled();
  expect(guardarMetrica).toHaveBeenCalledWith(expect.objectContaining({
    intencion_detectada: 'appointment_cancel'
  }));
});

test.each([
  'cancelar',
  'Cancelar, por favor.',
  'Quiero cancelar el agendamiento.',
  'ya no quiero agendar'
])('distingue cancelar el formulario de cancelar una cita guardada: %s', message => {
  expect(wantsToCancelBookingFlow(message)).toBe(true);
  expect(wantsToCancelExistingAppointment(message)).toBe(false);
  expect(wantsToCreateAppointment(message)).toBe(false);
});

test.each([
  'Quisiera que me des las citas que tengo registradas.',
  '¿Cuáles son mis citas pendientes?',
  'quiero saber mis citas agendadas'
])('consulta citas existentes sin abrir el formulario: %s', message => {
  expect(wantsToListAppointments(message)).toBe(true);
  expect(wantsToCreateAppointment(message)).toBe(false);
  expect(classifyIntent(message)).toBe('appointment_query');
});

test('clasifica cancelar una cita aparte de agendar y del cancelar del formulario', () => {
  expect(classifyIntent('quiero eliminar una cita')).toBe('appointment_cancel');
  expect(classifyIntent('quiero agendar una cita')).toBe('appointment');
  expect(classifyIntent('cancelar')).toBe('appointment');
  expect(wantsToCancelExistingAppointment('cancelar agendamiento')).toBe(false);
  expect(wantsToCancelExistingAppointment('cancelar una reparación')).toBe(false);
  expect(wantsToCancelExistingAppointment('no quiero cancelar mi cita')).toBe(false);
  expect(wantsToCancelExistingAppointment('cancelar el proceso de agendamiento de mi cita')).toBe(false);
  expect(appointmentNumberToCancel('eliminar la cita 2')).toBe(2);
  expect(appointmentNumberToCancel('anular cita número 3')).toBe(3);
  expect(appointmentNumberToCancel('no quiero cancelar la cita 2')).toBeNull();
  expect(appointmentNumberToCancel('¿Cómo puedo cancelar la cita 2?')).toBeNull();
});

test('"eliminar la cita 1" cancela una cita propia y no abre un agendamiento', async () => {
  const res = respuesta();
  await procesarMensaje(solicitud('Quiero eliminar la cita 1.'), res);

  expect(cancelarCitaPropiaPorId).toHaveBeenCalledWith(10, 3);
  expect(appointmentAgent).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ intent: 'appointment_cancelled' }));
  expect(guardarMetrica).toHaveBeenCalledWith(expect.objectContaining({
    intencion_detectada: 'appointment_cancelled'
  }));
});

test('la ruta de voz procesa la misma cancelación y registra el canal voz-simli', async () => {
  const req = solicitud('quiero cancelar una cita que ha sido registrada');
  req.authType = 'voice-service';
  req.body.canal = 'texto';
  const res = respuesta();

  await procesarMensaje(req, res);

  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    intent: 'appointment_cancel',
    appointment_in_progress: false
  }));
  expect(appointmentAgent).not.toHaveBeenCalled();
  expect(guardarMetrica).toHaveBeenCalledWith(expect.objectContaining({
    intencion_detectada: 'appointment_cancel',
    canal: 'voz-simli',
    stt_exitoso: 1
  }));
});

test('consulta cuántos vehículos tiene usando solo datos del cliente autenticado', async () => {
  db.query.mockImplementation((sql, params, callback) => {
    if (sql.includes('SELECT DISTINCT TRIM(vehiculo_texto)')) {
      expect(params).toEqual([10]);
      return callback(null, [{ vehiculo: 'Nissan Sentra' }, { vehiculo: 'Kia Sportage' }]);
    }
    if (sql.includes('FROM estado_cita_temporal')) return callback(null, []);
    callback(null, sql.includes('SELECT') ? [] : { affectedRows: 1 });
  });
  const res = respuesta();

  await procesarMensaje(solicitud('¿Cuántos vehículos tengo registrados?'), res);

  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    intent: 'vehicle_query',
    reply: expect.stringContaining('2 descripciones de vehículos asociadas')
  }));
  expect(aiService.generarRespuesta).not.toHaveBeenCalled();
});

test('una pregunta de horarios durante el agendamiento responde y mantiene el paso', async () => {
  db.query.mockImplementation((sql, params, callback) => {
    if (sql.includes('FROM estado_cita_temporal')) return callback(null, [{ paso: 'motivo' }]);
    callback(null, sql.includes('SELECT') ? [] : { affectedRows: 1 });
  });
  const res = respuesta();
  await procesarMensaje(solicitud('¿Cuáles son sus horarios?'), res);

  expect(scheduleAgent).toHaveBeenCalled();
  expect(appointmentAgent).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    intent: 'schedule',
    reply: expect.stringContaining('Tu agendamiento sigue pendiente')
  }));
  expect(db.query.mock.calls.some(([sql]) => /DELETE FROM estado_cita_temporal|UPDATE estado_cita_temporal/.test(sql))).toBe(false);
});

test('"hola" durante el paso de detalle no se guarda como servicio', async () => {
  db.query.mockImplementation((sql, params, callback) => {
    if (sql.includes('FROM estado_cita_temporal')) return callback(null, [{ paso: 'motivo' }]);
    callback(null, sql.includes('SELECT') ? [] : { affectedRows: 1 });
  });
  const res = respuesta();
  await procesarMensaje(solicitud('hola'), res);

  expect(appointmentAgent).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    reply: expect.stringContaining('trabajo o problema concreto de tu vehículo')
  }));
  expect(db.query.mock.calls.some(([sql]) => /UPDATE estado_cita_temporal/.test(sql))).toBe(false);
});
