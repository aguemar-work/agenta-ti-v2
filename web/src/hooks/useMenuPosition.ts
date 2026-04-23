/**
 * hooks/useMenuPosition.ts
 * Resuelve hallazgo 2.4: menús contextuales que se cortan fuera del viewport.
 *
 * Detecta si hay espacio suficiente abajo/arriba y derecha/izquierda del botón
 * trigger, y devuelve el estilo de posición correcto para el menú.
 *
 * Uso:
 *   const { triggerRef, menuStyle, abrirMenu } = useMenuPosition(menuAbierto);
 *
 *   <div ref={triggerRef}>
 *     <button onClick={abrirMenu}>···</button>
 *     {menuAbierto && (
 *       <div style={menuStyle} className="absolute z-20 ...">...</div>
 *     )}
 *   </div>
 */

import { useCallback, useRef, useState } from 'react';

type MenuStyle = {
    position: 'absolute';
    top?: number | string;
    bottom?: number | string;
    left?: number | string;
    right?: number | string;
    zIndex: number;
};

const MENU_W = 160; // min-width del menú en px
const MENU_H = 140; // altura estimada del menú en px
const GAP = 4;   // gap entre trigger y menú

export function useMenuPosition() {
    const triggerRef = useRef<HTMLDivElement>(null);
    const [menuStyle, setMenuStyle] = useState<MenuStyle>({
        position: 'absolute',
        top: '100%',
        right: 0,
        zIndex: 20,
    });

    const calcularPosicion = useCallback(() => {
        const el = triggerRef.current;
        if (!el) return;

        const rect = el.getBoundingClientRect();
        const vh = window.innerHeight;

        const hayEspacioAbajo = rect.bottom + MENU_H + GAP <= vh;
        const hayEspacioDerecha = rect.right - MENU_W >= 0;

        const style: MenuStyle = { position: 'absolute', zIndex: 20 };

        // Vertical
        if (hayEspacioAbajo) {
            style.top = `calc(100% + ${GAP}px)`;
        } else {
            style.bottom = `calc(100% + ${GAP}px)`;
        }

        // Horizontal
        if (hayEspacioDerecha) {
            style.right = 0;
        } else {
            style.left = 0;
        }

        setMenuStyle(style);
    }, []);

    return { triggerRef, menuStyle, calcularPosicion };
}