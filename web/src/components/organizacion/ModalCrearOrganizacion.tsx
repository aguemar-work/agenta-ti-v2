/**
 * ModalCrearOrganizacion — bootstrap org + workspace vía RPC sgtd_crear_organizacion.
 * Módulos libres (045): cualquier combinación del catálogo; obligatorios fijos.
 */

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { CrearOrgResult } from '@/api/organizacion';
import { Button, CancelButton } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useCrearOrganizacion } from '@/hooks/useCrearOrganizacion';
import {
  CATALOGO_MODULOS,
  MODULOS_OBLIGATORIOS,
  slugify,
} from '@/lib/modulos';

const SLUG_PATTERN = /^[a-z0-9-]+$/;
/** Valor fijo enviado a sgtd_crear_organizacion (el usuario ya no elige tipo en UI). */
const TIPO_WORKSPACE_DEFAULT = 'interno' as const;

type Props = {
  open: boolean;
  onClose: () => void;
  onCreada: (result: CrearOrgResult) => void;
};

function mensajeError(err: unknown): string {
  if (err instanceof Error && err.message.trim()) return err.message;
  const msg = (err as { message?: string })?.message;
  if (typeof msg === 'string' && msg.trim()) return msg;
  return 'No se pudo crear la organización.';
}

function modulosIniciales(): Set<string> {
  return new Set(MODULOS_OBLIGATORIOS);
}

export function ModalCrearOrganizacion({ open, onClose, onCreada }: Props) {
  const [nombre, setNombre] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [modulosSeleccionados, setModulosSeleccionados] = useState<Set<string>>(modulosIniciales);

  const { mutate, isPending, reset: resetMutation } = useCrearOrganizacion((result) => {
    toast.success('Organización creada');
    onCreada(result);
    onClose();
  });

  useEffect(() => {
    if (!open) return;
    setNombre('');
    setSlug('');
    setSlugManual(false);
    setModulosSeleccionados(modulosIniciales());
    resetMutation();
  }, [open, resetMutation]);

  function handleNombreChange(value: string) {
    setNombre(value);
    if (!slugManual) setSlug(slugify(value));
  }

  function handleSlugChange(value: string) {
    setSlugManual(true);
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
  }

  function toggleModulo(clave: string, obligatorio: boolean) {
    if (obligatorio) return;
    setModulosSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(clave)) next.delete(clave);
      else next.add(clave);
      return next;
    });
  }

  const slugValido = slug.trim().length > 0 && SLUG_PATTERN.test(slug.trim());
  const canSubmit = nombre.trim().length > 0 && slugValido && !isPending;

  const hasUnsavedChanges = useMemo(() => {
    if (nombre.trim()) return true;
    if (slugManual && slug.trim()) return true;
    const opcionales = CATALOGO_MODULOS.filter((m) => !m.obligatorio);
    return opcionales.some((m) => modulosSeleccionados.has(m.clave));
  }, [nombre, slug, slugManual, modulosSeleccionados]);

  function cerrar() {
    onClose();
  }

  function submit() {
    if (!canSubmit) return;
    mutate(
      {
        nombre: nombre.trim(),
        slug:   slug.trim(),
        tipo: TIPO_WORKSPACE_DEFAULT,
        modulos: Array.from(modulosSeleccionados),
      },
      {
        onError: (err) => {
          console.error('[ModalCrearOrganizacion]', err);
          toast.error(mensajeError(err));
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      onClose={cerrar}
      title="Nueva organización"
      analyticsId="modal-crear-organizacion"
      size="md"
      hasUnsavedChanges={hasUnsavedChanges}
      bodyClassName="mc-modal-form"
      footerClassName="mc-modal-footer--stack"
      description="Crea una organización con su espacio de trabajo principal. Elige los módulos que necesites."
      footer={(
        <>
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={isPending}
            disabled={!canSubmit}
            onClick={() => submit()}
          >
            Crear organización
          </Button>
          <CancelButton onClick={cerrar} disabled={isPending} />
        </>
      )}
    >
      <div className="flex flex-col gap-[14px]">
        <div className="mc-field">
          <label className="mc-field-label" htmlFor="org-nombre">
            Nombre
          </label>
          <input
            id="org-nombre"
            className="mc-input"
            value={nombre}
            onChange={(e) => handleNombreChange(e.target.value)}
            autoFocus
            required
            autoComplete="organization"
          />
        </div>

        <div className="mc-field">
          <label className="mc-field-label" htmlFor="org-slug">
            Identificador (slug)
          </label>
          <input
            id="org-slug"
            className="mc-input"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            required
            spellCheck={false}
            autoComplete="off"
            aria-describedby="org-slug-hint"
          />
          <p id="org-slug-hint" className="mc-field-hint">
            Solo minúsculas, números y guiones. Se usa en URLs internas.
          </p>
        </div>

        <fieldset className="mc-field border-0 p-0 m-0">
          <legend className="mc-field-label mb-2">Módulos activos</legend>
          <ul className="flex flex-col gap-2">
            {CATALOGO_MODULOS.map((mod) => {
              const activo = modulosSeleccionados.has(mod.clave);
              return (
                <li key={mod.clave}>
                  <label
                    className={
                      mod.obligatorio
                        ? 'flex cursor-default items-start gap-2 rounded-md border border-[var(--mc-color-border)] px-3 py-2 opacity-90'
                        : 'flex cursor-pointer items-start gap-2 rounded-md border border-[var(--mc-color-border)] px-3 py-2'
                    }
                  >
                    <input
                      type="checkbox"
                      className="mc-checkbox mt-0.5"
                      checked={activo}
                      disabled={mod.obligatorio || isPending}
                      onChange={() => toggleModulo(mod.clave, mod.obligatorio)}
                      aria-disabled={mod.obligatorio || undefined}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--mc-color-text)]">
                        {mod.nombre}
                        {mod.obligatorio && (
                          <span className="mc-badge mc-badge-neutral text-[10px]">Incluido</span>
                        )}
                      </span>
                      <span className="text-xs text-[var(--mc-color-text-secondary)]">
                        {mod.descripcion}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      </div>
    </Modal>
  );
}
