describe('Pruebas unitarias - Validación de DNI', () => {

  function validarDni(dni) {
    return /^\d{8}$/.test(String(dni || '').trim());
  }

  test('Debe aceptar un DNI válido de 8 dígitos', () => {
    expect(validarDni('19331864')).toBe(true);
  });

  test('Debe rechazar un DNI con menos de 8 dígitos', () => {
    expect(validarDni('1234567')).toBe(false);
  });

  test('Debe rechazar un DNI con letras', () => {
    expect(validarDni('ABC12345')).toBe(false);
  });

  test('Debe rechazar un DNI vacío', () => {
    expect(validarDni('')).toBe(false);
  });

});