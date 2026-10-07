const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../utils/logger');
const { isValidDni } = require('../utils/validators');

async function crearORecuperarUsuario(dni, nombre, sessionId) {
  const connection = await db.promise().getConnection();
  const lockName = `dni:${crypto
    .createHash('sha256')
    .update(dni)
    .digest('hex')
    .slice(0, 60)}`;
  let lockAcquired = false;
  let transactionStarted = false;

  try {
    const [lockRows] = await connection.query(
      'SELECT GET_LOCK(?, 5) AS acquired',
      [lockName]
    );

    lockAcquired = Number(lockRows[0]?.acquired) === 1;
    if (!lockAcquired) {
      const error = new Error('No se pudo bloquear la identidad del cliente');
      error.code = 'DNI_LOCK_TIMEOUT';
      throw error;
    }

    await connection.beginTransaction();
    transactionStarted = true;

    const [usuarios] = await connection.query(
      `SELECT id
       FROM usuarios
       WHERE dni = ?
       ORDER BY id DESC
       LIMIT 1
       FOR UPDATE`,
      [dni]
    );

    let usuarioId;

    if (usuarios.length) {
      usuarioId = usuarios[0].id;

      // Invalida sesiones antiguas de filas duplicadas del mismo DNI.
      // No borra ni fusiona datos históricos automáticamente.
      await connection.query(
        `UPDATE usuarios
         SET session_id = NULL
         WHERE dni = ? AND id <> ?`,
        [dni, usuarioId]
      );

      await connection.query(
        `UPDATE usuarios
         SET nombre = ?, session_id = ?, canal = 'web', ultima_interaccion = NOW()
         WHERE id = ?`,
        [nombre, sessionId, usuarioId]
      );
    } else {
      const [insertResult] = await connection.query(
        `INSERT INTO usuarios (dni, nombre, session_id, canal, ultima_interaccion)
         VALUES (?, ?, ?, 'web', NOW())`,
        [dni, nombre, sessionId]
      );
      usuarioId = insertResult.insertId;
    }

    await connection.commit();
    transactionStarted = false;

    return { id: usuarioId, nombre };
  } catch (error) {
    if (transactionStarted) {
      try {
        await connection.rollback();
      } catch {}
    }
    throw error;
  } finally {
    if (lockAcquired) {
      try {
        await connection.query('SELECT RELEASE_LOCK(?)', [lockName]);
      } catch {}
    }
    connection.release();
  }
}

async function verificarDni(req, res) {
  try {
    const dni = String(req.body.dni || '').trim();

    if (!isValidDni(dni)) {
      return res.status(400).json({
        success: false,
        message: 'Ingrese un DNI válido.'
      });
    }

    if (!process.env.APIPERU_TOKEN) {
      return res.status(500).json({
        success: false,
        message: 'No se configuró el token de validación DNI.'
      });
    }

    const response = await fetch(`https://apiperu.dev/api/dni/${dni}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${process.env.APIPERU_TOKEN}`,
        Accept: 'application/json'
      }
    });

    const data = await response.json();

    if (
      !data.success ||
      !data.data ||
      !data.data.nombres ||
      !data.data.apellido_paterno
    ) {
      return res.status(404).json({
        success: false,
        message: 'El DNI no existe en RENIEC.'
      });
    }

    const nombreCompleto = [
      data.data.nombres,
      data.data.apellido_paterno,
      data.data.apellido_materno
    ]
      .filter(Boolean)
      .join(' ')
      .trim();

    const sessionId = `cs_${crypto.randomBytes(32).toString('base64url')}`;

    const usuario = await crearORecuperarUsuario(
      dni,
      nombreCompleto,
      sessionId
    );

    return res.json({
      success: true,
      usuario,
      session_id: sessionId
    });

  } catch (error) {
    logger.error('dni_verification_failed', {
      code: error.code || error.name
    });

    return res.status(500).json({
      success: false,
      message: 'No se pudo verificar el DNI.'
    });
  }
}

module.exports = { verificarDni, crearORecuperarUsuario };
