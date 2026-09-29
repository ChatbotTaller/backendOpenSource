'use strict';

require('dotenv').config();
const autocannon = require('autocannon');

const BASE_URL = process.env.LOAD_BASE_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.LOAD_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.LOAD_ADMIN_PASSWORD || '123456';
const DNI = process.env.LOAD_DNI || '19331864';
const PROFILE = (process.env.LOAD_PROFILE || 'normal').toLowerCase();

const STRESS = PROFILE === 'stress';
const READ_C = STRESS ? 50 : 20;
const READ_D = STRESS ? 30 : 15;
const LIGHT_C = STRESS ? 20 : 10;
const LIGHT_D = STRESS ? 20 : 10;

const summaries = [];

async function jsonRequest(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `${options.method || 'GET'} ${path} -> ${response.status}: ${text}`
    );
  }

  return data;
}

async function prepare() {
  await jsonRequest('/');

  const login = await jsonRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      usuario: ADMIN_USER,
      password: ADMIN_PASSWORD
    })
  });

  const dni = await jsonRequest('/dni/verificar', {
    method: 'POST',
    body: JSON.stringify({ dni: DNI })
  });

  const auth = {
    authorization: `Bearer ${login.token}`
  };

  const citas = await jsonRequest('/citas', { headers: auth });
  const cita =
    citas.find(c => c.id && c.estado && c.estado !== 'cancelada') ||
    citas.find(c => c.id && c.estado);

  const metricas = await jsonRequest('/metricas', { headers: auth });
  const metrica = metricas.find(m => m.id);

  if (!login.token) throw new Error('No se obtuvo JWT.');
  if (!dni.session_id) throw new Error('No se obtuvo session_id.');
  if (!cita) throw new Error('No existe una cita para la prueba PUT.');
  if (!metrica) throw new Error('No existe una metrica para la prueba PUT.');

  return {
    token: login.token,
    sessionId: dni.session_id,
    cita,
    metrica
  };
}

function run(name, options) {
  return new Promise((resolve, reject) => {
    console.log(`\n\n========== ${name} ==========`);

    const instance = autocannon(
      {
        timeout: 30,
        pipelining: 1,
        ...options
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        const passed =
          result.requests.total > 0 &&
          result['2xx'] > 0 &&
          result.non2xx === 0 &&
          result.errors === 0 &&
          result.timeouts === 0;

        const row = {
          prueba: name,
          solicitudes: result.requests.total,
          req_s: result.requests.average,
          latencia_ms: result.latency.average,
          max_ms: result.latency.max,
          respuestas_2xx: result['2xx'],
          no_2xx: result.non2xx,
          errores: result.errors,
          timeouts: result.timeouts,
          estado: passed ? 'APROBADA' : 'REVISAR'
        };

        summaries.push(row);

        console.log('\n===== RESUMEN =====');
        console.log(row);
        resolve(result);
      }
    );

    autocannon.track(instance, {
      renderProgressBar: true,
      renderResultsTable: true,
      renderLatencyTable: false
    });
  });
}

