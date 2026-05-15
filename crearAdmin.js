const bcrypt = require('bcryptjs');
const db = require('./src/config/database');

async function crearAdmin() {
  const usuario = 'admin';
  const passwordPlano = '123456';
  const nombre = 'Administrador';

  const passwordHash = await bcrypt.hash(passwordPlano, 10);

  const sql = `
    INSERT INTO administradores (usuario, password, nombre)
    VALUES (?, ?, ?)
  `;

  db.query(sql, [usuario, passwordHash, nombre], (err) => {
    if (err) {
      console.error('Error creando admin:', err);
      process.exit(1);
    }

    console.log('Admin creado correctamente');
    process.exit(0);
  });
}

crearAdmin();