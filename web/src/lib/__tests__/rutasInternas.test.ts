import { describe, expect, it } from 'vitest';

import { destinoPostLogin } from '@/lib/rutasInternas';

describe('destinoPostLogin', () => {
  it('redirige legacy /hoy y /login a /semana', () => {
    expect(destinoPostLogin('/hoy')).toBe('/semana');
    expect(destinoPostLogin('/login')).toBe('/semana');
  });

  it('acepta rutas internas válidas', () => {
    expect(destinoPostLogin('/semana')).toBe('/semana');
    expect(destinoPostLogin('/objetivos')).toBe('/objetivos');
    expect(destinoPostLogin('/ordenes-trabajo')).toBe('/ordenes-trabajo');
  });

  it('rechaza rutas externas o desconocidas', () => {
    expect(destinoPostLogin('//evil.com')).toBe('/semana');
    expect(destinoPostLogin('/admin')).toBe('/semana');
    expect(destinoPostLogin(undefined)).toBe('/semana');
  });
});
