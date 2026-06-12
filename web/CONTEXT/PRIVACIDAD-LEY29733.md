# Tratamiento de datos personales — Ley N.° 29733 (Perú)

**Producto:** Materen SGTD · **Estado:** plantilla operativa — **requiere revisión Legal / DPO**  
**Última actualización:** 2026-06-08

---

## 1. Responsable del tratamiento

| Campo | Valor |
|-------|-------|
| Responsable | _[Razón social / área TI]_ |
| Contacto privacidad | _[email DPO o responsable]_ |
| Finalidad | Gestión operativa de tareas, OTs y métricas del equipo de TI |

---

## 2. Datos personales tratados

| Categoría | Datos | Origen | Base legal (completar con Legal) |
|-----------|-------|--------|----------------------------------|
| Identificación | nombre, email, rol (`jefe`/`miembro`) | Login corporativo + tabla `usuario` | Ejecución contractual / interés legítimo |
| OT completada | receptor_nombre, receptor_dni (8 dígitos) | Formulario cierre OT | Obligación procedimental interna |
| Trazabilidad | justificaciones en `log_accion` | Usuario al cancelar/reprogramar/eliminar | Interés legítimo / cumplimiento interno |
| Observabilidad | user id, rol (tag) en Sentry | App en producción | Interés legítimo — **sin email** (`sendDefaultPii: false`) |
| Analytics (opcional) | user id, rol, eventos de UI | `VITE_ANALYTICS_ENDPOINT` si configurado | Consentimiento / interés legítimo — definir con Legal |

**No se trata:** datos de salud, biométricos ni menores (app interna corporativa).

---

## 3. Destinatarios y transferencias

| Destinatario | Datos | Ubicación | Salvaguardas |
|--------------|-------|-----------|--------------|
| InsForge (BaaS) | Todos los de BD + auth | _[región: us-east]_ | Contrato / DPA — **pendiente documentar** |
| Sentry | Errores, user id, rol | EE.UU. | DPA Sentry — **pendiente** |
| Vercel | Logs de hosting, IP | Global | Política Vercel — **pendiente** |

---

## 4. Plazos de conservación (propuesta — validar con Legal)

| Dato | Plazo | Acción al vencimiento |
|------|-------|------------------------|
| `usuario` activo | Mientras relación laboral + _X_ meses | Desactivar / anonimizar |
| `log_accion` | _X_ años (inmutables migr. 024) | Anonimizar justificación / pseudonimizar |
| OT completada (receptor) | _X_ años | Archivo / anonimizar DNI |
| Sentry issues | Según retención plan Sentry | Borrado automático |

---

## 5. Derechos ARCO (titulares)

Canal sugerido: _[email o formulario interno]_

| Derecho | Procedimiento interno |
|---------|----------------------|
| Acceso | Exportar filas `usuario` + logs vinculados vía soporte TI |
| Rectificación | Actualización en `usuario` (nombre/email) por admin |
| Cancelación / oposición | Baja lógica (`activo = false`) + evaluación de logs inmutables |
| Portabilidad | Export JSON bajo solicitud formal |

**Conflicto con logs inmutables (migr. 024):** coordinar con Legal — opciones: anonimización de campos identificativos manteniendo el evento.

---

## 6. Medidas de seguridad (resumen técnico)

- RLS PostgreSQL en todas las tablas principales.
- Whitelist de dominios email en producción (`VITE_ALLOWED_EMAIL_DOMAINS`).
- Sesión JWT con refresh silencioso; sin exponer errores de token al usuario.
- CSP en `vercel.json`; HSTS activo.
- Sin `sendDefaultPii` en Sentry.

---

## 7. Registro de actividades de tratamiento

Mantener matriz viva (Excel/Confluence) con:

- Finalidad, categorías, destinatarios, transferencias, plazos, medidas.

**Este documento no sustituye** el Registro formal exigido por la normativa.

---

## 8. Pendientes (checklist Legal)

- [ ] Aprobar textos de aviso al primer login / pie de app
- [ ] Firmar DPA con InsForge y Sentry
- [ ] Definir plazos de conservación y proceso ARCO
- [ ] Publicar política en intranet o ruta `/privacidad` si aplica

---

*Origen: auditoría `auditorias/auditoria_08062026.md` — Prioridad 3 ítem 13 (AUDIT-037).*
