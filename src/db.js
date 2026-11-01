// SQLite database: schema, migrations, and small query helpers.
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { DATA_DIR } = require('./config');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const db = new Database(path.join(DATA_DIR, 'cec.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  town TEXT NOT NULL DEFAULT '',
  client TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'residential',
  year INTEGER,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  scope TEXT NOT NULL DEFAULT '[]',
  series TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0,
  in_progress INTEGER NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 1,
  position INTEGER NOT NULL DEFAULT 0,
  cover_photo_id INTEGER,
  created TEXT NOT NULL DEFAULT (datetime('now')),
  updated TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  base TEXT NOT NULL,
  caption TEXT NOT NULL DEFAULT '',
  w INTEGER, h INTEGER,
  created TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS photos_job ON photos(job_id, position);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  town TEXT NOT NULL DEFAULT '',
  project_type TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  emailed INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS content (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invites (
  token TEXT PRIMARY KEY,
  created_by INTEGER NOT NULL,
  created TEXT NOT NULL DEFAULT (datetime('now')),
  used_at TEXT,
  used_by INTEGER
);
`);

// ---- helpers ---------------------------------------------------------------
const q = {
  meta: {
    get: (k) => (db.prepare('SELECT value FROM meta WHERE key=?').get(k) || {}).value,
    set: (k, v) => db.prepare('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(v)),
  },
  settings: {
    all: () => Object.fromEntries(db.prepare('SELECT key,value FROM settings').all().map(r => [r.key, r.value])),
    set: (k, v) => db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(v ?? '')),
  },
  content: {
    all: () => Object.fromEntries(db.prepare('SELECT key,value FROM content').all().map(r => [r.key, r.value])),
    set: (k, v) => db.prepare("INSERT INTO content(key,value,updated) VALUES(?,?,datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated=datetime('now')").run(k, String(v ?? '')),
  },
  users: {
    count: () => db.prepare('SELECT COUNT(*) c FROM users').get().c,
    byEmail: (e) => db.prepare('SELECT * FROM users WHERE lower(email)=lower(?)').get(e),
    byId: (id) => db.prepare('SELECT id,name,email,created FROM users WHERE id=?').get(id),
    all: () => db.prepare('SELECT id,name,email,created FROM users ORDER BY id').all(),
    create: (name, email, hash) => db.prepare('INSERT INTO users(name,email,password_hash) VALUES(?,?,?)').run(name, email, hash).lastInsertRowid,
    setPassword: (id, hash) => db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hash, id),
    remove: (id) => db.prepare('DELETE FROM users WHERE id=?').run(id),
  },
  jobs: {
    count: () => db.prepare('SELECT COUNT(*) c FROM jobs').get().c,
    published: (category) => db.prepare(`SELECT * FROM jobs WHERE published=1 ${category ? 'AND category=?' : ''} ORDER BY in_progress DESC, position ASC, year DESC, id DESC`).all(...(category ? [category] : [])),
    featured: (limit = 6) => db.prepare('SELECT * FROM jobs WHERE published=1 AND featured=1 ORDER BY position ASC, year DESC, id DESC LIMIT ?').all(limit),
    series: (series, excludeId) => db.prepare('SELECT * FROM jobs WHERE published=1 AND series=? AND series<>\'\' AND id<>? ORDER BY year ASC, id ASC').all(series, excludeId || 0),
    seriesAll: (series) => db.prepare('SELECT * FROM jobs WHERE published=1 AND series=? ORDER BY year ASC, id ASC').all(series),
    all: () => db.prepare('SELECT * FROM jobs ORDER BY in_progress DESC, position ASC, year DESC, id DESC').all(),
    bySlug: (slug) => db.prepare('SELECT * FROM jobs WHERE slug=?').get(slug),
    byId: (id) => db.prepare('SELECT * FROM jobs WHERE id=?').get(id),
    neighbors: (job) => {
      const list = db.prepare('SELECT id, slug, title, town FROM jobs WHERE published=1 ORDER BY in_progress DESC, position ASC, year DESC, id DESC').all();
      const i = list.findIndex(j => j.id === job.id);
      return { prev: i > 0 ? list[i - 1] : null, next: i >= 0 && i < list.length - 1 ? list[i + 1] : null };
    },
    insert: (j) => db.prepare(`INSERT INTO jobs(slug,title,town,client,category,year,summary,body,scope,series,featured,in_progress,published,position)
      VALUES(@slug,@title,@town,@client,@category,@year,@summary,@body,@scope,@series,@featured,@in_progress,@published,@position)`).run(j).lastInsertRowid,
    update: (id, j) => db.prepare(`UPDATE jobs SET slug=@slug,title=@title,town=@town,client=@client,category=@category,year=@year,summary=@summary,body=@body,scope=@scope,series=@series,featured=@featured,in_progress=@in_progress,published=@published,updated=datetime('now') WHERE id=@id`).run({ ...j, id }),
    setCover: (id, photoId) => db.prepare('UPDATE jobs SET cover_photo_id=? WHERE id=?').run(photoId, id),
    setPosition: (id, pos) => db.prepare('UPDATE jobs SET position=? WHERE id=?').run(pos, id),
    remove: (id) => db.prepare('DELETE FROM jobs WHERE id=?').run(id),
  },
  photos: {
    forJob: (jobId) => db.prepare('SELECT * FROM photos WHERE job_id=? ORDER BY position ASC, id ASC').all(jobId),
    byId: (id) => db.prepare('SELECT * FROM photos WHERE id=?').get(id),
    insert: (p) => db.prepare('INSERT INTO photos(job_id,position,base,caption,w,h) VALUES(@job_id,@position,@base,@caption,@w,@h)').run(p).lastInsertRowid,
    setCaption: (id, c) => db.prepare('UPDATE photos SET caption=? WHERE id=?').run(c, id),
    setPosition: (id, pos) => db.prepare('UPDATE photos SET position=? WHERE id=?').run(pos, id),
    remove: (id) => db.prepare('DELETE FROM photos WHERE id=?').run(id),
    maxPosition: (jobId) => (db.prepare('SELECT MAX(position) m FROM photos WHERE job_id=?').get(jobId).m || 0),
    covers: () => {
      // one cover row per published job
      const rows = db.prepare(`SELECT j.id job_id, p.* FROM jobs j
        LEFT JOIN photos p ON p.id = COALESCE(j.cover_photo_id, (SELECT id FROM photos WHERE job_id=j.id ORDER BY position ASC, id ASC LIMIT 1))`).all();
      return Object.fromEntries(rows.map(r => [r.job_id, r.id ? r : null]));
    },
  },
  invites: {
    create: (token, by) => db.prepare('INSERT INTO invites(token,created_by) VALUES(?,?)').run(token, by),
    get: (token) => db.prepare("SELECT * FROM invites WHERE token=? AND used_at IS NULL AND created > datetime('now','-7 days')").get(token),
    use: (token, userId) => db.prepare("UPDATE invites SET used_at=datetime('now'), used_by=? WHERE token=?").run(userId, token),
    open: () => db.prepare("SELECT token, created FROM invites WHERE used_at IS NULL AND created > datetime('now','-7 days') ORDER BY created DESC").all(),
    revoke: (token) => db.prepare('DELETE FROM invites WHERE token=?').run(token),
  },
  leads: {
    insert: (l) => db.prepare('INSERT INTO leads(name,phone,email,town,project_type,message) VALUES(@name,@phone,@email,@town,@project_type,@message)').run(l).lastInsertRowid,
    markEmailed: (id) => db.prepare('UPDATE leads SET emailed=1 WHERE id=?').run(id),
    all: (archived = 0) => db.prepare('SELECT * FROM leads WHERE archived=? ORDER BY id DESC').all(archived),
    byId: (id) => db.prepare('SELECT * FROM leads WHERE id=?').get(id),
    setArchived: (id, a) => db.prepare('UPDATE leads SET archived=? WHERE id=?').run(a ? 1 : 0, id),
    countNew: () => db.prepare('SELECT COUNT(*) c FROM leads WHERE archived=0').get().c,
  },
  tx: (fn) => db.transaction(fn)(),
};

module.exports = { db, q };
