import type { UserSchema } from '@insforge/sdk';

import { getInsforge } from '@/lib/insforge';
import type { Usuario } from '@/types';

// ---------------------------------------------------------------------------
// Whitelist de dominios permitidos.
// Define VITE_ALLOWED_EMAIL_DOMAINS en .env como lista separada por comas:
//   VITE_ALLOWED_EMAIL_DOMAINS=empresa.com,contratistas.empresa.com
// Si la variable no está definida, cualquier dominio es aceptado (útil en dev).
// En producción SIEMPRE define esta variable.
// ---------------------------------------------------------------------------
const ALLOWED_DOMAINS: string[] | null = (() => {
  const raw = (import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS as string | undefined)?.trim();
  if (!raw) {
    if (import.meta.env.PROD) {
      throw new Error(
        'VITE_ALLOWED_EMAIL_DOMAINS no está configurado. Define los dominios permitidos en Vercel.',
      );
    }
    return null;
  }
  return raw.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
})();

function isDomainAllowed(email: string): boolean {
  if (!ALLOWED_DOMAINS) return true;
  const domain = email.split('@')[1]?.toLowerCase();
  return !!domain && ALLOWED_DOMAINS.includes(domain);
}

// ---------------------------------------------------------------------------

function mapRow(row: Record<string, unknown>): Usuario {
  return {
    id: String(row.id),
    nombre: String(row.nombre),
    email: String(row.email),
    rol: row.rol as Usuario['rol'],
    activo: row.activo !== false,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function fetchUsuarioPorId(id: string): Promise<Usuario | null> {
  const insforge = getInsforge();
  const { data, error } = await insforge.database
    .from('usuario')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

/**
 * Garantiza fila en `public.usuario` enlazada a `auth.users`.
 *
 * Seguridad añadida:
 *   1. Valida que el email pertenezca a un dominio permitido (whitelist).
 *   2. Si el usuario no existe y el dominio no está permitido, lanza error
 *      en lugar de crear la fila.
 */
export async function asegurarUsuario(authUser: UserSchema): Promise<Usuario> {
  const existente = await fetchUsuarioPorId(authUser.id);
  if (existente) return existente;

  if (!isDomainAllowed(authUser.email)) {
    throw new Error(
      `El correo "${authUser.email}" no pertenece a un dominio autorizado. Contacta al administrador.`,
    );
  }

  const insforge = getInsforge();
  const nombre =
    authUser.profile && typeof authUser.profile.name === 'string'
      ? authUser.profile.name
      : authUser.email.split('@')[0] ?? 'Usuario';

  const { data, error } = await insforge.database
    .from('usuario')
    .insert([
      {
        id: authUser.id,
        nombre,
        email: authUser.email,
        rol: 'miembro',
        activo: true,
      },
    ])
    .select('*')
    .single();

  if (!error && data) {
    return mapRow(data as Record<string, unknown>);
  }

  const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: string }).code) : '';
  const msg = error && typeof error === 'object' && 'message' in error ? String((error as { message?: string }).message) : '';
  const isDuplicate = code === '23505' || /duplicate|unique/i.test(msg);

  if (isDuplicate) {
    const again = await fetchUsuarioPorId(authUser.id);
    if (again) return again;
  }

  if (error) throw error;
  throw new Error('No se pudo crear el usuario.');
}