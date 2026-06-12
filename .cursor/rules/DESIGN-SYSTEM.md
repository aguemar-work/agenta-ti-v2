# Agenda TI — Reglas Obligatorias del Design System
**Materen Canvas Design System · Post-Fase 0 · Mayo 2026**

> Este documento es la fuente única de verdad para todos los desarrolladores y agentes.  
> Cada regla es una **norma de code review, no una sugerencia**.

---

## ESTADO DE CONVERGENCIA (Plan V4)

| Fase | Estado | Descripción |
|---|---|---|
| **0** | ✅ Completa | `--ds-*` eliminados como hex; `design-tokens.css` borrado; `StatusBadge.tsx` sin referencias |
| **1** | 🔄 Activa | Todo código nuevo: solo `--mc-*`, `.mc-*`, `TAREA_BADGE` / `STATE_TOKENS` |
| **2** | ✅ Completa | `StatusBadge.tsx` eliminado; bloque `.ds-status-badge` eliminado de `components.css` |
| **3** | ✅ Completa | `@import design-tokens.css` eliminado de `index.css` |

**Regla para agentes y desarrolladores:**
- ❌ No añadir `--ds-*` en TSX/CSS nuevos.
- ❌ No volver a poner hex en `design-tokens.css` (el archivo fue eliminado).
- ❌ No importar ni usar `StatusBadge` (marcado `@deprecated`, sin referencias activas).
- ✅ Solo `--mc-*` / `.mc-*` / `TAREA_BADGE` / `STATE_TOKENS` de `lib/estadoConfig.ts`.

---

## 1. TOKENS: La única fuente de color

### 1.1 Prefijo activo: `--mc-*`

`tokens.css` es la **única fuente de color**. El prefijo `--ds-*` fue eliminado en Fase 0.

```css
/* ✅ CORRECTO */
color: var(--mc-color-text);
background: var(--mc-color-accent);
border-color: var(--mc-state-atrasada-border);

/* ❌ INCORRECTO — prohibido en cualquier archivo nuevo */
color: #050505;
background: #0064e0;

/* ❌ INCORRECTO — prefijo eliminado */
color: var(--ds-color-text);
```

### 1.3 Helper unificado: `getEstadoStyles`

Para obtener los estilos visuales completos de una tarjeta de tarea (fondo, texto, borde
de alerta, badge de urgencia) usa siempre el helper unificado:

```ts
import { getEstadoStyles } from '@/lib/estadoConfig';

const estilos = getEstadoStyles(claveVisual, urgenciaHoraria);
// estilos.bg, estilos.fg, estilos.borderAlerta, estilos.badgeBg, estilos.badgeFg
```

Prioridad interna: `atrasada` > `vencida_hoy` > `urgente` > `precaucion` > normal.

**No** construir esta lógica inline en componentes nuevos.
`STATE_TOKENS` y `URGENCIA_TOKENS` siguen exportados para usos de tarjeta con
`STATE_TOKENS[tarea.estado]` (borde izquierdo de color de estado, no de urgencia).

### 1.4 Regla de acento: teal vs violeta

El sistema tiene dos colores de marca con roles distintos. La distinción es **acción vs
identidad**, y debe respetarse siempre:

| Color | Token | Cuándo usarlo |
|---|---|---|
| Teal | `--mc-color-accent` (y `-hover`, `-active`, `-soft`) | Todo lo interactivo: botón primario, link, chip clicable, anillo de foco, nav activo del sidebar, KPI activo, barra de progreso en ritmo. |
| Violeta | `--mc-brand-violet` (y `-soft`) | Identidad de marca pasiva y el estado de tarea `reprogramada`. **Nunca** en un elemento sobre el que se hace clic. |

**Regla de una línea para code review:** si el usuario puede hacer clic en ello, es teal.
Si solo lo está mirando (estado, marca), puede ser violeta.

El nav activo del sidebar usa **teal** deliberadamente — navegar es una acción, no un estado.

### 1.2 Tokens de estado de tarea (solo leer vía `STATE_TOKENS`)

Definidos en `tokens.css` bajo "Estado de tarea". **Nunca usarlos directamente en componentes** — siempre a través de `STATE_TOKENS` en `lib/estadoConfig.ts`.

