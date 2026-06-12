/**
 * components/ui/Skeletons.tsx
 * Skeleton loaders reutilizables — reemplazan los "Cargando…" de texto.
 *
 * Uso:
 *   import { SkeletonTarea, SkeletonCard, SkeletonKanbanCol, SkeletonList } from '@/components/ui/Skeletons';
 *
 * Todos usan la clase .mc-skeleton definida en sprint4.css.
 */

// ---------------------------------------------------------------------------
// Primitivo base
// ---------------------------------------------------------------------------
function Bone({ w = '100%', h = 14, radius = 6 }: { w?: string | number; h?: number; radius?: number }) {
    return (
        <div
            className="mc-skeleton"
            style={{ width: w, height: h, borderRadius: radius, flexShrink: 0 }}
        />
    );
}

// ---------------------------------------------------------------------------
// SkeletonTarea — imita TaskItem variant="week"
// ---------------------------------------------------------------------------
export function SkeletonTarea() {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '10px 12px',
                borderRadius: 'var(--mc-radius-md)',
                border: '1px solid var(--mc-color-border)',
                background: 'var(--mc-color-surface)',
            }}
            aria-hidden="true"
        >
            <Bone w="70%" h={14} />
            <div style={{ display: 'flex', gap: 6 }}>
                <Bone w={60} h={12} radius={10} />
                <Bone w={80} h={12} radius={10} />
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// SkeletonTareaList — N tareas apiladas
// ---------------------------------------------------------------------------
export function SkeletonTareaList({ count = 3 }: { count?: number }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-busy="true" aria-label="Cargando tareas">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonTarea key={i} />
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// SkeletonCard — card genérica (objetivos, logs, entidades)
// ---------------------------------------------------------------------------
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '12px 16px',
                borderRadius: 'var(--mc-radius-lg)',
                border: '1px solid var(--mc-color-border)',
                background: 'var(--mc-color-surface)',
            }}
            aria-hidden="true"
        >
            <Bone w="55%" h={14} />
            {lines >= 2 && <Bone w="80%" h={12} />}
            {lines >= 3 && <Bone w="40%" h={12} />}
        </div>
    );
}

export function SkeletonCardList({ count = 3, lines = 2 }: { count?: number; lines?: number }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-busy="true" aria-label="Cargando">
            {Array.from({ length: count }).map((_, i) => (
                <SkeletonCard key={i} lines={lines} />
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// SkeletonKanbanCol — imita una columna del tablero
// ---------------------------------------------------------------------------
export function SkeletonKanbanCol({ count = 3 }: { count?: number }) {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: '8px',
            }}
            aria-hidden="true"
        >
            {Array.from({ length: count }).map((_, i) => (
                <div
                    key={i}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        padding: '10px 12px',
                        borderRadius: 'var(--mc-radius-md)',
                        border: '1px solid var(--mc-color-border)',
                        background: 'var(--mc-color-surface)',
                    }}
                >
                    <Bone w="75%" h={13} />
                    <div style={{ display: 'flex', gap: 6 }}>
                        <Bone w={50} h={11} radius={10} />
                        <Bone w={70} h={11} radius={10} />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// SkeletonRow — fila de tabla (planificación, logs)
// ---------------------------------------------------------------------------
export function SkeletonRow({ cols = 4 }: { cols?: number }) {
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: 12,
                padding: '12px 16px',
                borderBottom: '1px solid var(--mc-color-border)',
                alignItems: 'center',
            }}
            aria-hidden="true"
        >
            {Array.from({ length: cols }).map((_, i) => (
                <Bone key={i} w={i === 0 ? '80%' : '60%'} h={12} />
            ))}
        </div>
    );
}

// ---------------------------------------------------------------------------
// SkeletonSemanaGrilla — columnas de Mi Semana (1 móvil / 6 desktop)
// ---------------------------------------------------------------------------
export function SkeletonSemanaGrilla() {
  return (
    <div
      className="grid min-h-[220px] flex-1 grid-cols-1 gap-3 md:grid-cols-6"
      aria-busy="true"
      aria-label="Cargando agenda"
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className={[
            'flex flex-col gap-2 rounded-[var(--mc-radius-lg)] border border-[var(--mc-color-border)] p-3',
            i === 0 ? 'flex' : 'hidden md:flex',
          ].join(' ')}
          aria-hidden={i > 0}
        >
          <Bone w="50%" h={12} />
          <SkeletonTareaList count={2} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 3, cols = 4 }: { rows?: number; cols?: number }) {
    return (
        <div
            style={{ borderRadius: 'var(--mc-radius-lg)', border: '1px solid var(--mc-color-border)', overflow: 'hidden' }}
            aria-busy="true"
            aria-label="Cargando"
        >
            {Array.from({ length: rows }).map((_, i) => (
                <SkeletonRow key={i} cols={cols} />
            ))}
        </div>
    );
}