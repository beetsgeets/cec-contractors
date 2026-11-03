const express = require('express');
const os = require('os');
const fs = require('fs/promises');
const multer = require('multer');
const { q } = require('../db');
const cfg = require('../config');
const auth = require('../lib/auth');
const images = require('../lib/images');
const { DEFAULTS } = require('../lib/content');
const { slugify, uniqueSlug, parseScope, fmtDate } = require('../lib/util');

const r = express.Router();
r.use((req, res, next) => { res.locals.admin = true; res.locals.fmtDate = fmtDate; next(); });

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 25 * 1024 * 1024, files: 40 },
  fileFilter: (req, file, cb) => cb(null, /^image\//.test(file.mimetype) || /\.(jpe?g|png|heic|heif|webp|tiff?)$/i.test(file.originalname)),
});

// ---- first-run setup ------------------------------------------------------------
r.get('/setup', (req, res) => {
  if (q.users.count() > 0) return res.redirect('/admin/login');
  res.render('admin/setup', { title: 'Set up your login', error: null });
});
r.post('/setup', (req, res) => {
  if (q.users.count() > 0) return res.redirect('/admin/login');
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 10) {
    return res.status(422).render('admin/setup', { title: 'Set up your login', error: 'Name, email, and a password of at least 10 characters.' });
  }
  const id = q.users.create(name.trim(), email.trim(), auth.hashPassword(password));
  req.session.uid = id;
  res.redirect('/admin');
});

// ---- login / logout ---------------------------------------------------------------
r.get('/login', (req, res) => {
  if (q.users.count() === 0) return res.redirect('/admin/setup');
  if (req.user) return res.redirect('/admin');
  res.render('admin/login', { title: 'Sign in', error: null });
});
r.post('/login', (req, res) => {
  if (!auth.loginAllowed(req.ip)) return res.status(429).render('admin/login', { title: 'Sign in', error: 'Too many attempts. Wait 15 minutes and try again.' });
  const u = q.users.byEmail(String(req.body.email || ''));
  if (!u || !auth.verifyPassword(String(req.body.password || ''), u.password_hash)) {
    auth.loginFailed(req.ip);
    return res.status(401).render('admin/login', { title: 'Sign in', error: 'That email and password don’t match.' });
  }
  auth.loginSucceeded(req.ip);
  req.session.uid = u.id;
  const to = req.session.returnTo || '/admin';
  delete req.session.returnTo;
  res.redirect(to);
});
r.post('/logout', (req, res) => { req.session = null; res.redirect('/'); });

// ---- invite links: an owner makes a link, the new person creates their own login --------
r.get('/join/:token', (req, res) => {
  const inv = q.invites.get(req.params.token);
  if (!inv) return res.status(410).render('admin/join', { title: 'Create your login', invite: null, error: null, form: {} });
  res.render('admin/join', { title: 'Create your login', invite: inv, error: null, form: {} });
});
r.post('/join/:token', (req, res) => {
  const inv = q.invites.get(req.params.token);
  if (!inv) return res.status(410).render('admin/join', { title: 'Create your login', invite: null, error: null, form: {} });
  const { name, email, password } = req.body;
  const form = { name: String(name || '').trim(), email: String(email || '').trim() };
  if (!form.name || !form.email || !password || password.length < 10) {
    return res.status(422).render('admin/join', { title: 'Create your login', invite: inv, error: 'Name, email, and a password of at least 10 characters.', form });
  }
  if (q.users.byEmail(form.email)) {
    return res.status(422).render('admin/join', { title: 'Create your login', invite: inv, error: 'That email already has a login. Sign in instead, or use a different email.', form });
  }
  const id = q.users.create(form.name, form.email, auth.hashPassword(password));
  q.invites.use(inv.token, id);
  req.session.uid = id;
  req.session.flash = `Welcome, ${form.name}. You're signed in.`;
  res.redirect('/admin/help');
});

// everything below needs a login
r.use(auth.requireUser);

// ---- edit mode toggle + inline content save --------------------------------------
r.post('/edit-mode', (req, res) => {
  req.session.edit = req.body.on === '1';
  res.redirect(req.body.back && req.body.back.startsWith('/') ? req.body.back : '/');
});
r.post('/content', (req, res) => {
  const changes = req.body.changes || {};
  const keys = Object.keys(changes).filter(k => Object.prototype.hasOwnProperty.call(DEFAULTS.text, k));
  q.tx(() => { for (const k of keys) q.content.set(k, String(changes[k]).slice(0, 20000)); });
  res.json({ ok: true, saved: keys.length });
});
r.post('/content/reset', (req, res) => {
  const k = req.body.key;
  if (k && DEFAULTS.text[k] !== undefined) q.content.set(k, DEFAULTS.text[k]);
  res.json({ ok: true, value: DEFAULTS.text[k] });
});

