import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

type CookieAdapter = {
  get(name: string): string | undefined;
  set(name: string, value: string, options: CookieOptions): void;
  remove(name: string, options: CookieOptions): void;
};

// Narrow the cookie store to the mutable flavor when available
type MutableCookieStore = {
  set: (args: { name: string; value: string } & CookieOptions) => void;
};
function hasSet(x: unknown): x is MutableCookieStore {
  return typeof x === 'object' && x !== null && 'set' in x && typeof (x as { set?: unknown }).set === 'function';
}

/**
 * SSR client (anon key + cookies)
 * Use in Server Components / Route Handlers (acting as the user).
 */
export async function supabaseServer() {
  const cookieStore = await cookies(); // async in your Next version
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const adapter: CookieAdapter = {
    get(name) {
      return cookieStore.get(name)?.value;
    },
    set(name, value, options) {
      if (hasSet(cookieStore)) {
        cookieStore.set({ name, value, ...options });
      }
      // else: readonly context; silently ignore
    },
    remove(name, options) {
      if (hasSet(cookieStore)) {
        cookieStore.set({ name, value: '', ...options });
      }
      // else: readonly context; silently ignore
    },
  };

  return createServerClient(url, anon, { cookies: adapter });
}

/**
 * Admin client (service role)
 * Use ONLY on the server (API routes) for privileged work.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

