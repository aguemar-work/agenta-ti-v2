/**
 * hooks/useDraftForm.ts
 *
 * Auto-guarda el estado de un formulario en localStorage mientras el usuario escribe.
 * Al reabrir el modal, recupera el borrador automáticamente.
 * Detecta si hay cambios respecto al estado inicial para mostrar confirmación al cerrar.
 *
 * Uso:
 *   const { form, setForm, hasChanges, clearDraft } = useDraftForm('ot-nueva', initialValues);
 *
 *   // Pasar hasChanges al Modal:
 *   <Modal hasUnsavedChanges={hasChanges} ...>
 *
 *   // Al guardar o cancelar explícitamente:
 *   clearDraft();
 *
 * La key debe ser única por formulario:
 *   'ot-nueva', 'ot-editar-{id}', 'tarea-nueva', 'objetivo-nuevo', etc.
 */

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

const DRAFT_PREFIX = 'mc_draft_';

function readDraft<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeDraft<T>(key: string, value: T) {
  try {
    localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(value));
  } catch { /* quota exceeded — ignorar */ }
}

function deleteDraft(key: string) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {}
}

function isEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface UseDraftFormResult<T> {
  /** Estado actual del formulario */
  form: T;
  /** Setter — igual que useState */
  setForm: Dispatch<SetStateAction<T>>;
  /** true si el formulario tiene cambios respecto al estado inicial */
  hasChanges: boolean;
  /** Llama esto al guardar o cancelar explícitamente para limpiar el borrador */
  clearDraft: () => void;
  /** true si se recuperó un borrador guardado previamente */
  restoredFromDraft: boolean;
}

export function useDraftForm<T extends object>(
  /** Clave única para localStorage. Usar nombres descriptivos: 'ot-nueva', 'tarea-nueva-hoy' */
  draftKey: string,
  /** Valores iniciales del formulario (cuando no hay borrador) */
  initialValues: T,
  /** Opciones */
  options?: {
    /** Si es false, desactiva el auto-guardado (ej: modal de solo 2 campos) */
    enabled?: boolean;
  },
): UseDraftFormResult<T> {
  const enabled = options?.enabled ?? true;

  // Al montar, intentar recuperar borrador
  const [form, setFormRaw] = useState<T>(() => {
    if (!enabled) return initialValues;
    const draft = readDraft<T>(draftKey);
    return draft ?? initialValues;
  });
  const [restoredFromDraft, setRestoredFromDraft] = useState<boolean>(() => {
    if (!enabled) return false;
    return readDraft<T>(draftKey) !== null;
  });

  // Referencia a los valores iniciales para detectar cambios
  const initialRef = useRef<T>(initialValues);

  // Cuando cambian key/initialValues, restaurar el estado correspondiente.
  useEffect(() => {
    initialRef.current = initialValues;
    if (!enabled) {
      setRestoredFromDraft(false);
      setFormRaw(initialValues);
      return;
    }
    const draft = readDraft<T>(draftKey);
    setRestoredFromDraft(draft !== null);
    setFormRaw(draft ?? initialValues);
  }, [draftKey, enabled, initialValues]);

  // Auto-guardar en localStorage cada vez que cambia el formulario
  useEffect(() => {
    if (!enabled) return;
    // No guardar si el formulario es igual al inicial (evita escribir borrador vacío)
    if (isEqual(form, initialRef.current)) {
      deleteDraft(draftKey);
      return;
    }
    writeDraft(draftKey, form);
  }, [form, draftKey, enabled]);

  // Detectar cambios respecto al estado inicial
  const hasChanges = !isEqual(form, initialRef.current);

  const clearDraft = useCallback(() => {
    deleteDraft(draftKey);
    setRestoredFromDraft(false);
  }, [draftKey]);

  // Wrapper del setter para compatibilidad con React.Dispatch
  const setForm: Dispatch<SetStateAction<T>> = useCallback((action) => {
    setFormRaw((prev) => {
      const next = typeof action === 'function' ? (action as (prev: T) => T)(prev) : action;
      return next;
    });
  }, []);

  return { form, setForm, hasChanges, clearDraft, restoredFromDraft };
}