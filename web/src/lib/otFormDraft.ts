/**
 * Utilidades para borrador de OT (autoguardado en servidor).
 */

import type { ActualizarOTInput, CrearOTInput, OrdenTrabajo } from '@/api/ordenTrabajo';
import type { Id } from '@/types';

export function formInicialOT(creadoPor: Id): Omit<CrearOTInput, 'enviar'> {
  return {
    creado_por: creadoPor,
    tipo_trabajo_id: null,
    tarea_id: null,
    descripcion: '',
    area_destino: '',
    ubicacion: '',
    modalidad: 'presencial',
    fecha_estimada: '',
    hora_inicio_est: '',
    duracion_est_min: null,
    equipos_materiales: '',
    observaciones: '',
  };
}

export function ordenTrabajoToForm(ot: OrdenTrabajo): Omit<CrearOTInput, 'enviar'> {
  return {
    creado_por: ot.creado_por,
    tipo_trabajo_id: ot.tipo_trabajo_id,
    tarea_id: ot.tarea_id,
    objetivo_id: ot.objetivo_id ?? null,
    descripcion: ot.descripcion === '(borrador)' ? '' : ot.descripcion,
    area_destino: ot.area_destino === '(pendiente)' ? '' : ot.area_destino,
    ubicacion: ot.ubicacion ?? '',
    modalidad: ot.modalidad,
    fecha_estimada: ot.fecha_estimada,
    hora_inicio_est: ot.hora_inicio_est ?? '',
    duracion_est_min: ot.duracion_est_min,
    equipos_materiales: ot.equipos_materiales ?? '',
    observaciones: ot.observaciones ?? '',
    prioridad: ot.prioridad,
  };
}

export function tieneContenidoBorrador(
  form: Omit<CrearOTInput, 'enviar'>,
  vacio: Omit<CrearOTInput, 'enviar'>,
): boolean {
  return JSON.stringify(form) !== JSON.stringify(vacio);
}

/** Valores mínimos para INSERT/UPDATE en BD (campos NOT NULL). */
export function formToActualizarInput(
  form: Omit<CrearOTInput, 'enviar'>,
  otId: Id,
  enviar: boolean,
): ActualizarOTInput {
  return {
    otId,
    enviar,
    tipo_trabajo_id: form.tipo_trabajo_id ?? null,
    tarea_id: form.tarea_id ?? null,
    objetivo_id: form.objetivo_id ?? null,
    descripcion: form.descripcion,
    area_destino: form.area_destino,
    ubicacion: form.ubicacion ?? null,
    modalidad: form.modalidad,
    fecha_estimada: form.fecha_estimada,
    hora_inicio_est: form.hora_inicio_est ?? null,
    duracion_est_min: form.duracion_est_min ?? null,
    equipos_materiales: form.equipos_materiales ?? null,
    observaciones: form.observaciones ?? null,
    prioridad: form.prioridad ?? 'normal',
  };
}

export function normalizarFormOTParaGuardar(
  form: Omit<CrearOTInput, 'enviar'>,
  creadoPor: Id,
): CrearOTInput {
  const hoy = new Date().toISOString().slice(0, 10);
  return {
    ...form,
    creado_por: creadoPor,
    descripcion: form.descripcion.trim() || '(borrador)',
    area_destino: form.area_destino.trim() || '(pendiente)',
    fecha_estimada: form.fecha_estimada || hoy,
    enviar: false,
  };
}

export function formatBorradorGuardadoHace(iso: string | null): string | null {
  if (!iso) return null;
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 8) return 'hace unos segundos';
  if (sec < 60) return `hace ${sec} segundos`;
  const min = Math.floor(sec / 60);
  if (min === 1) return 'hace 1 minuto';
  if (min < 60) return `hace ${min} minutos`;
  const h = Math.floor(min / 60);
  return h === 1 ? 'hace 1 hora' : `hace ${h} horas`;
}
