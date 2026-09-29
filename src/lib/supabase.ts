import { createClient } from '@supabase/supabase-js';

// import.meta.env is undefined outside Vite (e.g. scripts/ run via plain tsx for
// audits/simulations) — those entry points prime the dish cache directly and never
// touch this client, so a harmless placeholder avoids a hard crash on import.
const env = (import.meta as { env?: Record<string, string> }).env;

export const supabase = createClient(
  env?.VITE_SUPABASE_URL || 'https://placeholder.supabase.co',
  env?.VITE_SUPABASE_ANON_KEY || 'placeholder'
);
