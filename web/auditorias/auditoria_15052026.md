AUDITORÍA INTEGRAL — NEXORA (SGTD Agenda TI v4)
Chief Digital Audit Report
Fecha: 2026-05-15
Auditado por: Análisis automatizado sobre código fuente, dist compilado, cobertura de tests y documentación
Versión auditada: V4 · Build mayo 2026

DIAGNÓSTICO GENERAL
Nexora es un producto de gestión operativa interno con una arquitectura técnica sólida y documentación excepcional. El código sigue patrones consistentes, la seguridad está bien pensada a nivel de BD (RLS + RPCs atómicas), y el design system tiene tokens definidos y aplicados. Sin embargo, existen brechas concretas entre la documentación y la implementación real que deben cerrarse antes del rollout a nuevas áreas.
Estado general: LISTO PARA USO INTERNO CON 4 CORRECCIONES PENDIENTES

PROBLEMAS DETECTADOS POR PRIORIDAD

🔴 CRÍTICOS (bloquean calidad de producto)
C-01 · Botón primario de Mi Semana en variant secundario

Dónde: MiSemana.tsx — botón + Nueva tarea
Evidencia: dist compilado contiene variant:"secondary", size:"sm" para ese botón
Impacto: el CTA más usado de la app no se parece a un CTA. Usuarios nuevos no van a encontrar cómo crear tareas.
Fix: cambiar variant="secondary" a variant="primary" · 1 línea · 5 minutos

C-02 · maxHeight fijo en panel de tareas vinculadas (Objetivos)

Dónde: Objetivos.tsx — panel lateral de tareas por objetivo
Evidencia: dist compilado contiene maxHeight:200, overflowY:'auto' con estilos inline
Impacto: si un objetivo tiene más de ~4 tareas, el usuario no las ve. La barra de scroll es casi invisible en ese contexto.
Fix: eliminar maxHeight: 200 y el overflowY: 'auto'. Si se quiere contener, usar max-h-[50vh] con Tailwind · 2 líneas · 5 minutos


🟠 ALTOS (degradan experiencia significativamente)
A-01 · Cobertura de tests: API layer al 2%, Hooks al 7%

Evidencia: coverage/lcov-report — api: 2.04% statements, hooks: 7.06%
Impacto: la lógica de negocio más crítica (RPCs atómicas, validaciones, flujos de OT) no tiene cobertura automática. Los tests existentes son de lib/utilidades (42%) pero no del código que realmente falla en producción.
Contexto positivo: los tests de permisos.roles.test.ts y semana.api.test.ts son de muy buena calidad — el patrón ya está definido, solo falta expandirlo.
Fix a mediano plazo: añadir tests para al menos ordenTrabajo.api.ts, objetivos.api.ts, useOrdenesTrabajoPage, usePlanificacionPage

A-02 · Sentry configurado pero NO incluido en el bundle de producción

Evidencia: grep "Sentry" dist/assets/index-c48FKNLG.js retorna 0 ocurrencias. Solo hay console.error en los error boundaries.
Impacto: cuando la app falle en producción con usuarios reales, no habrá visibilidad de los errores. Se sabrá que algo falló cuando el usuario lo reporte verbalmente.
Fix: instalar @sentry/react, inicializar en main.tsx condicionalmente con VITE_SENTRY_DSN, y llamar Sentry.captureException en AppErrorBoundary.componentDidCatch

A-03 · QA checklist desactualizado — referencias a módulos eliminados

Evidencia: qa-manual-checklist.md contiene escenarios D3 (Tablero Kanban), D4 (arrastrar en Tablero), P2 (Tablero con >10 miembros), B1-B4 (Bitácora como página), todos apuntando a módulos que no existen en V4.
Impacto: el QA checklist es el documento que usarán para validar antes de cada release. Si el equipo lo sigue al pie de la letra, perderá tiempo buscando pantallas que no existen, o peor, dará por válido el checklist sin ejecutarlo.
Fix: actualizar el checklist eliminando D3, D4, P2, B1-B4 y reemplazando por escenarios reales de V4: PanelNotas, ZonaIncidencias, OT impresión, recurrencia de eventos.

