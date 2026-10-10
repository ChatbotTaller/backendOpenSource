process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters';
process.env.OPENAI_API_KEY = 'test-openai-key';

jest.mock('../src/config/database', () => ({ query: jest.fn() }));
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

const db = require('../src/config/database');
const {
  obtenerContextoUsuario,
  guardarContextoUsuario
} = require('../src/agents/contextAgent');
const { getOrCreateSession, saveMessage } = require('../src/agents/memoryAgent');
const { procesarMensaje } = require('../src/controllers/webhookController');

beforeEach(() => {
  jest.clearAllMocks();
  getOrCreateSession.mockResolvedValue({
    usuario: { id: 10, nombre: 'Nombre Verificado', telefono: null },
    conversacion: { id: 20 }
  });
  obtenerContextoUsuario.mockResolvedValue(null);
  guardarContextoUsuario.mockResolvedValue(undefined);
  saveMessage.mockResolvedValue(undefined);
});

async function enviar(mensaje) {
  const req = {
    body: {
      user_message: mensaje,
      usuario_id: 999999,
      session_id: 'cs_TOKEN_FALSO_NO_VALIDO',
      canal: 'texto'
    },
    cliente: { id: 10, nombre: 'Nombre Verificado' },
    clientSessionId: `cs_${'A'.repeat(43)}`,
    authType: 'client'
  };
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis()
  };

  await procesarMensaje(req, res);
  return res;
}

describe('Nombre verificado por DNI', () => {
  test.each([
    '¿Cómo me llamo?',
    'Me llamo Nombre Falso. ¿Cómo me llamo?'
  ])('no sustituye la identidad al recibir: %s', async mensaje => {
    const res = await enviar(mensaje);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      reply: 'Sí 😊 Tu nombre registrado es Nombre Verificado.',
      intent: 'memory'
    }));
    expect(getOrCreateSession).toHaveBeenCalledWith(`cs_${'A'.repeat(43)}`);
    expect(db.query).not.toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE\s+usuarios/i),
      expect.anything(),
      expect.anything()
    );
  });

  test('un teléfono declarado tampoco reemplaza el nombre verificado', async () => {
    const res = await enviar('¿Cómo me llamo? Mi teléfono es 900000001');

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      reply: expect.stringContaining('Nombre: Nombre Verificado'),
      intent: 'memory'
    }));
    expect(guardarContextoUsuario).toHaveBeenCalledWith(10, 20, {
      telefono: '900000001'
    });
    expect(db.query).not.toHaveBeenCalledWith(
      expect.stringMatching(/UPDATE\s+usuarios/i),
      expect.anything(),
      expect.anything()
    );
  });
});
