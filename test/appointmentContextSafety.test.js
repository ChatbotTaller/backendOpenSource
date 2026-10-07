jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  promise: jest.fn()
}));

jest.mock('../src/services/googleCalendarService', () => ({
  crearEventoCita: jest.fn(),
  eliminarEventoCita: jest.fn()
}));

jest.mock('../src/services/citaOwnershipService', () => ({
  cancelarCitaPropiaPorDatos: jest.fn()
}));

const db = require('../src/config/database');
const appointmentAgent = require('../src/agents/appointmentAgent');
const {
  extraerMotivo,
  esMotivoCitaValido
} = require('../src/utils/dataExtractor');

function prepararEstado(estado, citasPrevias = []) {
  db.query.mockImplementation((sql, params, callback) => {
    if (sql.includes('SELECT * FROM estado_cita_temporal')) {
      callback(null, [estado]);
      return;
    }

    if (sql.includes('SELECT cliente_nombre, vehiculo_texto')) {
      callback(null, citasPrevias);
      return;
    }

    callback(null, { affectedRows: 1 });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Protección del contexto durante el agendamiento', () => {
  test('no considera "Agendar cita" como servicio o problema', () => {
    expect(extraerMotivo('quiero agendar una cita')).toBeNull();
    expect(extraerMotivo('¿Cuál es el problema que tienes registrado?')).toBeNull();
    expect(esMotivoCitaValido('Agendar cita')).toBe(false);
    expect(extraerMotivo('cambio de aceite')).toBe('Cambio de aceite');
  });

  test('después del teléfono confirma el vehículo y no hereda un motivo anterior', async () => {
    prepararEstado({
      paso: 'telefono',
      nombre: 'Carmen Gomez',
      telefono: null,
      vehiculo: 'Toyota Yaris',
      motivo: null
    });

    const resultado = await appointmentAgent('949939879', 10, {
      vehiculo: 'Toyota Yaris',
      motivo: 'Agendar cita'
    });

    const actualizacion = db.query.mock.calls.find(([sql]) =>
      sql.includes('SET telefono = ?, vehiculo = ?, motivo = NULL, paso = ?')
    );

    expect(actualizacion).toBeDefined();
    expect(actualizacion[1]).toEqual([
      '949939879',
      'Toyota Yaris',
      'confirmar_vehiculo',
      10
    ]);
    expect(resultado.reply).toContain('¿Deseas usarlo para esta cita?');
    expect(resultado.reply).not.toContain('problema registrado');
  });

  test('impide registrar la fecha si el motivo temporal está contaminado', async () => {
    prepararEstado({
      paso: 'fecha',
      nombre: 'Carmen Gomez',
      telefono: '949939879',
      vehiculo: 'Toyota Yaris',
      motivo: 'Agendar cita'
    });

    const resultado = await appointmentAgent(
      'mañana a las 9 de la mañana',
      10,
      null
    );

    expect(resultado.success).toBe(false);
    expect(resultado.reply).toContain('servicio o problema real');
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining("paso = 'motivo'"),
      [10],
      expect.any(Function)
    );
  });
});