| Token grupo | Propiedades |
|---|---|
| `--mc-state-atrasada-*` | bg, fg, border, meta |
| `--mc-state-bloqueada-*` | bg, fg, border, meta |
| `--mc-state-progreso-*` | bg, fg, border |
| `--mc-state-completada-*` | bg, fg, border |
| `--mc-state-reprogramada-*` | bg, fg, border |
| `--mc-state-precaucion-*` | bg, fg, border (urgencia horaria) |
| `--mc-state-urgente-*` | bg, fg, border, badge-bg, badge-fg |
| `--mc-state-vencida-*` | bg, fg, border, badge-bg, badge-fg |

---

## 2. BADGES DE ESTADO — Sistema unificado

### 2.1 Forma válida de renderizar un badge de estado

```tsx
import { TAREA_BADGE, TAREA_LABEL } from '@/lib/estadoConfig';

// ✅ CORRECTO
<span className={`mc-badge ${TAREA_BADGE[tarea.estado]}`}>
  {TAREA_LABEL[tarea.estado]}
</span>

// ❌ INCORRECTO — componente deprecated
<StatusBadge estado={tarea.estado} />

// ❌ INCORRECTO — clase eliminada en Fase 2
<span className="ds-status-badge ds-status-badge--atrasada">...</span>
```

### 2.2 Mapa completo de badge por estado (fuente: `TAREA_BADGE` en `estadoConfig.ts`)

| Estado | Clase badge | Color | Nota |
|---|---|---|---|
| `pendiente` | `mc-badge-neutral` | Gris neutro | |
| `en_progreso` | `mc-badge-info` | Azul info | Usa `--mc-color-info`, **no** brand/accent |
| `completada` | `mc-badge-success` | Verde | |
| `atrasada` | `mc-badge-danger` | Rojo | Eje 2 (`situacion`) — ver `web/CONTEXT/TAREA-MODEL.md` |
| `reprogramada` | `mc-badge-neutral` | Gris neutro | Badge es neutral; `TAREA_PILL` usa violeta — ver §2.5 |
| `cancelada` | `mc-badge-neutral` | Gris neutro | |

### 2.3 Badges de objetivo (`OBJETIVO_BADGE`)

```tsx
import { OBJETIVO_BADGE, OBJETIVO_LABEL } from '@/lib/estadoConfig';

<span className={`mc-badge ${OBJETIVO_BADGE[objetivo.estado]}`}>
  {OBJETIVO_LABEL[objetivo.estado]}
</span>
```

| Estado | Clase |
|---|---|
| `activo` | `mc-badge-accent` |
| `completado` | `mc-badge-success` |
| `cancelado` | `mc-badge-neutral` |

### 2.4 Badges de urgencia horaria (`URGENCIA_BADGE`)

```tsx
import { URGENCIA_BADGE, URGENCIA_LABEL } from '@/lib/estadoConfig';

{urgencia !== 'normal' && (
  <span className={`mc-badge ${URGENCIA_BADGE[urgencia]}`}>
    {URGENCIA_LABEL[urgencia]}
  </span>
)}
```

### 2.5 Badges de prioridad (`PRIORIDAD_BADGE`)

```tsx
import { PRIORIDAD_BADGE, PRIORIDAD_LABEL } from '@/lib/estadoConfig';

// PRIORIDAD_BADGE ya incluye 'mc-badge' en la clase — no duplicar
<span className={PRIORIDAD_BADGE[tarea.prioridad]}>
  {PRIORIDAD_LABEL[tarea.prioridad]}
</span>
```

### 2.6 `TAREA_PILL` — diferencia con `TAREA_BADGE`

`TAREA_PILL` existe para tablas y Planificación donde los badges necesitan Tailwind inline (sin acceso directo a `style={{}}`). A diferencia de `TAREA_BADGE`:

- `reprogramada` en `TAREA_PILL` usa **violeta** (`bg-[#EEEDFE] text-[#3C3489]`).
- `TAREA_PILL` tiene hex directos — **deuda de Fase 1**, no extender este patrón.
- Solo usar `TAREA_PILL` en los contextos donde ya se usa actualmente.

### 2.7 Clases de badge disponibles en `components.css`

