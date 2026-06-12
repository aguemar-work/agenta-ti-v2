# Deuda post-auditoría — para después (no bloquea cierre técnico)

**Auditoría:** `auditoria_08062026.md` · **Registrado:** 2026-06-08  
**Criterio:** ítems de **mantenibilidad, rendimiento, Legal completo o plataforma** que no impiden remediar hallazgos ALTA de código/seguridad/CI ya aplicados.

---

## Código y arquitectura

| ID | Hallazgo | Motivo diferido |
|----|----------|-----------------|
| AUDIT-003 | God-hook `useOrdenesTrabajoPage` (borrador/autoguardado) | Split parcial hecho (`useOrdenesTrabajoQueries`); resto es refactor grande sin bug |
| AUDIT-008 | `ModalDetalleTareaSemana` monolítico | Mantenibilidad / tests |
| AUDIT-009 | Kanban legacy en `api/tablero.ts` | Marcado `@deprecated`; tests lo usan |
| AUDIT-011 | `TipoAccionLog` con `bloqueada`/`desbloqueada` | Solo lectura histórica en logs |
| AUDIT-033 | 4 queries paralelas en Métricas | Rendimiento; sin SLA roto en volumen actual |

## Seguridad

| ID | Hallazgo | Motivo diferido |
|----|----------|-----------------|
| AUDIT-018 (parcial) | CSP `script-src 'unsafe-inline'` | Requiere nonce/hash en build Vite; Sentry ya en `connect-src` |
| AUDIT-020 | JWT en storage del SDK | Mitigado por CSP + sin XSS sinks; cambio de SDK fuera de alcance |
| AUDIT-021 | Token reset en router state | Riesgo bajo; TTL servidor InsForge |
| AUDIT-035 | Rate limiting app | Responsabilidad plataforma InsForge / WAF |

## BD e infraestructura

| ID | Hallazgo | Motivo diferido |
|----|----------|-----------------|
| AUDIT-022 | Migraciones pendientes Staging/Prod | Operación DevOps; checklist §12 + runbook |
| AUDIT-028 (parcial) | Prueba anual de restore | Procedimiento en `db/RUNBOOK-BACKUP-RESTORE.md`; ejecución manual |
| AUDIT-029 (parcial) | `schema.sql` desfasado vs 042 | Fuente operativa = migraciones; regenerar DDL masivo |
| AUDIT-032 | 39 SQL manuales / duplicado 040 | Proceso; sin divergencia verificada en Dev |

## Cumplimiento y procesos

| ID | Hallazgo | Motivo diferido |
|----|----------|-----------------|
| AUDIT-037 (parcial) | Ley 29733 completa | Plantilla `CONTEXT/PRIVACIDAD-LEY29733.md` + aviso en app; **Legal** debe completar DPA/ARCO/plazos |
| AUDIT-039 | README monorepo raíz | Onboarding; no afecta seguridad |
| AUDIT-040 | OpenAPI / catálogo RPC | Documentación formal |
| AUDIT-041 | Logs inmutables vs supresión ARCO | Decisión Legal + política retención |
| AUDIT-043 | Umbral cobertura en CI | Mejora continua |

## Calidad (registrado aparte)

| Documento | Contenido |
|-----------|-----------|
| `deuda_lint_2026-06-08.md` | 25 errores ESLint; CI lint con `continue-on-error` |

## Visibilidad limitada (auditoría original)

No verificable desde repo — seguimiento manual:

- InsForge prod/staging: RLS, migraciones 023–040, `sgtd_config` dominios
- Variables Vercel producción
- Backups automáticos InsForge, monitoreo, DPA Sentry/InsForge
- MFA / rate-limit auth InsForge
- CORS y autorización Realtime en canales

---

## Criterio de cierre de auditoría técnica

Cuando todos los ítems en `auditoria_08062026.md` → sección **Estado hallazgos** estén en ✅ o 📋 Legal/DevOps documentado, considerar auditoría **cerrada en código** y este archivo como backlog de mejora continua.
