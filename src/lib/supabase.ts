import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY ?? '';
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

/** Cliente com a chave PÚBLICA. A segurança real vem do RLS no banco, não desta chave. */
export const supabase = createClient(SUPABASE_URL || 'http://localhost:0', SUPABASE_KEY || 'sem-configuracao', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
});