```
mc-badge                  — base
mc-badge-neutral          — gris
mc-badge-accent           — brand azul
mc-badge-success          — verde
mc-badge-warning          — ámbar
mc-badge-danger           — rojo
mc-badge-info             — azul info
mc-badge-prioridad-alta
mc-badge-prioridad-media
mc-badge-prioridad-baja
```

No crear clases `mc-badge-*` nuevas sin añadirlas a `components.css` y a este documento.

---

## 3. COLORES DE ESTADO EN TARJETAS DE TAREA

```tsx
import { STATE_TOKENS } from '@/lib/estadoConfig';

const t = STATE_TOKENS[tarea.estado];

<div style={{
  background: t.bg,
  borderLeft: `3px solid ${t.border}`,
  color:      t.fg,
}}>
  <span style={{ color: t.meta }}>meta info</span>
</div>
```

Para urgencia horaria (solo en `pendiente` / `en_progreso`):

```tsx
import { URGENCIA_TOKENS } from '@/lib/estadoConfig';

const u = URGENCIA_TOKENS[urgenciaHoraria];
// u.bg, u.fg, u.border, u.badgeBg, u.badgeFg
```

---

## 4. BOTONES — Jerarquía y uso

### 4.1 Los seis tipos

| Variante | Cuándo | Máximo |
|---|---|---|
| `primary` | Acción principal única | **1 por sección/modal** |
| `secondary` | Alternativa directa (Reprogramar, Exportar) | Sin límite |
| `tertiary` | Baja urgencia, consecuencia visible | Sin límite |
| `ghost` | Cancelar en par horizontal con primary (Patrón A) | Solo en par |
| `danger` | Destructivas: Eliminar, Descartar | Solo en zona separada |
| `quaternary` | Links de texto: Ver historial, Limpiar filtros | Sin límite |

### 4.2 Tamaños por contexto

| Prop | Cuándo |
|---|---|
| `size="lg"` | CTA principal de modal (siempre con `fullWidth`) |
| `size="default"` | Headers de página, acciones principales |
| `size="sm"` | Acciones secundarias en tarjetas, listas |
| `size="xs"` | Vistas densas: Planificación, tablas. Solo desktop |

### 4.3 Patrón A (fila) vs Patrón B (stack)

**Patrón A — Confirmación simple:**
```tsx
<div className="mc-modal-footer">
  <Button variant="ghost">Cancelar</Button>
  <Button variant="primary">Confirmar</Button>
</div>
```

**Patrón B — Modal con formulario:**
```tsx
<div className="mc-modal-footer mc-modal-footer--stack">
  <Button variant="primary" size="lg" fullWidth>Guardar</Button>
  <CancelButton onClick={onClose} />
</div>
```

### 4.4 Zona destructiva (separación obligatoria)

```tsx
<Button variant="primary" size="lg" fullWidth>Acción principal</Button>
<CancelButton onClick={onClose} />
<div style={{ borderTop: '1px solid var(--mc-color-border)', paddingTop: 12, marginTop: 4 }}>
  <Button variant="danger" size="sm" fullWidth>Eliminar permanentemente</Button>
</div>
```

### 4.5 Prohibiciones

```tsx
// ❌ Dos primary en el mismo scope
// ❌ danger sin zona separada por border-t
// ❌ ghost como CTA único (usar quaternary)
// ❌ className que sobreescriba color de variante
```

---

## 5. MODALES — Estructura

```tsx
<Modal
  open={open}
  onClose={onClose}
  title="Título descriptivo"           // obligatorio, nunca vacío
  size="md"                            // sm | md | lg
  hasUnsavedChanges={hasChanges}       // obligatorio si hay formulario
  footer={<FooterButtons />}
  footerClassName="mc-modal-footer--stack"   // si CTA es full-width
  bodyClassName="mc-modal-form"              // si hay inputs
>
  {/* contenido */}
</Modal>
```

| Size | max-width | Cuándo |
|---|---|---|
| `sm` | 384px | Confirmaciones, un solo campo |
| `md` | 448px | Formularios estándar (default) |
| `lg` | 512px | Formularios complejos, detalle OT |

