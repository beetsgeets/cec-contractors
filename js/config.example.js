/**
 * Supabase configuration template
 *
 * SETUP (local development):
 * 1. Copy this file to `js/config.js` (same folder).
 * 2. Replace the placeholder anon key with the value from
 *    Supabase → Project Settings → API (project URL is already set for this site).
 * 3. Never commit `js/config.js` if it contains real keys (see .gitignore).
 *
 * NETLIFY (production):
 * Prefer generating `js/config.js` during deploy from environment variables.
 * See README.md → "Deploying to Netlify" for the `scripts/build-config.js` approach.
 */
window.CEC_SUPABASE_CONFIG = {
  url: "https://roryrokffilemghhskct.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_PUBLIC_KEY",
};
