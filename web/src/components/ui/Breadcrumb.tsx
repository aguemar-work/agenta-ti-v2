type Crumb = {
  label: string;
  current?: boolean;
};

type Props = {
  items: Crumb[];
};

/** Migas mínimas para overlays de 2+ niveles (solo lectura). */
export function Breadcrumb({ items }: Props) {
  if (items.length < 2) return null;

  return (
    <nav className="mc-breadcrumb" aria-label="Ubicación">
      {items.map((item, i) => (
        <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
          {i > 0 ? <span className="mc-breadcrumb__sep" aria-hidden>/</span> : null}
          <span className={item.current ? 'mc-breadcrumb__current' : undefined}>{item.label}</span>
        </span>
      ))}
    </nav>
  );
}
