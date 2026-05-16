/**
 * Región aria-live global para anunciar actualizaciones (realtime, etc.) a lectores de pantalla.
 */
import { useEffect, useState } from 'react';

type Announcer = (message: string) => void;

let announcer: Announcer | null = null;

/** Anuncia un mensaje de forma no intrusiva (aria-live="polite"). */
export function announcePolitely(message: string) {
  const trimmed = message.trim();
  if (!trimmed) return;
  announcer?.(trimmed);
}

export function LiveRegion() {
  const [message, setMessage] = useState('');

  useEffect(() => {
    announcer = (msg) => {
      setMessage('');
      requestAnimationFrame(() => { setMessage(msg); });
    };
    return () => {
      announcer = null;
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}