A-04 · theme-color en index.html no coincide con el accent del DS

Evidencia: index.html tiene <meta name="theme-color" content="#1e40af"> (azul Tailwind genérico) pero el token del DS es --mc-color-accent: #0064E0
Impacto: en Android Chrome, la barra del navegador se colorea con #1e40af. No es un bug funcional, pero si el equipo empieza a reconocer la marca como #0064E0, la inconsistencia se nota.
Fix: cambiar a #0064E0 · 1 línea

A-05 · og:url y og:image sin configurar

Evidencia: og:url está comentado, og:image apunta a /og-image.png que probablemente no existe
Impacto: cuando alguien comparta el link en Slack o Teams (lo que ocurrirá al onboardear la nueva área), el preview saldrá sin imagen o roto
Fix: crear un og-image.png 1200×630px con el logo de Nexora y descomentar la URL base


🟡 MEDIOS (afectan calidad a largo plazo)
M-01 · Bundle de AppLogo pesa 40KB — sospechosamente grande

Evidencia: AppLogo-BtxhDnTr.js = 40,690 bytes para lo que debería ser un componente de logo
Diagnóstico probable: el logo SVG o PNG está importado como módulo JS (posiblemente inlinado como base64) en lugar de servirse como asset estático
Fix: mover el logo a public/ y referenciarlo con <img src="/logo.png"> o como import de asset Vite que genera hash pero no lo inlinea

M-02 · Bundle de schemas pesa 72KB

Evidencia: schemas-CXZXOiu4.js = 72,928 bytes — cargado en el chunk principal
Diagnóstico: el archivo src/lib/schemas.ts tiene todos los schemas Zod consolidados y posiblemente importa Zod completo sin tree-shaking efectivo
Fix: revisar si hay imports de Zod duplicados; considerar dividir schemas por dominio y cargarlos lazy con cada módulo

M-03 · Estilos inline en Objetivos (V-10 de auditoría previa sin corregir)

Evidencia: dist de Objetivos contiene múltiples style={{...}} con valores hardcodeados
Impacto: viola el DS, dificulta el mantenimiento y no responde a modo oscuro (los tokens CSS sí lo hacen)
Fix: migrar a clases .mc-* correspondientes

M-04 · No hay PWA manifest ni service worker

Evidencia: no se encontró manifest.json ni sw.js en /dist
Impacto: en dispositivos móviles la app no se puede "instalar" en homescreen. Para una app interna que el equipo usará diariamente, esto mejora la experiencia sin costo.
Fix: añadir vite-plugin-pwa con configuración mínima

M-05 · Modo oscuro definido en tokens pero no activable por usuario

Evidencia: el CSS compilado tiene variables de dark mode (@media (prefers-color-scheme: dark)) pero no hay toggle de tema en la UI
Impacto: el sistema respeta la preferencia del SO, que es correcto. Pero si el equipo quiere toggle manual, no existe.
Decisión: si es app interna, respetar el SO es suficiente. Documentar que el dark mode existe y es automático.


🔵 BAJOS (polish y escalabilidad)
B-01 · Accesibilidad: aria-labels presentes en componentes críticos ✅ pero navegación por teclado en modales no verificada

Evidencia positiva: aria-label encontrado en: arrastrar tarea, evento card, botón de opciones, semana anterior/siguiente, limpiar filtro
Pendiente: el QA checklist (AC1) marca la navegación por teclado en modales como sin ejecutar. Verificar focus trap en Modal.tsx

B-02 · Flechas de navegación semanal usan caracteres ‹ › en lugar de iconos Lucide

Evidencia: dist contiene children:"‹" y children:"›" para los botones de navegación
Fix menor: cambiar a <ChevronLeft> y <ChevronRight> de lucide-react para consistencia con el resto de iconografía

B-03 · Realtime de InsForge: implementado pero sin tests de reconexión

