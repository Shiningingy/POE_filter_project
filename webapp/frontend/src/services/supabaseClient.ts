// Lazy Supabase client — used ONLY for the admin contribution flow.
// When the env vars are absent (local dev, GH Pages preview) every admin UI
// element is hidden and the app behaves exactly as before.

import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Reviews/approves submissions; matched against the signed-in email (UI only —
 *  row access is enforced server-side by RLS policies on the same email). */
export const OWNER_EMAIL: string =
  (import.meta.env.VITE_OWNER_EMAIL as string | undefined) || 'shiningingzili@gmail.com';

export const isSupabaseConfigured = (): boolean => Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) return null;
  if (!client) client = createClient(url!, anonKey!);
  return client;
};
