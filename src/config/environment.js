const DEFAULT_CORS_ORIGINS = [
  'http://localhost:4200',
  'http://127.0.0.1:4200',
  'https://front-open-source.vercel.app'
];

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value || !String(value).trim()) {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  }

  return String(value).trim();
}

function hasDatabaseConfiguration() {
  const host = process.env.DB_HOST || process.env.MYSQLHOST;
  const user = process.env.DB_USER || process.env.MYSQLUSER;
  const password = process.env.DB_PASS || process.env.DB_PASSWORD || process.env.MYSQLPASSWORD;
  const database = process.env.DB_NAME || process.env.MYSQLDATABASE;

  return Boolean(host && user && password && database);
}

function validateStartupEnvironment() {
  const missing = [];

  for (const name of ['JWT_SECRET', 'OPENAI_API_KEY', 'APIPERU_TOKEN']) {
    if (!process.env[name] || !String(process.env[name]).trim()) {
      missing.push(name);
    }
  }

  if (!hasDatabaseConfiguration()) {
    missing.push('configuración MySQL');
  }

  if (process.env.ENABLE_LIVEKIT !== 'false') {
    for (const name of [
      'LIVEKIT_API_KEY',
      'LIVEKIT_API_SECRET',
      'LIVEKIT_URL',
      'VOICE_SERVICE_TOKEN'
    ]) {
      if (!process.env[name] || !String(process.env[name]).trim()) {
        missing.push(name);
      }
    }
  }

  if (missing.length) {
    throw new Error(`Configuración incompleta. Variables requeridas: ${missing.join(', ')}`);
  }
}

function getCorsOrigins() {
  const configured = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  return [...new Set([...DEFAULT_CORS_ORIGINS, ...configured])];
}

function isFeatureEnabled(name, defaultValue = false) {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return String(value).toLowerCase() === 'true';
}

module.exports = {
  getRequiredEnv,
  validateStartupEnvironment,
  getCorsOrigins,
  isFeatureEnabled
};
