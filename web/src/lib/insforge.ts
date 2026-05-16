import { createClient, type InsForgeClient } from '@insforge/sdk';

let client: InsForgeClient | null = null;

/** Lectura segura de env (no lanza). Úsala antes de montar auth o el interceptor. */
export function getInsforgeEnv(): { baseUrl: string; anonKey: string } | null {
  const baseUrl = (import.meta.env.VITE_INSFORGE_URL as string | undefined)?.trim();
  const anonKey = (import.meta.env.VITE_INSFORGE_ANON_KEY as string | undefined)?.trim();
  if (!baseUrl || !anonKey) return null;
  return { baseUrl: baseUrl.replace(/\/$/, ''), anonKey };
}

function readEnv(): { baseUrl: string; anonKey: string } {
  const env = getInsforgeEnv();
  if (!env) {
    throw new Error(
      'Faltan VITE_INSFORGE_URL o VITE_INSFORGE_ANON_KEY. Copia .env.example a .env y completa los valores.',
    );
  }
  return env;
}

/**
 * Cliente singleton InsForge (sesión y PostgREST). Requiere `.env` con variables VITE_*.
 *
 * Sesión: el SDK gestiona tokens en almacenamiento del navegador — no en authStore (solo perfil `usuario`).
 * Mitigación V4: CSP en vercel.json, sin secretos en Zustand, interceptor 401, refresh automático.
 * httpOnly cookies requerirían proxy de auth propio (fuera de alcance SPA + InsForge BaaS).
 */
export function getInsforge(): InsForgeClient {
  if (!client) {
    const { baseUrl, anonKey } = readEnv();
    client = createClient({
      baseUrl,
      anonKey,
      autoRefreshToken: true,
    });
  }
  return client;
}
