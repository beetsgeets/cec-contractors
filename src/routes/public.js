const express = require('express');
const { q } = require('../db');
const cfg = require('../config');
const images = require('../lib/images');
const { sendLeadEmail } = require('../lib/mail');

const r = express.Router();

// Attach cover photo + photo list helpers to job rows.
function withCovers(jobs) {
  const covers = q.photos.covers();
  return jobs.map(j => ({ ...j, cover: covers[j.id] || null, scopeList: safeScope(j.scope) }));
}
function safeScope(s) { try { return JSON.parse(s || '[]'); } catch { return []; } }

function heroImage(settings) {
  // settings.hero_image = "<slug>/<base>" ; blank = first featured job's cover
  if (settings.hero_image && settings.hero_image.includes('/')) {
    const [slug, base] = settings.hero_image.split('/');
    const job = q.jobs.bySlug(slug);
    if (job) {
      const p = q.photos.forJob(job.id).find(x => x.base === base);
      if (p) return { url: images.url(job.slug, p.base, 'large'), w: p.w, h: p.h, job };
    }
  }
  const f = withCovers(q.jobs.featured(1))[0];
  if (f && f.cover) return { url: images.url(f.slug, f.cover.base, 'large'), w: f.cover.w, h: f.cover.h, job: f };
  return null;
}

r.get('/', (req, res) => {
  const featured = withCovers(q.jobs.featured(6));
  const series = withCovers(q.jobs.seriesAll('cleveland-heights-house'));
  const howPhotoJob = q.jobs.bySlug('lakewood-presbyterian-church-interior-repair');
  const howPhoto = howPhotoJob ? q.photos.forJob(howPhotoJob.id)[3] : null;
  const servicesJobs = {
    1: q.jobs.bySlug('cleveland-heights-living-room-restoration'),
    2: q.jobs.bySlug('cleveland-heights-staircase-rebuild'),
    3: q.jobs.bySlug('lakewood-porch-to-office-conversion'),
    4: q.jobs.bySlug('gordon-park-front-porch-restoration'),
    5: q.jobs.bySlug('ohio-city-covered-patio'),
    6: q.jobs.bySlug('west-shore-unitarian-universalist-church-sanctuary'),
  };
  const covers = q.photos.covers();
  const serviceCards = [1, 2, 3, 4, 5, 6].map(n => ({ n, job: servicesJobs[n], cover: servicesJobs[n] ? covers[servicesJobs[n].id] : null }));
  res.render('home', {
    title: null,
    description: 'Residential and commercial carpentry, remodeling, and millwork across Greater Cleveland. One crew, start to finish. Formerly Cutting Edge Carpentry.',
    hero: heroImage(res.locals.settings),
    featured, series, howPhoto, howPhotoJob, serviceCards,
  });
});

r.get('/work', (req, res) => {
  const cat = ['residential', 'commercial'].includes(req.query.type) ? req.query.type : null;
  const jobs = withCovers(q.jobs.published(cat));
  res.render('work', {
    title: cat ? `${cat[0].toUpperCase() + cat.slice(1)} work` : 'Our work',
    description: 'Photos and details from our carpentry, remodeling, and commercial projects across Greater Cleveland.',
    jobs, cat,
  });
});

r.get('/work/:slug', (req, res, next) => {
  const job = q.jobs.bySlug(req.params.slug);
  if (!job || (!job.published && !req.user)) return next();
  const photos = q.photos.forJob(job.id);
  const siblings = job.series ? withCovers(q.jobs.series(job.series, job.id)) : [];
  const { prev, next: nxt } = q.jobs.neighbors(job);
  const cover = photos.find(p => p.id === job.cover_photo_id) || photos[0] || null;
  res.render('job', {
    title: `${job.title} — ${job.town}`,
    description: job.summary,
    ogImage: cover ? cfg.SITE_URL + images.url(job.slug, cover.base, 'large') : null,
    job: { ...job, scopeList: safeScope(job.scope) }, photos, cover, siblings, prev, nxt,
  });
});

