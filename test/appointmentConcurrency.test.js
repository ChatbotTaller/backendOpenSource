jest.mock('../src/config/database', () => ({
  query: jest.fn(),
  promise: jest.fn()
}));

jest.mock('../src/services/googleCalendarService', () => ({
  crearEventoCita: jest.fn().mockResolvedValue(null),
  eliminarEventoCita: jest.fn().mockResolvedValue(undefined)
}));

const db = require('../src/config/database');
const appointmentAgent = require('../src/agents/appointmentAgent');

describe('Reserva concurrente de citas', () => {
  test('revalida dentro de la transacción y rechaza un horario solapado', async () => {
    const connection = {
      beginTransaction: jest.fn().mockResolvedValue(undefined),
      commit: jest.fn().mockResolvedValue(undefined),
      rollback: jest.fn().mockResolvedValue(undefined),
      release: jest.fn(),
      query: jest.fn()
        .mockResolvedValueOnce([[{ acquired: 1 }]])
        .mockResolvedValueOnce([[{ hora: '10:00:00' }]])
        .mockResolvedValueOnce([[{ released: 1 }]])
    };
    db.promise.mockReturnValue({
      getConnection: jest.fn().mockResolvedValue(connection)
    });

    const result = await appointmentAgent.__test.registrarCitaConControl({
      usuarioId: 1,
      fecha: '2026-12-10',
      hora: '11:00',
      nombre: 'Cliente de prueba',
      telefono: '999999999',
      vehiculo: 'Vehículo de prueba',
      motivo: 'Servicio de prueba'
    });

    expect(result.conflict).toBe(true);
    expect(connection.rollback).toHaveBeenCalled();
    expect(connection.commit).not.toHaveBeenCalled();
    expect(connection.release).toHaveBeenCalled();
    expect(connection.query.mock.calls.some(([sql]) => /INSERT INTO citas/.test(sql))).toBe(false);
  });
});
