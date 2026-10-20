jest.mock('../src/config/database', () => ({ query: jest.fn() }));

const {
  normalizeText,
  matchService,
  aggregateServiceMentions
} = require('../src/controllers/adminInsightsController');

describe('Analítica administrativa', () => {
  const services = [
    { nombre: 'Cambio de aceite' },
    { nombre: 'Revisión de frenos' },
    { nombre: 'Reparación de suspensión' }
  ];

  test('normaliza tildes y signos para comparar consultas', () => {
    expect(normalizeText('¡Revisión de suspensión!')).toBe('revision de suspension');
  });

  test('asocia una consulta natural con el catálogo de servicios', () => {
    expect(matchService('Quiero revisar los frenos de mi auto', services)).toBe('Revisión de frenos');
    expect(matchService('Necesito cambio de aceite', services)).toBe('Cambio de aceite');
  });

  test('ignora mensajes sin términos de un servicio real', () => {
    expect(matchService('hola también', services)).toBeNull();
  });

  test('agrupa y ordena la demanda por frecuencia', () => {
    const result = aggregateServiceMentions([
      { pregunta: 'precio del cambio de aceite' },
      { pregunta: 'necesito cambio de aceite' },
      { pregunta: 'revisión de frenos' }
    ], services, 'pregunta');

    expect(result).toEqual([
      { name: 'Cambio de aceite', total: 2 },
      { name: 'Revisión de frenos', total: 1 }
    ]);
  });
});
