const db = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function loginAdmin(req, res) {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({
      error: 'Usuario y contraseña son obligatorios'
    });
  }

  const sql = `
    SELECT *
    FROM administradores
    WHERE usuario = ?
    LIMIT 1
  `;

  db.query(sql, [usuario], async (err, results) => {
    if (err) {
      console.error('Error login:', err);
      return res.status(500).json({ error: 'Error en servidor' });
    }

    if (results.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const admin = results[0];
    const passwordValida = await bcrypt.compare(password, admin.password);

    if (!passwordValida) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        usuario: admin.usuario,
        nombre: admin.nombre
      },
      process.env.JWT_SECRET || 'clave_temporal_desarrollo',
      { expiresIn: '2h' }
    );

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        usuario: admin.usuario,
        nombre: admin.nombre
      }
    });
  });
}

module.exports = { loginAdmin };