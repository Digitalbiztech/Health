import passport from 'passport';
import { supabaseJwtStrategy } from './supabase.strategy.js';

/**
 * Register all Passport strategies.
 * Call this once during app bootstrap.
 */
export function initializePassport() {
  passport.use('supabase-jwt', supabaseJwtStrategy);
}

export { passport };
