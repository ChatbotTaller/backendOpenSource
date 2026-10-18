const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { sendPasswordResetEmail } = require('../services/brevoTransactionalEmail');

const GENERIC_MESSAGE = 'Si el correo corresponde al administrador configurado, recibirás un enlace para restablecer la contraseña.';
const recentEmails = new Map();
const SEND_INTERVAL_MS = 60 * 1000;

function isStrongPassword(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 128 &&
    /\p{Lu}/u.test(password) && /\p{N}/u.test(password) && /[\p{P}\p{S}]/u.test(password);
}

function getConfig() {
  const { ADMIN_RECOVERY_USER, ADMIN_RECOVERY_EMAIL, ADMIN_RESET_SECRET, BREVO_API_KEY, BREVO_SENDER_EMAIL, FRONTEND_URL } = process.env;
  if (!ADMIN_RECOVERY_USER || !ADMIN_RECOVERY_EMAIL || !ADMIN_RESET_SECRET || !BREVO_API_KEY || !BREVO_SENDER_EMAIL || !FRONTEND_URL) return null;
  if (ADMIN_RESET_SECRET.length < 32 || ADMIN_RESET_SECRET === process.env.JWT_SECRET) return null;

  try {
    const frontend = new URL(FRONTEND_URL);
    const local = ['localhost', '127.0.0.1'].includes(frontend.hostname);
    if (frontend.protocol !== 'https:' && !(local && frontend.protocol === 'http:')) return null;
    if (frontend.username || frontend.password || frontend.search || frontend.hash) return null;
    return { user: ADMIN_RECOVERY_USER, email: ADMIN_RECOVERY_EMAIL.trim().toLowerCase(), secret: ADMIN_RESET_SECRET, frontend };
  } catch {
    return null;
  }
}

function credentialFingerprint(passwordHash, secret) {
  return crypto.createHmac('sha256', secret).update(`admin-reset:${passwordHash}`).digest('hex');
}

function sameFingerprint(actual, expected) {
  if (typeof actual !== 'string' || !/^[a-f0-9]{64}$/.test(actual)) return false;
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

async function requestAdminPasswordReset(req, res) {
  res.set('Cache-Control', 'no-store');
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'Ingresa un correo válido.' });
  }

  const config = getConfig();
  if (!config) return res.status(503).json({ error: 'La recuperación no está configurada temporalmente.' });
  if (email !== config.email) {
    return res.status(404).json({ error: 'Correo no registrado para la recuperación administrativa.' });
  }

  const key = crypto.createHash('sha256').update(email).digest('hex');
  const lastSent = recentEmails.get(key) || 0;
  if (Date.now() - lastSent < SEND_INTERVAL_MS) return res.json({ message: GENERIC_MESSAGE });

  try {
    const [rows] = await db.promise().query(
      'SELECT id, password FROM administradores WHERE usuario = ? LIMIT 1',
      [config.user]
    );
    if (!rows.length) return res.json({ message: GENERIC_MESSAGE });

    const admin = rows[0];
    const token = jwt.sign(
      { credential: credentialFingerprint(admin.password, config.secret) },
      config.secret,
      { subject: String(admin.id), audience: 'admin-password-reset', issuer: 'mara', expiresIn: '15m' }
    );
    const resetUrl = new URL('/restablecer-clave', config.frontend);
    resetUrl.hash = `token=${encodeURIComponent(token)}`;
    await sendPasswordResetEmail(config.email, resetUrl.toString());
    recentEmails.set(key, Date.now());
  } catch (error) {
    // No revelar si el correo o el administrador existen ni imprimir el token.
    console.error('No se pudo enviar la recuperación administrativa:', error.status || error.code || error.name);
  }

  return res.json({ message: GENERIC_MESSAGE });
}

async function resetAdminPassword(req, res) {
  res.set('Cache-Control', 'no-store');
  const { token, password, confirmPassword } = req.body || {};
  if (typeof token !== 'string' || token.length > 2048 ||
      !isStrongPassword(password) || password !== confirmPassword) {
    return res.status(400).json({ error: 'Revisa el enlace. La contraseña debe tener entre 12 y 128 caracteres, una mayúscula, un número y un símbolo; ambos campos deben coincidir.' });
  }

  const config = getConfig();
  if (!config) return res.status(503).json({ error: 'La recuperación no está configurada temporalmente.' });

  let payload;
  try {
    payload = jwt.verify(token, config.secret, { audience: 'admin-password-reset', issuer: 'mara' });
    if (!/^\d+$/.test(payload.sub || '') || !Number.isSafeInteger(Number(payload.sub))) throw new Error('Sujeto inválido');
  } catch {
    return res.status(400).json({ error: 'El enlace es inválido o ha vencido. Solicita uno nuevo.' });
  }

  try {
    const [rows] = await db.promise().query(
      'SELECT id, usuario, password FROM administradores WHERE id = ? LIMIT 1',
      [Number(payload.sub)]
    );
    const admin = rows[0];
    if (!admin || admin.usuario !== config.user ||
        !sameFingerprint(payload.credential, credentialFingerprint(admin.password, config.secret))) {
      return res.status(400).json({ error: 'El enlace es inválido o ya fue utilizado. Solicita uno nuevo.' });
    }

    const newHash = await bcrypt.hash(password, 10);
    const [result] = await db.promise().query(
      'UPDATE administradores SET password = ? WHERE id = ? AND password = ?',
      [newHash, admin.id, admin.password]
    );
    if (result.affectedRows !== 1) {
      return res.status(400).json({ error: 'El enlace es inválido o ya fue utilizado. Solicita uno nuevo.' });
    }
    return res.json({ success: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' });
  } catch (error) {
    console.error('Error al restablecer contraseña administrativa:', error.code || error.name);
    return res.status(500).json({ error: 'No se pudo actualizar la contraseña. Inténtalo más tarde.' });
  }
}

module.exports = { requestAdminPasswordReset, resetAdminPassword };