Evidencia: useRealtimeNotificaciones.ts existe en el árbol de hooks pero el QA checklist R3 (desconexión/reconexión) no tiene estado registrado
Impacto bajo: para 4-8 usuarios en red corporativa estable, la reconexión es rara


QUICK WINS (implementables hoy, alto impacto)
#AcciónTiempo estimadoImpactoQW-1C-01: Cambiar variant="secondary" a "primary" en botón Nueva tarea5 minCrítico UXQW-2C-02: Eliminar maxHeight: 200 en panel de tareas de Objetivos5 minCrítico UXQW-3A-04: Corregir theme-color a #0064E02 minBrandingQW-4A-03: Actualizar QA checklist eliminando módulos V330 minProcesoQW-5B-02: Reemplazar ‹› por iconos Lucide en navegación semanal10 minConsistenciaTotal~52 min

MEJORAS ESTRATÉGICAS A MEDIANO PLAZO
1. Cobertura de tests → 40% en API y Hooks (1-2 sprints)
El patrón de tests con MSW ya está definido en semana.api.test.ts. Expandirlo a:

ordenTrabajo.api.test.ts — flujo completo borrador→completada
objetivos.api.test.ts — progreso calculado, permisos de completar
useOrdenesTrabajoPage.test.ts — transiciones de estado
usePlanificacionPage.test.ts — carga multi-miembro

2. Sentry operativo en producción (1 sprint)
Sin esto, el soporte a la nueva área es reactivo (esperan que alguien reporte). Con Sentry, el equipo sabe antes que el usuario.
3. Optimización de bundle (1 sprint)

AppLogo: de 40KB a <2KB
Schemas: split por dominio, carga lazy
Objetivo: reducir JS inicial de ~204KB a ~140KB → mejora de 30% en tiempo a interactivo

4. PWA básica (1 sprint)
Para una app que se usa diario, poder instalarla en el homescreen del móvil aumenta el uso. vite-plugin-pwa + manifest.json + service worker de cache básico.

REGLAS DE COMPONENTES (lo que pediste — contrato visual del DS)
Estas reglas son el estándar que debe cumplir cualquier componente nuevo o modificado:
Botones — regla de jerarquía
Por vista: 1 solo mc-btn (primario, azul) para la acción principal de la página
Acciones secundarias por fila/sección: mc-btn-ghost o mc-btn-secondary
Acciones destructivas: mc-btn-danger
Cancelar en modal: mc-btn-cancel (texto plano, sin borde)
Tamaño default: sin modificador · sm para acciones en fila · lg para CTA de auth
Modales — especificación
Overlay: fondo rgba(0,0,0,0.45), z-index 50
Dialog: mc-card + max-w-md (512px) + shadow mc-modal-shadow
Header: padding 16/20px · título 16px/600 · botón X ghost 30×30px derecha
Body: padding 20px · scroll independiente si contenido largo
Footer: padding 12/20px · border-top · justify-end · gap 8px
  └ Siempre: [Cancelar ghost] [Acción primaria mc-btn o mc-btn-danger]
Confirmación destructiva: mc-modal-confirm-card encima del dialog (overlay interno)
Formularios dentro de modal: inputs height 36px (mc-modal-form .mc-input)
Páginas — estructura obligatoria
<div className={APP_PAGE_CLASS}>           ← raíz, sin max-w
  <PageHeader
    title="Nombre del módulo"
    subtitle="contexto o rango"            ← opcional
    actions={<Button variant="primary">}   ← 1 máximo
  />
  <FilterBar>...</FilterBar>               ← si hay filtros
  <SectionErrorBoundary label="...">
    {/* contenido */}
  </SectionErrorBoundary>
</div>
Estados de tarea — fuente única
NUNCA definir colores de estado ad-hoc.
SIEMPRE usar TAREA_BADGE[estado] de src/lib/estadoConfig.ts
El badge incluye: className, label, punto de color
Tablas — cabecera unificada
th: font-size 11px · font-weight 500 · uppercase · letter-spacing 0.06em
    color var(--mc-color-text-secondary) · padding 10px 12px
