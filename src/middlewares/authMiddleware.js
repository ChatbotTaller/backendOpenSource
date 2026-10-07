const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { getRequiredEnv } = require('../config/environment');

function clientTokenExists(token) {
  return new Promise((resolve, reject) => {
    db.query(
      `SELECT id FROM usuarios WHERE session_id = ? AND estado = 'activo' LIMIT 1`,
      [token],
      (error, results) => {
        if (error) return reject(error);
        resolve(results.length > 0);
      }
    );
  });
}

async function verificarToken(req, res, next) {
  const authHeader = String(req.headers.authorization || '');
  const [scheme, bearerToken] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !bearerToken) {
    return res.status(401).json({
      error: 'Token no proporcionado'
    });
  }

  const token = bearerToken;

  try {
    const decoded = jwt.verify(
      token,
      getRequiredEnv('JWT_SECRET')
    );

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Permisos insuficientes' });
    }

    req.admin = decoded;
    next();

  } catch (error) {
    if (/^cs_[A-Za-z0-9_-]{40,}$/.test(token)) {
      try {
        if (await clientTokenExists(token)) {
          return res.status(403).json({
            error: 'El cliente no puede acceder a funciones administrativas'
          });
        }
      } catch {
        return res.status(500).json({ error: 'No se pudo validar la autorización' });
      }
    }

    if (error.message?.includes('Falta la variable de entorno')) {
      return res.status(500).json({
        error: 'Autenticación administrativa no configurada'
      });
    }

    return res.status(401).json({
      error: 'Token expirado o inválido'
    });
  }
}

module.exports = { verificarToken };
