# Auditoría integral de diseño y experiencia — Materen (SGTD v4)

**Fecha auditoría:** 2026-06-08  
**Última actualización remediación:** 2026-06-08  
**Equipo auditor:** UX Research · UX Design · UI Design · UX Writing · Frontend Dev · Product Manager  
**Alcance:** SPA `web/src` — rutas activas, Materen Canvas, flujos jefe/miembro  
**Método:** Revisión de código fuente, tokens CSS y patrones de componentes

**Limitaciones:** ratios de contraste estimados desde `tokens.css` (no medidos con axe en runtime). Algunos flujos requieren datos reales de InsForge.

---

## ESTADO DE REMEDIACIÓN (resumen)

| Métrica | Valor |
|---------|-------|
| **Hallazgos totales** | 62 (DES-001 → DES-062) |
| **Resueltos** | **25** |
| **Fortalezas / sin acción** | **21** (INFORMATIVA o ya cumplían) |
| **Pendientes / parciales** | **14** |
| **Diferidos (decisión producto)** | **2** |
| **Extra (fuera de DES-xxx)** | Renombre **Meta Canvas → Materen Canvas** ✅ |
| **Puntuación inicial** | 72 / 100 |
| **Puntuación estimada post-remediación** | **~84 / 100** |

### Puntuación por dimensión (post-remediación estimada)

| Dimensión | Nota inicial | Nota actual | Estado |
|-----------|--------------|-------------|--------|
| 1 — Usabilidad (UX) | 7.2 | **8.2** | Bien |
| 2 — Interfaz visual (UI) | 8.0 | **8.6** | Bien |
| 3 — Componentes | 7.4 | **8.4** | Bien |
| 4 — Distribución (layout) | 7.6 | **8.5** | Bien |
| 5 — Responsive | 7.0 | **7.8** | Mejorable |
| 6 — Accesibilidad WCAG 2.1 AA | 6.4 | **8.0** | Bien |
| 7 — UX Writing | 7.3 | **8.2** | Bien |
| 8 — Rendimiento visual | 7.1 | **8.0** | Bien |

---

## TABLA MAESTRA DE HALLAZGOS

Leyenda de estado: ✅ Resuelto · ⏳ Pendiente/parcial · 🔒 Diferido (producto) · ✓ Fortaleza (mantener) · — Sin acción requerida

