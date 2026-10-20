const db = require('../config/database');
const logger = require('../utils/logger');

const VALID_STATES = new Set(['pendiente', 'confirmada', 'completada', 'cancelada']);
const VALID_PERIODS = new Set(['30', '90', '365', 'all']);
const VALID_PART_SORTS = new Set(['name', 'price_asc', 'price_desc']);
const STOP_WORDS = new Set([
  'de', 'del', 'la', 'las', 'el', 'los', 'para', 'por', 'con', 'sin', 'un', 'una',
  'servicio', 'servicios', 'revision', 'reparacion', 'mantenimiento', 'vehiculo', 'auto'
]);

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.query(sql, params, (error, results) => {
      if (error) return reject(error);
      resolve(results);
    });
  });
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function significantTokens(value) {
  return normalizeText(value)
    .split(' ')
    .filter(token => token.length >= 4 && !STOP_WORDS.has(token));
}

function buildDateFilter(column, period, params) {
  const normalized = VALID_PERIODS.has(String(period)) ? String(period) : '30';
  if (normalized === 'all') return '';

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - Number(normalized));
  params.push(cutoff.toISOString().slice(0, 10));
  return `${column} >= ?`;
}

function matchService(text, services) {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return null;

  let best = null;
  let bestScore = 0;

  for (const service of services) {
    const normalizedName = normalizeText(service.nombre);
    if (!normalizedName) continue;

    if (normalizedText.includes(normalizedName)) return service.nombre;

    const tokens = significantTokens(service.nombre);
    const score = tokens.reduce(
      (total, token) => total + (normalizedText.includes(token) ? Math.max(token.length, 4) : 0),
      0
    );

    if (score > bestScore) {
      bestScore = score;
      best = service.nombre;
    }
  }

  return bestScore >= 4 ? best : null;
}

