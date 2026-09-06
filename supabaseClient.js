import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// supabase-js UMD build attaches `window.supabase` with a `.createClient` factory.
export const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