| ID | Sev. | Dim. | Estado | Observación (qué se detectó) | Remediación / notas |
|----|------|------|--------|------------------------------|---------------------|
| DES-001 | ALTA | UX | ✅ | Cabeceras divergentes (`PageHeader` vs `mc-misemana-header`) | `MiSemanaHeader`, `OTHeader`, `PlanificacionHeader` migrados a `PageHeader` |
| DES-002 | MEDIA | UX | ✅ | Borrador OT sin feedback visible de autoguardado | `OTFormModal`: `.mc-draft-status` + iconos + `aria-live` |
| DES-003 | MEDIA | UX | ✅ | Sin migas en flujos de 2+ niveles | `Breadcrumb` en `PlanificacionCeldaSidebar` y `PlanificacionCeldaMobile` |
| DES-004 | MEDIA | UX | ✅ | Acciones de tarjeta solo visibles en hover (desktop) | `.mc-semana-task-card__actions` siempre `display: flex` |
| DES-005 | MEDIA | UX | 🔒 | Planificación sin CTA para crear tarea desde heatmap | **Diferido:** conflicto con regla «solo lectura» — requiere decisión producto |
| DES-006 | BAJA | UX | ⏳ | Deep-link post-login limitado a allowlist | `rutasInternas.ts` mitiga; falta documentar en onboarding |
| DES-007 | BAJA | UX | ✅ | Empty state Objetivos sin CTA | `EmptyState` + botón «Crear objetivo» (jefe) |
| DES-008 | INFO | UX | ✓ | Confirmaciones destructivas + justificación ≥10 chars | Mantener patrón `ModalConfirmar` + `JustificacionField` |
| DES-009 | INFO | UX | ✓ | Pills de día + swipe móvil en Mi Semana | Mantener |
| DES-010 | MEDIA | UI | ✓ | Tokens Materen Canvas completos | Mantener; sin hex en TSX |
| DES-011 | MEDIA | UI | ✓ | Semántica warning vs incidencias correcta | Mantener |
| DES-012 | CRÍTICA | UI | ✅ | Menú ⋮ 34×28 px (&lt; 44 px móvil) | `min 44×44` en `@media (max-width: 767px)` |
| DES-013 | MEDIA | UI | ✅ | Iconos ojo custom en Login | `Eye` / `EyeOff` lucide-react |
| DES-014 | BAJA | UI | ⏳ | Escala tipográfica densa sin guía por contexto | Documentar en `SISTEMA-DISENO.md` |
| DES-015 | BAJA | UI | ✓ | Cabeceras tabla uppercase 10–11px | Mantener en nuevas tablas |
| DES-016 | INFO | UI | ✓ | Marca Materen en shell y auth | Mantener |
| DES-017 | ALTA | Comp. | ⏳ | Posibles vistas con 2 botones primarios | Auditar modales/vistas restantes; regla 1 primary vigente |
| DES-018 | ALTA | Comp. | ⏳ | Botones async sin spinner | Prop `loading` en `Button` + Login; **falta** extender a más mutaciones |
| DES-019 | MEDIA | Comp. | ✅ | `FilterBar.Pills` sin `aria-label` en grupo | Prop `groupLabel`; OT toolbar configurado |
| DES-020 | MEDIA | Comp. | ✓ | Modal con focus trap, Escape, scroll lock | Mantener |
| DES-021 | MEDIA | Comp. | ✅ | `EmptyState` título en `<p>` | Título como `<h2>` |
| DES-022 | MEDIA | Comp. | ✓ | `JustificacionField` con label + contador live | Mantener |
| DES-023 | BAJA | Comp. | ✅ | Footer onboarding horizontal | `footerClassName="mc-modal-footer--stack"` |
| DES-024 | INFO | Comp. | ✓ | Doble confirmación al eliminar tarea | Mantener |
| DES-025 | ALTA | Layout | ✓ | Layout maestro-detalle OT/Objetivos eficiente | Mantener como patrón |
| DES-026 | MEDIA | Layout | ⏳ | Scroll vertical en columnas semana muy altas | Validar en QA manual desktop |
| DES-027 | MEDIA | Layout | ✓ | `APP_PAGE_CLASS` con gap/padding consistente | Mantener |
| DES-028 | MEDIA | Layout | ✓ | Stats inline en toolbar (no KPI cards) | Mantener |
| DES-029 | BAJA | Layout | ✅ | Header Mi Semana duplicado (móvil + desktop) | Un solo `MiSemanaHeader` + `useIsMobile` |
| DES-030 | INFO | Layout | ✓ | Heatmap planificación escaneable | Mantener |
| DES-031 | ALTA | Resp. | ✅ | `/metricas` redirigía a Planificación | Ruta restaurada con `JefeRoute` + ítem sidebar |
| DES-032 | ALTA | Resp. | ⏳ | Bottom nav jefe apretada en 360px (4 ítems) | `aria-label` mejorado; validar touch en dispositivo real |
| DES-033 | MEDIA | Resp. | 🔒 | Tablet 768px sin layout intermedio | **Diferido:** esfuerzo alto, volumen tablet bajo |
| DES-034 | MEDIA | Resp. | ✓ | Tabla→cards en móvil OT/Objetivos | Mantener |
| DES-035 | MEDIA | Resp. | ⏳ | Columnas día con `dvh` — validar iOS Safari | QA manual pendiente |
| DES-036 | BAJA | Resp. | ⏳ | Texto largo sin `max-width` en bloques lectura | Aplicar solo en modales/párrafos densos |
| DES-037 | INFO | Resp. | ✅ | Breakpoint 767 vs 768 documentación | `MOBILE_MAX_WIDTH_PX` + comentario alineado con `md:` |
| DES-038 | ALTA | A11y | ✅ | Sin skip link a `#main-content` | `.mc-skip-link` en `AppShell` |
| DES-039 | ALTA | A11y | ✅ | `focus-visible: none` en inputs | Outline 2px accent en `.mc-input:focus-visible` |
| DES-040 | ALTA | A11y | ✅ | Texto secundario en límite WCAG (~4.5:1) | Token `#5c6570` (`--mc-brand-ui-gray`) |
| DES-041 | MEDIA | A11y | ✅ | Placeholder #94a3b8 bajo contraste | Token `#64748b`; labels siempre visibles |
| DES-042 | MEDIA | A11y | ✅ | Drawer «Más» con `aria-modal` siempre true | `role`/`aria-modal`/`aria-hidden` condicionales |
| DES-043 | MEDIA | A11y | ✅ | Subtítulo `PageHeader` no era `<h2>` | Subtítulo como `<h2 class="mc-page-subtitle">` |
| DES-044 | MEDIA | A11y | ✅ | Badge SLA `aria-hidden` en bottom nav | `aria-label` en `NavLink` incluye count |
| DES-045 | BAJA | A11y | ✓ | OTP `VerifyResetCode` — buen modelo | Referencia para inputs compuestos |
| DES-046 | BAJA | A11y | ⏳ | SVG legacy fuera de Login | Login corregido; revisar `ForgotPassword` / `ResetPassword` |
| DES-047 | INFO | A11y | ✓ | `Modal` con `role="dialog"` + `aria-labelledby` | Mantener |
| DES-048 | ALTA | Writing | ✅ | `/privacidad` exponía ruta técnica interna | Copy orientado al usuario (ARCO) |
| DES-049 | MEDIA | Writing | ⏳ | Glosario terminológico no documentado | Crear/actualizar sección en `SISTEMA-DISENO.md` |
| DES-050 | MEDIA | Writing | ✓ | Errores login neutros | Mantener |
| DES-051 | MEDIA | Writing | ⏳ | Botones genéricos «Confirmar» en varios modales | Parcial: «Sí, eliminar tarea», «Completar objetivo»; faltan OT y otros |
| DES-052 | MEDIA | Writing | ✅ | Onboarding sin paso Mi Semana (miembro) | Paso «Mi semana» para jefe y miembro |
| DES-053 | BAJA | Writing | ⏳ | Placeholder justificación genérico | Ejemplos por contexto (reprogramar, cancelar, etc.) |
| DES-054 | BAJA | Writing | ✓ | Nav «Mi semana» = título página | Mantener en nuevos módulos |
| DES-055 | INFO | Writing | ⏳ | Toasts sin plantilla unificada | Estandarizar «[Entidad] [acción]» en `sonner` |
| DES-056 | MEDIA | Perf. | ✅ | Carga semana solo texto «Cargando…» | `SkeletonSemanaGrilla` en `Suspense` |
| DES-057 | MEDIA | Perf. | ✓ | Charts métricas con prop `loading` | Ruta `/metricas` activa; patrón reutilizable |
| DES-058 | MEDIA | Perf. | ⏳ | `font-display: swap` no verificado | Revisar si Inter se auto-hospeda |
| DES-059 | MEDIA | Perf. | ✅ | `prefers-reduced-motion` solo en skeleton | Tokens `--mc-transition-*` → `0ms` en reduce |
| DES-060 | BAJA | Perf. | ✅ | `AppLogo` sin width reservado (CLS) | `width`/`height` con ratio 280/52 |
| DES-061 | BAJA | Perf. | ✓ | Lazy routes en `App.tsx` | Mantener |
| DES-062 | INFO | Perf. | ✓ | Logo PNG sin WebP | Opcional; peso &lt;40KB aceptable |

