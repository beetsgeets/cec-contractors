const cfg = require('./src/config');
const { seed } = require('./seed/seed');

// First start on an empty database: load the initial jobs and photos.
try {
  const r = seed();
  if (r.seeded) console.log(`Seeded ${r.jobs} jobs, ${r.photos} photos.`);
} catch (e) {
  console.error('Seeding failed:', e);
}

const app = require('./src/app');
app.listen(cfg.PORT, () => {
  console.log(`CEC Contractors site listening on http://localhost:${cfg.PORT}  (data: ${cfg.DATA_DIR})`);
});
