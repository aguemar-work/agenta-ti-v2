# Deuda técnica — ESLint (registrada 2026-06-08)

**Estado:** pendiente · **CI:** `npm run lint` con `continue-on-error: true` en `.github/workflows/ci.yml`  
**Última medición:** 27 problemas (25 errores, 2 warnings) · **Tests:** 217/217 OK

---

## Resumen por regla

| Regla | Errores | Prioridad sugerida |
|-------|---------|-------------------|
| `react-hooks/set-state-in-effect` | 17 | Media — refactor por componente |
| `react-refresh/only-export-components` | 7 | Baja — mover helpers a `lib/` |
| `react-hooks/refs` | 1 | Alta — `useDraftForm.ts` |
| `react-hooks/immutability` | 1 | Alta — ubicación en salida truncada |
| `@typescript-eslint/triple-slash-reference` | 1 | Baja — `vite.config.ts` |
| `no-empty` | 1 | Baja — `useDraftForm.ts` |
| `react-hooks/exhaustive-deps` | 2 warnings | Baja |

---

## Archivos afectados

### `react-hooks/set-state-in-effect`

| Archivo | Línea aprox. | Patrón |
|---------|--------------|--------|
| `components/layout/AppShell.tsx` | 128 | Cargar prefs notificaciones al cambiar usuario |
| `components/layout/ModalPreferenciasNotificaciones.tsx` | 27 | Reset prefs al abrir modal |
| `components/onboarding/OnboardingWelcome.tsx` | 55 | Abrir onboarding si no completado |
| `components/semana/MiSemanaResumenDia.tsx` | 16 | Leer dismiss de sessionStorage |
| `components/semana/ModalConvertirNota.tsx` | 63 | Reset form al abrir |
| `components/tareas/ModalCompletarTarea.tsx` | 28 | Limpiar resumen al cambiar tarea |
| `components/tareas/ModalNuevaTarea.tsx` | 56 | Sync fecha incidencia |
| `components/tareas/ModalReprogramar.tsx` | ~27 | Reset fecha |
| `hooks/useDraftForm.ts` | 94 | Reset al deshabilitar draft |
| `hooks/useOrdenesTrabajoPage.ts` | 281 | Hidratar borrador OT |
| `pages/MiSemana.tsx` | 116 | Sync día móvil |
| `pages/Objetivos.tsx` | 128 | Ajustar paginación |
| `pages/Planificacion.tsx` | 80 | Abrir historial si vista SLA |

**Estrategia de fix:** preferir reset en handlers (`onOpenChange`), `key={id}` en modales, derivar estado con `useMemo`, o `queueMicrotask` solo donde no haya alternativa.

### `react-refresh/only-export-components`

| Archivo |
|---------|
| `components/a11y/LiveRegion.tsx` |
| `components/objetivos/ObjetivoProgreso.tsx` |
| `components/semana/MiSemanaHeader.tsx` (×3) |
| `components/ui/KpiCard.tsx` |
| `components/ui/Modal.tsx` |

**Estrategia:** extraer constantes/helpers exportados a archivos `*.ts` en `lib/`.

### Otros

| Archivo | Regla | Nota |
|---------|-------|------|
| `hooks/useDraftForm.ts` | `refs` + `no-empty` | Revisar `hasChanges` sin leer ref en render |
| `vite.config.ts` | `triple-slash-reference` | Usar `import` de `vitest/config` |

---

## Criterio de cierre

1. `npm run lint` exit code 0 en local.
2. Quitar `continue-on-error: true` del paso lint en `.github/workflows/ci.yml`.
3. Actualizar este documento a **cerrado** con fecha.

---

*Origen: auditoría `auditoria_08062026.md` · Prioridad 2 ítem 7 (CI).*
