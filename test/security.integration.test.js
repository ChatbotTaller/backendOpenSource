process.env.JWT_SECRET = 'test-only-secret-with-at-least-32-characters';
process.env.VOICE_SERVICE_TOKEN = 'test-only-voice-service-token-32-chars';
process.env.LIVEKIT_API_KEY = 'test-key';
process.env.LIVEKIT_API_SECRET = 'test-secret';
process.env.LIVEKIT_URL = 'wss://voice.test.invalid';
process.env.CORS_ORIGINS = 'https://frontend.test';
process.env.ENABLE_RETELL = 'false';
process.env.ENABLE_WHATSAPP = 'false';

jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  promise: jest.fn()
}));

const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../src/config/database');
const { app } = require('../src/server');
const { verificarSesionCliente } = require('../src/middlewares/clientAuthMiddleware');

const CLIENT_TOKEN_A = `cs_${'A'.repeat(43)}`;
const CLIENT_TOKEN_B = `cs_${'B'.repeat(43)}`;

function respond(results, error = null) {
  return (...args) => {
    const callback = args[args.length - 1];
    callback(error, results);
  };
}

function adminToken(extra = {}, options = {}) {
  return jwt.sign(
    { id: 1, usuario: 'admin-test', nombre: 'Admin', role: 'admin', ...extra },
    process.env.JWT_SECRET,
    { expiresIn: '10m', ...options }
  );
}

function mockDniConnection(usuarios = []) {
  const connection = {
    query: jest.fn(),
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn()
  };

  connection.query
    .mockResolvedValueOnce([[{ acquired: 1 }]])
    .mockResolvedValueOnce([usuarios]);

  if (usuarios.length) {
    connection.query
      .mockResolvedValueOnce([{ affectedRows: 1 }])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);
  } else {
    connection.query.mockResolvedValueOnce([{ insertId: 10 }]);
  }

  connection.query.mockResolvedValueOnce([[{ released: 1 }]]);
  db.promise.mockReturnValue({
    getConnection: jest.fn().mockResolvedValue(connection)
  });

  return connection;
}

afterEach(() => {
  db.query.mockReset();
  db.promise.mockReset();
  global.fetch = undefined;
});

