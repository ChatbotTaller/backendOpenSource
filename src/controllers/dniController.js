const db = require('../config/database');

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

async function verificarDni(req, res) {
  try {
    const dni = String(req.body.dni || '').trim();

    if (!/^\d{8}$/.test(dni) || dni === '00000000') {
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
    console.log(JSON.stringify(data, null, 2));

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

    const sessionId = `dni_${dni}`;

    await query(
      `
      INSERT INTO usuarios (dni, nombre, session_id, canal, ultima_interaccion)
      VALUES (?, ?, ?, 'web', NOW())
      ON DUPLICATE KEY UPDATE
        nombre = VALUES(nombre),
        session_id = VALUES(session_id),
        ultima_interaccion = NOW()
      `,
      [dni, nombreCompleto, sessionId]
    );

    const usuarios = await query(
      `
      SELECT id, dni, nombre, telefono, session_id
      FROM usuarios
      WHERE dni = ?
      LIMIT 1
      `,
      [dni]
    );

    return res.json({
      success: true,
      usuario: usuarios[0],
      session_id: sessionId
    });

  } catch (error) {
    console.error('Error verificando DNI:', error);

    return res.status(500).json({
      success: false,
      message: 'No se pudo verificar el DNI.'
    });
  }
}

module.exports = { verificarDni };