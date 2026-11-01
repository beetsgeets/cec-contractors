// Runtime configuration. Everything comes from environment variables with
// sensible local defaults, so the same code runs on a laptop and on Render.
const path = require('path');

const ROOT = path.join(__dirname, '..');

module.exports = {
  ROOT,
  PORT: parseInt(process.env.PORT || '3000', 10),
  // Where the database and uploaded photos live. On Render this is the
  // persistent disk mount (e.g. /data). Locally it's ./data.
  DATA_DIR: process.env.DATA_DIR || path.join(ROOT, 'data'),
  // Public URL of the site, used for canonical links, sitemap, and emails.
  SITE_URL: (process.env.SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  // Secret used to sign the login cookie. Set a long random value in production.
  SESSION_SECRET: process.env.SESSION_SECRET || 'dev-only-secret-change-me',
  // Resend (transactional email) — https://resend.com
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  // The address estimate requests are sent FROM. Must be on a domain verified
  // in Resend (ceccontractors.com). Until then Resend's onboarding address works
  // for testing to the account owner's own inbox only.
  MAIL_FROM: process.env.MAIL_FROM || 'CEC Contractors <onboarding@resend.dev>',
  // Comma-separated list of addresses that receive estimate requests. Can also
  // be changed from the admin Settings page (that value wins when set).
  MAIL_TO: process.env.MAIL_TO || '',
  IS_PROD: process.env.NODE_ENV === 'production',
  // Cache-busting token for CSS/JS; changes on every deploy.
  ASSET_V: (process.env.RENDER_GIT_COMMIT || '').slice(0, 8) || Date.now().toString(36),
};
