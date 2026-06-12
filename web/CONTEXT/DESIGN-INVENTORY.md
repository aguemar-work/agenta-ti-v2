# DESIGN-INVENTORY — Nexora / SGTD v4

**Generado:** 2026-06-05  
**Alcance:** frontend en `web/` (SPA React + Materen Canvas). Solo inventario; sin cambios de código.

---

## 1. Stack y herramientas

| Capa | Tecnología | Versión (package.json) |
|------|------------|------------------------|
| Framework | React + TypeScript | React **19.2.4**, TS **~6.0.2** |
| Bundler | Vite | **8.0.4** |
| Routing | React Router DOM | **7.14.1** |
| Estado servidor | TanStack Query | **5.99.0** |
| Estado cliente | Zustand | **5.0.12** (solo auth) |
| Validación | Zod | **4.3.6** |
| Backend | InsForge SDK | **1.2.5** |
| Toasts | Sonner | **2.0.7** |

### Sistema de estilos

- **Tailwind CSS 3.4.17** (`@tailwind base/components/utilities` en `index.css`).
- **Design system propio Materen Canvas:** clases `mc-*` y tokens `--mc-*` en CSS plano.
- Archivos de estilo: `tokens.css`, `shell.css`, `components.css`, `forms.css`, `layout.css`, `tasks.css`, `animations.css`, `ot-impresion.css`.
- **No** CSS Modules, **no** styled-components, **no** Tailwind v4.
- `tailwind.config.js` tiene `theme.extend` vacío: casi todo el diseño vive en CSS `mc-*`, no en utilidades Tailwind extendidas.

### Librería de componentes

- **Ninguna** (no shadcn, Radix, MUI, Chakra, etc.).
- Componentes propios en `src/components/ui/` + dominio (`semana/`, `tareas/`, `ot/`, …).
- Patrones: `Button`, `Modal`, `FilterBar`, badges vía clases CSS + `TareaEstadoIndicator`.

### Móvil / responsive

**Sí, soporta móvil.** Dos capas:

1. **CSS custom (`@media`)** — fuente principal de breakpoints en la práctica:
   - `max-width: 767px` — móvil (bottom nav, columnas apiladas, drawers).
   - `min-width: 768px` — tablet/desktop (sidebar, grilla 6 columnas).
   - `max-width: 1023px` / `min-width: 1024px` — paneles laterales, notas.
   - `min-width: 1200px` — layout ancho (p. ej. panel notas `xl+` en reglas de producto).

2. **Tailwind en TSX** (uso puntual):
   - `md:` (768px): grilla Mi Semana `grid-cols-1` → `md:grid-cols-6`; toolbar desktop vs móvil.
   - `md:grid-cols-2/3` en `OTFormModal`.

**Patrones de producto:** Mi Semana móvil = un día + swipe; desktop = 6 columnas Lun–Sáb. Bottom nav &lt;768px; sidebar rail ≥768px.

---

## 2. Tokens / tema (pegar literal y completo)

### `tailwind.config.js` (entero)

```js
/**
 * Tailwind 3.4.x — NO migrar a v4 (reglas Nexora: incompatibilidad InsForge MCP + @layer vs tokens --mc-*).
 * @type {import('tailwindcss').Config}
 */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
```

### `src/index.css` (entero — punto de entrada; `:root` está en `tokens.css`)

```css
/**
 * index.css — Punto de entrada de estilos
 * Todos los @import DEBEN ir antes de @tailwind.
 */

 @import './styles/tokens.css';
 @import './styles/shell.css';
 @import './styles/components.css';
 @import './styles/forms.css';
 @import './styles/layout.css';
 @import './styles/tasks.css';
 
 @tailwind base;
 @tailwind components;
 @tailwind utilities;
 
 /* ── Reset mínimo ──────────────────────────────────────────────────────── */
 html,
 body,
 #root {
   height: 100%;
   min-height: 100vh;
   min-height: 100dvh;
 }

 #root {
   display: flex;
   flex-direction: column;
   min-height: 0;
 }

 /* Evita barra horizontal por rail + tooltips o ancho 100vw vs scrollbar */
 html {
   overflow-x: hidden;
 }
 
 body {
   margin: 0;
   font-family: var(--mc-font-sans);
   font-size: var(--mc-text-sm);
   background: var(--mc-color-bg);
   color: var(--mc-color-text);
 }
```

### `src/styles/tokens.css` (entero — variables `:root`)

