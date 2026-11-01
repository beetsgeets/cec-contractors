const { q } = require('../db');

function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '') || 'job';
}

function uniqueSlug(base, excludeId) {
  let slug = base, n = 2;
  while (true) {
    const j = q.jobs.bySlug(slug);
    if (!j || j.id === excludeId) return slug;
    slug = `${base}-${n++}`;
  }
}

function telHref(s) {
  return 'tel:+1' + String(s || '').replace(/\D/g, '').replace(/^1/, '');
}

function parseScope(text) {
  return String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
}

function fmtDate(iso) {
  const d = new Date(iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

module.exports = { slugify, uniqueSlug, telHref, parseScope, fmtDate };
