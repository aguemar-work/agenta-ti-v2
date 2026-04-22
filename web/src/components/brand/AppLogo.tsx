import iconUrl from '@/assets/icon-nexora-png.png';
import logoUrl from '@/assets/logo-nexora.png';

type LogoProps = {
  /** Altura en px; el ancho escala con aspect ratio. */
  height?: number;
  className?: string;
};

/** Logo Nexora para cabeceras y pantallas de auth. */
export function AppLogo({ height = 32, className }: LogoProps) {
  return (
    <img
      src={logoUrl}
      alt="Nexora"
      height={height}
      className={className}
      style={{ height, width: 'auto', maxWidth: '100%', objectFit: 'contain' }}
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