```css
/**
 * tokens.css — Fuente de verdad Materen Canvas (--mc-*)
 */
:root {
  /* ── Superficies ────────────────────────────────────────────────── */
  --mc-color-bg:               #f5f6f7;
  --mc-color-bg-secondary:     #eef0f3;
  --mc-color-surface:          #ffffff;
  --mc-color-surface-elevated: #f8f9fb;
  --mc-color-surface-hover:    #f2f4f7;
  --mc-color-surface-active:   #e8eaef;

  /* ── Bordes ─────────────────────────────────────────────────────── */
  --mc-color-border:           #e4e6eb;
  --mc-color-border-strong:    #ced2d9;
  --mc-color-border-hover:     #b0b5bf;

  /* ── Texto ──────────────────────────────────────────────────────── */
  --mc-color-text:             #050505;
  --mc-color-text-secondary:   #65676b;
  --mc-color-text-placeholder: #8d949e;
  --mc-color-text-tertiary:    #8a8f98;
  --mc-color-text-disabled:    #bcc0c7;
  --mc-color-neutral:          #65676b;

  /* Brand morado (shell nav activo, CTAs de formulario unificado) */
  --mc-brand-violet:       #534ab7;
  --mc-brand-violet-soft: #eeedfe;

  /* ── Acento / Brand ─────────────────────────────────────────────── */
  --mc-color-on-accent:        #ffffff;
  --mc-color-accent:           #0064e0;
  --mc-color-accent-hover:     #0057c2;
  --mc-color-accent-active:    #004ba3;
  --mc-color-accent-soft:      rgba(0, 100, 224, 0.08);
  --mc-color-accent-border:    color-mix(in srgb, var(--mc-color-accent) 38%, var(--mc-color-border));

  /* ── Semánticos ─────────────────────────────────────────────────── */
  --mc-color-success:          #31a24c;
  --mc-color-success-soft:     rgba(49, 162, 76, 0.10);

  --mc-color-warning:          #f7b928;
  --mc-color-warning-soft:     rgba(247, 185, 40, 0.10);

  --mc-color-danger:           #fa3e3e;
  --mc-color-danger-hover:     #e02424;
  --mc-color-danger-soft:      rgba(250, 62, 62, 0.10);

  --mc-color-info:             #0288d1;
  --mc-color-info-soft:        rgba(2, 136, 209, 0.10);

  /* ── Layout ─────────────────────────────────────────────────────── */
  --mc-sidebar-w-collapsed: 52px;
  --mc-sidebar-w-expanded:  220px;
  --mc-bottom-nav-h:        60px;
  --mc-topbar-h:            56px;
  /* Mi Semana: chrome sobre la grilla (header + resumen + filtros; ver appLayout.ts) */
  --mc-main-padding-block:  calc(var(--mc-space-6) * 2);
  --mc-semana-page-chrome:  10.5rem;
  --mc-semana-dia-col-max-height: calc(
    100dvh - var(--mc-topbar-h) - var(--mc-bottom-nav-h) - var(--mc-main-padding-block) - var(--mc-semana-page-chrome)
  );

  /* ── Radios ─────────────────────────────────────────────────────── */
  --mc-radius-sm:   6px;
  --mc-radius-md:   8px;
  --mc-radius-lg:   12px;
  --mc-radius-xl:   16px;
  --mc-radius-pill: 20px;

  /* ── Espaciado (escala 4px) ─────────────────────────────────────── */
  --mc-space-1:  4px;
  --mc-space-2:  8px;
  --mc-space-3:  12px;
  --mc-space-4:  16px;
  --mc-space-5:  20px;
  --mc-space-6:  24px;
  --mc-space-8:  32px;
  --mc-space-10: 40px;

  /* ── Tipografía ─────────────────────────────────────────────────── */
  --mc-text-xs:   11px;
  --mc-text-sm:   13px;
  --mc-text-base: 14px;
  --mc-text-md:   16px;
  --mc-text-lg:   18px;
  --mc-text-xl:   22px;
  --mc-text-2xl:  28px;
  --mc-leading-tight:  1.2;
  --mc-leading-normal: 1.5;
  --mc-font-sans: 'Inter', -apple-system, system-ui, sans-serif;
  /* Legacy — main.tsx y otros */
  --mc-font: var(--mc-font-sans);

  /* ── Iconos ─────────────────────────────────────────────────────── */
  --mc-icon-xs: 14px;
  --mc-icon-sm: 16px;
  --mc-icon-md: 20px;
  --mc-icon-lg: 24px;

  /* ── Transiciones ───────────────────────────────────────────────── */
  --mc-ease:             cubic-bezier(0.4, 0, 0.2, 1);
  --mc-duration-fast:    120ms;
  --mc-duration-normal:  180ms;
  --mc-duration-slow:    280ms;
  --mc-transition:       var(--mc-duration-normal) var(--mc-ease);
  --mc-transition-fast:  var(--mc-duration-fast) var(--mc-ease);
  --mc-transition-slow:  var(--mc-duration-slow) var(--mc-ease);
  /* Alias legacy — mantener para no romper usos existentes */
  --mc-transition-layout: 0.2s ease;

  /* ── Sombras ────────────────────────────────────────────────────── */
  --mc-shadow-xs:   0 1px 2px rgba(0, 0, 0, 0.04);
  --mc-shadow-sm:   0 1px 3px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
  --mc-shadow-md:   0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04);
  --mc-shadow-lg:   0 8px 32px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06);
  --mc-shadow-xl:   0 16px 48px rgba(0, 0, 0, 0.16), 0 8px 16px rgba(0, 0, 0, 0.08);
  --mc-shadow-drag: 0 22px 48px -10px rgba(0, 0, 0, 0.22), 0 12px 24px -8px rgba(0, 0, 0, 0.12);
  /* Aliases semánticos */
  --mc-card-shadow:      var(--mc-shadow-sm);
  --mc-card-shadow-drag: var(--mc-shadow-drag);
  --mc-modal-shadow:     var(--mc-shadow-lg);
  --mc-dropdown-shadow:  var(--mc-shadow-md);
  /* Legacy — mantener para no romper usos existentes */
  --mc-card-border:      0.5px solid var(--mc-color-border);

  /* ── Estado de tarea ────────────────────────────────────────────── */
  /*
   * FUENTE ÚNICA de colores para todos los estados de tarea.
   * Consumir via STATE_TOKENS en lib/estadoConfig.ts.
   * NUNCA usar hex sueltos en componentes.
   */

  /* atrasada */
  --mc-state-atrasada-bg:        #FCEBEB;
  --mc-state-atrasada-fg:        #791F1F;
  --mc-state-atrasada-border:    #E24B4A;
  --mc-state-atrasada-meta:      #A32D2D;

  /* OT */
  --mc-ot-urgente-bg:     color-mix(in srgb, var(--mc-color-warning) 8%, transparent);
  --mc-ot-urgente-border: var(--mc-color-warning);
  --mc-ot-vencida-bg:     color-mix(in srgb, var(--mc-color-danger) 8%, transparent);
  --mc-ot-vencida-border: var(--mc-color-danger);
  --mc-ot-rechazo-bg:     color-mix(in srgb, var(--mc-color-danger) 6%, transparent);

  /* bloqueada */
  --mc-state-bloqueada-bg:       rgba(247, 185, 40, 0.08);
  --mc-state-bloqueada-border:   var(--mc-color-warning);
  --mc-state-bloqueada-fg:       #7A4F00;
  --mc-state-bloqueada-meta:     #854F0B;

  /* Urgencia horaria — tokens adicionales (auditoría) */
  --mc-urgencia-vencida-hoy-bg:     #FFF0F0;
  --mc-urgencia-vencida-hoy-fg:     #C00;
  --mc-urgencia-vencida-hoy-border: #E24B4A;
  --mc-urgencia-urgente-bg:        #FFFBF0;
  --mc-urgencia-urgente-fg:        #7A4F00;
  --mc-urgencia-urgente-border:    var(--mc-color-warning);
  --mc-urgencia-precaucion-border: var(--mc-color-warning);

  /* urgencia horaria: urgente (5–6pm) — usado por URGENCIA_TOKENS */
  --mc-state-urgente-bg:         #FCEBEB;
  --mc-state-urgente-fg:         #791F1F;
  --mc-state-urgente-border:     #E24B4A;
  --mc-state-urgente-badge-bg:   #F7C1C1;
  --mc-state-urgente-badge-fg:   #791F1F;

  /* urgencia horaria: precaución (4–5pm) */
  --mc-state-precaucion-bg:      transparent;
  --mc-state-precaucion-fg:      var(--mc-color-text);
  --mc-state-precaucion-border:  #EF9F27;
  --mc-state-precaucion-badge-bg:  #FAC775;
  --mc-state-precaucion-badge-fg:  #633806;

  /* urgencia horaria: vencida hoy (≥6pm) */
  --mc-state-vencida-bg:         #E24B4A;
  --mc-state-vencida-fg:         #ffffff;
  --mc-state-vencida-border:     #A32D2D;
  --mc-state-vencida-badge-bg:   rgba(255,255,255,0.25);
  --mc-state-vencida-badge-fg:   #ffffff;

  /* en_progreso */
  --mc-state-progreso-bg:        #E6F1FB;
  --mc-state-progreso-fg:        #0B3F6E;
  --mc-state-progreso-border:    #185FA5;

  /* completada */
  --mc-state-completada-bg:      #EAF3DE;
  --mc-state-completada-fg:      #27500A;
  --mc-state-completada-border:  #4FA64A;

  /* reprogramada */
  --mc-state-reprogramada-bg:    #EEEDFE;
  --mc-state-reprogramada-fg:    #3C3489;
  --mc-state-reprogramada-border:#7F77DD;

  /* pendiente / cancelada (pills compactos en Planificación) */
  --mc-state-pendiente-bg:       #F1EFE8;
  --mc-state-pendiente-fg:       #5F5E5A;
  --mc-state-cancelada-bg:       #F1F1F1;
  --mc-state-cancelada-fg:       #6B6B6B;

  /* ── Incidencias ─ registro neutral (NO advertencia) ────────────── */
  --mc-state-incidencia-bg:      color-mix(in srgb, var(--mc-color-info) 8%, transparent);
  --mc-state-incidencia-border:  var(--mc-color-info);
  --mc-state-incidencia-fg:      var(--mc-color-info);

  /* ── Soft backgrounds para filas/tablas ─────────────────────────── */
  --mc-state-completada-bg-soft: #EAF3DE;
  --mc-state-atrasada-bg-soft:   #FCEBEB;
  --mc-state-precaucion-bg-soft: #FAEEDA;

  /* Fondo muy suave para filas con alerta leve (ej. "bajo rendimiento") */
  --mc-state-row-danger-soft:    color-mix(in srgb, var(--mc-color-danger) 3%, transparent);

  /* Variantes claras para tramos de barras de progreso */
  --mc-state-completada-bar-soft: color-mix(in srgb, var(--mc-color-success) 35%, var(--mc-color-surface));
  --mc-state-atrasada-bar-soft:   color-mix(in srgb, var(--mc-color-danger)  30%, var(--mc-color-surface));
  --mc-state-precaucion-bar-soft: color-mix(in srgb, var(--mc-color-warning) 38%, var(--mc-color-surface));

  /* Color neutro de "pendientes" usado en gráficos (gris desaturado) */
  --mc-color-neutral-soft:       #B4B2A9;

  /* ── Capas (modales > drawer > shell) ───────────────────────────── */
  --mc-z-bottom-nav:   40;
  --mc-z-drawer:       60;
  --mc-z-modal:        70;
  --mc-z-modal-stack:  80;
  --mc-z-modal-top:    90;
  --mc-z-popover:      65;
}
```

