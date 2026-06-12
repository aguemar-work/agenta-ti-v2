import iconUrl from '@/assets/icon_materen.png';
import logoUrl from '@/assets/logo_materen.png';

type LogoProps = {
  /** Altura en px; el ancho escala con aspect ratio. */
  height?: number;
  className?: string;
};

/** Proporción aproximada del logo Materen (evita CLS al cargar). */
const LOGO_ASPECT = 280 / 52;

/** Logo Materen para cabeceras y pantallas de auth. */
export function AppLogo({ height = 32, className }: LogoProps) {
  const width = Math.round(height * LOGO_ASPECT);
  return (
    <img
      src={logoUrl}
      alt="Materen"
      width={width}
      height={height}
      className={className}
      style={{ height, width, maxWidth: '100%', objectFit: 'contain' }}
      decoding="async"
    />
  );
}

type IconProps = {
  size?: number;
  className?: string;
};

/** Marca cuadrada (misma imagen que favicon) para barra lateral u otros huecos pequeños. */
export function AppBrandIcon({ size = 28, className }: IconProps) {
  return (
    <img
      src={iconUrl}
      alt=""
      width={size}
      height={size}
      className={className}
      decoding="async"
      aria-hidden
    />
  );
}