---

## RESUELTOS — detalle de implementación

| ID | Archivos / cambio clave |
|----|-------------------------|
| DES-001 | `PageHeader.tsx`, `MiSemanaHeader.tsx`, `OTHeader.tsx`, `PlanificacionHeader.tsx` |
| DES-002 | `OTFormModal.tsx`, `layout.css` (`.mc-draft-status`) |
| DES-003 | `Breadcrumb.tsx`, `PlanificacionCeldaSidebar.tsx`, `PlanificacionCeldaMobile.tsx` |
| DES-004 | `components.css` — acciones tarjeta siempre visibles |
| DES-007 | `Objetivos.tsx` — CTA empty state |
| DES-012 | `components.css` — touch 44px móvil en menú ⋮ |
| DES-013 | `Login.tsx` — lucide Eye/EyeOff |
| DES-019 | `FilterBar.tsx`, `OTToolbar.tsx` |
| DES-021 | `EmptyState.tsx` — `<h2>` |
| DES-023 | `OnboardingWelcome.tsx` |
| DES-029 | `MiSemana.tsx` — header único + `useIsMobile` |
| DES-031 | `App.tsx`, `AppShell.tsx` — ruta y nav Métricas |
| DES-037 | `useIsMobile.ts` — `MOBILE_MAX_WIDTH_PX` |
| DES-038 | `AppShell.tsx`, `layout.css` — skip link |
| DES-039 | `forms.css` — focus ring |
| DES-040/041 | `tokens.css` — grises ajustados |
| DES-042/044 | `AppShell.tsx` — drawer y bottom nav ARIA |
| DES-043 | `PageHeader.tsx` — subtítulo `<h2>` |
| DES-048 | `Privacidad.tsx` |
| DES-051 | `TareaSemanaCard.tsx`, `Objetivos.tsx` (parcial) |
| DES-052 | `OnboardingWelcome.tsx` |
| DES-056 | `Skeletons.tsx`, `MiSemana.tsx` |
| DES-059 | `animations.css` |
| DES-060 | `AppLogo.tsx` |
| DES-018 | `Button.tsx` (`loading`), `Login.tsx` (parcial) |
| — | Renombre: `sgtd-ui-materen-canvas.mdc`, docs y comentarios CSS |