### `theme.ts` / `colors.ts`

**No existen** en el repo. La paleta vive en `tokens.css` + mapeos en `lib/estadoConfig.ts` / `lib/otConfig.ts`.

---

## 3. Mapeos de estado (pegar literal y completo)

### `src/lib/estadoConfig.ts` (entero)

```ts
/**
 * lib/estadoConfig.ts
 *
 * Fuente única de labels, badges y tokens para estados de tarea (eje 1)
 * y situaciones calculadas (eje 2) en UI.
 */

import type {
  ClaveVisualTarea,
  EstadoObjetivo,
  EstadoTarea,
  PrioridadTarea,
  SituacionTarea,
  UrgenciaHoraria,
} from '@/types';

// ---------------------------------------------------------------------------
// Tokens — eje visual (estado persistido + situación calculada)
// ---------------------------------------------------------------------------

export interface EstadoTokens {
  bg:     string;
  fg:     string;
  border: string;
  meta:   string;
}

export interface UrgenciaTokens {
  bg:      string;
  fg:      string;
  border:  string;
  badgeBg: string;
  badgeFg: string;
}

export const STATE_TOKENS: Record<ClaveVisualTarea, EstadoTokens> = {
  atrasada: {
    bg:     'var(--mc-state-atrasada-bg)',
    fg:     'var(--mc-state-atrasada-fg)',
    border: 'var(--mc-state-atrasada-border)',
    meta:   'var(--mc-state-atrasada-meta)',
  },
  en_progreso: {
    bg:     'var(--mc-state-progreso-bg)',
    fg:     'var(--mc-state-progreso-fg)',
    border: 'var(--mc-state-progreso-border)',
    meta:   'var(--mc-color-text-secondary)',
  },
  completada: {
    bg:     'var(--mc-state-completada-bg)',
    fg:     'var(--mc-state-completada-fg)',
    border: 'var(--mc-state-completada-border)',
    meta:   'var(--mc-color-text-secondary)',
  },
  reprogramada: {
    bg:     'var(--mc-state-reprogramada-bg)',
    fg:     'var(--mc-state-reprogramada-fg)',
    border: 'var(--mc-state-reprogramada-border)',
    meta:   'var(--mc-color-text-secondary)',
  },
  pendiente: {
    bg:     'var(--mc-state-pendiente-bg)',
    fg:     'var(--mc-state-pendiente-fg)',
    border: 'transparent',
    meta:   'var(--mc-color-text-secondary)',
  },
  cancelada: {
    bg:     'var(--mc-state-cancelada-bg)',
    fg:     'var(--mc-state-cancelada-fg)',
    border: 'transparent',
    meta:   'var(--mc-color-text-placeholder)',
  },
};

export const URGENCIA_TOKENS: Record<UrgenciaHoraria, UrgenciaTokens> = {
  normal: {
    bg:      'transparent',
    fg:      'var(--mc-color-text)',
    border:  'transparent',
    badgeBg: 'transparent',
    badgeFg: 'transparent',
  },
  precaucion: {
    bg:      'var(--mc-state-precaucion-bg)',
    fg:      'var(--mc-state-precaucion-fg)',
    border:  'var(--mc-state-precaucion-border)',
    badgeBg: 'var(--mc-state-precaucion-badge-bg)',
    badgeFg: 'var(--mc-state-precaucion-badge-fg)',
  },
  urgente: {
    bg:      'var(--mc-state-urgente-bg)',
    fg:      'var(--mc-state-urgente-fg)',
    border:  'var(--mc-state-urgente-border)',
    badgeBg: 'var(--mc-state-urgente-badge-bg)',
    badgeFg: 'var(--mc-state-urgente-badge-fg)',
  },
  vencida_hoy: {
    bg:      'var(--mc-state-vencida-bg)',
    fg:      'var(--mc-state-vencida-fg)',
    border:  'var(--mc-state-vencida-border)',
    badgeBg: 'var(--mc-state-vencida-badge-bg)',
    badgeFg: 'var(--mc-state-vencida-badge-fg)',
  },
};

// ---------------------------------------------------------------------------
// Tarea — badge / label / pill (clave visual)
// ---------------------------------------------------------------------------

export const TAREA_BADGE: Record<ClaveVisualTarea, string> = {
  pendiente:    'mc-badge-neutral',
  en_progreso:  'mc-badge-info',
  completada:   'mc-badge-success',
  atrasada:     'mc-badge-danger',
  reprogramada: 'mc-badge-neutral',
  cancelada:    'mc-badge-neutral',
};

export const TAREA_LABEL: Record<ClaveVisualTarea, string> = {
  pendiente:    'Pendiente',
  en_progreso:  'En progreso',
  completada:   'Completada',
  atrasada:     'Atrasada',
  reprogramada: 'Reprogramada',
  cancelada:    'Cancelada',
};

export const TAREA_LABEL_PLURAL: Record<ClaveVisualTarea, string> = {
  pendiente:    'pendientes',
  en_progreso:  'en progreso',
  completada:   'completadas',
  atrasada:     'atrasadas',
  reprogramada: 'reprogramadas',
  cancelada:    'canceladas',
};

/** Eje 1 — estado persistido en BD (4 valores). */
export const ESTADO_EJECUCION_LABEL: Record<EstadoTarea, string> = {
  pendiente:    'Pendiente',
  en_progreso:  'En progreso',
  completada:   'Completada',
  cancelada:    'Cancelada',
};

/** Eje 2 — situación calculada (solo las que aportan señal en UI). */
export const SITUACION_LABEL: Record<Exclude<SituacionTarea, 'creada'>, string> = {
  atrasada:     'Atrasada',
  reprogramada: 'Reprogramada',
};

export const TAREA_PILL: Record<ClaveVisualTarea, string> = {
  pendiente:    'mc-tarea-pill mc-tarea-pill--pendiente',
  en_progreso:  'mc-tarea-pill mc-tarea-pill--en_progreso',
  completada:   'mc-tarea-pill mc-tarea-pill--completada',
  atrasada:     'mc-tarea-pill mc-tarea-pill--atrasada',
  reprogramada: 'mc-tarea-pill mc-tarea-pill--reprogramada',
  cancelada:    'mc-tarea-pill mc-tarea-pill--cancelada',
};

// ---------------------------------------------------------------------------
// Objetivo
// ---------------------------------------------------------------------------

export const OBJETIVO_BADGE: Record<EstadoObjetivo, string> = {
  activo:     'mc-badge-accent',
  completado: 'mc-badge-success',
  cancelado:  'mc-badge-neutral',
};

export const OBJETIVO_LABEL: Record<EstadoObjetivo, string> = {
  activo:     'Activo',
  completado: 'Completado',
  cancelado:  'Cancelado',
};

// ---------------------------------------------------------------------------
// Urgencia horaria
// ---------------------------------------------------------------------------

export const URGENCIA_BADGE: Record<UrgenciaHoraria, string> = {
  normal:      '',
  precaucion:  'mc-badge-warning',
  urgente:     'mc-badge-danger',
  vencida_hoy: 'mc-badge-danger',
};

export const URGENCIA_LABEL: Record<UrgenciaHoraria, string> = {
  normal:      '',
  precaucion:  'Por vencer',
  urgente:     'Urgente',
  vencida_hoy: 'Vencida hoy',
};

// ---------------------------------------------------------------------------
// Prioridad
// ---------------------------------------------------------------------------

export const PRIORIDAD_BADGE: Record<PrioridadTarea, string> = {
  critica: 'mc-badge mc-badge-prioridad-critica',
  alta:    'mc-badge mc-badge-prioridad-alta',
  media:   'mc-badge mc-badge-prioridad-media',
  baja:    'mc-badge mc-badge-prioridad-baja',
};

export const PRIORIDAD_LABEL: Record<PrioridadTarea, string> = {
  critica: 'Crítica',
  alta:    'Alta',
  media:   'Media',
  baja:    'Baja',
};
```

