import { TareaCatalogoSelects } from '@/components/semana/TareaCatalogoSelects';
import type { Area } from '@/api/areas';
import type { Cliente } from '@/api/clientes';
import type { Proyecto } from '@/api/proyectos';
import type { Objetivo, Tarea, Usuario } from '@/types';

export type EditarTareaDraft = {
  titulo:     string;
  prioridad:  Tarea['prioridad'];
  descripcion: string;
  objetivoId: string;
  asignadoId: string;
  clienteId:  string;
  proyectoId: string;
  areaId:     string;
};

export const EDITAR_IDLE: EditarTareaDraft = {
  titulo: '', prioridad: 'media', descripcion: '',
  objetivoId: '', asignadoId: '', clienteId: '', proyectoId: '', areaId: '',
};

type Props = {
  form: EditarTareaDraft;
  onChange: (patch: Partial<EditarTareaDraft>) => void;
  objetivos: Pick<Objetivo, 'id' | 'titulo'>[];
  usuariosAsignables: Pick<Usuario, 'id' | 'nombre'>[];
  clientes: Pick<Cliente, 'id' | 'nombre'>[];
  proyectos: Pick<Proyecto, 'id' | 'nombre' | 'cliente_id'>[];
  areas: Pick<Area, 'id' | 'nombre'>[];
  moduloClientes: boolean;
  moduloProyectos: boolean;
  moduloAreas: boolean;
};

export function TareaEditarVista({
  form, onChange,
  objetivos, usuariosAsignables,
  clientes, proyectos, areas,
  moduloClientes, moduloProyectos, moduloAreas,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="mc-field">
        <label className="mc-field-label" htmlFor="edit-titulo">Título</label>
        <input
          id="edit-titulo"
          className="mc-input"
          value={form.titulo}
          onChange={(e) => onChange({ titulo: e.target.value })}
          autoFocus
          required
        />
      </div>

      <div className="mc-field">
        <label className="mc-field-label" htmlFor="edit-prioridad">Prioridad</label>
        <select
          id="edit-prioridad"
          className="mc-input"
          value={form.prioridad}
          onChange={(e) => onChange({ prioridad: e.target.value as Tarea['prioridad'] })}
        >
          <option value="baja">Baja</option>
          <option value="media">Media</option>
          <option value="alta">Alta</option>
          <option value="critica">Crítica</option>
        </select>
      </div>

      <div className="mc-field">
        <label className="mc-field-label" htmlFor="edit-desc">Descripción</label>
        <textarea
          id="edit-desc"
          className="mc-input"
          style={{ minHeight: 90, resize: 'vertical' }}
          value={form.descripcion}
          onChange={(e) => onChange({ descripcion: e.target.value })}
        />
      </div>

      <div className="mc-field">
        <label className="mc-field-label" htmlFor="edit-objetivo">Objetivo</label>
        <select
          id="edit-objetivo"
          className="mc-input"
          value={form.objetivoId}
          onChange={(e) => onChange({ objetivoId: e.target.value })}
        >
          <option value="">Sin objetivo</option>
          {objetivos.map((o) => (
            <option key={o.id} value={o.id}>{o.titulo}</option>
          ))}
        </select>
      </div>

      {usuariosAsignables.length > 0 && (
        <div className="mc-field">
          <label className="mc-field-label" htmlFor="edit-resp">Responsable</label>
          <select
            id="edit-resp"
            className="mc-input"
            value={form.asignadoId}
            onChange={(e) => onChange({ asignadoId: e.target.value })}
          >
            {usuariosAsignables.map((u) => (
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </select>
        </div>
      )}

      <TareaCatalogoSelects
        idPrefix="edit"
        values={{ clienteId: form.clienteId, proyectoId: form.proyectoId, areaId: form.areaId }}
        onChange={onChange}
        clientes={clientes}
        proyectos={proyectos}
        areas={areas}
        moduloClientes={moduloClientes}
        moduloProyectos={moduloProyectos}
        moduloAreas={moduloAreas}
        allowClear={false}
      />
    </div>
  );
}
