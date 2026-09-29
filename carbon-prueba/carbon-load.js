'use strict';

const autocannon = require('autocannon');

function readArgument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1]
    ? process.argv[index + 1]
    : fallback;
}

const baseUrl = readArgument('base-url', 'http://127.0.0.1:3100');
const duration = Number(readArgument('duration', '60'));
const connections = Number(readArgument('connections', '20'));

if (!Number.isFinite(duration) || duration <= 0) {
  throw new Error('--duration debe ser un numero positivo.');
}

if (!Number.isFinite(connections) || connections <= 0) {
  throw new Error('--connections debe ser un numero positivo.');
}

const startedAt = new Date().toISOString();

autocannon(
  {
    url: baseUrl,
    connections,
    duration,
    pipelining: 1,
    timeout: 10,
    requests: [
      { method: 'GET', path: '/' },
      { method: 'GET', path: '/politica-privacidad' }
    ]
  },
  (error, result) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
      return;
    }

    const summary = {
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      base_url: baseUrl,
      duration_seconds: result.duration,
      connections,
      requests_total: result.requests.total,
      requests_per_second: result.requests.average,
      latency_average_ms: result.latency.average,
      latency_p99_ms: result.latency.p99,
      responses_2xx: result['2xx'],
      responses_non_2xx: result.non2xx,
      errors: result.errors,
      timeouts: result.timeouts
    };

    process.stdout.write(`${JSON.stringify(summary)}\n`);

    if (
      summary.requests_total === 0 ||
      summary.responses_non_2xx > 0 ||
      summary.errors > 0 ||
      summary.timeouts > 0
    ) {
      process.exitCode = 2;
    }
  }
);
