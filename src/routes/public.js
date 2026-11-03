const express = require('express');
const { q } = require('../db');
const cfg = require('../config');
const indexnow = require('../lib/indexnow');
const images = require('../lib/images');
const { sendLeadEmail } = require('../lib/mail');
const { spamReason } = require('../lib/spam');

const r = express.Router();

// Attach cover photo + photo list helpers to job rows.
function withCovers(jobs) {
  const covers = q.photos.covers();
  return jobs.map(j => ({ ...j, cover: covers[j.id] || null, scopeList: safeScope(j.scope) }));
}
function safeScope(s) { try { return JSON.parse(s || '[]'); } catch { return []; } }

// The jobs the site launched with, by permanent id (the seed loads them in this
// order into an empty table). Pages that feature a particular job refer to it this
// way, so retitling a job in the admin can't break them. Each list is in order of
// preference: the first published job with a photo wins, so deleting or hiding one
// just falls through to the next.
const SEED = {
  livingRoom: 1, thirdFloor: 2, staircase: 3, porchOffice: 4, coveredPatio: 5,
  chesterlandKitchen: 6, westlakeKitchen: 7, ohioCityKitchen: 8, bookcaseDoor: 9,
  ohioCityThirdFloor: 10, ohioCityPorch: 11, gordonParkPorch: 12, timberStairs: 13,
  westShoreChurch: 14, lakewoodChurchInterior: 15, lakewoodChurchPatio: 16, stoneMad: 17,
  tacoTantos: 18, souperMarket: 19,
};

// Home page: each job shows up once where possible. The Cleveland Heights house
// has its own section ("One home, year after year"), so "Recent work" and the
// service boxes use other jobs. Recent work is the featured jobs not already on
// the page, topped up from this list; each service box takes the first job in its
// list that isn't already on the page.
const HOME_RECENT_FILL = [SEED.tacoTantos, SEED.westlakeKitchen, SEED.gordonParkPorch];
const HOME_SERVICE_JOBS = {
  1: [SEED.ohioCityThirdFloor, SEED.bookcaseDoor, SEED.livingRoom],
  2: [SEED.timberStairs, SEED.staircase],
  3: [SEED.porchOffice, SEED.westlakeKitchen, SEED.chesterlandKitchen, SEED.ohioCityKitchen],
  4: [SEED.gordonParkPorch, SEED.ohioCityPorch, SEED.livingRoom],
  5: [SEED.coveredPatio, SEED.ohioCityPorch, SEED.lakewoodChurchPatio],
  6: [SEED.westShoreChurch, SEED.tacoTantos, SEED.souperMarket, SEED.stoneMad],
};
const SERVICE_JOBS = {
  1: [SEED.livingRoom, SEED.bookcaseDoor, SEED.thirdFloor],
  2: [SEED.staircase, SEED.timberStairs],
  3: [SEED.porchOffice, SEED.chesterlandKitchen, SEED.ohioCityThirdFloor],
  4: [SEED.gordonParkPorch, SEED.livingRoom, SEED.ohioCityPorch],
  5: [SEED.coveredPatio, SEED.ohioCityPorch],
  6: [SEED.westShoreChurch, SEED.lakewoodChurchInterior, SEED.stoneMad],
};

function publishedJobs(ids) {
  return ids.map(id => q.jobs.byId(id)).filter(j => j && j.published);
}

// "How we work" photo: the temporary dust wall from the church interior job.
function howWeWorkPhoto() {
  const job = publishedJobs([SEED.lakewoodChurchInterior])[0];
  if (!job) return { job: null, photo: null };
  const photos = q.photos.forJob(job.id);
  return { job, photo: photos[3] || photos[0] || null };
}

function heroImage(settings) {
  // settings.hero_image = "<slug>/<base>" ; blank = first featured job's cover
  if (settings.hero_image && settings.hero_image.includes('/')) {
    const [slug, base] = settings.hero_image.split('/');
    const job = q.jobs.bySlug(slug) || q.aliases.jobFor(slug);
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
  const covers = q.photos.covers();
  const hero = heroImage(res.locals.settings);
  const series = withCovers(q.jobs.seriesAll('cleveland-heights-house'));
  const how = howWeWorkPhoto();
  const shown = new Set([hero && hero.job && hero.job.id, ...series.map(j => j.id), how.job && how.job.id].filter(Boolean));

  const recent = q.jobs.featured(100).filter(j => covers[j.id] && !shown.has(j.id)).slice(0, 6);
  for (const j of publishedJobs(HOME_RECENT_FILL)) {
    if (recent.length >= 6) break;
    if (covers[j.id] && !shown.has(j.id) && !recent.some(x => x.id === j.id)) recent.push(j);
  }
  recent.forEach(j => shown.add(j.id));

  const serviceCards = [1, 2, 3, 4, 5, 6].map(n => {
    const options = publishedJobs(HOME_SERVICE_JOBS[n]).filter(j => covers[j.id]);
    const job = options.find(j => !shown.has(j.id)) || options[0] || null;
    if (job) shown.add(job.id);
    return { n, job, cover: job ? covers[job.id] : null };
  });
  res.render('home', {
    title: null,
    description: 'Residential and commercial carpentry, remodeling, and millwork across Greater Cleveland. One crew, start to finish. Formerly Cutting Edge Carpentry.',
    hero, featured: withCovers(recent), series, howPhoto: how.photo, howPhotoJob: how.job, serviceCards,
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
  if (!job) {
    // an old address for a job that's since been retitled
    const moved = q.aliases.jobFor(req.params.slug);
    if (moved && (moved.published || req.user)) return res.redirect(301, `/work/${moved.slug}`);
    return next();
  }
  if (!job.published && !req.user) return next();
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
  const groups = [1, 2, 3, 4, 5, 6].map(n => ({ n, jobs: withCovers(publishedJobs(SERVICE_JOBS[n])) }));
  res.render('services', { title: 'Services', description: 'Finish carpentry and millwork, stairs, remodeling and additions, historic restoration, porches and outdoor structures, and commercial carpentry in Greater Cleveland.', groups });
});

r.get('/about', (req, res) => {
  const how = howWeWorkPhoto();
  res.render('about', { title: 'About', description: 'A family carpentry and construction company serving Greater Cleveland. Formerly Cutting Edge Carpentry.', howJob: how.job, howPhoto: how.photo });
});

r.get('/contact', (req, res) => {
  const s = res.locals.settings;
  res.render('contact', { title: 'Request an estimate', description: `Call ${s.phone_primary_name || 'us'} or send project details for a free estimate. Serving ${s.service_area}.`, sent: req.query.sent === '1', errors: null, form: {} });
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
  // Obvious sales pitches are saved under "Probably spam" in the admin but not emailed.
  const reason = spamReason(form);
  const id = q.leads.insert({ ...form, spam: reason ? 1 : 0, spam_reason: reason || '' });
  if (reason) return res.redirect('/contact?sent=1');
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
// IndexNow key file: search engines check it matches the key in our pings.
r.get(`/${indexnow.KEY}.txt`, (req, res) => res.type('text/plain').send(indexnow.KEY));

module.exports = r;
