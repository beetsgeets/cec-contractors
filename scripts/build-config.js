/**
 * Netlify (or CI) build step: write js/config.js from environment variables.
 *
 * Required env vars:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *
 * In Netlify: Site settings → Environment variables → add both for Production.
 * Set build command to: node scripts/build-config.js
 * Publish directory: . (repository root)
 */

const fs = require("fs");
const path = require("path");

const url = process.env.SUPABASE_URL || "";
const anonKey = process.env.SUPABASE_ANON_KEY || "";

const outPath = path.join(__dirname, "..", "js", "config.js");
const body =
  "/* Generated at build time — do not edit by hand */\n" +
  "window.CEC_SUPABASE_CONFIG = {\n" +
  "  url: " +
  JSON.stringify(url) +
  ",\n" +
  "  anonKey: " +
  JSON.stringify(anonKey) +
  ",\n" +
  "};\n";

fs.writeFileSync(outPath, body, "utf8");

if (!url || !anonKey) {
  console.warn(
    "[build-config] SUPABASE_URL or SUPABASE_ANON_KEY missing. config.js written with empty strings."
  );
} else {
  console.log("[build-config] Wrote js/config.js");
}
