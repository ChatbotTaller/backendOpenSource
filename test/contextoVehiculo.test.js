process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters';
process.env.OPENAI_API_KEY = 'test-openai-key';

jest.mock('../src/config/database', () => ({
  query: jest.fn()
}));

jest.mock('../src/agents/contextAgent', () => ({
  obtenerContextoUsuario: jest.fn(),
  guardarContextoUsuario: jest.fn()
}));

jest.mock('../src/agents/memoryAgent', () => ({
  getOrCreateSession: jest.fn(),
  saveMessage: jest.fn(),
  updateConversationContext: jest.fn(),
  getLastContext: jest.fn(),
  getConversationMessages: jest.fn()
}));

jest.mock('../src/services/metricsService', () => ({
  guardarMetrica: jest.fn()
}));

const {
  esDeclaracionVehiculo,
  extraerVehiculo
} = require('../src/utils/dataExtractor');
const {
  obtenerContextoUsuario,
  guardarContextoUsuario
} = require('../src/agents/contextAgent');
const {
  getOrCreateSession,
  saveMessage
} = require('../src/agents/memoryAgent');
const { guardarMetrica } = require('../src/services/metricsService');
const { procesarMensaje } = require('../src/controllers/webhookController');

function crearRespuesta() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };
}

function crearSolicitud(mensaje) {
  return {
    body: { user_message: mensaje, canal: 'texto' },
    cliente: { id: 10, nombre: 'Cliente Prueba', telefono: null },
    clientSessionId: `cs_${'A'.repeat(43)}`,
    authType: 'client'
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  getOrCreateSession.mockResolvedValue({
    usuario: { id: 10, nombre: 'Cliente Prueba', telefono: null },
    conversacion: { id: 20 }
  });
  saveMessage.mockResolvedValue(undefined);
  guardarContextoUsuario.mockResolvedValue(undefined);
  guardarMetrica.mockResolvedValue(undefined);
});

describe('Persistencia explícita del vehículo', () => {
  test('reconoce una declaración de vehículo sin confundirla con una consulta', () => {
    const mensaje = 'Para que sepas, mi vehículo es un Toyota Yaris.';

    expect(esDeclaracionVehiculo(mensaje)).toBe(true);
    expect(extraerVehiculo(mensaje)).toBe('Toyota Yaris');
    expect(esDeclaracionVehiculo('¿Qué vehículo te dije que tengo?')).toBe(false);
    expect(extraerVehiculo('¿Qué vehículo te dije que tengo?')).toBeNull();
  });

  test('guarda el vehículo declarado antes de responder', async () => {
    obtenerContextoUsuario.mockResolvedValue(null);
    const res = crearRespuesta();

    await procesarMensaje(
      crearSolicitud('Mi vehículo es un Toyota Yaris.'),
      res
    );

    expect(guardarContextoUsuario).toHaveBeenCalledWith(
      10,
      20,
      expect.objectContaining({
        vehiculo: 'Toyota Yaris',
        ultimo_intent: 'memory_update'
      })
    );
    expect(guardarMetrica).toHaveBeenCalledWith(
      expect.objectContaining({
        intencion_detectada: 'memory_update',
        canal: 'texto'
      })
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        reply: 'Perfecto, recordaré que tu vehículo es Toyota Yaris.',
        intent: 'memory_update'
      })
    );
  });

  test('recupera el vehículo persistido al consultar los datos', async () => {
    obtenerContextoUsuario.mockResolvedValue({
      nombre: 'Cliente Prueba',
      telefono: null,
      vehiculo: 'Toyota Yaris',
      motivo: null
    });
    const res = crearRespuesta();

    await procesarMensaje(
      crearSolicitud('¿Qué vehículo te dije que tengo?'),
      res
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        reply: 'Sí 😊 Tu vehículo registrado es Toyota Yaris.',
        intent: 'memory'
      })
    );
    expect(guardarMetrica).toHaveBeenCalledWith(
      expect.objectContaining({
        intencion_detectada: 'memory',
        canal: 'texto'
      })
    );
  });

  test('reconoce la variante "qué vehículo tengo registrado"', async () => {
    obtenerContextoUsuario.mockResolvedValue({
      nombre: 'Cliente Prueba',
      telefono: null,
      vehiculo: 'Toyota Yaris',
      motivo: null
    });
    const res = crearRespuesta();

    await procesarMensaje(
      crearSolicitud('¿Qué vehículo tengo registrado?'),
      res
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        reply: 'Sí 😊 Tu vehículo registrado es Toyota Yaris.',
        intent: 'memory'
      })
    );
  });
});
