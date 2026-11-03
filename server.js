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
} catch (e) {
  console.error('Seeding failed:', e);
}

const app = require('./src/app');
app.listen(cfg.PORT, () => {
  console.log(`CEC Contractors site listening on http://localhost:${cfg.PORT}  (data: ${cfg.DATA_DIR})`);
});