**Reglas críticas:**
- No crear overlays custom ad hoc — solo `<Modal>`.
- `hasUnsavedChanges` obligatorio en cualquier modal con campos controlados.
- No anidar `<Modal>` dentro de otro sin auditar z-index y focus trap.
- El unsaved-changes dialog lo gestiona el componente automáticamente.

---

## 6. MÓDULOS DE PÁGINA

### 6.1 Esqueleto estándar

```tsx
export function MiPagina() {
  return (
    <div className={APP_PAGE_CLASS}>
      <PageHeader titulo="…" subtitulo="…" actions={<Button>…</Button>} />
      <div className="mc-kpi-grid"><KpiCard … /></div>
      <div className="mc-module">
        <div className="mc-card">{/* contenido */}</div>
      </div>
    </div>
  );
}
```

### 6.2 Clases por elemento

| Elemento | Clase |
|---|---|
| Página | `APP_PAGE_CLASS` — no padding inline |
| Card / panel | `.mc-card` |
| Módulo wrapper | `.mc-module` |
| Grilla KPI | `.mc-kpi-grid` |
| Tarjeta KPI | `.mc-kpi-card` (valor: `.mc-kpi-value`, label: `.mc-kpi-label`) |
| Tabla | `.mc-table` |
| Header de sección | `.mc-section-header` |
| Separador | `.mc-divider` |
| Estado vacío | `.mc-empty` + `.mc-empty-title` + `.mc-empty-desc` (o `<EmptyState>`) |

### 6.3 Clases de tarjeta de tarea por contexto

| Contexto | Clase |
|---|---|
| Lista / backlog | `.mc-task-item` |
| Kanban | `.mc-task-kanban` |
| Card suelta | `.mc-task-card` |
| Grilla Mi Semana (mínima) | `.mc-semana-task-card--minimal` |
| OT / objetivo / entidad | `.mc-entity-card` |

### 6.4 Mi Semana — layout V4.1 (mayo 2026)

**Principio:** cero fricción, denso, todo visible en desktop sin scroll innecesario.

| Elemento | Regla |
|---|---|
| Contadores de estado | `.mc-misemana-stats` — texto inline en cabecera (número + etiqueta). **Sin** `.mc-kpi-card` ni bordes |
| Selector «Ver semana de» | Solo jefe; dentro de menú secundario (`MiSemanaMenuSecundario`), no visible siempre |
| Notas | Drawer colapsado por defecto; botón «Notas» en cabecera |
| Columna HOY | `.mc-semana-dia-col--hoy` → `--mc-color-surface-elevated`; cabecera en negrita + `.mc-semana-dia-col__hoy-dot` (acento azul) |
| Tarjeta en columna | Título + grip; badge de estado **solo si** `estado !== 'pendiente'`; descripción en `title` (hover); chips OT / vence hoy si aplican |
| Pie de columna | `.mc-semana-col-resumen` — una línea compacta |
| Leyenda | `.mc-misemana-leyenda` — barra inferior bajo la grilla |
| Móvil | Un día visible; pills o swipe (`useSwipeDiaSemana`); día actual al abrir |

Token nuevo: `--mc-color-surface-elevated` (superficie HOY, sutil vs `--mc-color-bg`).

### 6.8 Métricas — layout V4.1 (mayo 2026)

| Bloque | Regla |
|--------|--------|
| Hero | `.mc-metricas-hero` — % grande + delta pp (solo aquí) |
| Resumen | `.mc-metricas-resumen` — grid denso, sin trailing/delta |
| Análisis | `.mc-metricas-analisis`: chart + donut OT ≤150px |
| Comparativa | Avatar iniciales + mini barra cumplimiento |
| Objetivos | `.mc-metricas-objetivos__grid` cards compactas |

### 6.7 Planificación — layout V4.1 (mayo 2026)

| Tareas en celda | Clase |
|----|----|
| 0 | `.mc-plan-celda--0` gris suave |
| 1–2 | `.mc-plan-celda--1` neutro |
| 3–4 | `.mc-plan-celda--2` azul suave |
| 5–6 | `.mc-plan-celda--3` ámbar suave |
| 7+ | `.mc-plan-celda--4` rojo suave |

Drawer: `.mc-drawer-panel--planificacion`. Resumen día: `.mc-plan-resumen-dia`.

