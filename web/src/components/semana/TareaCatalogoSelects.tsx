import { useMemo } from 'react';

import { SelectInput } from '@/components/ui/SelectInput';
import type { Area } from '@/api/areas';
import type { Cliente } from '@/api/clientes';
import type { Proyecto } from '@/api/proyectos';

export type TareaCatalogoValues = {
  clienteId: string;
  proyectoId: string;
  areaId: string;
};

type Props = {
  idPrefix: string;
  values: TareaCatalogoValues;
  onChange: (patch: Partial<TareaCatalogoValues>) => void;
  clientes: Pick<Cliente, 'id' | 'nombre'>[];
  proyectos: Pick<Proyecto, 'id' | 'nombre' | 'cliente_id'>[];
  areas: Pick<Area, 'id' | 'nombre'>[];
  moduloClientes: boolean;
  moduloProyectos: boolean;
  moduloAreas: boolean;
  /**
   * false en edición: oculta "Sin X" cuando ya hay valor (sgtd_actualizar_tarea usa COALESCE).
   * TODO: limpiar catálogo en edición requiere RPC que distinga null-no-tocar vs null-limpiar.
   */
  allowClear?: boolean;
};

function muestraOpcionVacia(allowClear: boolean, valorActual: string): boolean {
  return allowClear || !valorActual;
}

export function TareaCatalogoSelects({
  idPrefix,
  values,
  onChange,
  clientes,
  proyectos,
  areas,
  moduloClientes,
  moduloProyectos,
  moduloAreas,
  allowClear = true,
}: Props) {
  const proyectosFiltrados = useMemo(() => {
    if (!values.clienteId) return proyectos;
    return proyectos.filter((p) => p.cliente_id === values.clienteId);
  }, [proyectos, values.clienteId]);

  if (!moduloClientes && !moduloProyectos && !moduloAreas) return null;

  return (
    <>
      {moduloClientes && (
        <div className="mc-field">
          <label className="mc-field-label" htmlFor={`${idPrefix}-cliente`}>
            Cliente
          </label>
          <SelectInput
            id={`${idPrefix}-cliente`}
            value={values.clienteId}
            onChange={(e) => {
              const nuevoClienteId = e.target.value;
              const proyectoActual = proyectos.find((pr) => pr.id === values.proyectoId);
              const proyectoInvalido = Boolean(
                nuevoClienteId
                && proyectoActual
                && proyectoActual.cliente_id !== nuevoClienteId,
              );
              onChange({
                clienteId: nuevoClienteId,
                ...(proyectoInvalido ? { proyectoId: '' } : {}),
              });
            }}
          >
            {muestraOpcionVacia(allowClear, values.clienteId) ? (
              <option value="">Sin cliente</option>
            ) : null}
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </SelectInput>
        </div>
      )}
      {moduloProyectos && (
        <div className="mc-field">
          <label className="mc-field-label" htmlFor={`${idPrefix}-proyecto`}>
            Proyecto
          </label>
          <SelectInput
            id={`${idPrefix}-proyecto`}
            value={values.proyectoId}
            onChange={(e) => onChange({ proyectoId: e.target.value })}
          >
            {muestraOpcionVacia(allowClear, values.proyectoId) ? (
              <option value="">Sin proyecto</option>
            ) : null}
            {proyectosFiltrados.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </SelectInput>
        </div>
      )}
      {moduloAreas && (
        <div className="mc-field">
          <label className="mc-field-label" htmlFor={`${idPrefix}-area`}>
            Área
          </label>
          <SelectInput
            id={`${idPrefix}-area`}
            value={values.areaId}
            onChange={(e) => onChange({ areaId: e.target.value })}
          >
            {muestraOpcionVacia(allowClear, values.areaId) ? (
              <option value="">Sin área</option>
            ) : null}
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.nombre}</option>
            ))}
          </SelectInput>
        </div>
      )}
    </>
  );
}
