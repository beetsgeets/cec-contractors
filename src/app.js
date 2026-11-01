const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const cfg = require('./config');
const { q } = require('./db');
const { loadUser } = require('./lib/auth');
const { csrf } = require('./lib/csrf');
const { makeT, settingsWithDefaults } = require('./lib/content');
const { telHref } = require('./lib/util');
const images = require('./lib/images');

const app = express();
app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(cfg.ROOT, 'views'));
app.disable('x-powered-by');

// ---- security headers --------------------------------------------------------
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (cfg.IS_PROD) res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// ---- static ---------------------------------------------------------------------
app.use('/uploads', express.static(images.UPLOADS, { maxAge: '30d', immutable: true, index: false, dotfiles: 'deny' }));
app.use(express.static(path.join(cfg.ROOT, 'public'), { maxAge: cfg.IS_PROD ? '7d' : 0, index: false }));

// ---- parsing + session -------------------------------------------------------
app.use(express.urlencoded({ extended: false, limit: '2mb' }));
app.use(express.json({ limit: '2mb' }));
app.use(cookieSession({
  name: 'cec',
  keys: [cfg.SESSION_SECRET],
  maxAge: 30 * 24 * 60 * 60 * 1000,
  sameSite: 'lax',
  secure: cfg.IS_PROD,
  httpOnly: true,
}));
app.use(loadUser);

// ---- per-request view helpers -------------------------------------------------
app.use((req, res, next) => {
  const settings = settingsWithDefaults(q.settings.all());
  const editMode = !!(req.user && req.session.edit);
  res.locals.settings = settings;
  res.locals.editMode = editMode;
  res.locals.t = makeT(q.content.all(), editMode);
  res.locals.tel = telHref;
  res.locals.img = images.url;
  res.locals.siteUrl = cfg.SITE_URL;
  res.locals.path = req.path;
  res.locals.canonical = cfg.SITE_URL + req.path.replace(/\/$/, '') || cfg.SITE_URL + '/';
  res.locals.v = cfg.ASSET_V || '1';
  res.locals.newLeads = req.user ? q.leads.countNew() : 0;
  next();
});

app.use('/admin', csrf, require('./routes/admin'));
app.use('/', csrf, require('./routes/public'));

// ---- errors --------------------------------------------------------------------
app.use((req, res) => res.status(404).render('404', { title: 'Page not found' }));
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).send('That photo is too large (25 MB max). Try again with a smaller file.');
  res.status(500).render('404', { title: 'Something went wrong', message: cfg.IS_PROD ? 'Something went wrong on our end. Please try again, or call us.' : String(err.stack || err) });
});

module.exports = app;
