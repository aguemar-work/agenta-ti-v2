# SGTD v1.2 — DESIGN SYSTEM "META CANVAS"

## 1. Propósito y Filosofía

Meta Canvas es el sistema visual de SGTD. Su único objetivo es desaparecer para que los datos manden.

**Principios innegociables:**
- **Silencioso:** La UI no compite. Un solo acento, cero decoración.
- **Denso por defecto:** Listas antes que cards. Borde antes que sombra. Información antes que aire.
- **Predecible:** 1 forma de hacer cada cosa. Sin variantes creativas.
- **Funcional:** Cada pixel justifica su existencia. Si lo quitas y nada se rompe, sobraba.

**Anti-principios:** No es expresivo, no es memorable, no es "bonito". Es una herramienta. Como Excel, no como Instagram.

---

## 2. Tokens — `src/styles/tokens.css`

Todos los valores viven en `:root`. **Prohibido hardcodear.**

```css
:root {
  /* === COLOR === */
  --mc-color-bg: #F5F6F7;
  --mc-color-surface: #FFFFFF;
  --mc-color-surface-hover: #F2F4F7;

  --mc-color-border: #E4E6EB;
  --mc-color-border-strong: #CED2D9;

  --mc-color-text: #050505;
  --mc-color-text-secondary: #65676B;
  --mc-color-text-placeholder: #8D949E;

  --mc-color-accent: #0064E0;
  --mc-color-accent-hover: #0057C2;
  --mc-color-accent-soft: rgba(0, 100, 224, 0.08);

  /* Semánticos — solo para badges y alertas */
  --mc-color-success: #31A24C;
  --mc-color-warning: #F7B928;
  --mc-color-danger: #FA3E3E;
  --mc-color-neutral: #65676B;

  /* === RADIUS — únicos permitidos === */
  --mc-radius-sm: 6px;   /* badges, checkbox */
  --mc-radius-md: 8px;   /* botones, inputs */
  --mc-radius-lg: 12px;  /* cards, modales */

  /* === SOMBRAS — prohibidas salvo overlay === */
  --mc-shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --mc-shadow-md: 0 2px 8px 0 rgba(0, 0, 0, 0.08); /* solo dropdowns/modales */

  /* === ESPACIADO — múltiplos de 4px === */
  --mc-space-1: 4px;
  --mc-space-2: 8px;
  --mc-space-3: 12px;
  --mc-space-4: 16px;
  --mc-space-5: 20px;
  --mc-space-6: 24px;
  --mc-space-8: 32px;

  /* === TIPOGRAFÍA === */
  --mc-font-sans: 'Inter', -apple-system, sans-serif;
  --mc-text-xs: 12px;   /* meta, caption, timestamps */
  --mc-text-sm: 14px;   /* base, body, botones, inputs */
  --mc-text-md: 16px;   /* h3, títulos de card */
  --mc-text-lg: 20px;   /* h2, títulos de sección */
  --mc-text-xl: 24px;   /* h1 */

  /* === LAYOUT SHELL === */
  --mc-sidebar-w-expanded: 240px;
  --mc-sidebar-w-mini: 64px;
  --mc-topbar-h: 56px;

  /* === MOTION === */
  --mc-transition: 150ms cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Regla de espaciado:** Los contenedores definen `padding` y `gap`. Los hijos no usan `margin`.

---

## 3. Layout Base

### Shell de aplicación (`AppShell`)

| Elemento | Especificación |
|----------|---------------|
| TopAppBar | `height: var(--mc-topbar-h)` (56px), `bg: var(--mc-color-surface)`, `border-bottom: 1px solid var(--mc-color-border)`, sin sombra. Estructura: `[Menú móvil] [Título semibold] [Acciones]` |
| AppSidebar | **Dos estados:** expandido `width: var(--mc-sidebar-w-expanded)` (240px), mini `width: var(--mc-sidebar-w-mini)` (64px). Transición `width` con `var(--mc-transition)`. `bg: white`, `border-right: 1px solid #E4E6EB`. En **mini**: solo iconos; etiqueta oculta (accesible); **tooltip** = atributo `title` en cada enlace. Toggle colapsar solo **desktop** (`≥901px`). Persistencia: `localStorage` clave `sgtd_sidebar_collapsed` (`1` = mini). |
| `nav` sidebar | Items `min-height: 40px`, `radius: var(--mc-radius-md)`, hover `var(--mc-color-surface-hover)`. Activo: `bg: var(--mc-color-accent-soft)`, `color: var(--mc-color-accent)`. |
| **Main** | `flex: 1`, `min-width: 0`, `min-height: 0`; área scrollable: **`.mc-main`** con `overflow-y: auto`, `padding: var(--mc-space-6)`, **sin** `max-width` forzado (layout líquido al ancho restante). |
| Ancho móvil (`≤900px`) | Sidebar = drawer overlay `rgba(0,0,0,0.2)`; ancho drawer 240px; mini **no** aplica (siempre ancho completo al abrir). |

