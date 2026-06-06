# Sistema de diseño — SGTD / Nexora · orden v1

**Base:** este documento NO inventa tokens. Ordena lo que ya existe en
`styles/tokens.css` (`--mc-*`), `lib/estadoConfig.ts` y `components/ui/Button.tsx`,
resuelve las inconsistencias detectadas en `DESIGN-INVENTORY.md` y cierra las reglas de uso.

**Decisiones cerradas (2026-06-05):**

| # | Decisión | Resolución |
|---|----------|------------|
| **D1** | Acento de marca | **A: azul `#0064E0` único** para todo lo interactivo; violeta solo en logo. |
| **D2** | Urgencia horaria | **Mantener** — solo tareas de hoy no terminadas (no colisiona con `atrasada`). |
| **D3** | Acciones card móvil | **Ambas** — ⋯ siempre visible en móvil; hover + ⋯ en desktop; tap cuerpo → detalle. |

---

## 1. Color — acento de marca

- `--mc-color-accent` (#0064E0) es el ÚNICO acento interactivo: botón primario, links,
  estado seleccionado, nav activo, columna "hoy".
- `--mc-brand-violet` se reserva al logo / splash. No compite como primario en nav ni formularios.

---

## 2. Color — estados (consume `STATE_TOKENS`)

### Eje 1 — Estado de ejecución (4 valores persistidos)

| Estado | Token base | Label | Pill |
|--------|-----------|-------|------|
| pendiente | `--mc-state-pendiente-*` | Pendiente | `mc-tarea-pill--pendiente` |
| en_progreso | `--mc-state-progreso-*` | En progreso | `mc-tarea-pill--en_progreso` |
| completada | `--mc-state-completada-*` | Completada | `mc-tarea-pill--completada` |
| cancelada | `--mc-state-cancelada-*` | Cancelada | `mc-tarea-pill--cancelada` |

### Eje 2 — Situación (calculada)

| Situación | Token | Label | Cuándo |
|-----------|-------|-------|--------|
| atrasada | `--mc-state-atrasada-*` | Atrasada | fecha pasada + no terminal |
| reprogramada | `--mc-state-reprogramada-*` | Reprogramada | `reprogramaciones > 0` |
| creada | — | (nada) | NUNCA se pinta |

### Urgencia horaria (solo tareas de HOY)

| Nivel | Token | Label | Ventana |
|-------|-------|-------|---------|
| precaucion | `--mc-state-precaucion-*` | Por vencer | 16–17 h |
| urgente | `--mc-state-urgente-*` | Urgente | 17–18 h |
| vencida_hoy | `--mc-state-vencida-*` | Vencida hoy | ≥18 h |

### Prioridad

| Prioridad | Señal | Chip texto |
|-----------|-------|------------|
| critica | barra lateral roja | sí — "Crítica" |
| alta | barra lateral ámbar | no |
| media | barra lateral neutra | no |
| baja | barra lateral gris | no |

### Retirado

- `--mc-state-bloqueada-*` y UI de `bloqueada` (v1.1 sin bloquear).

---

## 3. Iconos — mapa cerrado (lucide-react)

| Concepto | Icono | Tamaño |
|----------|-------|--------|
| Estado pendiente | `Circle` | 14 |
| Estado en progreso | `PlayCircle` | 14 |
| Estado completada | `CheckCircle2` | 14 |
| Estado cancelada | `Ban` | 14 |
| Situación atrasada | `AlertTriangle` | 14 |
| Situación reprogramada | `CalendarClock` | 14 |
| Vence/urgencia hoy | `Clock` | 14 |
| Prioridad crítica | `Flame` | 11–12 |
| Acción iniciar | `Play` | 14 |
| Acción completar | `Check` | 14 |
| Acción reprogramar | `CalendarClock` | 14 |
| Acción eliminar | `Trash2` | 14 |
| Acción cancelar | `Ban` | 14 |
| Menú acciones | `MoreHorizontal` | 16 |
| Nav / shell | `CalendarDays`, `Target`, `FileText`, `ClipboardList`, `Bell`, `LogOut` | 20 |
| Eventos | `Calendar` | 14 |
| Incidencias | `AlertCircle` | 14 |
| Cerrar modal | `X` | 16 |

---

## 4. Botones — matriz de uso

| Lugar | variant | size |
|-------|---------|------|
| CTA principal de página | `primary` | `default` |
| CTA principal de modal | `primary` | `lg` + `fullWidth` |
| Acción secundaria directa | `secondary` | `default` |
| Cancelar modal (fila) | `ghost` | `default` |
| Cancelar modal (bajo primary) | `CancelButton` | — |
| Iniciar / Completar en card | `primary` | `xs` |
| Reprogramar en card (hover desktop) | `secondary` | `xs` |
| Eliminar / Cancelar tarea | menú `⋯` | `danger` en ítem |
| Ver historial / Limpiar filtros | `quaternary` | `sm` |
| Descartar en modal | `danger` | — |

**Regla:** una sola `primary` por vista de página.

---

## 5. Tamaños

### Tipografía (fuente de verdad = tokens)

| Token | px | Uso |
|-------|----|-----|
| `--mc-text-xs` | 11 | meta, labels, badges |
| `--mc-text-sm` | 13 | cuerpo denso |
| `--mc-text-base` | 14 | título de card, texto general |
| `--mc-text-md` | 16 | títulos de sección |
| `--mc-text-lg`–`2xl` | 18–28 | headers, hero |

Card: título `--mc-text-base` peso 500; meta `--mc-text-xs`; estado vía `TareaEstadoIndicator variant="pill"`.

### Espaciado / radios / sombras

- Espaciado: `--mc-space-*` (múltiplos 4px). Card padding `--mc-space-3`.
- Radios: card `--mc-radius-lg`; botones `--mc-radius-md`; pills `--mc-radius-pill`.
- Sombras: card reposo `--mc-shadow-xs`; hover `--mc-shadow-md`; modal `--mc-shadow-lg`.
- Breakpoints: preferir `@media` en CSS (`767` / `768` / `1024` / `1200`); Tailwind `md:` solo puntual.

---

## 6. Componentes

### Card de tarea (`TareaSemanaCard`)

**Reposo:** barra prioridad + título (+ chip Crítica) · fila pills (situación + estado) · pie avatar + OT.

**Desktop hover:** Iniciar|Completar + Reprogramar (`Button xs`) + ⋯ (Cancelar, Eliminar, Ver detalle).

**Móvil:** ⋯ siempre visible con todas las acciones; tap cuerpo → detalle.

### Primitivos

- `Avatar` — iniciales, tamaños sm/md.
- `DropdownMenu` — menú `⋯` reutilizable.
- `TareaEstadoIndicator` — badge/pill de estado (no duplicar `mc-badge` a mano).

### Pendiente (refactor mayor)

- Consolidar `TareaSemanaCard` + `TarjetaTarea` + `TaskItem` → `TareaCard` con `contexto`.

---

## 7. Mapa inconsistencias → acción

| # | Acción |
|---|--------|
| 1 | §1 acento único |
| 2 | §5 tipografía en tokens |
| 3 | Retirar bloqueada |
| 4 | Retirar CSS DnD |
| 5 | Avatar + DropdownMenu |
| 6 | Card → `Button` |
| 7 | Modal → lucide `X` |
| 8 | Inline → clases CSS |
| 9 | `@media` como fuente responsive |
| 10 | Métricas: componentes usados desde Planificación |
| 11 | Consolidación cards — pendiente |
| 12 | Hex en TSX — OK |

---

## Orden de ejecución

1. ✅ Decisiones D1–D3 + este documento.
2. ✅ Acento único + cruft bloqueada/DnD.
3. ✅ Card: pills, `Button`, menú ⋯, móvil.
4. ✅ Primitivos `Avatar` + `DropdownMenu`.
5. ⏳ Consolidar 3 cards en `TareaCard`.
