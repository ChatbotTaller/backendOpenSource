jest.mock('../src/config/database', () => ({ query: jest.fn() }));

const db = require('../src/config/database');
const {
  cancelarCitaPropiaPorId,
  cancelarCitaPropiaPorDatos
} = require('../src/services/citaOwnershipService');

function respond(results, error = null) {
  return (...args) => args[args.length - 1](error, results);
}

afterEach(() => db.query.mockReset());

describe('Propiedad e integridad de citas', () => {
  test('rechaza un ID inválido', async () => {
    expect(await cancelarCitaPropiaPorId(1, 'abc')).toEqual({ status: 'invalid' });
    expect(db.query).not.toHaveBeenCalled();
  });

  test('informa cita inexistente', async () => {
    db.query.mockImplementationOnce(respond([]));
    expect(await cancelarCitaPropiaPorId(1, 999)).toEqual({ status: 'not_found' });
  });

  test('impide cancelar una cita ajena', async () => {
    db.query.mockImplementationOnce(respond([
      { id: 20, usuario_id: 2, estado: 'pendiente', google_event_id: null }
    ]));
    expect(await cancelarCitaPropiaPorId(1, 20)).toEqual({ status: 'forbidden' });
    expect(db.query).toHaveBeenCalledTimes(1);
  });

  test('permite cancelar una cita propia activa', async () => {
    db.query
      .mockImplementationOnce(respond([
        { id: 20, usuario_id: 1, estado: 'confirmada', google_event_id: null }
      ]))
      .mockImplementationOnce(respond({ affectedRows: 1 }));

    const result = await cancelarCitaPropiaPorId(1, 20);
    expect(result.status).toBe('cancelled');
  });

  test('no permite cancelar una cita completada', async () => {
    db.query.mockImplementationOnce(respond([
      { id: 20, usuario_id: 1, estado: 'completada', google_event_id: null }
    ]));
    expect((await cancelarCitaPropiaPorId(1, 20)).status).toBe('conflict');
  });

  test('la cancelación por datos primero limita la búsqueda al usuario', async () => {
    db.query.mockImplementationOnce(respond([]));
    const result = await cancelarCitaPropiaPorDatos(1, '2026-12-01', '10:00', '999999999');
    expect(result.status).toBe('not_found');
    expect(db.query.mock.calls[0][1][0]).toBe(1);
  });
});
