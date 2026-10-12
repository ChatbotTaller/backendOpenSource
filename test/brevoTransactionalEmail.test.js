const { sendPasswordResetEmail, renderPasswordResetEmail } = require('../src/services/brevoTransactionalEmail');

const resetUrl = 'http://localhost:4200/restablecer-clave#token=token-de-prueba';

afterEach(() => {
  jest.restoreAllMocks();
  delete process.env.BREVO_API_KEY;
  delete process.env.BREVO_SENDER_EMAIL;
  delete process.env.EMAIL_LOGO_URL;
});

test('el correo HTML contiene el logo público y un botón que lleva al frontend local', () => {
  const html = renderPasswordResetEmail(resetUrl);
  expect(html).toContain('https://multichat-reyespolo.vercel.app/ReyesPolo.jpeg');
  expect(html).toContain(`href="${resetUrl}"`);
  expect(html).toContain('Restablecer contraseña');
  expect(html).toContain('15 minutos');
  expect(html).not.toContain('BREVO_API_KEY');
});

test('un logo local no se incluye en el correo y el enlace se escapa como HTML', () => {
  process.env.EMAIL_LOGO_URL = 'http://localhost:4200/ReyesPolo.jpeg';
  const html = renderPasswordResetEmail(`${resetUrl}&valor="prueba"`);
  expect(html).toContain('https://multichat-reyespolo.vercel.app/ReyesPolo.jpeg');
  expect(html).toContain('&amp;valor=&quot;prueba&quot;');
  expect(html).not.toContain('src="http://localhost');
});

test('Brevo recibe HTML, destinatario y remitente configurados sin filtrar la clave en la URL', async () => {
  process.env.BREVO_API_KEY = 'clave-de-prueba';
  process.env.BREVO_SENDER_EMAIL = 'remitente@example.com';
  const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true });

  await sendPasswordResetEmail('destino@example.com', resetUrl);

  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, options] = fetchMock.mock.calls[0];
  const body = JSON.parse(options.body);
  expect(url).toBe('https://api.brevo.com/v3/smtp/email');
  expect(options.headers['api-key']).toBe('clave-de-prueba');
  expect(body.sender.email).toBe('remitente@example.com');
  expect(body.to).toEqual([{ email: 'destino@example.com' }]);
  expect(body.htmlContent).toContain('href="http://localhost:4200/restablecer-clave#token=token-de-prueba"');
  expect(body.textContent).toBeUndefined();
});
