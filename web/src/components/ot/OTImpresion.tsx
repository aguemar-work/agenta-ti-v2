/**
 * components/ot/OTImpresion.tsx
 * Documento imprimible compacto — media A4, mitad de página aprox.
 * - "ÁREA DE TI" en lugar de "Departamento de TI"
 * - "OT generado por Nexora" al pie
 * - Diseño compacto: todo visible sin scroll en hoja A4
 */

import { useEffect } from 'react';
import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { ESTADO_OT_LABEL, MODALIDAD_OT_LABEL } from '@/lib/otConfig';

type Props = { ot: OrdenTrabajo; onClose: () => void };

export function OTImpresion({ ot, onClose }: Props) {
    useEffect(() => {
        const t = setTimeout(() => window.print(), 300);
        return () => clearTimeout(t);
    }, []);

    const fechaEmision = new Date(ot.created_at).toLocaleDateString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
    });

    return (
        <>
            <style>{`
        @media print {
          body > *:not(#ot-print-root) { display: none !important; }
          #ot-print-root { display: block !important; }
          @page { size: A4; margin: 15mm; }
          .ot-close-btn { display: none !important; }
        }
        @media screen {
          #ot-print-root {
            position: fixed; inset: 0; z-index: 9999;
            background: rgba(0,0,0,0.5);
            display: flex; align-items: flex-start; justify-content: center;
            overflow-y: auto; padding: 24px 16px;
          }
        }

        .ot-close-btn {
          position: fixed; top: 12px; right: 12px;
          background: #fff; border: 1px solid #ccc;
          border-radius: 8px; padding: 6px 14px;
          cursor: pointer; font-size: 13px; font-weight: 500;
          z-index: 10000; font-family: system-ui, sans-serif;
        }

        .ot-doc {
          background: #fff;
          width: 180mm;
          padding: 12mm;
          box-sizing: border-box;
          font-family: 'Inter', Arial, sans-serif;
          font-size: 9.5pt;
          color: #050505;
        }

        /* Encabezado */
        .ot-head {
          display: flex; justify-content: space-between; align-items: flex-start;
          border-bottom: 2px solid #050505; padding-bottom: 6px; margin-bottom: 8px;
        }
        .ot-head-left p { margin: 0; line-height: 1.4; }
        .ot-area { font-size: 8pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #65676B; }
        .ot-title { font-size: 15pt; font-weight: 700; }
        .ot-numero { font-size: 11pt; font-weight: 600; color: #0064E0; font-family: monospace; }
        .ot-head-right { text-align: right; }
        .ot-estado-badge {
          display: inline-block; padding: 2px 8px;
          border: 1.5px solid #050505; border-radius: 4px;
          font-size: 8.5pt; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .ot-meta { font-size: 8pt; color: #65676B; margin-top: 4px; }

        /* Grid de campos */
        .ot-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; margin-bottom: 6px; }
        .ot-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px 8px; margin-bottom: 6px; }
        .ot-field { padding: 3px 0; }
        .ot-label { font-size: 7.5pt; color: #65676B; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 1px; }
        .ot-value { font-size: 9.5pt; border-bottom: 0.5px solid #CED2D9; padding-bottom: 1px; min-height: 4mm; }
        .ot-value.tall { min-height: 10mm; }

        /* Sección */
        .ot-section { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #65676B; border-bottom: 0.5px solid #CED2D9; padding-bottom: 2px; margin: 8px 0 5px; }

        /* Firmas */
        .ot-firmas { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8mm; margin-top: 8mm; }
        .ot-firma {
          border: 0.5px solid #CED2D9; border-radius: 4px;
          padding: 4px 6px 6px;
          display: flex; flex-direction: column; min-height: 28mm;
        }
        .ot-firma-role { font-size: 7.5pt; font-weight: 700; color: #65676B; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px; }
        .ot-firma-name { font-size: 9pt; font-weight: 500; margin-bottom: 3px; }
        .ot-firma-campo { font-size: 8pt; color: #65676B; margin-bottom: 1px; }
        .ot-firma-linea { border-top: 0.8px solid #050505; margin-top: auto; padding-top: 3px; font-size: 7.5pt; color: #65676B; text-align: center; }

        /* Pie */
        .ot-footer { margin-top: 6mm; font-size: 7.5pt; color: #8D949E; text-align: center; border-top: 0.5px solid #E4E6EB; padding-top: 3px; }
      `}</style>

            <div id="ot-print-root">
                <button className="ot-close-btn" type="button" onClick={onClose}>✕ Cerrar</button>

                <div className="ot-doc">

                    {/* Encabezado */}
                    <div className="ot-head">
                        <div className="ot-head-left">
                            <p className="ot-area">Área de TI</p>
                            <p className="ot-title">Orden de Trabajo</p>
                            <p className="ot-numero">{ot.numero}</p>
                        </div>
                        <div className="ot-head-right">
                            <span className="ot-estado-badge">{ESTADO_OT_LABEL[ot.estado]}</span>
                            <p className="ot-meta">Emisión: {fechaEmision}</p>
                            {ot.fecha_aprobacion && (
                                <p className="ot-meta">Aprobada: {new Date(ot.fecha_aprobacion).toLocaleDateString('es-PE')}</p>
                            )}
                        </div>
                    </div>

                    {/* Técnico y tipo */}
                    <div className="ot-grid-2">
                        <div className="ot-field">
                            <span className="ot-label">Técnico responsable</span>
                            <div className="ot-value">{ot.creador?.nombre ?? ''}</div>
                        </div>
                        <div className="ot-field">
                            <span className="ot-label">Tipo de trabajo</span>
                            <div className="ot-value">{ot.tipo_trabajo?.nombre ?? '—'}</div>
                        </div>
                    </div>

                    {/* Descripción */}
                    <div className="ot-field" style={{ marginBottom: 6 }}>
                        <span className="ot-label">Descripción del trabajo</span>
                        <div className="ot-value tall" style={{ padding: '2px 0' }}>{ot.descripcion}</div>
                    </div>

                    {/* Destino y modalidad */}
                    <div className="ot-grid-3">
                        <div className="ot-field">
                            <span className="ot-label">Área / Oficina</span>
                            <div className="ot-value">{ot.area_destino}</div>
                        </div>
                        <div className="ot-field">
                            <span className="ot-label">Ubicación</span>
                            <div className="ot-value">{ot.ubicacion ?? '—'}</div>
                        </div>
                        <div className="ot-field">
                            <span className="ot-label">Modalidad</span>
                            <div className="ot-value">{MODALIDAD_OT_LABEL[ot.modalidad]}</div>
                        </div>
                    </div>

                    {/* Fecha y duración */}
                    <div className="ot-grid-3">
                        <div className="ot-field">
                            <span className="ot-label">Fecha estimada</span>
                            <div className="ot-value">{ot.fecha_estimada}</div>
                        </div>
                        <div className="ot-field">
                            <span className="ot-label">Hora inicio</span>
                            <div className="ot-value">{ot.hora_inicio_est ?? '—'}</div>
                        </div>
                        <div className="ot-field">
                            <span className="ot-label">Duración est.</span>
                            <div className="ot-value">{ot.duracion_est_min ? `${ot.duracion_est_min} min` : '—'}</div>
                        </div>
                    </div>

                    {/* Equipos/materiales (solo si hay) */}
                    {ot.equipos_materiales && (
                        <div className="ot-field" style={{ marginBottom: 6 }}>
                            <span className="ot-label">Equipos / Materiales</span>
                            <div className="ot-value">{ot.equipos_materiales}</div>
                        </div>
                    )}

                    {/* Registro de ejecución */}
                    <div className="ot-section">Registro de ejecución</div>
                    <div className="ot-grid-2">
                        <div className="ot-field">
                            <span className="ot-label">Inicio real</span>
                            <div className="ot-value">
                                {ot.fecha_inicio_real ? new Date(ot.fecha_inicio_real).toLocaleString('es-PE') : '________________________'}
                            </div>
                        </div>
                        <div className="ot-field">
                            <span className="ot-label">Fin real</span>
                            <div className="ot-value">
                                {ot.fecha_fin_real ? new Date(ot.fecha_fin_real).toLocaleString('es-PE') : '________________________'}
                            </div>
                        </div>
                    </div>
                    <div className="ot-field">
                        <span className="ot-label">Observaciones de cierre</span>
                        <div className="ot-value tall">{ot.observaciones_cierre ?? ''}</div>
                    </div>

                    {/* Firmas */}
                    <div className="ot-firmas">
                        {/* Técnico */}
                        <div className="ot-firma">
                            <p className="ot-firma-role">Técnico</p>
                            <p className="ot-firma-name">{ot.creador?.nombre ?? ''}</p>
                            <div className="ot-firma-linea">Firma</div>
                        </div>

                        {/* Receptor */}
                        <div className="ot-firma">
                            <p className="ot-firma-role">Receptor del área</p>
                            <p className="ot-firma-campo">Nombre: {ot.receptor_nombre ?? '____________________'}</p>
                            <p className="ot-firma-campo">DNI: {ot.receptor_dni ?? '____________'}</p>
                            <p className="ot-firma-campo">Cargo: {ot.receptor_cargo ?? '________________'}</p>
                            <div className="ot-firma-linea">Firma</div>
                        </div>

                        {/* Jefe */}
                        <div className="ot-firma">
                            <p className="ot-firma-role">Jefe de TI</p>
                            <p className="ot-firma-name">{ot.aprobador?.nombre ?? ''}</p>
                            <div className="ot-firma-linea">V°B° / Firma</div>
                        </div>
                    </div>

                    {/* Pie */}
                    <p className="ot-footer">OT generado por Nexora · {ot.numero} · {fechaEmision}</p>
                </div>
            </div>
        </>
    );
}