### `src/lib/otConfig.ts` (entero — estados OT)

```ts
/**
 * lib/otConfig.ts
 * Configuración de presentación para Órdenes de Trabajo.
 */

import type { EstadoOT, ModalidadOT, PrioridadOT } from '@/api/ordenTrabajo';

export const ESTADO_OT_LABEL: Record<EstadoOT, string> = {
  borrador:     'Borrador',
  pendiente:    'Pendiente aprobación',
  aprobada:     'Aprobada',
  completada:   'Completada',
  rechazada:    'Rechazada',
  cancelada:    'Cancelada',
};

export const ESTADO_OT_BADGE: Record<EstadoOT, string> = {
  borrador:     'mc-badge-neutral',
  pendiente:    'mc-badge-warning',
  aprobada:     'mc-badge-accent',
  completada:   'mc-badge-success',
  rechazada:    'mc-badge-danger',
  cancelada:    'mc-badge-neutral',
};

export const MODALIDAD_OT_LABEL: Record<ModalidadOT, string> = {
  presencial: 'Presencial',
  remoto:     'Remoto',
  viaje:      'Viaje',
};

export const PRIORIDAD_OT_LABEL: Record<PrioridadOT, string> = {
  normal:  'Normal',
  urgente: 'Urgente',
};

export const PRIORIDAD_OT_BADGE: Record<PrioridadOT, string> = {
  normal:  'mc-badge-neutral',
  urgente: 'mc-badge-danger',
};
```

### `src/components/tareas/TareaEstadoIndicator.tsx` (entero — iconos + badge/pill)

```tsx
/**
 * Badge/pill de estado o situación de tarea (eje visual unificado).
 */
import {
  AlertTriangle,
  Ban,
  CalendarClock,
  CheckCircle2,
  Circle,
  PlayCircle,
  type LucideIcon,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import { TAREA_BADGE, TAREA_LABEL, TAREA_LABEL_PLURAL, TAREA_PILL } from '@/lib/estadoConfig';
import type { ClaveVisualTarea } from '@/types';

const TAREA_ESTADO_ICON: Record<ClaveVisualTarea, LucideIcon> = {
  pendiente:    Circle,
  en_progreso:  PlayCircle,
  completada:   CheckCircle2,
  atrasada:     AlertTriangle,
  reprogramada: CalendarClock,
  cancelada:    Ban,
};

type Props = {
  estado: ClaveVisualTarea;
  variant?: 'badge' | 'pill';
  plural?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function TareaEstadoIndicator({
  estado,
  variant = 'badge',
  plural = false,
  className = '',
  style,
  children,
}: Props) {
  const Icon = TAREA_ESTADO_ICON[estado];
  const label = plural ? TAREA_LABEL_PLURAL[estado] : TAREA_LABEL[estado];
  const classBase = variant === 'pill' ? TAREA_PILL[estado] : `mc-badge ${TAREA_BADGE[estado]}`;

  return (
    <span className={[classBase, 'mc-tarea-estado-indicator', className].filter(Boolean).join(' ')} style={style}>
      <Icon size={variant === 'pill' ? 11 : 12} strokeWidth={2} aria-hidden />
      <span>{children ?? label}</span>
    </span>
  );
}
```

### Otros archivos relacionados (solo lista — no mapeo completo label/color/icono)

| Archivo | Rol |
|---------|-----|
| `src/lib/tableroEstado.ts` | Calcula `claveVisualTarea` (estado + situación); no define colores ni iconos. |
| `src/lib/tareaCardSemana.ts` | Señales de card Mi Semana (`vence_hoy`, barra prioridad CSS `mc-semana-task-card__prio--*`). |
| `src/lib/venceHoy.ts` | Lógica «vence hoy» para chip ámbar. |

### Tipo de tarea (`planificada` / `no_planificada` / `libre`)

**No hay archivo de mapeo UI** (label + color + icono) para `tipo`. Se usa en lógica de negocio/schemas; en UI el tipo no se muestra como badge dedicado.

---

## 4. Iconos

### Librería

```ts
import { … } from 'lucide-react';
```

Versión: **lucide-react ^1.8.0**.  
**No** hay `@tabler/icons`, `react-icons` ni sprites SVG propios (salvo SVG inline del botón cerrar en `Modal.tsx`).

### Iconos usados hoy (inventario por uso)

| Icono | Uso |
|-------|-----|
| `Circle` | Estado tarea: pendiente (`TareaEstadoIndicator`) |
| `PlayCircle` | Estado tarea: en progreso |
| `CheckCircle2` | Estado tarea: completada |
| `AlertTriangle` | Estado tarea: atrasada; alertas OT, completar tarea, error boundary, resumen día, drawer actividad |
| `CalendarClock` | Estado tarea: reprogramada; acción Reprogramar en card |
| `Ban` | Estado tarea: cancelada |
| `Play` | Acción Iniciar en `TareaSemanaCard` |
| `Check` | Acción Completar; card completada |
| `Trash2` | Acción Eliminar en card |
| `Calendar` | Eventos (`EventoCard`, `TareaMetaPillRow`); empty Mi Semana |
| `CalendarDays` | Nav: Mi semana (`AppShell`) |
| `Target` | Nav: Objetivos; onboarding |
| `FileText` | Nav: Órdenes; onboarding |
| `ClipboardList` | Nav: Planificación; onboarding |
| `ClipboardCheck` | Empty state OT (`OrdenesTrabajo`) |
| `Bell` | Notificaciones / preferencias (`AppShell`) |
| `LogOut` | Cerrar sesión (`AppShell`) |
| `MoreHorizontal` | Menús `⋯` (shell móvil, detalle tarea, `TaskItem`) |
| `ChevronLeft` / `ChevronRight` | Navegación semana (`MiSemanaHeader`, `PlanificacionHeader`) |
| `ChevronDown` | Acordeones (historial tarea, OT detalle, rendimiento planificación) |
| `ChevronUp` | Acordeón incidencias por día |
| `AlertCircle` | Fila incidencia (`IncidenciaRow`) |
| `X` | Cerrar banners / resumen día |
| `Info` | Tooltip fórmula progreso objetivos |
| `Clock` | Meta tarea (`TaskItem`) |
| `Flag` | Prioridad en `TaskItem` |
| `Lock` | Legacy bloqueada en `TaskItem` |
| `Settings2` | Config tipos OT |
| `Plus` | Añadir tipo OT |
| `ToggleLeft` / `ToggleRight` | Activar/desactivar tipo OT |
| `CheckCircle` | Actividad completada (drawer planificación) |
| `XCircle` | Actividad cancelada/rechazada |
| `History` | Historial en drawer planificación |

`EmptyState` acepta cualquier `ElementType` de Lucide pasado por props (sin import fijo).

---

## 5. Componentes UI compartidos

### `Button` — `src/components/ui/Button.tsx` (entero)