---

## PENDIENTES — observaciones y acción sugerida

| ID | Severidad | Observación | Acción sugerida | Esfuerzo |
|----|-----------|-------------|-----------------|----------|
| **DES-005** | MEDIA | El jefe detecta huecos en el heatmap pero debe ir a Mi Semana para crear tarea | Decisión producto: ¿enlace «Ir a semana de [miembro]» sin crear desde Planificación? | Alto · 🔒 |
| **DES-033** | MEDIA | En tablet (768–1024px) el layout salta de móvil a desktop sin grado intermedio | Heatmap 2 columnas o sidebar colapsado; solo si hay demanda real | Alto · 🔒 |
| **DES-006** | BAJA | Rutas internas post-login no documentadas para el usuario | Mencionar en onboarding o ayuda contextual | Bajo |
| **DES-014** | BAJA | Muchos tamaños de fuente en vistas densas sin guía | Actualizar `SISTEMA-DISENO.md` § tipografía por contexto | Bajo |
| **DES-017** | ALTA | No se auditaron todas las vistas por doble botón primario | Checklist manual: Mi Semana, OT modal, Objetivos modal | Medio |
| **DES-018** | ALTA | Spinner solo en `Button` genérico y Login | Pasar `loading` en mutaciones OT, auth, objetivos | Medio |
| **DES-026** | MEDIA | Columnas semana con muchas tareas pueden comprimir scroll | Probar con 15+ tareas/día en desktop | Bajo |
| **DES-032** | ALTA | 4 tabs en bottom nav jefe en 360px siguen densos | QA en dispositivo; acortar labels o icon-only | Bajo |
| **DES-035** | MEDIA | `100dvh` en columnas — barra Safari iOS | QA en iPhone real | Bajo |
| **DES-036** | BAJA | Descripciones OT largas sin max-width en panel | `max-width` en bloques de lectura de detalle | Bajo |
| **DES-046** | BAJA | Posibles SVG custom en páginas auth restantes | Sustituir por lucide donde aplique | Bajo |
| **DES-049** | MEDIA | Glosario tarea/OT/objetivo/incidencia no centralizado | Sección glosario en `SISTEMA-DISENO.md` | Bajo |
| **DES-051** | MEDIA | Otros modales aún usan «Confirmar» genérico | Revisar `OrdenesTrabajo`, `ModalReprogramar`, `ModalConfirmar` defaults | Medio |
| **DES-053** | BAJA | Placeholder justificación no contextual | Texto por acción: reprogramar, cancelar, eliminar | Bajo |
| **DES-055** | INFO | Toasts ad hoc sin plantilla | Helper `toastExito('Tarea', 'actualizada')` | Bajo |
| **DES-058** | MEDIA | Inter cargada vía CDN/link sin confirmar `font-display` | Verificar `index.html` / self-host | Bajo |

---

