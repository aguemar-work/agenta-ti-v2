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

function crearCliente(): InsForgeClient {
  const { baseUrl, anonKey } = readEnv();
  return createClient({
    baseUrl,
    anonKey,
    autoRefreshToken: true,
  });
}

/**
 * Cliente InsForge singleton (sesión y PostgREST). Requiere `.env` con variables VITE_*.
 *
 * El header `x-workspace-id` lo inyecta `insforgeFetchInterceptor` en cada petición
 * de base de datos leyendo `getWorkspaceId()` en tiempo de request — no al crear el cliente.
 * Esto evita la carrera de sesión que ocurría al recrear el cliente cuando cambiaba el wsId:
 * el nuevo cliente arrancaba sin token (SDK lo restaura async) y la primera RPC iba como anon.
 *
 * Sesión: el SDK gestiona tokens en almacenamiento del navegador — no en authStore (solo perfil `usuario`).
 * Mitigación V4: CSP en vercel.json, sin secretos en Zustand, interceptor 401, refresh automático.
 * httpOnly cookies requerirían proxy de auth propio (fuera de alcance SPA + InsForge BaaS).
 */
export function getInsforge(): InsForgeClient {
  if (!client) {
    client = crearCliente();
  }
  return client;
}
