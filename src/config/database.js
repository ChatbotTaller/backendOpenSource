const mysql = require('mysql2');

require('dotenv').config({
  quiet: true
});

const db = mysql.createPool({
  // Variables personalizadas o variables nativas de Railway
  host:
    process.env.DB_HOST ||
    process.env.MYSQLHOST,

  port: Number(
    process.env.DB_PORT ||
    process.env.MYSQLPORT ||
    3306
  ),

  user:
    process.env.DB_USER ||
    process.env.MYSQLUSER,

  password:
    process.env.DB_PASS ||
    process.env.DB_PASSWORD ||
    process.env.MYSQLPASSWORD,

  database:
    process.env.DB_NAME ||
    process.env.MYSQLDATABASE,

  // Configuración del pool
  waitForConnections: true,
  connectionLimit: Number(
    process.env.DB_CONNECTION_LIMIT || 5
  ),
  maxIdle: Number(
    process.env.DB_MAX_IDLE || 5
  ),
  idleTimeout: 60000,
  queueLimit: 0,

  // Mantener activas las conexiones TCP
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,

  connectTimeout: 15000,
  charset: 'utf8mb4'
});

// Comprobar la conexión al arrancar
db.getConnection((error, connection) => {
  if (error) {
    console.error('❌ No se pudo conectar al pool MySQL:', {
      code: error.code,
      message: error.message
    });

    // No usamos throw para evitar tumbar todo el servidor
    return;
  }

  console.log('✅ Pool de conexiones MySQL disponible');
  connection.release();
});

// Registrar desconexiones sin tumbar el proceso
db.on('connection', (connection) => {
  connection.on('error', (error) => {
    console.error('⚠️ Conexión MySQL interrumpida:', {
      code: error.code,
      message: error.message,
      fatal: error.fatal
    });
  });
});

module.exports = db;