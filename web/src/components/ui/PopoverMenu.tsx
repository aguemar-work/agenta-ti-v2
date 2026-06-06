import type { LucideIcon } from 'lucide-react';
import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type PopoverMenuItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
};

type Coords = {
  top: number;
  left: number;
  placement: 'above' | 'below';
};

type Props = {
  items: PopoverMenuItem[];
  trigger: ReactNode;
  menuMinWidth?: number;
};

const MENU_GAP = 4;
const MENU_EST_H = 132;

/** Menú anclado por portal (fixed) — no altera el layout de la card. */
export function PopoverMenu({ items, trigger, menuMinWidth = 168 }: Props) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords>({ top: 0, left: 0, placement: 'below' });
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const calcularPosicion = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const abrirArriba = spaceBelow < MENU_EST_H + MENU_GAP && rect.top > MENU_EST_H;
    const left = Math.max(8, rect.right - menuMinWidth);
    setCoords({
      top: abrirArriba ? rect.top - MENU_GAP : rect.bottom + MENU_GAP,
      left,
      placement: abrirArriba ? 'above' : 'below',
    });
  }, [menuMinWidth]);

  useLayoutEffect(() => {
    if (!open) return;
    calcularPosicion();
    window.addEventListener('resize', calcularPosicion);
    window.addEventListener('scroll', calcularPosicion, true);
    return () => {
      window.removeEventListener('resize', calcularPosicion);
      window.removeEventListener('scroll', calcularPosicion, true);
    };
  }, [open, calcularPosicion]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      const menu = document.getElementById(menuId);
      if (menu?.contains(t)) return;
      setOpen(false);
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
  }, [open, menuId]);

  if (!items.length) return null;

  const triggerNode =
    isValidElement(trigger)
      ? cloneElement(trigger as ReactElement<Record<string, unknown>>, {
          'aria-expanded': open,
          'aria-haspopup': 'menu',
          'aria-controls': menuId,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            const orig = (trigger as ReactElement<{ onClick?: (ev: React.MouseEvent) => void }>).props
              .onClick;
            orig?.(e);
            setOpen((v) => !v);
          },
        })
      : trigger;

  return (
    <div className="mc-popover-menu" ref={triggerRef}>
      {triggerNode}
      {open &&
        createPortal(
          <div
            id={menuId}
            role="menu"
            className="mc-dropdown-menu mc-dropdown-menu--portal"
            style={{
              top: coords.top,
              left: coords.left,
              minWidth: menuMinWidth,
              transform: coords.placement === 'above' ? 'translateY(-100%)' : undefined,
              transformOrigin: coords.placement === 'above' ? 'bottom right' : 'top right',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  className={[
                    'mc-dropdown-item',
                    'mc-dropdown-item--with-icon',
                    item.danger ? 'mc-dropdown-item--danger' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => {
                    setOpen(false);
                    item.onClick();
                  }}
                >
                  {Icon ? <Icon size={14} aria-hidden className="mc-dropdown-item__icon" /> : null}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