r.get('/help', (req, res) => { const flash = req.session.flash; delete req.session.flash; res.render('admin/help', { title: 'How to run the website', flash }); });

// ---- dashboard ----------------------------------------------------------------------
r.get('/', (req, res) => {
  const covers = q.photos.covers();
  const jobs = q.jobs.all().map(j => ({ ...j, cover: covers[j.id], photoCount: q.photos.forJob(j.id).length }));
  res.render('admin/dashboard', { title: 'Website admin', jobs });
});

// ---- jobs -----------------------------------------------------------------------------
function jobFromBody(b, existingId) {
  const title = String(b.title || '').trim().slice(0, 160);
  const town = String(b.town || '').trim().slice(0, 80);
  const baseSlug = slugify(`${town} ${title}`);
  return {
    slug: uniqueSlug(baseSlug, existingId),
    title, town,
    client: String(b.client || '').trim().slice(0, 120),
    category: b.category === 'commercial' ? 'commercial' : 'residential',
    year: parseInt(b.year, 10) || null,
    summary: String(b.summary || '').trim().slice(0, 400),
    body: String(b.body || '').trim().slice(0, 8000),
    scope: JSON.stringify(parseScope(b.scope)),
    series: String(b.series || '').trim().slice(0, 80),
    featured: b.featured ? 1 : 0,
    in_progress: b.in_progress ? 1 : 0,
    published: b.published === '0' ? 0 : 1,
    position: 0,
  };
}

async function addPhotos(job, files, startPos) {
  let pos = startPos;
  const results = [];
  for (const f of files) {
    try {
      const info = await images.processUpload(f.path, job.slug);
      const id = q.photos.insert({ job_id: job.id, position: ++pos, base: info.base, caption: '', w: info.w, h: info.h });
      results.push({ id, ...info });
    } catch (e) {
      console.warn('Photo skipped:', f.originalname, e.message);
      results.push({ error: `${f.originalname}: ${e.message}` });
    } finally {
      await fs.rm(f.path, { force: true });
    }
  }
  return results;
}

// ordering of jobs on the Work page (array of ids in display order)
r.post('/jobs/reorder', (req, res) => {
  const ids = (req.body.ids || []).map(Number).filter(Boolean);
  q.tx(() => ids.forEach((id, i) => q.jobs.setPosition(id, i + 1)));
  res.json({ ok: true });
});

r.get('/jobs/new', (req, res) => {
  res.render('admin/job-form', { title: 'Post a job', job: null, photos: [], errors: null, form: { category: 'residential', year: new Date().getFullYear(), published: '1' } });
});

r.post('/jobs/new', upload.array('photos', 40), async (req, res, next) => {
  try {
    const j = jobFromBody(req.body);
    const errors = {};
    if (!j.title) errors.title = 'Give the job a title, like “Kitchen remodel”.';
    if (!j.town) errors.town = 'Which town?';
    if (Object.keys(errors).length) {
      for (const f of req.files || []) await fs.rm(f.path, { force: true });
      return res.status(422).render('admin/job-form', { title: 'Post a job', job: null, photos: [], errors, form: req.body });
    }
    const id = q.jobs.insert(j);
    const job = q.jobs.byId(id);
    const results = await addPhotos(job, req.files || [], 0);
    const first = results.find(x => x.id);
    if (first) q.jobs.setCover(id, first.id);
    const failed = results.filter(x => x.error);
    req.session.flash = failed.length ? `Posted. ${failed.length} photo(s) couldn’t be read and were skipped.` : 'Posted. It’s live on the site.';
    res.redirect(`/admin/jobs/${id}`);
  } catch (e) { next(e); }
});

r.get('/jobs/:id', (req, res, next) => {
  const job = q.jobs.byId(req.params.id);
  if (!job) return next();
  const photos = q.photos.forJob(job.id);
  const flash = req.session.flash; delete req.session.flash;
  res.render('admin/job-form', { title: `Edit: ${job.title}`, job: { ...job, scopeText: JSON.parse(job.scope || '[]').join('\n') }, photos, errors: null, form: null, flash });
});

