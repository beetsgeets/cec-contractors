/**
 * Shared Supabase client (v2) for public site and admin dashboard.
 * Requires: window.CEC_SUPABASE_CONFIG from js/config.js (or injected before this script).
 * Load after: @supabase/supabase-js@2 from CDN.
 */

(function (global) {
  "use strict";

  var client = null;

  /**
   * Returns a singleton Supabase client, or null if config is missing/invalid.
   * Uses only the public anon key — never the service role key in the browser.
   */
  function getSupabaseClient() {
    if (client) return client;

    var cfg = global.CEC_SUPABASE_CONFIG;
    if (!cfg || !cfg.url || !cfg.anonKey) {
      console.error("[CEC] Missing CEC_SUPABASE_CONFIG. Copy js/config.example.js to js/config.js and add your Supabase URL and anon key.");
      return null;
    }
    if (cfg.url.indexOf("YOUR_PROJECT") !== -1 || cfg.anonKey.indexOf("YOUR_SUPABASE") !== -1) {
      console.warn("[CEC] Supabase config still contains placeholders. Update js/config.js.");
      return null;
    }
    if (!global.supabase || typeof global.supabase.createClient !== "function") {
      console.error("[CEC] Supabase JS library not loaded. Include the CDN script before supabase-client.js.");
      return null;
    }

    client = global.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        /** Required so session is read/written consistently across pages (admin ↔ dashboard). */
        storage:
          typeof global.localStorage !== "undefined" ? global.localStorage : undefined,
      },
    });
    return client;
  }

  /** Clear cached client (e.g. after logout in same tab). */
  function resetSupabaseClient() {
    client = null;
  }

  global.getSupabaseClient = getSupabaseClient;
  global.resetSupabaseClient = resetSupabaseClient;
})(typeof window !== "undefined" ? window : globalThis);
