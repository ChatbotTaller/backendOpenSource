const {
  procesarFlujoGeneral
} = require('../src/services/flujoGeneralService');

describe('PU-06 - Prueba general del flujo principal del sistema', () => {
  test('Debe completar correctamente el flujo de identificación, sesión y cita', () => {
    const resultado = procesarFlujoGeneral({
      dni: '19331864',
      mensaje: 'Quiero agendar una cita para mantenimiento',
      cita: {
        nombre: 'Juan Pérez',
        telefono: '987654321',
        vehiculo: 'Toyota Yaris',
        fecha: '2026-08-15',
        hora: '10:00'
      },
      estado: 'pendiente'
    });

    expect(resultado.success).toBe(true);
    expect(resultado.etapa).toBe('cita_lista_para_registro');
    expect(resultado.sessionId).toBe('dni_19331864');
    expect(resultado.intent).toBe('appointment');
    expect(resultado.cita.estado).toBe('pendiente');
  });

  test('Debe detener el flujo cuando el DNI es inválido', () => {
    const resultado = procesarFlujoGeneral({
      dni: '1234567',
      mensaje: 'Quiero agendar una cita'
    });

    expect(resultado.success).toBe(false);
    expect(resultado.etapa).toBe('validacion_dni');
  });

  test('Debe clasificar correctamente una consulta que no requiere cita', () => {
    const resultado = procesarFlujoGeneral({
      dni: '19331864',
      mensaje: '¿Cuál es el horario de atención?'
    });

    expect(resultado.success).toBe(true);
    expect(resultado.etapa).toBe('respuesta_chatbot');
    expect(resultado.sessionId).toBe('dni_19331864');
    expect(resultado.intent).toBe('schedule');
  });

  test('Debe rechazar una cita con datos obligatorios incompletos', () => {
    const resultado = procesarFlujoGeneral({
      dni: '19331864',
      mensaje: 'Quiero agendar una cita',
      cita: {
        nombre: 'Juan Pérez',
        telefono: '987654321',
        vehiculo: 'Toyota Yaris',
        hora: '10:00'
      }
    });

    expect(resultado.success).toBe(false);
    expect(resultado.etapa).toBe('validacion_cita');
  });

  test('Debe rechazar una cita con teléfono inválido', () => {
    const resultado = procesarFlujoGeneral({
      dni: '19331864',
      mensaje: 'Quiero agendar una cita',
      cita: {
        nombre: 'Juan Pérez',
        telefono: '812345678',
        vehiculo: 'Toyota Yaris',
        fecha: '2026-08-15',
        hora: '10:00'
      }
    });

    expect(resultado.success).toBe(false);
    expect(resultado.etapa).toBe('validacion_telefono');
  });

  test('Debe rechazar un estado de cita no permitido', () => {
    const resultado = procesarFlujoGeneral({
      dni: '19331864',
      mensaje: 'Quiero agendar una cita',
      cita: {
        nombre: 'Juan Pérez',
        telefono: '987654321',
        vehiculo: 'Toyota Yaris',
        fecha: '2026-08-15',
        hora: '10:00'
      },
      estado: 'en proceso'
    });

    expect(resultado.success).toBe(false);
    expect(resultado.etapa).toBe('validacion_estado');
  });
});