r.post('/jobs/:id', upload.array('photos', 40), async (req, res, next) => {
  try {
    const job = q.jobs.byId(req.params.id);
    if (!job) return next();
    const j = jobFromBody(req.body, job.id);
    const errors = {};
    if (!j.title) errors.title = 'Give the job a title.';
    if (!j.town) errors.town = 'Which town?';
    if (Object.keys(errors).length) {
      for (const f of req.files || []) await fs.rm(f.path, { force: true });
      return res.status(422).render('admin/job-form', { title: `Edit: ${job.title}`, job, photos: q.photos.forJob(job.id), errors, form: req.body, flash: null });
    }
    // A job's web address is set when it's first posted and never changes after,
    // so editing the title or town can't break links or the pages that feature it.
    j.slug = job.slug;
    q.jobs.update(job.id, j);
    const updated = q.jobs.byId(job.id);
    const results = await addPhotos(updated, req.files || [], q.photos.maxPosition(job.id));
    if (!updated.cover_photo_id) { const first = q.photos.forJob(job.id)[0]; if (first) q.jobs.setCover(job.id, first.id); }
    const failed = results.filter(x => x.error);
    req.session.flash = failed.length ? `Saved. ${failed.length} photo(s) couldn’t be read and were skipped.` : 'Saved.';
    res.redirect(`/admin/jobs/${job.id}`);
  } catch (e) { next(e); }
});

r.post('/jobs/:id/delete', async (req, res, next) => {
  try {
    const job = q.jobs.byId(req.params.id);
    if (!job) return next();
    q.jobs.remove(job.id);
    await images.deleteJobFolder(job.slug);
    res.redirect('/admin');
  } catch (e) { next(e); }
});

// ---- photos (JSON endpoints used by the job form) -----------------------------------
r.post('/photos/reorder', (req, res) => {
  const ids = (req.body.ids || []).map(Number).filter(Boolean);
  q.tx(() => ids.forEach((id, i) => q.photos.setPosition(id, i + 1)));
  res.json({ ok: true });
});
r.post('/photos/:id/caption', (req, res) => {
  q.photos.setCaption(Number(req.params.id), String(req.body.caption || '').slice(0, 300));
  res.json({ ok: true });
});
r.post('/photos/:id/cover', (req, res) => {
  const p = q.photos.byId(Number(req.params.id));
  if (p) q.jobs.setCover(p.job_id, p.id);
  res.json({ ok: !!p });
});
r.post('/photos/:id/delete', async (req, res, next) => {
  try {
    const p = q.photos.byId(Number(req.params.id));
    if (!p) return res.json({ ok: false });
    const job = q.jobs.byId(p.job_id);
    q.photos.remove(p.id);
    await images.deletePhotoFiles(job.slug, p.base);
    if (job.cover_photo_id === p.id) { const first = q.photos.forJob(job.id)[0]; q.jobs.setCover(job.id, first ? first.id : null); }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---- leads -------------------------------------------------------------------------------
r.get('/leads', (req, res) => {
  const archived = req.query.archived === '1';
  res.render('admin/leads', { title: 'Estimate requests', leads: q.leads.all(archived ? 1 : 0), archived });
});
r.post('/leads/:id/archive', (req, res) => { q.leads.setArchived(Number(req.params.id), req.body.on !== '0'); res.redirect(req.body.on === '0' ? '/admin/leads?archived=1' : '/admin/leads'); });

// ---- settings + users ----------------------------------------------------------------------
r.get('/settings', (req, res) => {
  const flash = req.session.flash; delete req.session.flash;
  res.render('admin/settings', { title: 'Settings', users: q.users.all(), invites: q.invites.open(), flash, error: null, keys: Object.keys(DEFAULTS.settings) });
});
r.post('/settings', (req, res) => {
  q.tx(() => { for (const k of Object.keys(DEFAULTS.settings)) if (k in req.body) q.settings.set(k, String(req.body[k]).trim().slice(0, 500)); });
  req.session.flash = 'Settings saved.';
  res.redirect('/admin/settings');
});
r.post('/invites', (req, res) => {
  const token = require('crypto').randomBytes(18).toString('base64url');
  q.invites.create(token, req.user.id);
  req.session.flash = 'Invite link made. Send it to the person; it works once and expires in 7 days.';
  res.redirect('/admin/settings#invites');
});
r.post('/invites/:token/revoke', (req, res) => {
  q.invites.revoke(req.params.token);
  req.session.flash = 'Invite link cancelled.';
  res.redirect('/admin/settings#invites');
});
r.post('/users/:id/delete', (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) { req.session.flash = 'You can’t remove your own login.'; return res.redirect('/admin/settings'); }
  q.users.remove(id);
  req.session.flash = 'Login removed.';
  res.redirect('/admin/settings');
});
r.post('/password', (req, res) => {
  const { current, password } = req.body;
  const u = q.users.byEmail(req.user.email);
  if (!auth.verifyPassword(String(current || ''), u.password_hash)) { req.session.flash = 'Current password didn’t match.'; return res.redirect('/admin/settings'); }
  if (!password || password.length < 10) { req.session.flash = 'New password needs at least 10 characters.'; return res.redirect('/admin/settings'); }
  q.users.setPassword(u.id, auth.hashPassword(password));
  req.session.flash = 'Password changed.';
  res.redirect('/admin/settings');
});

module.exports = r;