r.get('/services', (req, res) => {
  const pick = (slugs) => withCovers(slugs.map(s => q.jobs.bySlug(s)).filter(Boolean));
  const groups = [
    { n: 1, jobs: pick(['cleveland-heights-living-room-restoration', 'lakewood-secret-bookcase-door', 'cleveland-heights-third-floor-renovation']) },
    { n: 2, jobs: pick(['cleveland-heights-staircase-rebuild', 'timber-frame-stairs-and-railing']) },
    { n: 3, jobs: pick(['lakewood-porch-to-office-conversion', 'chesterland-kitchen-remodel', 'ohio-city-third-floor-interior-finish']) },
    { n: 4, jobs: pick(['gordon-park-front-porch-restoration', 'cleveland-heights-living-room-restoration', 'ohio-city-front-porch-and-rear-deck']) },
    { n: 5, jobs: pick(['ohio-city-covered-patio', 'ohio-city-front-porch-and-rear-deck']) },
    { n: 6, jobs: pick(['west-shore-unitarian-universalist-church-sanctuary', 'lakewood-presbyterian-church-interior-repair', 'stone-mad-catering-kitchen']) },
  ];
  res.render('services', { title: 'Services', description: 'Finish carpentry and millwork, stairs, remodeling and additions, historic restoration, porches and outdoor structures, and commercial carpentry in Greater Cleveland.', groups });
});

r.get('/about', (req, res) => {
  const howJob = q.jobs.bySlug('lakewood-presbyterian-church-interior-repair');
  const howPhoto = howJob ? q.photos.forJob(howJob.id)[3] : null;
  res.render('about', { title: 'About', description: 'A family carpentry and construction company serving Greater Cleveland. Formerly Cutting Edge Carpentry.', howJob, howPhoto });
});

r.get('/contact', (req, res) => {
  res.render('contact', { title: 'Request an estimate', description: 'Call Mike or send project details for a free estimate. Serving Cuyahoga, Lake, Geauga, and Medina counties.', sent: req.query.sent === '1', errors: null, form: {} });
});

// Simple per-IP throttle for the contact form: 5 per hour.
const sends = new Map();
function allowSend(ip) {
  const now = Date.now();
  const list = (sends.get(ip) || []).filter(t => now - t < 3600e3);
  sends.set(ip, list);
  if (list.length >= 5) return false;
  list.push(now);
  return true;
}

r.post('/contact', async (req, res) => {
  const b = req.body || {};
  if (b.website) return res.redirect('/contact?sent=1'); // honeypot
  const form = {
    name: String(b.name || '').trim().slice(0, 120),
    phone: String(b.phone || '').trim().slice(0, 40),
    email: String(b.email || '').trim().slice(0, 160),
    town: String(b.town || '').trim().slice(0, 80),
    project_type: String(b.project_type || '').trim().slice(0, 80),
    message: String(b.message || '').trim().slice(0, 4000),
  };
  const errors = {};
  if (!form.name) errors.name = 'Please tell us your name.';
  if (!form.phone && !form.email) errors.phone = 'A phone number or email, so we can reach you.';
  if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) errors.email = 'That email doesn’t look right.';
  if (!form.message) errors.message = 'A few words about the project.';
  if (Object.keys(errors).length) {
    return res.status(422).render('contact', { title: 'Request an estimate', description: '', sent: false, errors, form });
  }
  if (!allowSend(req.ip)) {
    return res.status(429).render('contact', { title: 'Request an estimate', description: '', sent: false, errors: { message: 'That’s a lot of requests from one place. Give us a call instead.' }, form });
  }
  const id = q.leads.insert(form);
  const to = (res.locals.settings.lead_emails || cfg.MAIL_TO || '').split(',');
  try {
    const r2 = await sendLeadEmail({ ...form, id }, to, `${req.protocol}://${req.get('host')}`);
    if (r2.ok) q.leads.markEmailed(id);
    else console.warn('Lead email not sent:', r2.reason);
  } catch (e) {
    console.warn('Lead email error:', e.message);
  }
  res.redirect('/contact?sent=1');
});

r.get('/healthz', (req, res) => res.type('text/plain').send('ok'));

r.get('/sitemap.xml', (req, res) => {
  const urls = ['/', '/work', '/services', '/about', '/contact', ...q.jobs.published().map(j => `/work/${j.slug}`)];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(u => `  <url><loc>${cfg.SITE_URL}${u}</loc></url>`).join('\n')}\n</urlset>`);
});
r.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nDisallow: /admin\nSitemap: ${cfg.SITE_URL}/sitemap.xml\n`));

module.exports = r;