```tsx
/**
 * components/ui/Button.tsx
 *
 * Sistema de botones con jerarquía Apple aplicada a SGTD.
 *
 * Variantes:
 *   primary     — Azul. LA acción principal. Máximo 1 por vista.
 *   secondary   — Gris con borde. Alternativa directa (Reprogramar, paginación).
 *   tertiary    — Transparente con borde accent. Acciones de baja urgencia con consecuencia visible.
 *   ghost       — Cancelar en fila horizontal junto al primary (Patrón A). No usar como única CTA.
 *   danger      — Rojo. Solo en zona destructive separada por border-t.
 *   quaternary  — Texto accent sin fondo ni borde. Ver historial, Limpiar filtros.
 *
 * Navegación por texto (React Router <Link>, pie de auth):
 *   Clases CSS `mc-text-link` (énfasis accent) y `mc-text-link-muted` (volver atrás).
 *   Misma jerarquía visual que quaternary / texto secundario; no duplicar estilos inline.
 *
 * Tamaños:
 *   lg          — Hero task y botones principales de modal (h-11, full-width típicamente).
 *   default     — Uso general en headers y acciones de página.
 *   sm          — Acciones secundarias en tarjetas, columnas, listas.
 *   xs          — Vistas densas: Planificación, logs, tablas. Solo desktop.
 *
 * Componente especial:
 *   <CancelButton> — Para el Cancelar de modales. Texto centrado debajo del primary.
 *                    No usa el sistema de variantes para no contaminar.
 */

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'tertiary' | 'ghost' | 'danger' | 'quaternary';
type Size    = 'lg' | 'default' | 'sm' | 'xs';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children:  ReactNode;
  variant?:  Variant;
  size?:     Size;
  fullWidth?: boolean;
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary:    'mc-btn',
  secondary:  'mc-btn-secondary',
  tertiary:   'mc-btn-tertiary',
  ghost:      'mc-btn-ghost',
  danger:     'mc-btn-danger',
  quaternary: 'mc-btn-quaternary',
};

const SIZE_CLASS: Record<Size, string> = {
  lg:      'mc-btn-lg',
  default: '',
  sm:      'mc-btn-sm',
  xs:      'mc-btn-xs',
};

export function Button({
  children,
  variant   = 'primary',
  size      = 'default',
  fullWidth = false,
  className = '',
  type      = 'button',
  ...rest
}: Props) {
  const classes = [
    VARIANT_CLASS[variant],
    SIZE_CLASS[size],
    fullWidth ? 'mc-btn-full' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// CancelButton — Patrón B: debajo del primary a ancho completo (modales con formulario).
//
// Uso correcto:
//   <Button variant="primary" size="lg" fullWidth>…</Button>
//   <CancelButton onClick={onClose} />
//
// Patrón A (fila: Cancelar + Confirmar) usa <Button variant="ghost">Cancelar</Button>.
// ---------------------------------------------------------------------------

type CancelProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
};

export function CancelButton({ label = 'Cancelar', className = '', type = 'button', ...rest }: CancelProps) {
  return (
    <button
      type={type}
      className={['mc-btn-cancel', className].filter(Boolean).join(' ')}
      {...rest}
    >
      {label}
    </button>
  );
}
```

### Badge / Pill / Tag — `TareaEstadoIndicator` (ver sección 3, archivo completo)

Chips adicionales sin componente `Badge.tsx`:

- Clases `mc-badge`, `mc-chip`, `mc-tarea-pill` definidas en `components.css`.
- `TareaMetaChips.tsx` — chips «Vence hoy» y «OT · estado».

### Card de tarea — `src/components/semana/TareaSemanaCard.tsx` (entero)

```tsx
import { CalendarClock, Check, Play, Trash2 } from 'lucide-react';

import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { TareaEstadoIndicator } from '@/components/tareas/TareaEstadoIndicator';
import { PRIORIDAD_LABEL } from '@/lib/estadoConfig';
import { inicialesNombre } from '@/lib/metricasHelpers';
import { claveVisualTarea } from '@/lib/tableroEstado';
import {
  claseBarraPrioridad,
  labelEstadoEjecucion,
  labelSenalSituacion,
  muestraChipPrioridad,
  senalSituacionCard,
} from '@/lib/tareaCardSemana';
import type { Tarea } from '@/types';

type Props = {
  tarea: Tarea;
  hoyYmd: string;
  ot?: OrdenTrabajo | null;
  responsableNombre?: string;
  readOnly?: boolean;
  onOpenDetalle?: (t: Tarea) => void;
  onIniciar?: (t: Tarea) => void;
  onCompletar?: (t: Tarea) => void;
  onReprogramar?: (t: Tarea) => void;
  onEliminar?: (t: Tarea) => void;
};

/** Tarjeta de tarea en columna semanal (sin drag). */
export function TareaSemanaCard({
  tarea,
  hoyYmd,
  responsableNombre = '—',
  readOnly,
  onOpenDetalle,
  onIniciar,
  onCompletar,
  onReprogramar,
  onEliminar,
}: Props) {
  const terminal = tarea.estado === 'completada' || tarea.estado === 'cancelada';
  const clave = claveVisualTarea(tarea, hoyYmd);
  const senalSit = senalSituacionCard(tarea, hoyYmd);
  const iniciales = inicialesNombre(responsableNombre);

  const puedeIniciar = !readOnly && tarea.estado === 'pendiente' && Boolean(onIniciar);
  const puedeCompletar = !readOnly && tarea.estado === 'en_progreso' && Boolean(onCompletar);
  const puedeReprogramar =
    !readOnly &&
    Boolean(onReprogramar) &&
    !terminal &&
    ['pendiente', 'atrasada', 'reprogramada', 'en_progreso'].includes(clave);
  const puedeEliminar = !readOnly && !terminal && Boolean(onEliminar);

  const hayAcciones = puedeIniciar || puedeCompletar || puedeReprogramar || puedeEliminar;

  if (tarea.estado === 'completada') {
    return (
      <div
        className="mc-semana-task-card mc-semana-task-card--v2 mc-semana-task-card--completada"
        onClick={() => onOpenDetalle?.(tarea)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpenDetalle?.(tarea);
        }}
      >
        <span className="mc-semana-task-card__check" aria-hidden>
          <Check size={14} strokeWidth={2.5} />
        </span>
        <p className="mc-semana-task-card__title">{tarea.titulo}</p>
      </div>
    );
  }

  if (tarea.estado === 'cancelada') {
    return (
      <div
        className="mc-semana-task-card mc-semana-task-card--v2 mc-semana-task-card--cancelada"
        onClick={() => onOpenDetalle?.(tarea)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') onOpenDetalle?.(tarea);
        }}
      >
        <p className="mc-semana-task-card__title">{tarea.titulo}</p>
        <span className="mc-semana-task-card__estado-texto">Cancelada</span>
      </div>
    );
  }

  return (
    <div
      className={[
        'mc-semana-task-card',
        'mc-semana-task-card--v2',
        senalSit === 'atrasada' ? 'mc-semana-task-card--atrasada' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <span
        className={['mc-semana-task-card__prio', claseBarraPrioridad(tarea.prioridad)].join(' ')}
        aria-hidden
      />

      <div className="mc-semana-task-card__main">
        <div
          className="mc-semana-task-card__click"
          role="button"
          tabIndex={0}
          onClick={() => onOpenDetalle?.(tarea)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onOpenDetalle?.(tarea);
          }}
        >
          <div className="mc-semana-task-card__row-top">
            <p className="mc-semana-task-card__title">{tarea.titulo}</p>
            {muestraChipPrioridad(tarea.prioridad) && (
              <span className="mc-chip mc-chip--prioridad-critica mc-semana-task-card__prio-chip">
                {PRIORIDAD_LABEL.critica}
              </span>
            )}
          </div>

          {senalSit ? (
            <div className="mc-semana-task-card__situacion-line">
              {senalSit === 'vence_hoy' ? (
                <span className="mc-chip mc-chip--vence-hoy">{labelSenalSituacion(senalSit)}</span>
              ) : (
                <TareaEstadoIndicator estado={senalSit} variant="pill" />
              )}
            </div>
          ) : null}

          <p className="mc-semana-task-card__ejecucion-line">
            <span className="mc-semana-task-card__ejecucion-label">Estado</span>
            <span className="mc-semana-task-card__estado-texto">{labelEstadoEjecucion(tarea)}</span>
          </p>

          <p className="mc-semana-task-card__usuario-line">
            <span className="mc-semana-task-card__avatar" title={responsableNombre} aria-hidden>
              {iniciales}
            </span>
            <span className="mc-semana-task-card__usuario-nombre">{responsableNombre}</span>
          </p>
        </div>

        {hayAcciones && (
          <div
            className="mc-semana-task-card__actions"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {puedeIniciar && (
              <button
                type="button"
                className="mc-semana-task-card__action-btn"
                onClick={() => onIniciar!(tarea)}
              >
                <Play size={12} aria-hidden />
                Iniciar
              </button>
            )}
            {puedeCompletar && (
              <button
                type="button"
                className="mc-semana-task-card__action-btn mc-semana-task-card__action-btn--primary"
                onClick={() => onCompletar!(tarea)}
              >
                <Check size={12} aria-hidden />
                Completar
              </button>
            )}
            {puedeReprogramar && (
              <button
                type="button"
                className="mc-semana-task-card__action-btn"
                onClick={() => onReprogramar!(tarea)}
              >
                <CalendarClock size={12} aria-hidden />
                Reprogramar
              </button>
            )}
            {puedeEliminar && (
              <button
                type="button"
                className="mc-semana-task-card__action-btn mc-semana-task-card__action-btn--danger"
                onClick={() => onEliminar!(tarea)}
              >
                <Trash2 size={12} aria-hidden />
                Eliminar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

### Avatar

**No existe** `Avatar.tsx`. Avatar = `<span className="mc-semana-task-card__avatar">` con iniciales (`inicialesNombre` en `lib/metricasHelpers.ts`). En métricas/planificación: `.mc-metricas-avatar`.

### Modal base — `src/components/ui/Modal.tsx` (entero)

```tsx
/**
 * components/ui/Modal.tsx
 *
 * Overlay y diálogo con clases del design system (`mc-modal-*`).
 * Si `hasUnsavedChanges`, pide confirmación antes de cerrar (X, Escape, click fuera).
 */

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { trackModalClose, trackModalOpen } from '@/lib/analytics';

