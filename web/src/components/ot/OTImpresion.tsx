/**
 * components/ot/OTImpresion.tsx
 * Documento imprimible compacto — media A4, mitad de página aprox.
 * - "ÁREA DE TI" en lugar de "Departamento de TI"
 * - "OT generado por Materen" al pie
 * - Diseño compacto: todo visible sin scroll en hoja A4
 */

import { useEffect } from 'react';

import type { OrdenTrabajo } from '@/api/ordenTrabajo';
import { ESTADO_OT_LABEL, MODALIDAD_OT_LABEL } from '@/lib/otConfig';
import '@/styles/ot-impresion.css';

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
                    <div className="ot-field ot-field--spaced">
                        <span className="ot-label">Descripción del trabajo</span>
                        <div className="ot-value tall ot-value--padded">{ot.descripcion}</div>
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
                        <div className="ot-field ot-field--spaced">
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
                    <p className="ot-footer">OT generado por Materen · {ot.numero} · {fechaEmision}</p>
                </div>
            </div>
        </>
    );
}