function aggregateServiceMentions(rows, services, field) {
  const counts = new Map();

  for (const row of rows) {
    const service = matchService(row[field], services);
    if (!service) continue;
    counts.set(service, (counts.get(service) || 0) + 1);
  }

  return [...counts.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'));
}

async function obtenerClientesConCitas(req, res) {
  const page = clampInteger(req.query.page, 1, 1, 100000);
  const limit = clampInteger(req.query.limit, 10, 5, 50);
  const search = String(req.query.search || '').trim().slice(0, 80);
  const status = VALID_STATES.has(String(req.query.status)) ? String(req.query.status) : '';
  const period = VALID_PERIODS.has(String(req.query.period)) ? String(req.query.period) : '30';

  const where = [];
  const params = [];
  const dateFilter = buildDateFilter('fecha', period, params);
  if (dateFilter) where.push(dateFilter);
  if (status) {
    where.push('estado = ?');
    params.push(status);
  }
  if (search) {
    where.push('(cliente_nombre LIKE ? OR cliente_telefono LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const groupedSql = `
    SELECT
      COALESCE(usuario_id, 0) AS usuario_id,
      COALESCE(NULLIF(TRIM(cliente_nombre), ''), 'Cliente sin nombre') AS cliente_nombre,
      COALESCE(NULLIF(TRIM(cliente_telefono), ''), 'Sin teléfono') AS cliente_telefono,
      COUNT(*) AS total_citas,
      SUM(CASE WHEN estado = 'completada' THEN 1 ELSE 0 END) AS completadas,
      SUM(CASE WHEN estado = 'cancelada' THEN 1 ELSE 0 END) AS canceladas,
      MAX(fecha) AS ultima_cita
    FROM citas
    ${whereSql}
    GROUP BY usuario_id, cliente_nombre, cliente_telefono
  `;

  try {
    const [countRows, items, chartRows, totalRows] = await Promise.all([
      query(`SELECT COUNT(*) AS total FROM (${groupedSql}) AS clientes`, params),
      query(`${groupedSql} ORDER BY total_citas DESC, ultima_cita DESC LIMIT ? OFFSET ?`, [
        ...params,
        limit,
        (page - 1) * limit
      ]),
      query(`${groupedSql} ORDER BY total_citas DESC, ultima_cita DESC LIMIT 10`, params),
      query(`
        SELECT COUNT(*) AS total_citas,
               COUNT(DISTINCT COALESCE(usuario_id, CONCAT(cliente_nombre, ':', cliente_telefono))) AS total_clientes
        FROM citas
        ${whereSql}
      `, params)
    ]);

    const totalClients = Number(countRows[0]?.total || 0);
    const totalAppointments = Number(totalRows[0]?.total_citas || 0);

    res.json({
      summary: {
        total_clients: Number(totalRows[0]?.total_clientes || 0),
        total_appointments: totalAppointments,
        repeat_clients: Math.max(totalAppointments - Number(totalRows[0]?.total_clientes || 0), 0)
      },
      items: items.map(row => ({
        ...row,
        total_citas: Number(row.total_citas || 0),
        completadas: Number(row.completadas || 0),
        canceladas: Number(row.canceladas || 0)
      })),
      chart: chartRows.map(row => ({
        name: row.cliente_nombre,
        total: Number(row.total_citas || 0)
      })),
      pagination: {
        page,
        limit,
        total: totalClients,
        pages: Math.max(Math.ceil(totalClients / limit), 1)
      }
    });
  } catch (error) {
    logger.error('admin_clients_insight_failed', { code: error.code });
    res.status(500).json({ error: 'No se pudo obtener la actividad de clientes' });
  }
}

async function obtenerDemandaServicios(req, res) {
  const period = VALID_PERIODS.has(String(req.query.period)) ? String(req.query.period) : '30';
  const metricParams = [];
  const appointmentParams = [];
  const metricDate = buildDateFilter('fecha', period, metricParams);
  const appointmentDate = buildDateFilter('fecha', period, appointmentParams);

  try {
    const [services, questions, appointments] = await Promise.all([
      query('SELECT nombre FROM servicios ORDER BY nombre ASC'),
      query(`
        SELECT pregunta
        FROM metricas_chatbot
        WHERE intencion_detectada = 'services'
          ${metricDate ? `AND ${metricDate}` : ''}
      `, metricParams),
      query(`
        SELECT motivo
        FROM citas
        WHERE estado <> 'cancelada'
          ${appointmentDate ? `AND ${appointmentDate}` : ''}
      `, appointmentParams)
    ]);

    const consulted = aggregateServiceMentions(questions, services, 'pregunta');
    const booked = aggregateServiceMentions(appointments, services, 'motivo');

    res.json({
      consulted,
      booked,
      summary: {
        service_catalog: services.length,
        matched_consultations: consulted.reduce((sum, item) => sum + item.total, 0),
        matched_appointments: booked.reduce((sum, item) => sum + item.total, 0)
      },
      methodology: 'Agrupación automática por coincidencia de términos con el catálogo de servicios.'
    });
  } catch (error) {
    logger.error('admin_service_demand_failed', { code: error.code });
    res.status(500).json({ error: 'No se pudo calcular la demanda de servicios' });
  }
}

async function obtenerCatalogoRepuestos(req, res) {
  const page = clampInteger(req.query.page, 1, 1, 100000);
  const limit = clampInteger(req.query.limit, 10, 5, 50);
  const search = String(req.query.search || '').trim().slice(0, 80);
  const sort = VALID_PART_SORTS.has(String(req.query.sort)) ? String(req.query.sort) : 'name';
  const params = [];
  const whereSql = search ? 'WHERE codigo LIKE ? OR descripcion LIKE ?' : '';
  if (search) params.push(`%${search}%`, `%${search}%`);

  const orderBy = {
    name: 'descripcion ASC',
    price_asc: 'precio_venta ASC, descripcion ASC',
    price_desc: 'precio_venta DESC, descripcion ASC'
  }[sort];

  try {
    const [countRows, items, summaryRows] = await Promise.all([
      query(`SELECT COUNT(*) AS total FROM inventario ${whereSql}`, params),
      query(`
        SELECT codigo, descripcion, precio_venta
        FROM inventario
        ${whereSql}
        ORDER BY ${orderBy}
        LIMIT ? OFFSET ?
      `, [...params, limit, (page - 1) * limit]),
      query(`
        SELECT COUNT(*) AS total,
               AVG(precio_venta) AS precio_promedio,
               MAX(precio_venta) AS precio_maximo
        FROM inventario
        ${whereSql}
      `, params)
    ]);

    const total = Number(countRows[0]?.total || 0);
    res.json({
      items: items.map(item => ({
        ...item,
        precio_venta: Number.isFinite(Number(item.precio_venta)) ? Number(item.precio_venta) : null
      })),
      summary: {
        total: Number(summaryRows[0]?.total || 0),
        average_price: Number(summaryRows[0]?.precio_promedio || 0),
        highest_price: Number(summaryRows[0]?.precio_maximo || 0)
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1)
      }
    });
  } catch (error) {
    logger.error('admin_parts_catalog_failed', { code: error.code });
    res.status(500).json({ error: 'No se pudo obtener el catálogo de repuestos' });
  }
}

module.exports = {
  obtenerClientesConCitas,
  obtenerDemandaServicios,
  obtenerCatalogoRepuestos,
  normalizeText,
  matchService,
  aggregateServiceMentions
};