async function main() {
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Perfil: ${PROFILE}`);

  const data = await prepare();

  const auth = {
    authorization: `Bearer ${data.token}`
  };

  const json = {
    'content-type': 'application/json'
  };

  const authJson = {
    ...auth,
    ...json
  };

  const sameMetricAnswer =
    data.metrica.respuesta_correcta == null
      ? 1
      : Number(data.metrica.respuesta_correcta);

  const sameMetricIntent =
    data.metrica.intencion_correcta ||
    data.metrica.intencion_detectada ||
    'inventory';

  const tests = [
    {
      name: 'PC-01 GET /',
      options: {
        url: `${BASE_URL}/`,
        connections: LIGHT_C,
        duration: LIGHT_D
      }
    },
    {
      name: 'PC-02 GET /politica-privacidad',
      options: {
        url: `${BASE_URL}/politica-privacidad`,
        connections: LIGHT_C,
        duration: LIGHT_D
      }
    },
    {
      name: 'PC-03 POST /auth/login',
      options: {
        url: `${BASE_URL}/auth/login`,
        method: 'POST',
        connections: STRESS ? 10 : 5,
        duration: STRESS ? 20 : 10,
        headers: json,
        body: JSON.stringify({
          usuario: ADMIN_USER,
          password: ADMIN_PASSWORD
        })
      }
    },
    {
      name: 'PC-04 POST /dni/verificar (controlada)',
      options: {
        url: `${BASE_URL}/dni/verificar`,
        method: 'POST',
        connections: 1,
        amount: STRESS ? 10 : 5,
        headers: json,
        body: JSON.stringify({ dni: DNI })
      }
    },
    {
      name: 'PC-05 GET /citas',
      options: {
        url: `${BASE_URL}/citas`,
        connections: READ_C,
        duration: READ_D,
        headers: auth
      }
    },
    {
      name: 'PC-06 PUT /citas/:id',
      options: {
        url: `${BASE_URL}/citas/${data.cita.id}`,
        method: 'PUT',
        connections: STRESS ? 5 : 2,
        amount: STRESS ? 100 : 20,
        headers: authJson,
        body: JSON.stringify({ estado: data.cita.estado })
      }
    },
    {
      name: 'PC-07 GET /metricas',
      options: {
        url: `${BASE_URL}/metricas`,
        connections: READ_C,
        duration: READ_D,
        headers: auth
      }
    },
    {
      name: 'PC-08 PUT /metricas/:id',
      options: {
        url: `${BASE_URL}/metricas/${data.metrica.id}`,
        method: 'PUT',
        connections: STRESS ? 5 : 2,
        amount: STRESS ? 100 : 20,
        headers: authJson,
        body: JSON.stringify({
          respuesta_correcta: sameMetricAnswer,
          intencion_correcta: sameMetricIntent
        })
      }
    },
    {
      name: 'PC-09 GET /metricas/resumen',
      options: {
        url: `${BASE_URL}/metricas/resumen`,
        connections: READ_C,
        duration: READ_D,
        headers: auth
      }
    },
    {
      name: 'PC-10 GET /metricas/por-intent',
      options: {
        url: `${BASE_URL}/metricas/por-intent`,
        connections: READ_C,
        duration: READ_D,
        headers: auth
      }
    },
    {
      name: 'PC-11 GET /metricas/voz',
      options: {
        url: `${BASE_URL}/metricas/voz`,
        connections: READ_C,
        duration: READ_D,
        headers: auth
      }
    },
    {
      name: 'PC-12 POST /webhook (flujo rapido)',
      options: {
        url: `${BASE_URL}/webhook`,
        method: 'POST',
        connections: LIGHT_C,
        duration: LIGHT_D,
        headers: json,
        body: JSON.stringify({
          user_message: 'Que hora es',
          session_id: data.sessionId,
          canal: 'web'
        })
      }
    },
    {
      name: 'PC-13 POST /webhook (conversacional)',
      options: {
        url: `${BASE_URL}/webhook`,
        method: 'POST',
        connections: STRESS ? 3 : 1,
        amount: STRESS ? 30 : 10,
        headers: json,
        body: JSON.stringify({
          user_message: 'hola',
          session_id: data.sessionId,
          canal: 'web'
        })
      }
    },
    {
      name: 'PC-14 POST /retell/chat',
      options: {
        url: `${BASE_URL}/retell/chat`,
        method: 'POST',
        connections: 1,
        amount: STRESS ? 10 : 5,
        headers: json,
        body: JSON.stringify({
          message: 'hola',
          session_id: data.sessionId
        })
      }
    },
    {
      name: 'PC-15 POST /livekit/token',
      options: {
        url: `${BASE_URL}/livekit/token`,
        method: 'POST',
        connections: LIGHT_C,
        duration: LIGHT_D,
        headers: json,
        body: JSON.stringify({
          roomName: 'mara-room-load-test',
          participantName: 'autocannon'
        })
      }
    },
    {
      name: 'PC-16 POST /webhook-whatsapp (evento vacio)',
      options: {
        url: `${BASE_URL}/webhook-whatsapp`,
        method: 'POST',
        connections: LIGHT_C,
        duration: LIGHT_D,
        headers: json,
        body: JSON.stringify({
          object: 'whatsapp_business_account',
          entry: []
        })
      }
    }
  ];

  for (const test of tests) {
    await run(test.name, test.options);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  await run('PC-17 CARGA GENERAL MIXTA', {
    url: BASE_URL,
    connections: STRESS ? 50 : 20,
    duration: STRESS ? 30 : 20,
    requests: [
      { method: 'GET', path: '/' },
      { method: 'GET', path: '/politica-privacidad' },
      { method: 'GET', path: '/citas', headers: auth },
      { method: 'GET', path: '/metricas', headers: auth },
      { method: 'GET', path: '/metricas/resumen', headers: auth },
      { method: 'GET', path: '/metricas/por-intent', headers: auth },
      { method: 'GET', path: '/metricas/voz', headers: auth },
      {
        method: 'POST',
        path: '/webhook',
        headers: json,
        body: JSON.stringify({
          user_message: 'Que hora es',
          session_id: data.sessionId,
          canal: 'web'
        })
      },
      {
        method: 'POST',
        path: '/livekit/token',
        headers: json,
        body: JSON.stringify({
          roomName: 'mara-room-mixed-test',
          participantName: 'autocannon-mixed'
        })
      }
    ]
  });

  console.log('\n\n========== TABLA GENERAL ==========');
  console.table(summaries);

  const approved = summaries.filter(r => r.estado === 'APROBADA').length;
  console.log(`Aprobadas: ${approved}/${summaries.length}`);

  console.log('\nRutas no saturadas deliberadamente:');
  console.log('- GET /auth/google/callback');
  console.log('- POST /retell/create-web-call');
  console.log('- POST /webhook-whatsapp con mensaje real');
  console.log('Dependen de OAuth o servicios externos y deben probarse solo una vez.');
}

main().catch(error => {
  console.error('\nPRUEBA INTERRUMPIDA');
  console.error(error);
  process.exitCode = 1;
});
