/** Primera línea de la nota como título sugerido al convertir. */
export function tituloDesdeNota(contenido: string, maxLen = 120): string {
  const line = contenido.trim().split('\n')[0]?.trim() ?? '';
  if (!line) return 'Sin título';
  if (line.length <= maxLen) return line;
  return `${line.slice(0, maxLen - 1)}…`;
}

/** Resto del contenido como descripción (tareas). */
export function descripcionDesdeNota(contenido: string): string {
  const lines = contenido.trim().split('\n');
  if (lines.length <= 1) return '';
  return lines.slice(1).join('\n').trim();
}

export function etiquetaConvertidaEn(tipo: 'tarea' | 'evento'): string {
  return tipo === 'tarea' ? 'Convertida en tarea' : 'Convertida en evento';
}
