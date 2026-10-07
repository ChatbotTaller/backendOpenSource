function write(level, event, details = {}) {
  const safeDetails = {};
  const blockedKeys = [
    'dni', 'password', 'token', 'jwt', 'session_id', 'sessionId',
    'message', 'mensaje', 'pregunta', 'respuesta'
  ];

  for (const [key, value] of Object.entries(details || {})) {
    if (!blockedKeys.includes(key) && value !== undefined) {
      safeDetails[key] = value;
    }
  }

  const output = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...safeDetails
  });

  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}

module.exports = {
  info: (event, details) => write('info', event, details),
  warn: (event, details) => write('warn', event, details),
  error: (event, details) => write('error', event, details)
};
