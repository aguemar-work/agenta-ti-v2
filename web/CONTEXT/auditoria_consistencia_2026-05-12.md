# Auditoría de consistencia — Nexora (SGTD v1.2)

**Fecha:** 2026-05-12
**Base:** revisión de código real (no capturas) sobre el estado actual del repo.
**Alcance:** páginas `MiSemana`, `Planificacion`, `Objetivos`, `OrdenesTrabajo`, `Metricas` y el design system Meta Canvas (`tokens.css`, `components.css`, `shell.css`, `layout.css`, `forms.css`).

> **Nota metodológica.** El usuario describió que iba a compartir capturas de la app, pero ninguna llegó adjunta a este turno. Para no devolver una auditoría genérica, la revisión se hizo leyendo cada página y comparando contra los componentes/clases del DS. Cada hallazgo cita archivo y línea exactos.

---

## REGLAS DEL SISTEMA (lo que SÍ se cumple hoy)

| # | Patrón | Cómo se aplica | Componente / clase canónica |
|---|---|---|---|
| R1 | Contenedor raíz de página | `<div className={APP_PAGE_CLASS}>` envuelve todo `<Outlet/>` | `lib/appLayout.ts` (`mc-module flex w-full flex-1 min-h-0 flex-col gap-6`) |
| R2 | Header de página | `<PageHeader title subtitle left actions />` | `components/layout/PageHeader.tsx` + clases `mc-page-*` |
| R3 | Acción primaria a la derecha | Slot `actions` del `PageHeader` con `<Button variant="primary">` | `Button` |
| R4 | Filtros bajo header, antes del contenido | `<FilterBar>` con sub-componentes `.Pills` / `.Select` / `.Date` / `.Action` | `components/ui/FilterBar.tsx` |
| R5 | Tarjeta base | `mc-card` (relleno y borde tokenizados) | `components.css` |
| R6 | Modal | `<Modal>` portalado, scroll lock, focus trap, confirmación de descartes | `components/ui/Modal.tsx` (clases `mc-modal-*`) |
| R7 | Botón cancelar de modal | `<CancelButton>` debajo del primary o `variant="ghost"` en fila | `components/ui/Button.tsx` |
| R8 | Confirmaciones destructivas con justificación | `<JustificacionField>` con mínimo de caracteres y validación visible | `components/ui/JustificacionField.tsx` |
| R9 | Estados de tarea (color/badge/label) | `TAREA_BADGE`, `TAREA_PILL`, `TAREA_LABEL` + tokens `--mc-state-*` | `lib/estadoConfig.ts` |
| R10 | Boundary por sección | `<SectionErrorBoundary label="…">` | `components/ui/SectionErrorBoundary.tsx` |
| R11 | Auth | Página + card + tokens `mc-auth-*` (Login, Forgot, Verify, Reset, InsforgeConfigMissing) | `components.css` |
| R12 | Iconografía | `lucide-react` con `aria-hidden` | — |
| R13 | RBAC | Acciones de jefe ocultas (`esJefe && …`) y reforzadas con RLS | hooks/store + DB |
| R14 | Telemetría de error | `AppErrorBoundary` → `Sentry.captureException` si hay DSN | `main.tsx` |
| R15 | Cabecera de tabla | Texto 10–11 px, `uppercase`, `letter-spacing .06em`, color secundario | aplica en 3 de 4 tablas (ver V-04) |

Estas 15 reglas son la **línea base**: cualquier módulo nuevo debe respetarlas sin negociar.

---

## PARTE 1 — AUDITORÍA DE CONSISTENCIA

### V-01 — `[Mi Semana]` Botón “+ Nueva tarea” no es la acción primaria de la página

- **Patrón esperado:** la acción que abre el creador principal del módulo debe ser **`Button variant="primary"`** y única en la vista (R3).
- **Lo que ocurre:** `src/pages/MiSemana.tsx:246` declara `<Button variant="secondary" size="sm">+ Nueva tarea</Button>` mientras Objetivos (`Objetivos.tsx:101`) y Órdenes de Trabajo (`OrdenesTrabajo.tsx:166`) usan `variant="primary"` para la misma intención.
- **Impacto:** **ALTO**. La página estrella del miembro pierde foco — el usuario no encuentra el CTA de crear; en contraste, Objetivos y OT lo gritan.
- **Fix:** cambiar a `variant="primary"`. Confirmar que dentro de cada columna del día sigue habiendo el botón “ghost” `+ Tarea / evento` (línea 318) — ese sí es secundario por columna y debe quedarse en `variant="ghost"`.

