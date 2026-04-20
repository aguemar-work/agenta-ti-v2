# SGTD v1 - Contexto del sistema
## 1. Propósito
Sistema de Gestión de Tareas Departamental para equipos con roles:
- Jefe
- Miembro

Permite: 
- Planificación semanal
- Ejecución diaria
- Gestión de imprevistos
- Métricas ponderadas por prioridad

## 2. Stack 
- React 18 + TypeScript + Vite
- InsForge (Postgres + Auth + RLS + Realtime)
- TanStack Query
- React Router v6
- @dnd-kit
- Sonner
- Lucide
- Inter

## 3. Módulos del sistema. 
- HOY -> ejecución diaria (3 columnas 'TAREAS PLANIFICADAS/EVENTOS' 'REGISTRO DE INCIDENCIAS' y 'BITACORA')
- MI SEMANA -> Calendario semanal + planificación semanal 
- PLANIFICACIÓN -> vista de carga (solo Jefe)
- TABLERO -> Kanban por estados
- OBJETIVO -> Gestión estratégica 
- BITÁCORA -> Registo de actividad
- MÉTRICAS -> KPIs  de rendimiento
- LOG -> Registro de acciones y actividades de los usuarios. 

## 4. RBAC (resumen)
- Jefe: control total + supervisión
- Miembro: solo sus tareas 
La autorización real se implementa con RLS en InsForge.

Fuente completa: 'sgtd-rbac.mdc'

## 5. Entidades (fuente de verdad)
Ver schema en:
'db/sgtd_v1_schema.sql'

Entidades principales:
- usuario
- tarea
- objetivo
- evento
- nota_bitacora
- log_accion
No modificar sin acuerdo explícito.

## 6. Reglas críticas
- tareas atrasadas automáticas
- backlog (tiempo libre)
- imprevistos como tareas completadas
- log obligatorio en acciones críticas
- métricas ponderadas por prioridad
Fuente: 'sgtd-business-rules.mdc'

## 7. Autenticación
- Basada en InsForge (JWT + refresh)
- Sesión persistente obligatoria
- Nunca mostrar errores de token al usuario
Fuente completa: 'sgtd-auth-session.mdc'

## 8. UI/Design System
Sistema visual: Meta Canvas
- uso obligatorio de tokens
- componentes '.mc-*'
- layout definido
Fuente: 'DESIGN-SYSTEM.md'

## 9. Restricciones
- No alterar schema DB, a me nos que sea necesario y consultado.
- UI en español
- No features fuera del alcance
- Código modular por features

## 10. Principios de implementación
- Feature-first architecture
- Bajo acoplamiento
- RLS como fuente de seguridad
- TanStack Query para estado async