process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-characters';
process.env.ADMIN_RESET_SECRET = 'different-test-reset-secret-with-at-least-32-characters';
process.env.ADMIN_RECOVERY_USER = 'admin';
process.env.ADMIN_RECOVERY_EMAIL = 'miguelaeg241@gmail.com';
process.env.BREVO_API_KEY = 'test-brevo-api-key';
process.env.BREVO_SENDER_EMAIL = 'miguelaeg241@gmail.com';
process.env.FRONTEND_URL = 'https://frontend.test';
process.env.ENABLE_RETELL = 'false';
process.env.ENABLE_WHATSAPP = 'false';

jest.mock('../src/config/database', () => ({ query: jest.fn(), promise: jest.fn() }));
jest.mock('../src/services/brevoTransactionalEmail', () => ({ sendPasswordResetEmail: jest.fn() }));

const request = require('supertest');
const bcrypt = require('bcryptjs');
const db = require('../src/config/database');
const { sendPasswordResetEmail } = require('../src/services/brevoTransactionalEmail');
const { app } = require('../src/server');

afterEach(() => {
  db.promise.mockReset();
  sendPasswordResetEmail.mockReset();
});

test('solicitud con correo no configurado responde genéricamente sin enviar', async () => {
  const response = await request(app).post('/auth/password-reset/request').send({ email: 'otro@example.com' });
  expect(response.status).toBe(200);
  expect(response.body.message).toMatch(/Si el correo corresponde/);
  expect(sendPasswordResetEmail).not.toHaveBeenCalled();
});

test('solicitud válida envía un enlace de 15 minutos al correo configurado', async () => {
  const originalHash = await bcrypt.hash('old-password-with-12-chars', 4);
  db.promise.mockReturnValue({ query: jest.fn().mockResolvedValue([[{ id: 7, password: originalHash }]]) });
  sendPasswordResetEmail.mockResolvedValue(undefined);

  const response = await request(app).post('/auth/password-reset/request').send({ email: 'miguelaeg241@gmail.com' });
  expect(response.status).toBe(200);
  expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  expect(sendPasswordResetEmail.mock.calls[0][0]).toBe('miguelaeg241@gmail.com');
  const url = new URL(sendPasswordResetEmail.mock.calls[0][1]);
  expect(url.origin).toBe('https://frontend.test');
  expect(url.pathname).toBe('/restablecer-clave');
  expect(url.hash).toMatch(/^#token=/);
});

test('enlace válido cambia contraseña y deja de funcionar tras el primer uso', async () => {
  const originalHash = await bcrypt.hash('old-password-with-12-chars', 4);
  const query = jest.fn()
    .mockResolvedValueOnce([[{ id: 7, usuario: 'admin', password: originalHash }]])
    .mockResolvedValueOnce([{ affectedRows: 1 }]);
  db.promise.mockReturnValue({ query });
  const crypto = require('crypto');
  const jwt = require('jsonwebtoken');
  const credential = crypto.createHmac('sha256', process.env.ADMIN_RESET_SECRET)
    .update(`admin-reset:${originalHash}`).digest('hex');
  const token = jwt.sign({ credential }, process.env.ADMIN_RESET_SECRET, {
    subject: '7', audience: 'admin-password-reset', issuer: 'mara', expiresIn: '15m'
  });

  const response = await request(app).post('/auth/password-reset/confirm').send({
    token, password: 'Nueva-Clave-123!', confirmPassword: 'Nueva-Clave-123!'
  });
  expect(response.status).toBe(200);
  expect(await bcrypt.compare('Nueva-Clave-123!', query.mock.calls[1][1][0])).toBe(true);
  expect(query.mock.calls[1][0]).toMatch(/WHERE id = \? AND password = \?/);

  const updatedHash = query.mock.calls[1][1][0];
  db.promise.mockReturnValue({ query: jest.fn().mockResolvedValue([[{ id: 7, usuario: 'admin', password: updatedHash }]]) });
  const replay = await request(app).post('/auth/password-reset/confirm').send({
    token, password: 'Otra-Clave-456!', confirmPassword: 'Otra-Clave-456!'
  });
  expect(replay.status).toBe(400);
});

test('enlace vencido y contraseñas cortas son rechazados', async () => {
  const jwt = require('jsonwebtoken');
  const expired = jwt.sign({ credential: 'a'.repeat(64) }, process.env.ADMIN_RESET_SECRET, {
    subject: '7', audience: 'admin-password-reset', issuer: 'mara', expiresIn: -1
  });
  const response = await request(app).post('/auth/password-reset/confirm').send({
    token: expired, password: 'Clave-Expirada-123!', confirmPassword: 'Clave-Expirada-123!'
  });
  expect(response.status).toBe(400);
  expect(db.promise).not.toHaveBeenCalled();
  const short = await request(app).post('/auth/password-reset/confirm').send({
    token: expired, password: 'short', confirmPassword: 'short'
  });
  expect(short.status).toBe(400);
});

test.each([
  ['sin mayúscula', 'clave-segura-123!'],
  ['sin número', 'Clave-segura-fuerte!'],
  ['sin símbolo', 'ClaveSegura12345'],
  ['menos de 12 caracteres', 'Clave12!']
])('rechaza contraseña %s antes de consultar la base', async (_name, password) => {
  const response = await request(app).post('/auth/password-reset/confirm').send({
    token: 'token-de-prueba', password, confirmPassword: password
  });
  expect(response.status).toBe(400);
  expect(response.body.error).toMatch(/mayúscula.*número.*símbolo/);
  expect(db.promise).not.toHaveBeenCalled();
});
