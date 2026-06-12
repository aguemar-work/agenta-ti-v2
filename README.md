# Materen — SGTD (Agenda TI v3)

Monorepo del **Sistema de Gestión de Tareas Departamental** (marca **Materen**).

| Directorio | Contenido |
|------------|-----------|
| [`web/`](web/) | SPA React 19 + Vite 8 (frontend) |
| [`db/`](db/) | Migraciones SQL, schema referencia, runbooks |
| [`web/auditorias/`](web/auditorias/) | Informes de auditoría y deuda técnica |
| [`.cursor/rules/`](.cursor/rules/) | Reglas de stack, negocio, UI y checklist de migraciones |

## Inicio rápido

```bash
cd web
cp .env.example .env   # completar VITE_INSFORGE_*
npm install
npm run dev
```

Documentación detallada: [`web/README.md`](web/README.md) · Schema: [`web/CONTEXT/CONTEXT.md`](web/CONTEXT/CONTEXT.md)

## Backend

Datos en **[InsForge](https://insforge.dev)** (PostgreSQL + Auth + RLS). Skills del agente en `.agents/skills/insforge*`; credenciales CLI en `.insforge/project.json`, app en `web/.env`.

## Licencia

Software propietario — ver [`LICENSE`](LICENSE).