### V-02 — `[Mi Semana / Planificación]` Color amarillo usado para “Incidencias” (registro), no para advertencia

- **Patrón esperado:** `--mc-color-warning` (#f7b928) sólo para urgencia/atraso/cambios pendientes de revisión.
- **Lo que ocurre:**
  - `MiSemana.tsx:104-116` la zona “Incidencias” usa borde discontinuo y label amarillo (`text-[var(--mc-color-warning)]`).
  - `MiSemana.tsx:126` cada tarjeta de incidencia tiene `border-[var(--mc-color-warning)]` y `bg color-mix(...,var(--mc-color-warning) 8%)`.
  - `Planificacion.tsx:315`, `362`, `537` reutilizan `--mc-color-warning` para “Incidencias esta semana” e historial de logs sin leer.
- Una **incidencia ya resuelta del día** (`es_imprevisto = true` + `estado='completada'` en `business-rules.mdc`) es un **registro neutral**, no una alerta.
- **Impacto:** **ALTO**. Roza una violación semántica del DS y eleva visualmente algo que en métricas se cuenta sin estigma.
- **Fix:**
  1. Reservar amarillo para “tareas urgentes/precaución horaria/atrasadas” y “justificaciones sin leer”.
  2. Para “Incidencia” introducir token nuevo **`--mc-state-incidencia-*`** apuntando a `--mc-color-info` (cyan #0288d1 ya existe en `tokens.css`). Aplicarlo en MiSemana y en el contador de Planificación. Mantener el icono `AlertTriangle` sólo donde realmente sea una alerta sin atender; usar `Sparkles`/`Info` para incidencias.

### V-03 — `[Métricas / Objetivos / Planificación]` Colores hex hardcodeados en lugar de tokens

- **Patrón esperado:** la regla `sgtd-business-rules.mdc` y `tokens.css` definen una fuente única de color para cada estado de tarea (`--mc-state-completada-fg`, `--mc-state-atrasada-bg`, etc.).
- **Lo que ocurre:** hex sueltos en 3 páginas:
  - `Metricas.tsx:14-21` paleta entera (`#27500A`, `#E24B4A`, `#EF9F27`, `#7F77DD`, `#185FA5`, `#B4B2A9`).
  - `Metricas.tsx:46-55` colores y fondos del semáforo de cumplimiento (`#27500A`, `#854F0B`, `#A32D2D`, `#EAF3DE`, `#FAEEDA`, `#FCEBEB`).
  - `Metricas.tsx:230-234, 352-364` se filtran a las KPI cards y a la tabla comparativa.
  - `Objetivos.tsx:23` paleta de barra de progreso (`#F7C1C1`, `#FAC775`, `#C0DD97`).
  - `Objetivos.tsx:147, 235-239` filas de tareas atrasadas con `#FCEBEB`, `#791F1F`, `#F7C1C1`.
  - `Objetivos.tsx:161` color de fecha límite vencida `#A32D2D`.
  - `Planificacion.tsx:26-28, 95-99` celdas de carga con `#EAF3DE`, `#FCEBEB`.
- **Impacto:** **ALTO** para mantenibilidad. Cualquier cambio del DS en colores de estado no se propaga.
- **Fix:** crear/usar los tokens ya disponibles:
  - `--mc-state-completada-bg/fg/border` ya existen.
  - `--mc-state-atrasada-bg/fg/border/meta` ya existen.
  - `--mc-state-progreso-fg`, `--mc-state-reprogramada-fg`, etc.
  - Para los matices más claros que aún no hay (p. ej. amarillo claro `#FAEEDA`, verde claro `#EAF3DE`), añadir en `tokens.css`:
    ```css
    --mc-state-completada-bg-soft: #EAF3DE;
    --mc-state-atrasada-bg-soft:   #FCEBEB;
    --mc-state-precaucion-bg-soft: #FAEEDA;
    ```
  Luego sustituir todos los hex de las tres páginas por estos tokens.

### V-04 — `[Tablas]` Tres maneras distintas de pintar la misma cabecera

- **Patrón esperado:** una única cabecera de tabla coherente — texto 10–11 px, `uppercase`, `tracking .06em`, color secundario, fondo `--mc-color-bg`, padding consistente.
- **Lo que ocurre:**
  - `OrdenesTrabajo.tsx:195-208` cabecera con **estilos inline** y `gridTemplateColumns: '110px 1fr 110px 160px'`.
  - `Objetivos.tsx:111-114` cabecera con **estilos inline** y `gridTemplateColumns: '1fr 80px 180px 90px 32px'`.
  - `Planificacion.tsx:210-220` cabecera con **clases Tailwind** dentro de `<table>` (`p-2 text-[10px] font-medium uppercase tracking-wide`).
  - `Metricas.tsx:320-335` cabecera con **estilos inline** dentro de `<table>` (`padding: '6px 8px'`, etc.).
- **Impacto:** **MEDIO**. La apariencia es parecida hoy, pero hay 4 fuentes de verdad. Cambiar paddings o el tracking afecta solo a una.
- **Fix:** mover la regla a CSS. Ya existe `.mc-table thead th` en `components.css:60-71`. Reescribir las 4 cabeceras así:
  - Para tablas reales (`<table>`): usar `<table className="mc-table">` directamente — ya define `thead th` con tipografía y borde correctos.
  - Para “listas-grid” (OT y Objetivos usan `display: grid`), crear **`.mc-list-header`** + **`.mc-list-header-cell`** en `components.css` con los mismos valores (10 px, 600, uppercase, tracking .06em, color secundario, fondo `--mc-color-bg`, padding `6px 16px`). Aplicarlo en ambos archivos.

### V-05 — `[Empty states]` Inconsistencia entre versiones

- **Patrón esperado:** ícono grande + título + descripción + (opcional) CTA — ya soportado por `.mc-empty`, `.mc-empty-title`, `.mc-empty-desc` en `components.css`.
- **Lo que ocurre:**
  - **Completo (icono + title + desc):** sólo `OrdenesTrabajo.tsx:213-217`.
  - **Sólo title:** `Planificacion.tsx:299, 372, 438, 517, 600`, `Objetivos.tsx:226`, `Objetivos.tsx:187-189` (este último sí tiene desc, pero sin icono).
  - **Title + desc:** `Objetivos.tsx:120-123` y `Objetivos.tsx:187-189`.
  - **Texto suelto (sin componente):** `MiSemana.tsx:118-120` “Sin incidencias hoy”, panel de Notas (`MiSemana.tsx:155-163`) que cuando `notas` viene vacío directamente no renderiza nada.
- **Impacto:** **MEDIO**. La sensación es distinta según el módulo; en Planificación hay 5 empty states distintos.
- **Fix:**
  1. Añadir prop `icon` a un componente `<EmptyState icon? title desc? cta?>` que renderice `mc-empty` con un `Lucide` opcional.
  2. Estandarizar:
     - **Sin datos del usuario** → icono + título + desc.
     - **Sin resultados de filtro** → icono Search + título + “Prueba con otros filtros” + CTA `Limpiar filtros`.
     - **Sub-zonas dentro de un panel ya compacto** (incidencias del día, notas) → variante `compact` solo título.
  3. Reemplazar los 8 sitios marcados arriba.

### V-06 — `[KPIs]` Tres implementaciones distintas

- **Patrón esperado:** `mc-kpi-grid` + `mc-kpi-card` + `mc-kpi-value` + `mc-kpi-label` (ya definidos en `components.css:26-51`).
- **Lo que ocurre:**
  - `MiSemana.tsx:269-276` usa `mc-card !p-0` con clases Tailwind para tipografía. No usa `mc-kpi-*`.
  - `Planificacion.tsx:59-91` define un componente local `ResumenKpi` con **estilos 100% inline** y semántica de colores propios.
  - `Metricas.tsx:81-112` define otro componente local `KpiCard` también con **estilos inline** y dos tamaños distintos.
- **Impacto:** **MEDIO**. Cada vista del jefe muestra KPIs con números, padding y radios distintos.
- **Fix:**
  - Promover `ResumenKpi` (Planificación) a `components/ui/KpiCard.tsx` parametrizado: `value`, `label`, `variant: 'neutral' | 'warning' | 'danger' | 'success'`, `icon?`, `size?`. Documentar tres tamaños: `sm` (Mi Semana), `md` (Planificación, OT), `lg` (Métricas hero).
  - Sustituir las 3 implementaciones por este componente.

### V-07 — `[Subtítulos de página]` Mezcla de descripción vs. contexto temporal

- **Patrón esperado:** un subtítulo claro: si la vista depende de tiempo, el rango temporal; si no, una descripción operativa corta.
- **Lo que ocurre:**
  - `MiSemana`: `“{fecha lunes} — {fecha sábado}”` — sólo rango.
  - `Planificacion`: `“Semana 21 · 20/05 — 26/05”` — semana + rango (más informativo).
  - `OrdenesTrabajo` (jefe): `“{n} pendientes · {n} urgentes · {n} vencidas”` o `“Gestión de órdenes”`.
  - `Objetivos`: `“{n} objetivo(s) en estado crítico”` o `“Gestión estratégica”`.
  - `Metricas`: `“{n} miembro(s) con cumplimiento bajo”` o `“Indicadores de rendimiento”`.
- **Impacto:** **BAJO** individualmente; **MEDIO** combinado. El usuario nota que algunas páginas le dan alertas accionables en el subtítulo (OT, Objetivos, Métricas) y otras solo informan (MiSemana, Planificación).
- **Fix:** convertir el subtítulo en una regla activa:
  - Si la vista es temporal, mostrar `Semana NN · rango`.
  - Encima, anteponer una alerta cuando exista (ej. MiSemana podría mostrar “2 tareas atrasadas · Semana 21 · 20/05 — 26/05”).
  - Tipográficamente todos comparten `.mc-page-subtitle`; el cambio es de redacción, no de estilo.

### V-08 — `[OrdenesTrabajo]` Label del primary rompe el formato

- **Patrón esperado:** botones primarios de creación llevan signo `+` antes del nombre del recurso (Mi Semana “+ Nueva tarea”, Objetivos “+ Nuevo objetivo”).
- **Lo que ocurre:** `OrdenesTrabajo.tsx:166-170` usa `<Plus icon /> Nueva OT` con icono Lucide. Visualmente compite con el resto por ser el único con icono.
- **Impacto:** **BAJO**. Pero rompe el patrón de Mi Semana / Objetivos.
- **Fix:** dos caminos válidos, pero hay que escoger uno y reaplicar en los 3 botones:
  1. (Recomendado) Sin icono, formato `+ Nueva OT` consistente con los demás. Quitar `<Plus />`.
  2. O bien añadir `<Plus size={14} />` también a `+ Nueva tarea` y `+ Nuevo objetivo`. Opción más visual pero requiere editar Mi Semana y Objetivos.

### V-09 — `[Métricas]` Las KPI cards mezclan énfasis de color

- **Patrón esperado:** si una métrica destaca, el énfasis se aplica con la misma regla en todas; no usar fondo de color en unas y solo color de texto en otras.
- **Lo que ocurre:** `Metricas.tsx:230-234`:
  - “Completadas” siempre con fondo verde (`bg="#EAF3DE"`).
  - “Atrasadas” fondo rojo **solo si hay** atrasadas.
  - “Bloqueadas” fondo ámbar **solo si hay**.
  - “En progreso”, “Reprogramadas” y “Total tareas” siempre sin fondo.
- **Impacto:** **MEDIO**. El usuario percibe “Completadas” como permanentemente positivo aunque sean 0; mientras “En progreso” se ve apagada aun cuando sea alta.
- **Fix:** unificar la regla:
  - **Énfasis condicional para todos los estados:** fondo coloreado solo cuando `valor > 0`.
  - **O bien** fondo coloreado siempre para todos los estados positivos/negativos; sin fondo para neutrales (`Total`, `En progreso`).
  - Aplicar la regla por igual a las 7 cards.

### V-10 — `[Objetivos]` Estilos inline masivos en filas y panel

- **Patrón esperado:** clases CSS o tokens; no `style={{...}}` con HEX para el estado “atrasada”.
- **Lo que ocurre:** `Objetivos.tsx:131-180` cada fila se pinta con `style={{ background: …, gridTemplateColumns: …, transition: …, … }}`; en `:235-239` el fondo de tarea atrasada es `#FCEBEB` (HEX).
- **Impacto:** **MEDIO**. Mezcla de problemas (V-03 + tabla en lugar de grid + lógica de hover en JS con `onMouseEnter`/`Leave`).
- **Fix:**
  1. Convertir la fila a una clase `.mc-list-row` con variantes `--selected`, `--critico`, `--atrasada` (estas dos últimas vienen de combinar booleanos).
  2. Hover por CSS, no por handlers JS.
  3. Sustituir HEX por tokens (`--mc-state-atrasada-bg-soft`, etc., ver V-03).

### V-11 — `[Iconografía]` Icono `···` literal vs `MoreHorizontal`

- **Patrón esperado:** todos los menús contextuales con icono Lucide (`MoreHorizontal` / `MoreVertical`) para mantener tamaño y alineación.
- **Lo que ocurre:** `Objetivos.tsx:177` usa el carácter `'···'` dentro del Button. Es el único sitio del repo con ese pattern (verificado contra `MoreHorizontal` y `MoreVertical`: 0 resultados).
- **Impacto:** **BAJO**.
- **Fix:** importar `MoreHorizontal` de `lucide-react` y reemplazar el string por `<MoreHorizontal size={16} aria-hidden />`. Quitar también el `!p-1` para que herede tamaño del DS.

### V-12 — `[Planificación]` `mc-section-header` con overrides destructivos

- **Patrón esperado:** `mc-section-header` es un componente con borde, fondo y padding propios; si una sección lo necesita liviano, se hace una variante en CSS, no `!important`.
- **Lo que ocurre:** `Objetivos.tsx:219` y `:250` usan `className="mc-section-header !border-none !bg-transparent !p-0"`. Tres `!important` solo para anular el header dentro de un panel.
- **Impacto:** **BAJO**, pero conceptualmente igual al problema que ya cerramos en `shell.css` (Fase 2). Misma deuda.
- **Fix:** añadir variante **`.mc-section-header--plain`** en `components.css` (sin borde, sin fondo, sin padding inline pero conservando tipografía/uppercase). Reemplazar los 2 sitios.

---

## PARTE 2 — PROBLEMAS FUNCIONALES

### F-01 — `[Mi Semana]` La grilla de 6 días puede recortar tareas largas

- `MiSemana.tsx:300-307` cada columna del día es `min-h-[220px]` con `flex-1`. En semanas con muchas tareas, las celdas no crecen porque el contenedor padre es `overflow:hidden` (`mc-card !p-0 overflow-hidden`).
- **Impacto:** **MEDIO**. En desktop con 8+ tareas por día se recorta sin scroll visible (el scroll de `SemanaDiaDrop` es por columna, no la grilla entera).
- **Fix:** dejar `overflow:hidden` solo para los bordes del card; asegurar que `SemanaDiaDrop` (`flex min-h-[120px] flex-1`) tiene `overflow-y:auto` cuando supera N px.

### F-02 — `[Planificación]` Tabla con `overflow-x` pero sin sticky de la primera columna

- `Planificacion.tsx:209-285`: scroll horizontal a partir de `min-w-[720px]`. En pantallas medias se desplaza la cabecera y los nombres de miembros sin referencia.
- **Impacto:** **MEDIO**. El jefe necesita el nombre del miembro fijo mientras navega 6 días.
- **Fix:** `position: sticky; left: 0; background: var(--mc-color-surface)` en la primera `<th>` y `<td>` de cada fila.

### F-03 — `[Objetivos]` `maxHeight: 200` para tareas vinculadas

- `Objetivos.tsx:228` lista de tareas vinculadas con `maxHeight: 200, overflowY: auto`. Bien por contención, pero **no hay indicador visual** de scroll y el resto del panel no scrollea.
- **Impacto:** **BAJO**. Funciona pero invisible.
- **Fix:** mostrar “{n} tareas” arriba (ya existe), y añadir gradiente o sombra inferior de “más abajo”, o simplemente expandir cuando hay foco.

### F-04 — `[OrdenesTrabajo]` Botones “Aprobar” / “Imprimir” en la fila pueden multiplicarse en pantallas estrechas

- `OrdenesTrabajo.tsx:301-315` columna “Estado + acciones” es `flexWrap: 'wrap'`. En anchos medios la fila crece a dos líneas y el badge queda separado del botón. Igual ocurre con “Urgente” + acciones.
- **Impacto:** **BAJO/MEDIO**. UX feo cuando el jefe abre la vista en notebook 13".
- **Fix:** en pantallas estrechas mostrar solo el badge y mover las acciones al menú del Modal de detalle (que ya las tiene). Regla: en lista, **una sola acción rápida** según estado (la más probable: “Aprobar” para `pendiente`, nada para el resto). Imprimir vive en el modal.

### F-05 — `[Métricas]` Resumen del jefe sin barra de progreso de comparativa cuando todos están al 100%

- `Metricas.tsx:339-381`: si todos los miembros tienen `cumpl=100%`, las barras se ven idénticas. No hay forma de ver volumen relativo.
- **Impacto:** **BAJO**.
- **Fix:** mostrar volumen total al lado de la barra (ej. “12/12”). Ya hay datos suficientes.

---

## VIOLACIONES PRIORITARIAS — TOP 5

| # | Hallazgo | Impacto |
|---|---|---|
| 1 | **V-01** — Mi Semana “+ Nueva tarea” como `secondary` en lugar de `primary`. | ALTO |
| 2 | **V-03** — Hex hardcodeados de estado en Métricas, Objetivos y Planificación. | ALTO |
| 3 | **V-02** — Amarillo `warning` usado para “Incidencias” (registro neutral). | ALTO |
| 4 | **V-04** + **V-05** — Cabeceras de tabla y empty states con 3+ implementaciones distintas. | MEDIO |
| 5 | **V-06** — Tres componentes locales de KPI; ya existe la clase oficial. | MEDIO |

Si solo se pudieran tocar **dos** archivos: `Metricas.tsx` (resuelve V-03 parcial y V-09) y `MiSemana.tsx` (resuelve V-01, parte de V-02 y V-05).

---

## CHECKLIST PARA NUEVOS MÓDULOS

Antes de marcar como “listo” cualquier nueva página, verificar:

- [ ] Envoltura de página `<div className={APP_PAGE_CLASS}>` (sin `max-w`, sin Tailwind con `var(--...)` para el chrome de la página).
- [ ] Header con `<PageHeader title subtitle left actions />` — no `<h1>` suelto.
- [ ] El **CTA primario** del módulo es **único** y `variant="primary"`. No competir con otro `primary` visible al mismo tiempo.
- [ ] Filtros: usar `<FilterBar>` y sus sub-componentes (`Pills`, `Select`, `Date`, `Action`). No mezclar pills propias con dropdowns nativos.
- [ ] Tablas: si es `<table>`, aplicar `.mc-table`. Si es lista-grid, usar (o crear) `.mc-list-header` + `.mc-list-row` — nunca volver a inlinar cabeceras.
- [ ] Empty state con `<EmptyState>` o las clases `mc-empty / mc-empty-title / mc-empty-desc`; **icono Lucide + título + descripción**. Variante compacta solo en sub-zonas.
- [ ] KPI cards con `<KpiCard>` (a crear, ver V-06) o las clases `mc-kpi-*`. No reinventar otro componente local.
- [ ] Modales con `<Modal>` + `<CancelButton>`. No portales propios.
- [ ] Justificaciones obligatorias (reprogramar/cancelar/bloquear/eliminar) con `<JustificacionField>` y `MIN_JUSTIFICACION_CHARS`.
- [ ] Colores: cero hex en `.tsx`. Si falta un matiz, **añadirlo a `tokens.css`** primero y usar el token.
- [ ] Semántica de color respetada:
  - Azul → acción primaria, links, foco.
  - Verde → éxito, completado.
  - Amarillo → atraso / urgencia / pendiente de revisión.
  - Rojo → peligro / error / destructivo.
  - Cyan (info) → registro neutral (incidencias, notas, contadores informativos).
  - Gris → texto secundario, bordes, deshabilitado.
- [ ] RBAC: lo que se oculta en UI debe estar también restringido por RLS/políticas en BD.
- [ ] Tipos Lucide con `aria-hidden`. Botones-icon con `aria-label`.
- [ ] Página envuelta en `<SectionErrorBoundary label="…" resetKey={location.pathname}>`.
- [ ] Cero `!important`. Si hace falta una variante, crear modifier en CSS.
- [ ] Estilos inline: solo cuando son dinámicos por dato (p. ej. color del badge según `tipo` en `EventoCard`). El resto, clases.

---

## TRABAJO PROPUESTO (orden de ejecución)

1. **Fase A — Tokens y semántica** (1–2 h): añadir tokens `--mc-state-*-bg-soft` y `--mc-state-incidencia-*`. Sustituir hex en `Metricas.tsx`, `Objetivos.tsx` y `Planificacion.tsx`.
2. **Fase B — Componentes faltantes** (2 h): `KpiCard.tsx` y `EmptyState.tsx`; clases `mc-list-header`, `mc-list-row`, `mc-section-header--plain`.
3. **Fase C — Migración por página** (2–3 h): MiSemana (V-01 + Notas + “Incidencias” info), Planificación (sticky, KPI cards, empty states, sección-header plain), OT (label + lista-grid), Objetivos (fila como `mc-list-row`, icono `MoreHorizontal`), Métricas (énfasis condicional + KpiCard).
4. **Fase D — QA visual** (30 min): comparar en `npm run dev` que cada empty state, cabecera y CTA primario se ve idéntico cruzando módulos.

Resultado esperado tras Fase D: un usuario que aprende a operar Órdenes de Trabajo puede usar Objetivos sin re-aprender ningún patrón visual ni de interacción.
