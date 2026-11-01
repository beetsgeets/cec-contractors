// End-to-end check of the admin in a phone-sized browser. Run against a fresh
// local server:  PORT=3101 node server.js &  then  node test/admintest.js
const { chromium } = require('playwright');
const S = process.env.SHOTS || '/tmp/claude-0/-home-claude/b324b5d4-5ccc-50fc-9bc9-e968793da626/scratchpad/';
const base = process.env.BASE || 'http://localhost:3101';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
  // 1. setup
  await p.goto(base + '/admin'); console.log('admin ->', p.url());
  await p.fill('#name', 'Matt'); await p.fill('#email', 'matt@cutting-edgecarpentry.com'); await p.fill('#password', 'test-password-123');
  await p.click('.auth-form button[type=submit]'); await p.waitForLoadState('networkidle'); console.log('after setup ->', p.url());
  await p.screenshot({ path: S + 'adm-dash.png', fullPage: true });
  // 2. post a job from "phone"
  await p.goto(base + '/admin/jobs/new');
  await p.screenshot({ path: S + 'adm-new.png', fullPage: true });
  await p.setInputFiles('#photos', ['/home/claude/job3/matt-picks/01_profile-template.jpg', '/home/claude/job3/matt-picks/02_curved-rail-joint.jpg', '/home/claude/job7/matt-picks/01_finished-screens-hero.jpg']);
  await p.fill('#title', 'Test job from phone'); await p.fill('#town', 'Grand River'); await p.fill('#year', '2026');
  await p.fill('#summary', 'A test post to make sure the admin works.'); await p.fill('#body', 'First paragraph.\n\nSecond paragraph.'); await p.fill('#scope', 'Thing one\nThing two');
  await p.click('#submit'); await p.waitForLoadState('networkidle'); console.log('after post ->', p.url());
  await p.screenshot({ path: S + 'adm-edit.png', fullPage: true });
  const n = await p.locator('#photogrid li').count(); console.log('photos on job:', n);
  await p.locator('#photogrid li').nth(1).locator('.photo-caption').fill('A caption'); await p.locator('#photogrid li').nth(1).locator('.photo-caption').dispatchEvent('change'); await p.waitForTimeout(400);
  await p.locator('#photogrid li').nth(1).locator('.act-cover').click(); await p.waitForTimeout(400);
  p.once('dialog', d => d.accept()); await p.locator('#photogrid li').nth(2).locator('.act-delete').click(); await p.waitForTimeout(500);
  console.log('photos after delete:', await p.locator('#photogrid li').count());
  // 3. public job page
  await p.goto(base + '/work/grand-river-test-job-from-phone'); console.log('public job page title:', await p.title());
  await p.screenshot({ path: S + 'job-m.png', fullPage: true });
  // 4. inline edit on home
  await p.goto(base + '/'); await p.click('text=Edit this page’s text'); await p.waitForLoadState('networkidle');
  const h = p.locator('.ed[data-k="home.hero.title"]'); await h.click(); await p.keyboard.press('Control+End'); await p.keyboard.type(' Edited.');
  await p.waitForTimeout(200); console.log('save enabled?', await p.locator('#edit-save').isEnabled());
  await p.click('#edit-save'); await p.waitForTimeout(800);
  await p.screenshot({ path: S + 'edit-m.png', fullPage: false });
  await p.click('text=Done'); await p.waitForLoadState('networkidle');
  const html = await p.content(); console.log('edit persisted?', html.includes('Finished with pride. Edited.'));
  // 5. contact form
  await p.goto(base + '/contact'); await p.fill('#f-name', 'Jane Tester'); await p.fill('#f-phone', '216-555-0100'); await p.fill('#f-town', 'Lakewood'); await p.selectOption('#f-type', 'Stairs or railings'); await p.fill('#f-msg', 'Need a new rail.');
  await p.click('form.form button[type=submit]'); await p.waitForLoadState('networkidle'); console.log('contact ->', p.url());
  await p.screenshot({ path: S + 'contact-sent-m.png', fullPage: true });
  await p.goto(base + '/admin/leads'); await p.screenshot({ path: S + 'adm-leads.png', fullPage: true });
  console.log('lead listed?', (await p.content()).includes('Jane Tester'));
  // 6. settings
  await p.goto(base + '/admin/settings'); await p.screenshot({ path: S + 'adm-settings.png', fullPage: true });
  await b.close();
  console.log('DONE');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