## DIFERIDOS (sin implementar por decisión)

| ID | Motivo |
|----|--------|
| **DES-005** | Planificación es **solo lectura** por regla de producto (`.cursor/rules/sgtd-product-modules.mdc`). Un CTA de creación rompe el contrato del módulo. |
| **DES-033** | ROI bajo: app interna, uso mayoritario desktop/móvil. Layout tablet dedicado pospuesto. |

---

## FORTALEZAS CONFIRMADAS (mantener)

1. **Materen Canvas** — tokens `--mc-*`, clases `mc-*`, semántica de color, densidad operativa.
2. **Modal unificado** — focus trap, Escape, `aria-labelledby`, guard de cambios.
3. **Shell responsive** — sidebar desktop + bottom nav móvil con estados activos.
4. **Flujos destructivos** — confirmación + justificación ≥10 caracteres.
5. **Patrón maestro-detalle** — OT y Objetivos (tabla + panel / fullscreen móvil).
6. **Mi Semana móvil** — pills de día + swipe entre fechas.

---

## SCORECARD ACTUALIZADO

| Dimensión | Crítica | Alta | Media | Baja | Info | Resueltos | Pendientes |
|-----------|---------|------|-------|------|------|-----------|------------|
| 1 UX | 0 | 0 | 1🔒 | 1 | 2 | 5 | 1 |
| 2 UI | 0 | 0 | 0 | 1 | 3 | 2 | 1 |
| 3 Componentes | 0 | 1⏳ | 0 | 0 | 3 | 4 | 1 |
| 4 Layout | 0 | 0 | 1 | 0 | 3 | 1 | 1 |
| 5 Responsive | 0 | 1⏳ | 1🔒 | 1 | 1 | 2 | 2 |
| 6 A11y | 0 | 0 | 0 | 1 | 2 | 7 | 1 |
| 7 Writing | 0 | 0 | 1⏳ | 1 | 2 | 2 | 3 |
| 8 Perf. visual | 0 | 0 | 1 | 0 | 2 | 3 | 1 |

---

## HALLAZGOS DETALLADOS (referencia original)

> Las tablas siguientes conservan la **observación original** del equipo auditor.  
> Para estado actualizado, usar la **Tabla maestra** arriba.

### Dimensión 1 — Usabilidad (UX)

| ID | Sev. | Rol | Pantalla | Componente | Descripción | Impacto | Recomendación |
|----|------|-----|----------|------------|-------------|---------|---------------|
| DES-001 | ALTA | UX Designer | `/semana` | `MiSemanaHeader` | Cabecera custom no comparte patrón con Objetivos/OT. | Curva de aprendizaje. | Unificar en `PageHeader` + slots. |
| DES-002 | MEDIA | UX Researcher | `/ordenes-trabajo` | `OTFormModal` | Formulario largo + autoguardado sin progreso explícito. | Abandono en borradores. | Footer con «Guardado hace X» + icono sync. |
| DES-003 | MEDIA | UX Designer | Global | `AppShell` | Sin breadcrumbs en overlays profundos. | Pérdida de contexto al volver. | Migas en overlays 2+ niveles. |
| DES-004 | MEDIA | UX Researcher | `/semana` | `TareaSemanaCard` | Acciones solo en hover desktop. | Descubrimiento tardío. | Acciones siempre visibles o tooltip primera visita. |
| DES-005 | MEDIA | Product Manager | `/planificacion` | `PlanificacionHeader` | Solo lectura sin CTA corrección. | Fricción supervisor. | Enlace contextual si producto aprueba. |
| DES-006 | BAJA | UX Designer | Auth | `Login` | Deep-link limitado a allowlist. | Pérdida deep-link legítimo. | Documentar rutas en onboarding. |
| DES-007 | BAJA | UX Researcher | `/objetivos` | `EmptyState` | Sin CTA en lista vacía. | Usuario sin siguiente paso. | CTA «Crear objetivo». |
| DES-008 | INFO | UX Designer | Modales | `JustificacionField` | Confirmación + ≥10 chars en destructivos. | Reduce errores. | Mantener. |
| DES-009 | INFO | UX Researcher | `/semana` móvil | Pills + swipe | Buen patrón navegación diaria. | — | Mantener. |