### Jerarquía de contenedores

- **Página:** Sin contenedor. El fondo `#F5F6F7` es el lienzo.
- **Sección:** `h2 20px semibold` + `border-bottom` o `.mc-card` si necesita agrupación visual.
- **Card:** `.mc-card` = `bg: white`, `border: 1px solid #E4E6EB`, `radius: 12px`, `padding: 20px`.
- **Lista:** Sin contenedor. Items con `border-bottom: 1px solid #E4E6EB`.
- **Prohibido:** Más de 1 nivel de `.mc-card` anidado.

---

## 4. Componentes Base — `src/index.css` (clases `.mc-*`)

### Button

| Variante | Uso | Clases |
|----------|-----|--------|
| Primario | 1 máximo por vista. Acción principal. | `.mc-btn`: `bg: #0064E0`, `color: white`, `radius: 8px`, `px: 20px`, `py: 12px`, `font: 14px medium` |
| Secundario | Acciones alternativas, filtros activos. | `.mc-btn-secondary`: `bg: white`, `border: 1px solid #CED2D9`, `color: #050505` |
| Ghost | Navegación, iconos, cancelar. | `.mc-btn-ghost`: `bg: transparent`, `hover: #F2F4F7` |

`hover`: cambio de bg. `active`: `scale: 0.98`. `disabled`: `opacity: 0.5`, `cursor: not-allowed`.

### Input

```css
.mc-input {
  background: white;
  border: 1px solid var(--mc-color-border-strong);
  border-radius: var(--mc-radius-md);
  padding: 12px 16px;
  font-size: 14px;
}
.mc-input:focus {
  border-color: var(--mc-color-accent);
  box-shadow: 0 0 0 2px var(--mc-color-accent-soft);
  outline: none;
}
```

`label`: `12px`, `color: #65676B`, `font-weight: 500`, encima del input.

### Badge — Estados

Siempre `.mc-badge` + modificador. **Prohibido usar solo color de texto o ícono.**

| Estado DB | Clase | Visual |
|-----------|-------|--------|
| `pendiente` | `.mc-badge-neutral` | `bg: rgba(101,103,107,0.1)`, `color: #65676B` |
| `en_progreso` | `.mc-badge-accent` | `bg: rgba(0,100,224,0.08)`, `color: #0064E0` |
| `completada` | `.mc-badge-success` | `bg: rgba(49,162,76,0.1)`, `color: #31A24C` |
| `bloqueada` | `.mc-badge-warning` | `bg: rgba(247,185,40,0.1)`, `color: #F7B928` |
| `atrasada` | `.mc-badge-danger` | `bg: rgba(250,62,62,0.1)`, `color: #FA3E3E` |
| `cancelada` | `.mc-badge-neutral` | `bg: rgba(101,103,107,0.1)`, `color: #65676B` |