### 6.6 Órdenes de Trabajo — layout V4.1 (mayo 2026)

| Elemento | Regla |
|---|---|
| Contadores | `.mc-misemana-stats` readOnly (Activas · Pendientes · Urgentes · Vencidas) |
| Flujo | `.mc-ot-flujo` — línea sin fondo; paso activo en negrita |
| Tabla | 3 columnas; urgente = `mc-badge-danger` en descripción; normal sin badge |
| Detalle | `.mc-ot-sidebar` split desktop; `.mc-ot-detalle-mobile` en móvil |
| Swipe móvil | `.mc-ot-swipe` — aprobar / completar / cancelar según rol y estado |

### 6.5 Objetivos — layout V4.1 (mayo 2026)

**Principio:** lectura analítica; panel de detalle solo bajo demanda.

| Elemento | Regla |
|---|---|
| Contadores | `.mc-misemana-stats` + `readOnly` en cabecera (Total · Activos · Críticos · Completados) |
| Tabla | Barra de progreso + badge de riesgo; fila crítica `.mc-list-row--atrasada` |
| Fórmula de progreso | `ObjetivosProgresoInfo` (ⓘ) en cabecera de columna Progreso — tooltip, no banner |
| Detalle | `ObjetivoDetallePanel`: drawer desktop (`mc-drawer-panel--objetivo`); móvil pantalla completa (`.mc-objetivo-detalle-mobile`) |
| Panel | Tareas, breakdown de puntos (`breakdownPuntosObjetivo`), acciones completar/eliminar |
| Leyenda | `.mc-objetivos-leyenda` — una línea al pie de página |
| Paginación | `.mc-objetivos-paginacion` cuando hay más de 15 objetivos |

---

## 7. INPUTS Y FORMULARIOS

```html
<div class="mc-field">
  <label class="mc-field-label">Etiqueta</label>
  <input class="mc-input" />
  <span class="mc-field-error">Error</span>   <!-- si aplica -->
  <span class="mc-field-hint">Ayuda</span>    <!-- si aplica -->
</div>
```

- Inputs en modal con `mc-modal-form`: **36px**.
- Inputs fuera de modal: **40px** (base).
- Textarea: `min-height: 80px`, `resize: vertical`.

---

## 8. TIPOGRAFÍA Y ESPACIADO

**Fuentes:** `--mc-text-xs` (11px) · `--mc-text-sm` (13px, base) · `--mc-text-base` (14px) · `--mc-text-md` (16px) · `--mc-text-lg` (18px, título página) · `--mc-text-xl` (22px) · `--mc-text-2xl` (28px)

**Espaciado — solo tokens o múltiplos de 4px:**  
`--mc-space-1` (4) · `--mc-space-2` (8) · `--mc-space-3` (12) · `--mc-space-4` (16) · `--mc-space-5` (20) · `--mc-space-6` (24) · `--mc-space-8` (32) · `--mc-space-10` (40)

---

## 8b. RESPONSIVE — Un solo paradigma para código nuevo

El proyecto tiene CSS `@media` legacy (congelado) y Tailwind. Para evitar mezcla indefinida:

### Regla

| Situación | Qué usar |
|---|---|
| Responsive de layout en código **nuevo** (grids, columnas, show/hide) | Tailwind: `md:`, `lg:`, `xl:` |
| Breakpoints | Estándar Tailwind: `sm` 640 · `md` 768 · `lg` 1024 · `xl` 1280 |
| Media query que depende de un token CSS (`calc()` con `--mc-*`) | CSS `@media` (Tailwind no lo puede expresar) |
| `@media` legacy existente | Congelado — no migrar, no ampliar |

### Al tocar un componente con `@media` legacy

- Si necesitas responsive nuevo, escríbelo en Tailwind aunque el archivo tenga `@media` viejos.
- **NO** conviertas los `@media` existentes "de paso". Migrar legacy es un PR aparte y deliberado.

### Excepción permanente (se quedan en CSS)