type ModalSize = 'sm' | 'md' | 'lg';
/** 0 = base · 1 = sobre otro modal · 2 = confirmaciones críticas encima de todo */
export type ModalStackLevel = 0 | 1 | 2;

const SIZE_CLASS: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
};

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  hideTitle?: boolean;
  size?: ModalSize;
  children: ReactNode;
  footer?: ReactNode;
  /** Clases extra del pie (p. ej. `mc-modal-footer--stack` para CTA a ancho completo). */
  footerClassName?: string;
  /** Clases extra del cuerpo (p. ej. `mc-modal-form` para altura de inputs unificada). */
  bodyClassName?: string;
  hasUnsavedChanges?: boolean;
  discardMessage?: string;
  /** Capa z-index cuando conviven varios overlays (p. ej. completar tras detalle). */
  stackLevel?: ModalStackLevel;
  /** Texto descriptivo enlazado con aria-describedby (recomendado en acciones destructivas). */
  description?: string;
  /** Si el cuerpo ya incluye la descripción visible, su id (evita párrafo duplicado). */
  descriptionElementId?: string;
  /** Id estable para analytics (modal_open / modal_close + abandono). */
  analyticsId?: string;
}

export { markModalCompleted } from '@/lib/analytics';

const STACK_OVERLAY_CLASS: Record<ModalStackLevel, string> = {
  0: '',
  1: 'mc-modal-overlay--stack',
  2: 'mc-modal-overlay--top',
};

const FOCUSABLE =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), button:not([disabled]), iframe, object, embed, ' +
  '[tabindex]:not([tabindex="-1"]), [contenteditable]';

