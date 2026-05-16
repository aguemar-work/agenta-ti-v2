import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  markModalCompleted,
  pathToModule,
  trackModalClose,
  trackModalOpen,
  trackPageView,
} from '@/lib/analytics';

describe('analytics', () => {
  beforeEach(() => {
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mapea rutas a módulos de producto', () => {
    expect(pathToModule('/semana')).toBe('mi_semana');
    expect(pathToModule('/objetivos')).toBe('objetivos');
    expect(pathToModule('/ordenes-trabajo')).toBe('ordenes_trabajo');
    expect(pathToModule('/metricas')).toBe('metricas');
  });

  it('registra abandono de modal si no se marca completado', () => {
    const debug = vi.spyOn(console, 'debug');
    trackModalOpen('test-modal');
    trackModalClose('test-modal');
    const closeCall = debug.mock.calls.find((c) => c[1] === 'modal_close');
    expect(closeCall).toBeDefined();
    expect(closeCall?.[2]).toMatchObject({
      modalId: 'test-modal',
      completed: false,
      abandoned: true,
    });
  });

  it('registra modal completado cuando se marca antes de cerrar', () => {
    const debug = vi.spyOn(console, 'debug');
    trackModalOpen('test-modal-ok');
    markModalCompleted('test-modal-ok');
    trackModalClose('test-modal-ok');
    const closeCall = debug.mock.calls.find(
      (c) => c[1] === 'modal_close' && (c[2] as { modalId?: string }).modalId === 'test-modal-ok',
    );
    expect(closeCall?.[2]).toMatchObject({ completed: true, abandoned: false });
  });

  it('trackPageView incluye módulo', () => {
    const debug = vi.spyOn(console, 'debug');
    trackPageView('/objetivos');
    expect(debug).toHaveBeenCalledWith(
      '[analytics]',
      'page_view',
      expect.objectContaining({ pathname: '/objetivos', module: 'objetivos' }),
    );
  });
});