Las media queries que sobreescriben valores calculados con tokens de layout — p. ej. si en algún
breakpoint hubiera que recalcular `--mc-semana-dia-col-max-height`
(`calc(100dvh - var(--mc-topbar-h) - var(--mc-bottom-nav-h) - ...)`).
Tailwind no puede expresar cálculos con CSS custom properties dinámicas; esos casos permanecen en CSS indefinidamente.

### Inventario de statu quo (foto congelada — junio 2026)

**CSS `@media` legacy — 16 responsivos en 3 archivos:**

| Archivo | Breakpoints usados |
|---|---|
| `components.css` | 767, 768, 768–1199, 1023, 1024, 1200 px (13 bloques) |
| `shell.css` | 767, 768 px (2 bloques) |
| `animations.css` | 767 px (1 bloque) |

No responsivos (no migrar): `@media print` / `@media screen` en `ot-impresion.css`; `@media (prefers-reduced-motion)` en `animations.css`.

**Tailwind responsive — usos actuales:**

| Prefijo | Usos | Archivos |
|---|---|---|
| `sm:` | 2 | `PanelUsuarios.tsx` |
| `md:` | 10 | `OTFormModal.tsx`, `MiSemanaGrilla.tsx`, `Skeletons.tsx` |
| `lg:` | 0 | — |
| `xl:` | 0 | — |

Los `@media` con `--mc-space-*` dentro de sus reglas son legacy normal (spacing, no cálculo de layout). El caso `max(env(safe-area-inset-bottom), var(--mc-space-2))` en `components.css` es iOS safe-area y permanece en CSS.

---

## 9. ICONOS, SOMBRAS Y ANIMACIONES

**Iconos:** Lucide React principal. Tabler Icons solo si el ícono no existe en Lucide. Color siempre `currentColor`. Tamaños: 14 / 16 / 20 / 24px.

**Sombras:** `--mc-card-shadow` (cards) · `--mc-dropdown-shadow` (dropdowns) · `--mc-modal-shadow` (solo modales) · `--mc-card-shadow-drag` (arrastre DnD).

**Animaciones existentes — no crear duplicados:** `mc-fade-in` · `mc-slide-up` · `mc-slide-in-right` · `mc-skeleton/mc-shimmer` · `task-precaucion`.

---

## 10. DEUDA TÉCNICA ACTIVA

| Item | Fase | Estado |
|---|---|---|
| ~~`TAREA_PILL` tiene hex directos~~ | ~~1~~ | ✅ Resuelto — `.mc-tarea-pill--*` + tokens `--mc-state-pendiente/cancelada-*` |
| ~~`.ds-status-badge` en `components.css`~~ | ~~2~~ | ✅ Eliminado |
| ~~`StatusBadge.tsx` en disco~~ | ~~2~~ | ✅ Eliminado |
| ~~`@tabler/icons-react` en `package.json`~~ | ~~1~~ | ✅ Resuelto — Lucide en `AppShell.tsx` |

---

## 10b. ACCESIBILIDAD — Patrones obligatorios

### Notificaciones en tiempo real
`LiveRegion` está montada globalmente en `AppProviders`. Para anunciar a lectores de pantalla:

```ts
import { announcePolitely } from '@/components/a11y/LiveRegion';

announcePolitely('OT aprobada: Revisión de servidores');
// En paralelo con el toast — no reemplaza al toast
```

**No crear `aria-live` regions adicionales.**

### Estados de tarea
No usar color como único diferenciador. Siempre `<TareaEstadoIndicator>` en superficies de tarea.

### Modales destructivos
`description` o `descriptionElementId` obligatorio. Ver §5.

---

## 10c. ANALYTICS — Patrones obligatorios

### Instrumentar modales

```tsx
<Modal
  analyticsId="modal-nueva-tarea"
  open={open}
  onClose={onClose}
>
  {/* Al guardar con éxito — antes de onClose: */}
  {/* markModalCompleted('modal-nueva-tarea') */}
</Modal>
```

**Modales instrumentados:** `modal-mi-semana-nuevo`, `modal-nueva-tarea`, `modal-ot-form`, `modal-reprogramar-tarea`, `modal-completar-tarea`, `modal-detalle-tarea`, `modal-ot-detalle`, `modal-ot-completar`, `modal-ot-rechazar`, `onboarding-welcome`, `modal-preferencias-notificaciones`.

