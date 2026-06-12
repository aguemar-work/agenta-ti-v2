import iconUrl from '@/assets/icon_materen.png';

/** Favicon y apple-touch-icon desde assets (URLs resueltas por Vite). */
export function setAppIcons(): void {
  const head = document.head;

  const ensureLink = (rel: string, sizes?: string) => {
    let el = head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement('link');
      el.rel = rel;
      head.appendChild(el);
    }
    el.href = iconUrl;
    el.type = 'image/png';
    if (sizes) el.setAttribute('sizes', sizes);
    else el.removeAttribute('sizes');
  };

  ensureLink('icon');
  ensureLink('apple-touch-icon', '180x180');
}
