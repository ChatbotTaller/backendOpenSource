const crypto = require('crypto');
const db = require('../config/database');
const { getRequiredEnv } = require('../config/environment');
const { isPositiveInteger } = require('../utils/validators');

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });
}

function readBearerToken(req) {
  const [scheme, token] = String(req.headers.authorization || '').split(' ');
  return scheme === 'Bearer' && token ? token.trim() : null;
}

async function verificarSesionCliente(req, res, next) {
  try {
    const token = readBearerToken(req) || req.headers['x-client-session'];

    if (!token) {
      return res.status(401).json({ error: 'Sesión de cliente no proporcionada' });
    }

    if (!/^cs_[A-Za-z0-9_-]{40,}$/.test(String(token))) {
      return res.status(401).json({ error: 'Sesión de cliente inválida' });
    }

    const users = await query(
      `SELECT id, nombre, telefono, session_id
       FROM usuarios
       WHERE session_id = ? AND estado = 'activo'
       LIMIT 1`,
      [token]
    );

    if (!users.length) {
      return res.status(401).json({ error: 'Sesión de cliente inválida' });
    }

    req.cliente = users[0];
    req.clientSessionId = users[0].session_id;
    req.authType = 'client';
    next();
  } catch {
    return res.status(500).json({ error: 'No se pudo validar la sesión' });
  }
}

async function verificarServicioVoz(req, res, next) {
  try {
    const received = String(req.headers['x-voice-service-token'] || '');
    let expected;

    try {
      expected = getRequiredEnv('VOICE_SERVICE_TOKEN');
    } catch {
      return res.status(503).json({ error: 'Servicio de voz no configurado' });
    }

    if (!received) {
      return res.status(401).json({ error: 'Credencial de servicio no proporcionada' });
    }

    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);
    if (
      receivedBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
    ) {
      return res.status(403).json({ error: 'Credencial de servicio inválida' });
    }

    const userId = req.body?.usuario_id;
    if (!isPositiveInteger(userId)) {
      return res.status(400).json({ error: 'usuario_id inválido' });
    }

    const users = await query(
      `SELECT id, nombre, telefono, session_id
       FROM usuarios
       WHERE id = ? AND estado = 'activo'
       LIMIT 1`,
      [Number(userId)]
    );

    if (!users.length) return res.status(404).json({ error: 'Cliente no encontrado' });

    req.cliente = users[0];
    req.clientSessionId = users[0].session_id;
    req.authType = 'voice-service';
    next();
  } catch {
    return res.status(500).json({ error: 'No se pudo validar el servicio de voz' });
  }
}

module.exports = { readBearerToken, verificarSesionCliente, verificarServicioVoz };