td: font-size 13px · padding 10px 12px · color var(--mc-color-text)
Primera columna en tabla scrollable: position sticky · left 0 · bg surface · z-index 1
Empty states — estructura única
<div className="mc-empty">
  <Inbox size={40} className="mc-empty-icon" aria-hidden />
  <p className="mc-empty-title">No hay {entidad} aún</p>
  <p className="mc-empty-desc">descripción breve opcional</p>
  <div className="mc-empty-cta">
    <Button variant="secondary">Acción opcional</Button>
  </div>
</div>
KPI cards — componente único
SIEMPRE usar <KpiCard> — nunca reinventar por módulo
Props: value, label, trend? (número), icon?, variant? (sm|md|lg)
Color de valor: neutro por defecto, success si positivo, danger si negativo
Incidencias — color semántico
NUNCA: --mc-color-warning (amarillo) para incidencias
SIEMPRE: --mc-state-incidencia-bg, --mc-state-incidencia-border, --mc-state-incidencia-fg
Icono: Info o Sparkles de lucide. AlertTriangle solo para alertas reales sin atender.

CHECKLIST TÉCNICO PARA EL EQUIPO
Pre-merge obligatorio

 ¿Hay más de 1 variant="primary" en la vista? → Error
 ¿Hay maxHeight hardcodeado en listas de contenido dinámico? → Error
 ¿Hay colores hex en JSX o CSS que no sean tokens? → Error
 ¿Los estados de tarea usan TAREA_BADGE? → Obligatorio
 ¿Los iconos tienen aria-hidden? → Obligatorio
 ¿El menú contextual usa <MoreHorizontal> (no ···)? → Obligatorio
 ¿Las acciones sensibles tienen <JustificacionField>? → Obligatorio
 ¿El componente usa APP_PAGE_CLASS como raíz? → Obligatorio
 ¿El PageHeader tiene slot actions con el CTA? → Obligatorio
 ¿Hay style={{...}} con valores que podrían ser clases .mc-*? → Revisión

Pre-release (QA)

 QA checklist ejecutado completo (versión V4 actualizada)
 Build sin errores TypeScript (npx tsc -b)
 Tests en verde (npm run test)
 Verificación manual: Mi Semana, Objetivos, OT (ciclo completo), Planificación, Métricas
 Verificación en móvil: bottom nav, DnD táctil, modales


HERRAMIENTAS RECOMENDADAS POR ÁREA
ÁreaHerramientaPara quéTestsVitest + MSW (ya instalados)Expandir cobertura API y hooksErrores prodSentry (pendiente de activar)Visibilidad de fallos en tiempo realBundlenpx vite-bundle-visualizerIdentificar qué pesa y por quéAccesibilidadaxe DevTools (extensión)Validar WCAG AA en modalesPerformanceLighthouse CIMonitorear LCP, TBT, CLS en cada deploySeguridadSupabase/InsForge dashboard de RLSVerificar que las políticas estén activas

RESUMEN EJECUTIVO
CategoríaEstadoAcciónArquitectura✅ SólidaMantener patrón Page→Hook→APISeguridad BD✅ CorrectaRLS activo en 9 tablasDesign System✅ Bien definidoAplicar reglas de componentes documentadas aquíUX crítica⚠️ 2 bugsC-01 y C-02 — corregir antes del rolloutTests❌ 2-7% en código críticoExpandir siguiendo el patrón existenteObservabilidad❌ Sentry no activoActivar antes de dar acceso a nueva áreaQA Process⚠️ DesactualizadoActualizar checklist a V4Performance⚠️ Bundle optimizableAppLogo 40KB y Schemas 72KB son los targets
Veredicto para rollout a nueva área:
Corregir C-01 + C-02 (10 minutos de trabajo) y actualizar el QA checklist.
El resto puede hacerse en sprints posteriores sin bloquear el lanzamiento.