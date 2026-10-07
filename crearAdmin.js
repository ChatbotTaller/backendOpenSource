const bcrypt = require('bcryptjs');
const db = require('./src/config/database');

async function crearAdmin() {
  const usuario = process.env.ADMIN_USER;
  const passwordPlano = process.env.ADMIN_PASSWORD;
  const nombre = process.env.ADMIN_NAME || 'Administrador';

  if (!usuario || !passwordPlano || passwordPlano.length < 12) {
    console.error('Configura ADMIN_USER y ADMIN_PASSWORD (mínimo 12 caracteres).');
    process.exit(1);
  }

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
