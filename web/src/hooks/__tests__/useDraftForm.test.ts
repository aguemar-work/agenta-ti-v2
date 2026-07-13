/**
 * src/hooks/__tests__/useDraftForm.test.ts
 * Auto-guardado de borrador de formulario en localStorage.
 *
 * IMPORTANTE: `initialValues` va en el array de deps de un useEffect interno del
 * hook. Los call sites reales siempre lo memoizan con useMemo — un objeto
 * literal inline recreado en cada render dispara un loop de renders infinito
 * (cada commit crea un nuevo `initialValues`, dispara el efecto, vuelve a
 * setFormRaw, vuelve a renderizar...). Por eso aquí se usa una constante
 * estable en vez de `{ titulo: '' }` inline en cada renderHook.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDraftForm } from '@/hooks/useDraftForm';

const INITIAL = { titulo: '' };

beforeEach(() => {
  localStorage.clear();
});

describe('useDraftForm', () => {
  it('sin borrador guardado, arranca con los valores iniciales y restoredFromDraft=false', () => {
    const { result } = renderHook(() => useDraftForm('k1', INITIAL));

    expect(result.current.form).toEqual(INITIAL);
    expect(result.current.restoredFromDraft).toBe(false);
    expect(result.current.hasChanges).toBe(false);
  });

  it('detecta cambios y los persiste en localStorage bajo el prefijo mc_draft_', () => {
    const { result } = renderHook(() => useDraftForm('k2', INITIAL));

    act(() => { result.current.setForm({ titulo: 'Nuevo título' }); });

    expect(result.current.hasChanges).toBe(true);
    expect(JSON.parse(localStorage.getItem('mc_draft_k2')!)).toEqual({ titulo: 'Nuevo título' });
  });

  it('al remontar con la misma key, restaura el borrador guardado', () => {
    const first = renderHook(() => useDraftForm('k3', INITIAL));
    act(() => { first.result.current.setForm({ titulo: 'Borrador a medias' }); });
    first.unmount();

    const { result } = renderHook(() => useDraftForm('k3', INITIAL));

    expect(result.current.form).toEqual({ titulo: 'Borrador a medias' });
    expect(result.current.restoredFromDraft).toBe(true);
  });

  it('volver al valor inicial borra el draft de localStorage (no deja basura)', () => {
    const { result } = renderHook(() => useDraftForm('k4', INITIAL));
    act(() => { result.current.setForm({ titulo: 'Algo' }); });
    expect(localStorage.getItem('mc_draft_k4')).not.toBeNull();

    act(() => { result.current.setForm({ titulo: '' }); });

    expect(localStorage.getItem('mc_draft_k4')).toBeNull();
    expect(result.current.hasChanges).toBe(false);
  });

  it('clearDraft borra el borrador y resetea restoredFromDraft', () => {
    const { result } = renderHook(() => useDraftForm('k5', INITIAL));
    act(() => { result.current.setForm({ titulo: 'Algo' }); });

    act(() => { result.current.clearDraft(); });

    expect(localStorage.getItem('mc_draft_k5')).toBeNull();
    expect(result.current.restoredFromDraft).toBe(false);
  });

  it('con enabled:false, no lee ni escribe borrador', () => {
    localStorage.setItem('mc_draft_k6', JSON.stringify({ titulo: 'ignorar' }));
    const { result } = renderHook(() => useDraftForm('k6', INITIAL, { enabled: false }));

    expect(result.current.form).toEqual(INITIAL);
    act(() => { result.current.setForm({ titulo: 'Cambio' }); });
    expect(localStorage.getItem('mc_draft_k6')).toBe(JSON.stringify({ titulo: 'ignorar' })); // sin tocar
  });
});
