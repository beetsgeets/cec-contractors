// Loads the initial 19 jobs and their photos into an empty database.
// Runs automatically on first start (see src/app.js); safe to run again —
// it does nothing once the "seeded" flag is set.
const path = require('path');
const fs = require('fs');
const { q } = require('../src/db');
const { UPLOADS } = require('../src/lib/images');

function seed({ force = false } = {}) {
  if (!force && q.meta.get('seeded') === '1') return { seeded: false };
  const jobsFile = path.join(__dirname, 'jobs.json');
  const photosFile = path.join(__dirname, 'photos.json');
  if (!fs.existsSync(jobsFile) || !fs.existsSync(photosFile)) return { seeded: false, reason: 'no seed files' };
  if (q.jobs.count() > 0 && !force) { q.meta.set('seeded', '1'); return { seeded: false, reason: 'jobs already exist' }; }

  const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8')).jobs;
  const photos = JSON.parse(fs.readFileSync(photosFile, 'utf8'));
  let count = 0;

  q.tx(() => {
    jobs.forEach((j, idx) => {
      const id = q.jobs.insert({
        slug: j.slug, title: j.title, town: j.town || '', client: j.client || '',
        category: j.category || 'residential', year: j.year || null,
        summary: j.summary || '', body: j.body || '', scope: JSON.stringify(j.scope || []),
        series: j.series || '', featured: j.featured ? 1 : 0, in_progress: j.in_progress ? 1 : 0,
        published: 1, position: idx + 1,
      });
      const src = path.join(__dirname, 'uploads', j.slug);
      const dst = path.join(UPLOADS, j.slug);
      fs.mkdirSync(dst, { recursive: true });
      (photos[j.slug] || []).forEach((p, i) => {
        const base = String(p.n).padStart(2, '0');
        for (const s of ['large', 'medium', 'thumb']) {
          const f = `${base}-${s}.jpg`;
          if (fs.existsSync(path.join(src, f))) fs.copyFileSync(path.join(src, f), path.join(dst, f));
        }
        const pid = q.photos.insert({ job_id: id, position: i + 1, base, caption: p.caption || '', w: p.large_w, h: p.large_h });
        if (j.cover && p.file === j.cover) q.jobs.setCover(id, pid);
        count++;
      });
    });
    q.meta.set('seeded', '1');
  });
  return { seeded: true, jobs: jobs.length, photos: count };
}

module.exports = { seed };

if (require.main === module) {
  const r = seed({ force: process.argv.includes('--force') });
  console.log(r);
}
