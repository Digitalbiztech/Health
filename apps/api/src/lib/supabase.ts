import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/**
 * Supabase Admin client — uses the service-role key so it can
 * create users, bypass RLS, and perform other privileged operations.
 *
 * ⚠️  Never expose this client or the service-role key to the frontend.
 */
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
