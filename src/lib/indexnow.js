// IndexNow: tells Bing (which also feeds Yahoo and DuckDuckGo) and the other
// IndexNow search engines when a page changes, so a new job shows up in search
// within a day or so instead of waiting for the next crawl.
// Google doesn't use IndexNow; it reads the sitemap instead.
// https://www.indexnow.org/documentation
const cfg = require('../config');

// The key is public by design. Search engines fetch /<key>.txt from this site
// and check it matches, which proves the ping came from the site itself.
const KEY = process.env.INDEXNOW_KEY || 'b6b139c1c9a791e7043653a056ca3dce';
const ENDPOINT = 'https://api.indexnow.org/indexnow';
// Edits made close together (post a job, then fix a caption, then reorder
// photos) go out as one ping instead of several.
const DELAY_MS = 60 * 1000;

const MAIN_PAGES = ['/', '/work', '/services', '/about', '/contact'];

const pending = new Set();
let timer = null;

// Only the live site pings. Local copies and test runs never do.
function enabled() {
  return process.env.INDEXNOW !== 'off'
    && /^https:\/\//.test(cfg.SITE_URL)
    && !/localhost|127\.0\.0\.1/.test(cfg.SITE_URL);
}

// Queue site paths ("/work/some-job") to be announced.
function queue(paths) {
  if (!enabled()) return;
  for (const p of [].concat(paths)) {
    if (!p) continue;
    pending.add(cfg.SITE_URL + (p.startsWith('/') ? p : `/${p}`));
  }
  if (pending.size && !timer) {
    timer = setTimeout(flush, DELAY_MS);
    if (timer.unref) timer.unref();
  }
}

// The pages a job shows up on.
function jobPages(job) {
  return job && job.slug ? [`/work/${job.slug}`, '/work', '/'] : [];
}

// The pages a block of site text appears on, by its key ("about.area.body").
function pagesForTextKey(key) {
  const area = String(key).split('.')[0];
  return {
    home: ['/'],
    how: ['/', '/about'],
    services: ['/services'],
    about: ['/about'],
    contact: ['/contact'],
    work: ['/work'],
    footer: MAIN_PAGES,
  }[area] || [];
}

async function flush() {
  timer = null;
  const urlList = [...pending];
  pending.clear();
  if (!urlList.length) return;
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: new URL(cfg.SITE_URL).host,
        key: KEY,
        keyLocation: `${cfg.SITE_URL}/${KEY}.txt`,
        urlList,
      }),
      signal: AbortSignal.timeout(15000),
    });
    console.log(`IndexNow: announced ${urlList.length} page(s), response ${res.status}`);
  } catch (e) {
    // Never matters to the person editing; search engines will still crawl.
    console.error('IndexNow ping failed:', e.message);
  }
}

module.exports = { KEY, MAIN_PAGES, enabled, queue, jobPages, pagesForTextKey, flush };
