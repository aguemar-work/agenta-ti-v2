import { MoreHorizontal } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

export type DropdownMenuItem = {
  id: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

type Props = {
  items: DropdownMenuItem[];
  triggerLabel?: string;
  triggerClassName?: string;
  align?: 'left' | 'right';
  iconSize?: number;
};

/** Menú contextual ⋯ — clases `mc-dropdown-menu` / `mc-dropdown-item`. */
export function DropdownMenu({
  items,
  triggerLabel = 'Más opciones',
  triggerClassName = 'mc-btn-icon-secondary',
  align = 'right',
  iconSize = 16,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!items.length) return null;

  return (
    <div className="mc-dropdown" ref={rootRef}>
      <button
        type="button"
        className={triggerClassName}
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <MoreHorizontal size={iconSize} aria-hidden />
      </button>
      {open && (
        <div
          id={menuId}
          className={[
            'mc-dropdown-menu',
            'mc-dropdown-menu--below',
            align === 'left' ? 'mc-dropdown-menu--left' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className={[
                'mc-dropdown-item',
                item.danger ? 'mc-dropdown-item--danger' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
