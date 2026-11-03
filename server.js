const cfg = require('./src/config');
const { seed, reorderSeededPhotos, backfillSlugAliases } = require('./seed/seed');

// First start on an empty database: load the initial jobs and photos.
try {
  const r = seed();
  if (r.seeded) console.log(`Seeded ${r.jobs} jobs, ${r.photos} photos.`);
  const m = reorderSeededPhotos();
  if (m.applied) console.log(`Photo order updated on ${m.jobs} jobs.`);
  const a = backfillSlugAliases();
  if (a.applied) console.log(`Kept ${a.added} old job addresses working.`);
  // One-time: run requests that arrived before the spam filter through it.
  const { q } = require('./src/db');
  if (q.meta.get('lead_spam_v1') !== '1') {
    const { spamReason } = require('./src/lib/spam');
    let flagged = 0;
    for (const l of q.leads.unarchived()) { const why = spamReason(l); if (why) { q.leads.setSpam(l.id, true, why); flagged++; } }
    q.meta.set('lead_spam_v1', '1');
    if (flagged) console.log(`Moved ${flagged} earlier request(s) to Probably spam.`);
  }
} catch (e) {
  console.error('Seeding failed:', e);
}

const app = require('./src/app');
app.listen(cfg.PORT, () => {
  console.log(`CEC Contractors site listening on http://localhost:${cfg.PORT}  (data: ${cfg.DATA_DIR})`);
});
