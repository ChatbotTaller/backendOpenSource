const autocannon = require('autocannon');

const prueba = autocannon(
  {
    url: 'http://localhost:3000/webhook',
    method: 'POST',

    connections: 1,
    duration: 10,

    headers: {
      'content-type': 'application/json'
    },

    body: JSON.stringify({
      user_message: 'hola',
      session_id: 'dni_19331864',
      canal: 'web'
    })
  },
  (error, resultado) => {
    if (error) {
      console.error('Error ejecutando la prueba:', error);
      process.exitCode = 1;
      return;
    }

    console.log('\n===== RESUMEN DE LA PRUEBA =====');
    console.log(`Solicitudes totales: ${resultado.requests.total}`);
    console.log(`Promedio req/s: ${resultado.requests.average}`);
    console.log(`Latencia promedio: ${resultado.latency.average} ms`);
    console.log(`Latencia máxima: ${resultado.latency.max} ms`);
    console.log(`Respuestas 2xx: ${resultado['2xx']}`);
    console.log(`Respuestas no 2xx: ${resultado.non2xx}`);
    console.log(`Errores: ${resultado.errors}`);
    console.log(`Timeouts: ${resultado.timeouts}`);

    if (resultado['2xx'] > 0 && resultado.non2xx === 0) {
      console.log('RESULTADO: PRUEBA APROBADA');
    } else {
      console.log('RESULTADO: REVISAR RESPUESTAS HTTP');
    }
  }
);

autocannon.track(prueba, {
  renderProgressBar: true,
  renderResultsTable: true,
  renderLatencyTable: true
});