describe('Seguridad HTTP e identidad', () => {
  test('DNI inválido devuelve 400', async () => {
    const response = await request(app).post('/dni/verificar').send({ dni: '12ABC' });
    expect(response.status).toBe(400);
  });

  test('DNI válido crea una sesión opaca sin exponer el DNI', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: { nombres: 'Cliente', apellido_paterno: 'Prueba', apellido_materno: 'Segura' }
      })
    });
    mockDniConnection([]);

    const response = await request(app).post('/dni/verificar').send({ dni: '12345678' });

    expect(response.status).toBe(200);
    expect(response.body.session_id).toMatch(/^cs_[A-Za-z0-9_-]{40,}$/);
    expect(response.body.session_id).not.toContain('12345678');
    expect(response.body.usuario.dni).toBeUndefined();
  });

  test('DNI repetido recupera la fila más reciente e invalida sesiones duplicadas', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({
        success: true,
        data: { nombres: 'Cliente', apellido_paterno: 'Prueba', apellido_materno: 'Segura' }
      })
    });
    const connection = mockDniConnection([{ id: 790 }]);

    const response = await request(app).post('/dni/verificar').send({ dni: '12345678' });

    expect(response.status).toBe(200);
    expect(response.body.usuario.id).toBe(790);
    const lockName = connection.query.mock.calls[0][1][0];
    expect(lockName).toMatch(/^dni:[a-f0-9]{60}$/);
    expect(lockName).not.toContain('12345678');
    expect(lockName.length).toBeLessThanOrEqual(64);
    expect(connection.query).toHaveBeenCalledWith(
      expect.stringContaining('ORDER BY id DESC'),
      ['12345678']
    );
    expect(connection.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE dni = ? AND id <> ?'),
      ['12345678', 790]
    );
    expect(connection.commit).toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
  });

  test('sesión válida queda asociada al usuario de la base de datos', async () => {
    db.query.mockImplementationOnce(respond([
      { id: 10, nombre: 'Cliente', telefono: null, session_id: CLIENT_TOKEN_A }
    ]));

    const response = await request(app)
      .get('/cliente/sesion')
      .set('Authorization', `Bearer ${CLIENT_TOKEN_A}`);

    expect(response.status).toBe(200);
    expect(response.body.usuario.id).toBe(10);
  });

  test('sesión inexistente devuelve 401', async () => {
    db.query.mockImplementationOnce(respond([]));
    const response = await request(app)
      .get('/cliente/sesion')
      .set('Authorization', `Bearer ${CLIENT_TOKEN_A}`);
    expect(response.status).toBe(401);
  });

  test('sesión falsificada devuelve 401 sin consultar la base de datos', async () => {
    const response = await request(app)
      .get('/cliente/sesion')
      .set('Authorization', 'Bearer dni_12345678');
    expect(response.status).toBe(401);
    expect(db.query).not.toHaveBeenCalled();
  });

  test('el payload no puede cambiar el usuario de la sesión autenticada', async () => {
    db.query.mockImplementationOnce(respond([
      { id: 10, nombre: 'Cliente A', telefono: null, session_id: CLIENT_TOKEN_A }
    ]));
    const req = {
      headers: { authorization: `Bearer ${CLIENT_TOKEN_A}` },
      body: { session_id: CLIENT_TOKEN_B, usuario_id: 99 }
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await verificarSesionCliente(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.cliente.id).toBe(10);
    expect(req.clientSessionId).toBe(CLIENT_TOKEN_A);
  });

  test('/webhook sin sesión devuelve 401', async () => {
    const response = await request(app).post('/webhook').send({ user_message: 'Hola' });
    expect(response.status).toBe(401);
  });

  test('/webhook rechaza payload inválido después de autenticar', async () => {
    db.query.mockImplementationOnce(respond([
      { id: 10, nombre: 'Cliente', telefono: null, session_id: CLIENT_TOKEN_A }
    ]));
    const response = await request(app)
      .post('/webhook')
      .set('Authorization', `Bearer ${CLIENT_TOKEN_A}`)
      .send({ user_message: { texto: 'no válido' } });
    expect(response.status).toBe(400);
  });

  test('login administrativo válido devuelve JWT con rol admin', async () => {
    const hash = await bcrypt.hash('password-seguro', 4);
    db.query.mockImplementationOnce(respond([
      { id: 1, usuario: 'admin-test', nombre: 'Admin', password: hash }
    ]));

    const response = await request(app)
      .post('/auth/login')
      .send({ usuario: 'admin-test', password: 'password-seguro' });

    expect(response.status).toBe(200);
    expect(jwt.verify(response.body.token, process.env.JWT_SECRET).role).toBe('admin');
  });

  test('login administrativo inválido devuelve 401', async () => {
    const hash = await bcrypt.hash('password-seguro', 4);
    db.query.mockImplementationOnce(respond([
      { id: 1, usuario: 'admin-test', nombre: 'Admin', password: hash }
    ]));
    const response = await request(app)
      .post('/auth/login')
      .send({ usuario: 'admin-test', password: 'incorrecta' });
    expect(response.status).toBe(401);
  });

  test('endpoint administrativo sin JWT devuelve 401', async () => {
    expect((await request(app).get('/citas')).status).toBe(401);
  });

  test('endpoint administrativo con JWT válido permite acceso', async () => {
    db.query.mockImplementationOnce(respond([]));
    const response = await request(app)
      .get('/citas')
      .set('Authorization', `Bearer ${adminToken()}`);
    expect(response.status).toBe(200);
  });

  test('JWT inválido devuelve 401', async () => {
    const response = await request(app)
      .get('/citas')
      .set('Authorization', 'Bearer token-invalido');
    expect(response.status).toBe(401);
  });

  test('JWT expirado devuelve 401', async () => {
    const expired = adminToken({}, { expiresIn: -1 });
    const response = await request(app)
      .get('/citas')
      .set('Authorization', `Bearer ${expired}`);
    expect(response.status).toBe(401);
  });

  test('cliente autenticado intentando acceder a administración recibe 403', async () => {
    db.query.mockImplementationOnce(respond([{ id: 10 }]));
    const response = await request(app)
      .get('/citas')
      .set('Authorization', `Bearer ${CLIENT_TOKEN_A}`);
    expect(response.status).toBe(403);
  });

  test('payload administrativo inválido devuelve 400', async () => {
    const response = await request(app)
      .put('/citas/1')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ estado: 'estado-inexistente' });
    expect(response.status).toBe(400);
  });

  test('ID administrativo inexistente devuelve 404', async () => {
    db.query.mockImplementationOnce(respond([]));
    const response = await request(app)
      .put('/citas/999999')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ estado: 'confirmada' });
    expect(response.status).toBe(404);
  });

  test('/livekit/token exige sesión de cliente', async () => {
    expect((await request(app).post('/livekit/token').send({})).status).toBe(401);
  });

  test('/livekit/token genera sala e identidad del lado servidor', async () => {
    db.query.mockImplementationOnce(respond([
      { id: 10, nombre: 'Cliente', telefono: null, session_id: CLIENT_TOKEN_A }
    ]));

    const response = await request(app)
      .post('/livekit/token')
      .set('Authorization', `Bearer ${CLIENT_TOKEN_A}`)
      .send({ roomName: 'sala-inyectada', participantName: 'identidad-inyectada' });

    expect(response.status).toBe(200);
    expect(response.body.roomName).toMatch(/^mara-user-10--/);
    expect(response.body.roomName).not.toBe('sala-inyectada');
    expect(response.body.participantName).not.toBe('identidad-inyectada');
  });

  test.each([
    ['GET', '/metricas'],
    ['GET', '/metricas/resumen'],
    ['GET', '/metricas/por-intent'],
    ['GET', '/metricas/voz'],
    ['PUT', '/metricas/1'],
    ['GET', '/auth/google']
  ])('%s %s rechaza acceso administrativo sin JWT', async (method, path) => {
    const response = method === 'PUT'
      ? await request(app).put(path).send({})
      : await request(app).get(path);
    expect(response.status).toBe(401);
  });

  test('/webhook/voice exige credencial interna', async () => {
    const response = await request(app)
      .post('/webhook/voice')
      .send({ usuario_id: 10, user_message: 'Hola' });
    expect(response.status).toBe(401);
  });

  test('/webhook/voice rechaza credencial interna incorrecta', async () => {
    const response = await request(app)
      .post('/webhook/voice')
      .set('X-Voice-Service-Token', 'credencial-incorrecta')
      .send({ usuario_id: 10, user_message: 'Hola' });
    expect(response.status).toBe(403);
  });

  test('/webhook/voice valida usuario_id antes de procesar voz', async () => {
    const response = await request(app)
      .post('/webhook/voice')
      .set('X-Voice-Service-Token', process.env.VOICE_SERVICE_TOKEN)
      .send({ usuario_id: 'otro', user_message: 'Hola' });
    expect(response.status).toBe(400);
    expect(db.query).not.toHaveBeenCalled();
  });
});

describe('Salud, disponibilidad y CORS', () => {
  test('/health confirma solamente el proceso', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  test('/ready devuelve 200 cuando MySQL responde', async () => {
    db.query.mockImplementationOnce(respond([{ ready: 1 }]));
    const response = await request(app).get('/ready');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ready');
  });

  test('/ready devuelve 503 cuando MySQL no responde', async () => {
    db.query.mockImplementationOnce(respond(null, new Error('database unavailable')));
    const response = await request(app).get('/ready');
    expect(response.status).toBe(503);
  });

  test('CORS permite el frontend configurado', async () => {
    const response = await request(app)
      .options('/webhook')
      .set('Origin', 'https://frontend.test')
      .set('Access-Control-Request-Method', 'POST');
    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('https://frontend.test');
  });

  test('CORS rechaza un origen no permitido', async () => {
    const response = await request(app)
      .options('/webhook')
      .set('Origin', 'https://origen-no-autorizado.test')
      .set('Access-Control-Request-Method', 'POST');
    expect(response.status).toBe(403);
  });
});
