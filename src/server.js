require('dotenv').config();
const express = require('express');
const cors = require('cors');
const webhookRoutes = require('./routes/webhookRoutes');
const citasRoutes = require('./routes/citasRoutes');
const metricasRoutes = require('./routes/metricasRoutes');
const authRoutes = require('./routes/authRoutes');
const googleRoutes = require('./routes/googleRoutes');
const whatsappRoutes = require('./routes/whatsappRoutes');
const retellRoutes = require('./routes/retellRoutes');
const livekitRoutes = require('./routes/livekitRoutes');
const dniRoutes = require('./routes/dniRoutes');
const healthRoutes = require('./routes/healthRoutes');
const {
  validateStartupEnvironment,
  getCorsOrigins,
  isFeatureEnabled
} = require('./config/environment');
const logger = require('./utils/logger');

const app = express();

const allowedOrigins = getCorsOrigins();

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    const error = new Error('Origen no permitido por CORS');
    error.status = 403;
    return callback(error);
  },
  methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Client-Session',
    'X-Voice-Service-Token'
  ],
  credentials: false
}));
app.use(express.json({ limit: '100kb' }));
app.use((req, res, next) => {
  const startedAt = Date.now();
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    logger.info('http_request_completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      userId: req.cliente?.id || req.admin?.id,
      channel: req.authType === 'voice-service' ? 'voz-simli' : req.body?.canal,
      intent: body?.intent
    });
    return originalJson(body);
  };

  next();
});
app.use('/', healthRoutes);
app.use('/', webhookRoutes);
app.use('/', citasRoutes);
app.use('/', metricasRoutes);
app.use('/', authRoutes);
app.use('/', dniRoutes);
app.use('/', googleRoutes);

if (isFeatureEnabled('ENABLE_WHATSAPP')) app.use('/', whatsappRoutes);
if (isFeatureEnabled('ENABLE_RETELL')) app.use('/', retellRoutes);
if (isFeatureEnabled('ENABLE_LIVEKIT', true)) app.use('/livekit', livekitRoutes);


const PORT = process.env.PORT || 3000;

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

app.get('/', (req, res) => {
  res.send('✅ Backend Taller Reyes Polo funcionando correctamente');
});

function startServer() {
  validateStartupEnvironment();
  return app.listen(PORT, () => {
  console.log(`🚀 Servidor Reyes Polo corriendo en el puerto ${PORT}`);
  });
}

app.get('/politica-privacidad', (req, res) => {
  res.send(`
    <h1>Política de Privacidad - Taller Reyes Polo</h1>
    <p>Esta aplicación utiliza proveedores tecnológicos para validar identidad, procesar consultas, voz y citas.</p>
    <p>Los datos como nombre, teléfono, vehículo y mensajes se usan únicamente para la atención y gestión solicitada.</p>
    <p>Solo se envía a cada proveedor la información necesaria para prestar su función.</p>
    <p>Contacto: m4eg24@gmail.com</p>
  `);
});

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API Taller Reyes Polo',
      version: '1.0.0',
      description: 'Documentación API del chatbot'
    },
    servers: [
      { url: 'https://backendopensource-production.up.railway.app', description: 'Producción' },
      { url: 'http://localhost:3000', description: 'Desarrollo local' }
    ],
    components: {
      securitySchemes: {
        AdminBearer: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        ClientBearer: {
          type: 'http',
          scheme: 'bearer',
          description: 'Sesión opaca entregada después de validar el DNI'
        }
      }
    }
  },
  apis: ['./src/routes/*.js']
};

const swaggerSpec = swaggerJsdoc(options);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use((error, req, res, next) => {
  if (error?.status === 403 && error.message === 'Origen no permitido por CORS') {
    return res.status(403).json({ error: 'Origen no permitido' });
  }

  logger.error('unhandled_request_error', {
    code: error?.code || error?.name,
    path: req.path
  });
  return res.status(500).json({ error: 'Error interno del servidor' });
});

if (require.main === module) {
  try {
    startServer();
  } catch {
    logger.error('startup_configuration_error', { code: 'CONFIG_MISSING' });
    process.exitCode = 1;
  }
}

module.exports = { app, startServer };