**Prioridad:** No es badge. Es ícono `Flag 16px` + color (`danger`/`warning`/`neutral`) junto al título.
**Tipo:** `planificada`, `no_planificada`, `libre` → Badge neutral con texto.

### TaskItem — Componente crítico

**Estructura obligatoria e inmutable:**

```
[Checkbox 16px] [Contenido flex-1] [Menú ⋯ 20px]
```

```css
.mc-task-item {
  display: flex;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--mc-color-border);
  align-items: flex-start;
}
.mc-task-item:hover {
  background: var(--mc-color-surface-hover);
}
```

**Contenido:**
- Línea 1: Título `14px medium #050505` + Flag prioridad `16px` si alta/media.
- Línea 2: Meta `12px #65676B` → `[Badge estado] [Asignado] [Objetivo] [Fecha] [🔒 si solo lectura]`.

**Estados visuales:**

| Estado | Visual |
|--------|--------|
| Normal | Como arriba |
| Completada | `opacity: 0.6`, título `line-through` |
| Atrasada | `border-left: 2px solid #FA3E3E` |
| Solo lectura | Ícono `Lock 16px #65676B` + `cursor: not-allowed` |

### Modal

```css
.mc-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.2); z-index: 50; }
.mc-modal   { /* .mc-card */ max-width: 512px; animation: fade-in 150ms ease; }
```

- **Header:** `h2 16px semibold` + `X 20px .mc-btn-ghost` derecha.
- **Footer:** `flex justify-end gap: 8px`. Cancelar `.mc-btn-ghost`, Confirmar `.mc-btn`.
- **Prohibido:** `backdrop-blur`, `shadow-2xl`, `radius > 12px`, `zoom-in`.

---

## 5. Tipografía e Íconos

- **Fuente:** Inter únicamente. Pesos: 400 regular, 500 medium, 600 semibold. No usar 700+.
- **Tamaños:** 12px meta · 14px base · 16px h3 · 20px h2 · 24px h1.
- **Íconos:** Solo Lucide. `16px` inline, `20px` standalone. Trazo `1.5px`. Color hereda texto o `text-secondary`.

---

## 6. Patrones por Módulo

### HOY
- **Layout:** **3 columnas densas** (`.mc-hoy-grid`): col 1 **Programadas y eventos** (subsecciones: Atrasadas, Hoy, Eventos); col 2 **Imprevistos** del día + CTA registrar; col 3 **Bitácora** (formulario rápido visibilidad + lista reciente). En viewport estrecho: una columna (`≤1100px`).
- **Tareas:** `.mc-task-item` por fila; atrasadas con `border-left: 2px solid danger`.
- **Vacío:** texto `14px muted` + `.mc-btn-secondary` donde aplique; sin ilustraciones decorativas.

### MI SEMANA
- **Layout:** Grid **7 columnas** (días) + **backlog** lateral (desktop) / apilado (móvil).
- **Día:** `border: 1px solid #E4E6EB`, `radius: var(--mc-radius-md)`, `min-height: 200px`, `padding: var(--mc-space-3)`. Cabecera fila: fecha + botón **inserción rápida** (`+`); debajo formulario título + Añadir/Cancelar si el día está en modo inserción.
- **Tarea en celda:** `.mc-task-item` variante **compacta** (`padding: 8px`), `GripVertical` en fila arrastrable (`.mc-semana-drag`).
- **Backlog:** `.mc-card` + lista compacta.
- **Drop zone:** `var(--mc-color-accent-soft)` + borde discontinuo acento.

### PLANIFICACIÓN (Jefe, solo lectura)
- **Layout:** Tabla densa. `thead sticky bg: white`, `border-bottom: 2px solid #E4E6EB`.
- **Celda:** `padding: 8px`, `border: 1px solid #E4E6EB`, `font: 12px`. Contenido: badge con count.
- **Color celda:** `bg: danger/0.05` si >8 tareas, `warning/0.05` si >5. No pintar toda la fila.
- **Click:** Abre `.mc-modal` solo lectura con lista de tareas.