export function Modal({
  open,
  onClose,
  title,
  hideTitle = false,
  size = 'md',
  children,
  footer,
  footerClassName,
  bodyClassName,
  hasUnsavedChanges = false,
  discardMessage = '¿Descartar los cambios? Se perderá la información ingresada.',
  stackLevel = 0,
  description,
  descriptionElementId,
  analyticsId,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const generatedDescId = useId();
  const describedById = descriptionElementId ?? (description ? generatedDescId : undefined);

  const [confirmingClose, setConfirmingClose] = useState(false);

  function emitClose() {
    if (analyticsId) trackModalClose(analyticsId);
    onClose();
  }

  function tryClose() {
    if (hasUnsavedChanges) setConfirmingClose(true);
    else emitClose();
  }

  function confirmDiscard() {
    setConfirmingClose(false);
    emitClose();
  }

  function cancelDiscard() {
    setConfirmingClose(false);
    dialogRef.current?.focus();
  }

  useEffect(() => {
    if (!open || !analyticsId) return;
    trackModalOpen(analyticsId);
  }, [open, analyticsId]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const el = dialogRef.current;
    if (!el) return;
    const first = el.querySelectorAll<HTMLElement>(FOCUSABLE)[0];
    (first ?? el).focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (confirmingClose) cancelDiscard();
      else tryClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, confirmingClose, hasUnsavedChanges]);

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Tab') return;
    const el = dialogRef.current;
    if (!el) return;
    const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className={['mc-modal-overlay', STACK_OVERLAY_CLASS[stackLevel]].filter(Boolean).join(' ')}
      role="presentation"
      onClick={(e) => {
        if (e.target === overlayRef.current) tryClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        {...(describedById ? { 'aria-describedby': describedById } : {})}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`mc-modal-dialog ${SIZE_CLASS[size]}`}
      >
        <div className="mc-modal-header">
          <div className="mc-modal-header-left">
            <h2
              id={titleId}
              className={
                hideTitle ? 'mc-modal-title mc-modal-title--sr-only' : 'mc-modal-title'
              }
            >
              {title}
            </h2>
            {hasUnsavedChanges && (
              <span
                className="mc-modal-unsaved-dot"
                title="Tienes cambios sin guardar"
                aria-label="Cambios sin guardar"
              />
            )}
          </div>
          <button
            type="button"
            className="mc-modal-close"
            onClick={tryClose}
            aria-label="Cerrar"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={['mc-modal-body', bodyClassName].filter(Boolean).join(' ')}>
          {description && !descriptionElementId ? (
            <p id={generatedDescId} className="mc-modal-description">
              {description}
            </p>
          ) : null}
          {children}
        </div>

        {footer ? (
          <div className={['mc-modal-footer', footerClassName].filter(Boolean).join(' ')}>{footer}</div>
        ) : null}

        {confirmingClose && (
          <div
            className="mc-modal-confirm-overlay"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-discard-title"
            aria-describedby="confirm-discard-desc"
          >
            <div className="mc-modal-confirm-card">
              <div>
                <p id="confirm-discard-title" className="mc-modal-confirm-title">
                  ¿Descartar cambios?
                </p>
                <p id="confirm-discard-desc" className="mc-modal-confirm-desc">{discardMessage}</p>
              </div>
              <div className="mc-modal-confirm-actions">
                <button
                  type="button"
                  autoFocus
                  onClick={cancelDiscard}
                  className="mc-btn-ghost"
                >
                  Seguir editando
                </button>
                <button type="button" onClick={confirmDiscard} className="mc-btn-danger">
                  Descartar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
```

### Input / Select base

**No hay** `Input.tsx` ni `Select.tsx` genéricos. Patrones:

- **Filtros:** `FilterBar.tsx` — `select.mc-filter-select`, `input[type=date].mc-filter-select`
- **Formularios:** clases `mc-input`, `mc-field`, `mc-field-label` en `forms.css` + uso en modales
- **Justificación:** `JustificacionField.tsx` (textarea `mc-input`)

#### `FilterBar.tsx` (entero)

```tsx
/**
 * components/ui/FilterBar.tsx
 *
 * Barra de filtros consistente para todas las vistas.
 * Tres variantes de ítem:
 *
 *   <FilterBar.Select>  — dropdown con label accesible
 *   <FilterBar.Pills>   — grupo de botones pill (opción única)
 *   <FilterBar.Date>    — input de fecha con label
 *   <FilterBar.Action>  — botón de acción dentro del contexto de filtros
 *
 * Uso:
 *   <FilterBar>
 *     <FilterBar.Select
 *       id="f-usuario"
 *       label="Usuario"
 *       value={usuarioFiltro}
 *       onChange={(v) => setUsuarioFiltro(v)}
 *       options={[{ value: 'todos', label: 'Todos' }, ...]}
 *     />
 *     <FilterBar.Pills
 *       value={estadoFiltro}
 *       onChange={setEstadoFiltro}
 *       options={[{ value: 'todos', label: 'Todos' }, ...]}
 *     />
 *   </FilterBar>
 */

import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Contenedor raíz
// ---------------------------------------------------------------------------

type FilterBarProps = {
  children: ReactNode;
};

export function FilterBar({ children }: FilterBarProps) {
  return (
    <div className="mc-filter-bar">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FilterBar.Select — dropdown
// ---------------------------------------------------------------------------

type SelectOption = { value: string; label: string };

type FilterSelectProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  minWidth?: number;
};

FilterBar.Select = function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  disabled = false,
  minWidth = 150,
}: FilterSelectProps) {
  return (
    <label className="mc-filter-item" htmlFor={id}>
      <span className="mc-filter-label">{label}</span>
      <select
        id={id}
        className="mc-filter-select"
        style={{ minWidth }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
};

// ---------------------------------------------------------------------------
// FilterBar.Pills — grupo de botones pill
// ---------------------------------------------------------------------------

type PillOption = { value: string; label: string; badge?: number };

type FilterPillsProps = {
  value: string;
  onChange: (value: string) => void;
  options: PillOption[];
};

FilterBar.Pills = function FilterPills({ value, onChange, options }: FilterPillsProps) {
  return (
    <div className="mc-filter-pills" role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`mc-filter-pill${value === o.value ? ' mc-filter-pill--active' : ''}`}
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
        >
          {o.label}
          {o.badge !== undefined && o.badge > 0 && (
            <span className="mc-filter-pill-badge">{o.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------------
// FilterBar.Date — input de fecha
// ---------------------------------------------------------------------------

type FilterDateProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

FilterBar.Date = function FilterDate({ id, label, value, onChange }: FilterDateProps) {
  return (
    <label className="mc-filter-item" htmlFor={id}>
      <span className="mc-filter-label">{label}</span>
      <input
        id={id}
        type="date"
        className="mc-filter-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
};

// ---------------------------------------------------------------------------
// FilterBar.Action — botón dentro de la barra
// ---------------------------------------------------------------------------

type FilterActionProps = {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
  variant?: 'default' | 'toggle';
  title?: string;
};

FilterBar.Action = function FilterAction({
  children,
  onClick,
  active = false,
  variant = 'default',
  title,
}: FilterActionProps) {
  return (
    <button
      type="button"
      title={title}
      className={[
        'mc-filter-action',
        active ? 'mc-filter-action--active' : '',
        variant === 'toggle' ? 'mc-filter-action--toggle' : '',
      ].filter(Boolean).join(' ')}
      onClick={onClick}
      aria-pressed={variant === 'toggle' ? active : undefined}
    >
      {children}
    </button>
  );
};
```

#### `JustificacionField.tsx` (entero)

```tsx
import { MIN_JUSTIFICACION_CHARS } from '@/lib/constants';

interface Props {
  id?:          string;
  value:        string;
  onChange:     (v: string) => void;
  label?:       string;
  placeholder?: string;
  minChars?:    number;
  disabled?:    boolean;
  autoFocus?:   boolean;
}

export function JustificacionField({
  id,
  value,
  onChange,
  label       = 'Justificación',
  placeholder = 'Describe el motivo…',
  minChars    = MIN_JUSTIFICACION_CHARS,
  disabled    = false,
  autoFocus   = false,
}: Props) {
  const len = value.trim().length;
  const ok  = len >= minChars;

  return (
    <div className="mc-field">
      <label className="mc-field-label" htmlFor={id}>
        <span className="flex justify-between">
          <span>{label}</span>
          <span aria-live="polite" className={`mc-char-count ${ok ? 'mc-char-count-ok' : ''}`}>
            {len}/{minChars}
          </span>
        </span>
      </label>
      <textarea
        id={id}
        className="mc-input"
        style={{ minHeight: 96, resize: 'vertical' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-invalid={len > 0 && !ok}
      />
    </div>
  );
}
```

### Resto de `components/` (nombre + ruta)

| Componente | Ruta |
|------------|------|
| LiveRegion | `components/a11y/LiveRegion.tsx` |
| AppLogo | `components/brand/AppLogo.tsx` |
| InsforgeConfigMissing | `components/config/InsforgeConfigMissing.tsx` |
| AppShell | `components/layout/AppShell.tsx` |
| ModalPreferenciasNotificaciones | `components/layout/ModalPreferenciasNotificaciones.tsx` |
| PageHeader | `components/layout/PageHeader.tsx` |
| MetricasChartSemanal | `components/metricas/MetricasChartSemanal.tsx` |
| MetricasComparativa | `components/metricas/MetricasComparativa.tsx` |
| MetricasDonutOT | `components/metricas/MetricasDonutOT.tsx` |
| MetricasHero | `components/metricas/MetricasHero.tsx` |
| MetricasObjetivos | `components/metricas/MetricasObjetivos.tsx` |
| MetricasResumen | `components/metricas/MetricasResumen.tsx` |
| ObjetivoDetalleContenido | `components/objetivos/ObjetivoDetalleContenido.tsx` |
| ObjetivoDetallePanel | `components/objetivos/ObjetivoDetallePanel.tsx` |
| ObjetivoDetalleSidebar | `components/objetivos/ObjetivoDetalleSidebar.tsx` |
| ObjetivoProgreso | `components/objetivos/ObjetivoProgreso.tsx` |
| ObjetivosHeader | `components/objetivos/ObjetivosHeader.tsx` |
| ObjetivosLeyendaRiesgos | `components/objetivos/ObjetivosLeyendaRiesgos.tsx` |
| ObjetivosProgresoInfo | `components/objetivos/ObjetivosProgresoInfo.tsx` |
| ObjetivosToolbar | `components/objetivos/ObjetivosToolbar.tsx` |
| ObjetivoTablaFila | `components/objetivos/ObjetivoTablaFila.tsx` |
| OnboardingWelcome | `components/onboarding/OnboardingWelcome.tsx` |
| ModalTiposOT | `components/ot/ModalTiposOT.tsx` |
| OTDetalleContenido | `components/ot/OTDetalleContenido.tsx` |
| OTDetalleMobile | `components/ot/OTDetalleMobile.tsx` |
| OTDetalleSidebar | `components/ot/OTDetalleSidebar.tsx` |
| OTFlujoEstados | `components/ot/OTFlujoEstados.tsx` |
| OTFormModal | `components/ot/OTFormModal.tsx` |
| OTHeader | `components/ot/OTHeader.tsx` |
| OTImpresion | `components/ot/OTImpresion.tsx` |
| OTListaMobileItem | `components/ot/OTListaMobileItem.tsx` |
| OTTablaFila | `components/ot/OTTablaFila.tsx` |
| OTToolbar | `components/ot/OTToolbar.tsx` |
| PlanificacionActividadDrawer | `components/planificacion/PlanificacionActividadDrawer.tsx` |
| PlanificacionActividadReciente | `components/planificacion/PlanificacionActividadReciente.tsx` |
| PlanificacionAnalisisGrid | `components/planificacion/PlanificacionAnalisisGrid.tsx` |
| PlanificacionCeldaMobile | `components/planificacion/PlanificacionCeldaMobile.tsx` |
| PlanificacionCeldaSidebar | `components/planificacion/PlanificacionCeldaSidebar.tsx` |
| PlanificacionHeader | `components/planificacion/PlanificacionHeader.tsx` |
| PlanificacionHeatmap | `components/planificacion/PlanificacionHeatmap.tsx` |
| PlanificacionHistorialCompleto | `components/planificacion/PlanificacionHistorialCompleto.tsx` |
| PlanificacionIncidenciasLista | `components/planificacion/PlanificacionIncidenciasLista.tsx` |
| PlanificacionJustificaciones | `components/planificacion/PlanificacionJustificaciones.tsx` |
| PlanificacionMobile | `components/planificacion/PlanificacionMobile.tsx` |
| PlanificacionPanel | `components/planificacion/PlanificacionPanel.tsx` |
| PlanificacionRendimiento | `components/planificacion/PlanificacionRendimiento.tsx` |
| PlanificacionSection | `components/planificacion/PlanificacionSection.tsx` |
| PlanificacionToolbar | `components/planificacion/PlanificacionToolbar.tsx` |
| JefeRoute | `components/routing/JefeRoute.tsx` |
| ProtectedRoute | `components/routing/ProtectedRoute.tsx` |
| EventoCard | `components/semana/EventoCard.tsx` |
| IncidenciaRow | `components/semana/IncidenciaRow.tsx` |
| MiSemanaGrilla | `components/semana/MiSemanaGrilla.tsx` |
| MiSemanaHeader | `components/semana/MiSemanaHeader.tsx` |
| MiSemanaLeyendaEstados | `components/semana/MiSemanaLeyendaEstados.tsx` |
| MiSemanaMenuSecundario | `components/semana/MiSemanaMenuSecundario.tsx` |
| MiSemanaResumenDia | `components/semana/MiSemanaResumenDia.tsx` |
| MiSemanaStatsInline | `components/semana/MiSemanaStatsInline.tsx` |
| MiSemanaToolbar | `components/semana/MiSemanaToolbar.tsx` |
| ModalConvertirNota | `components/semana/ModalConvertirNota.tsx` |
| ModalDetalleTareaSemana | `components/semana/ModalDetalleTareaSemana.tsx` |
| ModalMiSemana | `components/semana/ModalMiSemana.tsx` |
| NotasDrawer | `components/semana/NotasDrawer.tsx` |
| RecurrenciaForm | `components/semana/RecurrenciaForm.tsx` |
| SemanaColumnaResumen | `components/semana/SemanaColumnaResumen.tsx` |
| SemanaIncidenciasAcordeon | `components/semana/SemanaIncidenciasAcordeon.tsx` |
| ModalCompletarTarea | `components/tareas/ModalCompletarTarea.tsx` |
| ModalJustificacion | `components/tareas/ModalJustificacion.tsx` |
| ModalNuevaTarea | `components/tareas/ModalNuevaTarea.tsx` |
| ModalReprogramar | `components/tareas/ModalReprogramar.tsx` |
| TareaHistorialSection | `components/tareas/TareaHistorialSection.tsx` |
| TareaMetaChips | `components/tareas/TareaMetaChips.tsx` |
| TareaMetaPillRow | `components/tareas/TareaMetaPillRow.tsx` |
| TarjetaTarea | `components/tareas/TarjetaTarea.tsx` |
| TaskItem | `components/tareas/TaskItem.tsx` |
| EmptyState | `components/ui/EmptyState.tsx` |
| KpiCard | `components/ui/KpiCard.tsx` |
| ModalConfirmar | `components/ui/ModalConfirmar.tsx` |
| SectionErrorBoundary | `components/ui/SectionErrorBoundary.tsx` |
| Skeletons | `components/ui/Skeletons.tsx` |
| ValuePropositionBanner | `components/ui/ValuePropositionBanner.tsx` |

---

## 6. Pantallas

| Ruta | Página | Descripción |
|------|--------|-------------|
| `/login` | `pages/Login.tsx` | Inicio de sesión con email/contraseña (InsForge Auth). |
| `/forgot-password` | `pages/ForgotPassword.tsx` | Solicitud de código para recuperar contraseña. |
| `/verify-reset-code` | `pages/VerifyResetCode.tsx` | Verificación del código de reset enviado por email. |
| `/reset-password` | `pages/ResetPassword.tsx` | Establecer nueva contraseña tras verificar código. |
| `/` → `/semana` | redirect | Índice autenticado redirige a Mi Semana. |
| `/semana` | `pages/MiSemana.tsx` | Grilla semanal Lun–Sáb, tareas/eventos/incidencias, notas drawer, detalle y modales de tarea. |
| `/objetivos` | `pages/Objetivos.tsx` | CRUD y tabla de objetivos con panel lateral de detalle y progreso. |
| `/ordenes-trabajo` | `pages/OrdenesTrabajo.tsx` | Listado y flujo de OT (borrador → pendiente → aprobada → completada). |
| `/planificacion` | `pages/Planificacion.tsx` | Vista jefe: heatmap carga equipo, métricas/SLA integrados, drawer actividad. Solo jefe (`JefeRoute`). |
| `/metricas` | redirect → `/planificacion` | Ruta legacy; métricas unificadas en Planificación. |
| `*` | redirect → `/semana` | Catch-all. |

**Nota:** `pages/Metricas.tsx` puede existir como código legacy; no está montada en el router activo.

---

## 7. Inconsistencias detectadas

1. **Doble acento de marca:** `--mc-color-accent` (azul #0064E0, botones primarios) vs `--mc-brand-violet` (morado #534AB7, nav activo / algunos formularios). Dos sistemas de «primario» coexisten.

2. **Escala tipográfica vs documentación:** tokens usan `--mc-text-xs: 11px`, `--mc-text-sm: 13px`; reglas de producto citan 12/14/16. Desalineación doc ↔ tokens.

3. **Estado `bloqueada` legacy:** tokens `--mc-state-bloqueada-*` y icono `Lock` en `TaskItem.tsx` persisten tras v1.1 (eje situación sin bloquear en BD/UI nueva).

4. **CSS DnD huérfano:** clases `.mc-drag-overlay-card`, `.mc-semana-task-card__grip`, `--mc-shadow-drag` en `tokens.css` / `components.css` tras eliminar `@dnd-kit`.

5. **Sin componente `Badge`/`Input`/`Avatar` unificados:** badges son clases CSS + `TareaEstadoIndicator`; inputs repartidos entre `mc-input`, `mc-filter-select` y estilos de modal; avatares son spans locales.

6. **Botones en card vs `Button`:** acciones hover en `TareaSemanaCard` usan `.mc-semana-task-card__action-btn` (estilos propios), no el componente `Button` — jerarquía visual paralela.

7. **Icono cerrar modal:** SVG inline en `Modal.tsx` en lugar de Lucide `X` (resto del sistema usa lucide-react).

8. **Estilos inline puntuales:** `FilterBar.Select` (`minWidth`), `JustificacionField` (`minHeight: 96`), algunos `text-[12px]` en grilla — fuera de tokens `--mc-text-*`.

9. **Tailwind vs CSS custom:** responsive principal en `@media` (767/768/1024/1200px); Tailwind `md:` solo en pocos TSX — dos paradigmas de breakpoint.

10. **Módulo Métricas huérfano:** componentes en `components/metricas/` sin ruta dedicada; posible deuda si no se reutilizan todos desde Planificación.

11. **Tarjetas de tarea duplicadas:** `TareaSemanaCard`, `TarjetaTarea`, `TaskItem` — tres implementaciones de presentación de tarea según contexto.

12. **Hex en TSX:** no se detectaron hex hardcodeados en `.tsx/.ts` (ESLint `no-restricted-syntax`); hex concentrados en `tokens.css` (correcto por diseño).

---

## 8. package.json — dependencias de estilo, iconos y componentes

```json
{
  "dependencies": {
    "lucide-react": "^1.8.0",
    "sonner": "^2.0.7"
  },
  "devDependencies": {
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "3.4.17"
  }
}
```

**No instaladas:** shadcn/ui, Radix UI, MUI, Chakra, Emotion, styled-components, `@tabler/icons-react`, `react-icons`, Headless UI, `@dnd-kit/*` (eliminado en inventario actual).