Todo modal nuevo de creación o flujo crítico debe incluir `analyticsId`.

### Eventos en `analytics.ts`

| Evento | Cuándo |
|---|---|
| `page_view` | Automático en navegación |
| `modal_open` / `modal_close` | Automático vía `analyticsId` |
| `markModalCompleted(id)` | Antes de cerrar tras éxito |
| `onboarding` | Tour de bienvenida |
| `feature_discovery` | Clic desde banner o tour |

En dev: `[analytics]` en consola. En prod: `sendBeacon` a `VITE_ANALYTICS_ENDPOINT`.

### Qué no hacer

```ts
// ❌ fetch directo a tracker propio
// ❌ console.log en prod para funnels
// ✅ Extender analytics.ts si hace falta un evento nuevo
```

---

## 10d. MENÚS CONTEXTUALES

### Menús contextuales

Todo menú de acciones (⋯) usa `<PopoverMenu>` de `components/ui/PopoverMenu`.
No construir menús manuales con estado `open` propio, listeners de click-fuera ni
posicionamiento ad hoc — `PopoverMenu` lo gestiona todo por portal.

```tsx
import { PopoverMenu, type PopoverMenuItem } from '@/components/ui/PopoverMenu';

const menuItems = useMemo((): PopoverMenuItem[] => [
  { id: 'editar',    label: 'Editar',    icon: Pencil,       onClick: () => onEditar(item) },
  { id: 'eliminar',  label: 'Eliminar',  icon: Trash2,       danger: true, onClick: () => onEliminar(item) },
], [onEditar, onEliminar, item]);

<PopoverMenu
  items={menuItems}
  trigger={
    <button type="button" className="mc-semana-task-card__menu-trigger" aria-label="Más opciones">
      <MoreHorizontal size={16} aria-hidden />
    </button>
  }
/>
```

- `PopoverMenu` retorna `null` si `items.length === 0` — no hace falta condicionar externamente.
- El trigger recibe `aria-expanded`, `aria-haspopup` y `onClick` inyectados automáticamente.
- Items con `danger: true` se renderizan en rojo (`mc-dropdown-item--danger`).

---

## 11. CHECKLIST DE CODE REVIEW

- [ ] ¿Solo `--mc-*`? ¿Cero hex sueltos en componentes nuevos?
- [ ] ¿Sin imports de `--ds-*` ni de `design-tokens.css`?
- [ ] ¿Badges de estado usan `mc-badge ${TAREA_BADGE[estado]}`?
- [ ] ¿Sin imports de `StatusBadge` ni clases `ds-status-badge-*`?
- [ ] ¿Colores de tarjeta usan `STATE_TOKENS[estado]`?
- [ ] ¿Máximo 1 botón `primary` por modal/sección?
- [ ] ¿Botones `danger` separados por `border-t`?
- [ ] ¿Modales con formulario tienen `hasUnsavedChanges` + `bodyClassName="mc-modal-form"`?
- [ ] ¿Inputs con wrapper `.mc-field` y `.mc-field-label`?
- [ ] ¿Iconos de Lucide con `currentColor`?
- [ ] ¿Espaciado con `--mc-space-*` o múltiplos de 4px?
- [ ] ¿Estados de tarea usan `<TareaEstadoIndicator>` (no solo color)?
- [ ] ¿Notificaciones realtime llaman `announcePolitely()` además del toast?
- [ ] ¿Modales destructivos tienen `description` o `descriptionElementId`?
- [ ] ¿Modales de creación/flujo crítico tienen `analyticsId` y `markModalCompleted()`?
- [ ] ¿Estilos visuales de tarjeta de tarea usan `getEstadoStyles(est, urgencia)` en lugar
      de combinar `STATE_TOKENS` + `URGENCIA_TOKENS` manualmente?
- [ ] ¿El color de marca respeta la regla teal=acción / violeta=identidad? (ver §1.4)
- [ ] ¿Menús de acciones (⋯) usan `<PopoverMenu>` y no un dropdown manual con estado propio?
- [ ] ¿Responsive NUEVO usa Tailwind (`md:`/`lg:`) y no un `@media` manual nuevo?
      (Excepción: media queries con `calc()` sobre tokens `--mc-*`.) Ver §8b.