### TABLERO
- **Layout:** 5 columnas (estados DB) `.mc-kanban-col` con `padding: var(--mc-space-4)`. Cabecera: título `16px semibold` + contador `.mc-badge-neutral`.
- **Item:** **`.mc-task-item`** variante **kanban** (`border: 1px solid #E4E6EB`, `radius: var(--mc-radius-md)`, compacta); **sin** `margin` entre tarjetas: `gap` en `.mc-kanban-col-body`.
- **Arrastre:** fila `.mc-kanban-drag` con handle + `TaskRow` `tag="div"`.
- **Solo lectura:** `opacity: 0.7`, candado `16px`, `cursor: not-allowed`, sin handle de drag.
- **Drop zone:** resaltado acento + borde discontinuo (clase `.mc-drop-over`).

### OBJETIVOS
- **Card:** `.mc-card`. Header: Título `16px semibold` + `.mc-badge` estado + Menú `⋯`.
- **Progreso:** `div h: 8px`, `bg: #E4E6EB`, `radius: 9999px`. Fill `bg: #0064E0`, `width: %`.
- **Tareas:** Lista `.mc-task-item` dentro de card.
- **Footer:** `+ Añadir tarea .mc-btn-ghost text: 14px`.

### BITÁCORA
- **Item:** `div` con `padding: 16px`, `border-bottom`.
- **Header:** Usuario `14px medium` + Fecha `12px muted` + `.mc-badge` visibilidad.
- **Contenido:** `14px`, `line-height: 1.6`.
- **Filtros:** Pills `.mc-btn-ghost`, activo `.mc-btn-secondary`.

### MÉTRICAS
- **KPI:** `.mc-card padding: 16px`. Valor `24px semibold` + Label `12px muted` + Tendencia `↑ 12px success/danger`.
- **Gráfico:** Líneas/barras `stroke: #0064E0`, `grid: #E4E6EB`, `text: 12px #65676B`. Sin leyendas decorativas.
- **Tabla:** `thead bg: #F5F6F7`, `border-bottom: 1px solid #E4E6EB`, `th: 12px medium uppercase`, `td: 14px`, `padding: 12px`.

### LOG DE ACCIONES (Jefe)
- **Item:** `.mc-task-item`.
- **Meta:** Usuario `14px medium` + Acción `14px` + Fecha `12px muted`.
- **Cambio:** Antes `12px muted line-through` → Después `12px medium`.
- **Justificación:** `div bg: #F5F6F7`, `border-left: 2px solid #65676B`, `padding: 12px`, `14px italic`.
- **No leído:** `border-left: 2px solid #0064E0`.

---

## 7. Estados y Feedback

| Estado | Patrón |
|--------|--------|
| Loading | Skeleton: `div bg: #F5F6F7`, `radius: 8px`, `animate-pulse`. Altura igual al contenido real. |
| Vacío | `div` centrado `padding: 32px`, ícono `Inbox 48px #CED2D9`, `h3 16px medium`, `p 14px muted`, `.mc-btn-secondary` acción. |
| Error | `.mc-card border: 1px solid #FA3E3E`, ícono `AlertCircle 20px danger`, `h3 16px semibold`, `p 14px`, `.mc-btn-secondary Reintentar`. |
| Success toast | Sonner: `bg: white`, `border: 1px solid #E4E6EB`, `radius: 8px`, ícono `Check 16px success`, `text: 14px`. |
| Confirmación destructiva | `.mc-modal` + `h2 16px semibold` + `p 14px` + Cancelar `.mc-btn-ghost` + Eliminar `.mc-btn bg: danger`. |

---

## 8. Checklist obligatorio pre-merge

Antes de crear cualquier UI, validar:

- [ ] ¿Es `.mc-card` o `.mc-task-item`? Si necesitas elevación, replantea.
- [ ] ¿Hay más de 1 `.mc-btn` primario en la vista? → Cambia a ghost/secondary.
- [ ] ¿Algún `border-radius` ≠ 6/8/12px? → Corrige.
- [ ] ¿Algún `margin` en hijo cuando el padre tiene `gap`? → Elimina.
- [ ] ¿Todo estado usa `.mc-badge`? → Añade.
- [ ] ¿Íconos son Lucide 16/20px? → Reemplaza.
- [ ] ¿Loading usa skeleton? → Implementa.
- [ ] ¿Vacío usa ilustración? → Elimina.
- [ ] ¿Hay `shadow` fuera de modal/dropdown? → Borra.
- [ ] ¿Color fuera de tokens? → Mapea a token.

---

## 9. Anti-patrones — Prohibido

- **Hardcodear:** `style="margin: 15px"` o `bg-[#FF5733]`
- **Inventar tokens:** `--mc-radius-15`, `--mc-color-purple`
- **Degradados:** `bg-gradient-to-r`
- **Sombras decorativas:** `shadow-lg` en cards
- **Múltiples primarios:** 2 botones azules en misma vista
- **Islands:** Contenedores flotantes con shadow fuerte
- **Estados nuevos:** Si no está en DB, no existe en UI
- **Permisos por UI:** Ocultar con `hidden` sin validar RBAC en backend/RLS
- **Íconos como badge:** `Check 16px success` solo no reemplaza `.mc-badge-success`
- **Densidad variable:** No hay "modo compacto". Un solo spacing.

---

## 10. Fuentes de verdad

| Capa | Fuente | La UI no puede |
|------|--------|----------------|
| **Estados** | `CONTEXT.md` (bloque SQL) + `.cursor/rules/sgtd-business-rules.mdc` | Crear estados o valores que no existan en DB |
| **Permisos** | `CONTEXT.md` (tabla RBAC) + `.cursor/rules/sgtd-rbac.mdc` | Inferir permisos solo por UI; ocultar acciones sin RLS en backend |
| **Auth/Sesión** | `.cursor/rules/sgtd-auth-session.mdc` + `web/src/lib/insforgeClient.ts` + `web/src/lib/insforgeFetchInterceptor.ts` | Mostrar "Invalid Token"; usar `localStorage` como fuente de verdad del `rol`; omitir `refreshSession` ante 401 en PostgREST |
| **Visual / layout** | Este documento + `web/src/styles/tokens.css` + `web/src/index.css` | Tokens fuera de `:root`; sombras fuera de modal; `margin` en hijos con padre que ya usa `gap` |
| **Lógica** | `CONTEXT.md` (reglas de negocio) + `.cursor/rules/sgtd-business-rules.mdc` | Sustituir reglas de servidor (atrasada automática, log con justificación) |
| **Datos** | Schema en `CONTEXT.md` | Alterar columnas ni asumir campos no acordados |

**Regla final:** Si un componente no cumple este documento: está mal, aunque "se vea bien". Se rechaza en code review.

---

## 11. Setup inicial para devs

```bash
npm i lucide-react sonner @dnd-kit/core @dnd-kit/sortable @tanstack/react-query @insforge/sdk
```

Fuente Inter: via `next/font` o CDN en `index.html`.

**Archivos de referencia en este repo (`web/`):**
1. `src/styles/tokens.css` — variables `:root` (sección 2).
2. `src/index.css` — clases `.mc-*`, layout shell, patrones por vista.
3. `src/lib/insforgeClient.ts` — `createClient` + `installInsforgeDatabaseFetchInterceptor` (401 PostgREST → `refreshSession` + reintento).
4. `src/auth/AuthContext.tsx` — sesión InsForge + perfil `public.usuario`.

**Orden de vistas:** Login → HOY → MI SEMANA → TABLERO → OBJETIVOS → BITÁCORA → MÉTRICAS → LOG

Este documento es la spec. Cualquier duda: se actualiza aquí primero, luego el código.