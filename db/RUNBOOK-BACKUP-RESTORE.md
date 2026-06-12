# Runbook — Backup y restore (InsForge / PostgreSQL)

**Producto:** Materen SGTD · **Última revisión:** 2026-06-08  
**Frecuencia recomendada:** backup automático diario (plataforma) + prueba de restore **anual** o antes de migraciones irreversibles (040+).

---

## 1. Responsables

| Rol | Acción |
|-----|--------|
| DevOps / DBA | Verificar backups de InsForge, ejecutar restore de prueba |
| Desarrollo | Validar app tras restore (login, Mi Semana, OT, RLS) |
| Jefe de proyecto | Aprobar ventana de mantenimiento si restore en prod |

---

## 2. Backup (InsForge)

### Verificar proyecto enlazado

```bash
npx @insforge/cli whoami
npx @insforge/cli current
```

### Export manual (snapshot lógico)

Usar **SQL Editor** del dashboard InsForge o CLI:

```bash
# Listar tablas críticas
npx @insforge/cli db query "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1"
```

**Tablas críticas SGTD:** `usuario`, `tarea`, `objetivo`, `orden_trabajo`, `log_accion`, `evento`, `nota_bitacora`, `configuracion_semana`, `tipo_trabajo_ot`, `log_ot`.

> Confirmar en el dashboard InsForge que **backups automáticos** están activos para el plan del proyecto. Documentar RPO/RTO acordados con el proveedor.

### Antes de migraciones irreversibles

1. Snapshot / export en el entorno objetivo.
2. Aplicar migración en **Dev** → **Staging** → **Prod**.
3. Validar con queries de `db/migrations/README.md` y checklist `.cursor/rules/CONTEXT.mdc` §12.

---

## 3. Restore de prueba (anual)

### Objetivo

Demostrar que un backup puede restaurarse y que la app funciona (auth, RLS, RPCs).

### Pasos sugeridos

1. Crear proyecto InsForge **temporal** o usar Staging.
2. Restaurar backup del entorno fuente (según procedimiento InsForge / soporte).
3. Enlazar CLI al entorno restaurado: `npx @insforge/cli link`.
4. Verificar objetos:

```bash
npx @insforge/cli db query "SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'sgtd_es_jefe') AS ok"
npx @insforge/cli db query "SELECT count(*) FROM public.usuario"
```

5. Apuntar `web/.env` al entorno restaurado (solo prueba).
6. QA mínimo:
   - Login jefe y miembro
   - Listar Mi Semana
   - Crear / enviar OT borrador
   - Eliminar tarea con motivo ≥10 chars

7. Registrar resultado en checklist §12 (columna del entorno) y fecha de la prueba.

---

## 4. Incidente — restore en producción

1. **Comunicar** ventana de mantenimiento.
2. **Detener** deploys frontend (Vercel).
3. **Restaurar** BD al punto acordado (InsForge / soporte).
4. **Verificar** migraciones aplicadas vs código desplegado (tag/git commit del release).
5. **Revalidar** variables Vercel: `VITE_INSFORGE_URL`, `VITE_ALLOWED_EMAIL_DOMAINS`, `VITE_SENTRY_DSN`.
6. **Smoke test** con usuarios reales (jefe + miembro).
7. **Post-mortem** documentado en `web/auditorias/`.

---

## 5. RPO / RTO (plantilla)

| Métrica | Valor acordado | Notas |
|---------|----------------|-------|
| RPO (pérdida máx. datos) | _pendiente_ | Depende del plan InsForge |
| RTO (tiempo de recuperación) | _pendiente_ | Incluye restore + validación |

---

*Relacionado: `db/migrations/README.md`, auditoría `web/auditorias/auditoria_08062026.md` AUDIT-028.*