### Dimensión 2 — Interfaz visual (UI)

| ID | Sev. | Rol | Pantalla | Componente | Descripción | Recomendación |
|----|------|-----|----------|------------|-------------|---------------|
| DES-010 | MEDIA | UI Designer | Global | `tokens.css` | Sistema tokens Materen completo. | Mantener. |
| DES-011 | MEDIA | UI Designer | `/semana` | `TareaSemanaCard` | Warning solo urgencia; incidencias cyan. | Mantener. |
| DES-012 | CRÍTICA | UI + FE | `/semana` | Menú ⋮ | 34×28 px &lt; 44 px móvil. | 44px en móvil. |
| DES-013 | MEDIA | UI Designer | Auth | `Login` | SVG ojo custom. | lucide Eye/EyeOff. |
| DES-014 | BAJA | UI Designer | Global | Tipografía | Escala densa. | Documentar en SISTEMA-DISENO. |
| DES-015 | BAJA | UI Designer | Tablas | Cabeceras | Uppercase 10–11px. | Mantener. |
| DES-016 | INFO | UI Designer | `AppLogo` | Marca | Logo correcto en shell. | Mantener. |

### Dimensión 3 — Componentes

| ID | Sev. | Rol | Componente | Descripción | Recomendación |
|----|------|-----|------------|-------------|---------------|
| DES-017 | ALTA | FE | `Button` | Máx. 1 primary por vista. | Auditar vistas. |
| DES-018 | ALTA | FE | `Button` | Sin spinner en async. | Prop `loading`. |
| DES-019 | MEDIA | UX | `FilterBar.Pills` | Grupo sin `aria-label`. | `groupLabel` por contexto. |
| DES-020 | MEDIA | FE | `Modal` | Focus trap + Escape. | Mantener. |
| DES-021 | MEDIA | UX | `EmptyState` | Título no heading. | `<h2>`. |
| DES-022 | MEDIA | FE | `JustificacionField` | Label + contador live. | Mantener. |
| DES-023 | BAJA | UI | `OnboardingWelcome` | Footer horizontal. | `mc-modal-footer--stack`. |
| DES-024 | INFO | FE | Destructivos | Doble confirmación eliminar. | Mantener. |

### Dimensión 4 — Layout

| ID | Sev. | Rol | Pantalla | Descripción | Recomendación |
|----|------|-----|----------|-------------|---------------|
| DES-025 | ALTA | UX | OT/Objetivos | Split maestro-detalle eficiente. | Mantener patrón. |
| DES-026 | MEDIA | UI | `/semana` | Scroll columnas altas. | Validar QA. |
| DES-027 | MEDIA | UX | Global | `APP_PAGE_CLASS` consistente. | Mantener. |
| DES-028 | MEDIA | UI | Toolbars | Stats inline. | Mantener. |
| DES-029 | BAJA | UX | `/semana` | Header duplicado DOM. | Header único responsive. |
| DES-030 | INFO | UI | Planificación | Heatmap escaneable. | Mantener. |

### Dimensión 5 — Responsive

| ID | Sev. | Rol | Pantalla | Descripción | Recomendación |
|----|------|-----|----------|-------------|---------------|
| DES-031 | ALTA | PM | `/metricas` | Ruta rota / huérfana. | Restaurar ruta + nav. |
| DES-032 | ALTA | FE | Bottom nav | 4 ítems densos 360px. | QA touch; labels cortos. |
| DES-033 | MEDIA | UX | Tablet | Sin layout intermedio. | Breakpoint tablet opcional. |
| DES-034 | MEDIA | FE | Tablas | Tabla→cards móvil. | Mantener. |
| DES-035 | MEDIA | FE | `/semana` | `dvh` columnas. | QA iOS Safari. |
| DES-036 | BAJA | UX | Desktop | Texto largo sin max-width. | max-width lectura. |
| DES-037 | INFO | FE | Breakpoints | 767 vs 768. | Documentar constante. |

### Dimensión 6 — Accesibilidad

| ID | Sev. | Rol | Componente | Descripción | Recomendación |
|----|------|-----|------------|-------------|---------------|
| DES-038 | ALTA | FE | Shell | Sin skip link. | `.mc-skip-link`. |
| DES-039 | ALTA | FE | Inputs | Focus debilitado. | Outline 2px accent. |
| DES-040 | ALTA | UX | Tokens | Texto secundario ~4.5:1. | Oscurecer token. |
| DES-041 | MEDIA | FE | Placeholders | #94a3b8 ~2.9:1. | Oscurecer + label visible. |
| DES-042 | MEDIA | FE | Drawer | `aria-modal` estático. | Condicional al abrir. |
| DES-043 | MEDIA | UX | `PageHeader` | Subtítulo no h2. | `<h2>`. |
| DES-044 | MEDIA | FE | Bottom nav | SLA badge oculto a AT. | `aria-label` con count. |
| DES-045 | BAJA | FE | OTP | Buen modelo OTP. | Replicar. |
| DES-046 | BAJA | FE | Iconos | SVG legacy auth. | lucide everywhere. |
| DES-047 | INFO | FE | `Modal` | Dialog ARIA correcto. | Mantener. |

### Dimensión 7 — UX Writing

| ID | Sev. | Rol | Pantalla | Descripción | Recomendación |
|----|------|-----|----------|-------------|---------------|
| DES-048 | ALTA | UX Writer | `/privacidad` | Path técnico en copy. | Texto usuario final. |
| DES-049 | MEDIA | UX Writer | Global | Terminología sin glosario. | `SISTEMA-DISENO.md`. |
| DES-050 | MEDIA | UX Writer | `Login` | Error neutro (fortaleza). | Mantener. |
| DES-051 | MEDIA | UX Writer | Destructivos | «Confirmar» genérico. | Verbo + objeto. |
| DES-052 | MEDIA | UX Writer | Onboarding | Sin paso Mi Semana miembro. | Paso por rol. |
| DES-053 | BAJA | UX Writer | Justificación | Placeholder genérico. | Ejemplos por contexto. |
| DES-054 | BAJA | UX Writer | Nav | Labels = títulos. | Mantener. |
| DES-055 | INFO | UX Writer | Toasts | Sin plantilla. | Estandarizar mensajes. |

### Dimensión 8 — Rendimiento visual

| ID | Sev. | Rol | Pantalla | Descripción | Recomendación |
|----|------|-----|----------|-------------|---------------|
| DES-056 | MEDIA | FE | `/semana` | Sin skeleton grilla. | `SkeletonSemanaGrilla`. |
| DES-057 | MEDIA | FE | Métricas | Charts con `loading`. | Mantener. |
| DES-058 | MEDIA | FE | Fuentes | `font-display` no verificado. | Confirmar swap. |
| DES-059 | MEDIA | FE | Motion | reduced-motion parcial. | Tokens transición en reduce. |
| DES-060 | BAJA | FE | `AppLogo` | CLS sin width. | Dimensiones explícitas. |
| DES-061 | BAJA | FE | Build | Lazy routes. | Mantener. |
| DES-062 | INFO | FE | Assets | PNG logo. | WebP opcional. |

---

## PRÓXIMOS PASOS (post-remediación)

1. **Documentación:** actualizar `web/CONTEXT/SISTEMA-DISENO.md` (Materen Canvas, `PageHeader`, glosario, tipografía) — cierra DES-014, DES-049.
2. **QA manual:** bottom nav 360px (DES-032), `dvh` iOS (DES-035), columnas altas semana (DES-026).
3. **Extender `Button.loading`:** mutaciones OT, Objetivos, auth restante (DES-018).
4. **Revisar microcopy** en todos los modales destructivos (DES-051).
5. **Decisión producto** sobre DES-005 antes de cualquier CTA en Planificación.

---

## RELACIÓN CON OTRAS AUDITORÍAS

| Documento | Relación |
|-----------|----------|
| `auditoria_08062026.md` | Auditoría técnica/seguridad (complementaria) |
| `deuda_post_auditoria.md` | Deuda técnica no bloqueante |
| `deuda_lint_2026-06-08.md` | Deuda ESLint |
| `CONTEXT/SISTEMA-DISENO.md` | Fuente diseño — **pendiente actualizar** tras remediación |

---

*Auditoría de diseño Materen — 2026-06-08. Remediación aplicada en código el mismo día. Metodología: revisión estática + implementación Materen Canvas V4.*
