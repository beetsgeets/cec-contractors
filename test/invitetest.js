const {chromium}=require('playwright');
const base='http://localhost:3101';
(async()=>{
  const b=await chromium.launch();
  const matt=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  await matt.goto(base+'/admin/setup'); await matt.fill('#name','Matt'); await matt.fill('#email','matt@cutting-edgecarpentry.com'); await matt.fill('#password','test-password-123'); await matt.click('.auth-form button[type=submit]'); await matt.waitForLoadState('networkidle');
  await matt.goto(base+'/admin/settings'); await matt.click('form[action="/admin/invites"] button'); await matt.waitForLoadState('networkidle');
  const link=await matt.locator('.invitelist input').first().inputValue(); console.log('invite link:',link);
  await matt.screenshot({path:'/tmp/claude-0/-home-claude/b324b5d4-5ccc-50fc-9bc9-e968793da626/scratchpad/adm-invite.png',fullPage:true});
  // Mike, separate browser context (not logged in)
  const mike=await (await b.newContext({viewport:{width:390,height:844}})).newPage();
  await mike.goto(link); await mike.screenshot({path:'/tmp/claude-0/-home-claude/b324b5d4-5ccc-50fc-9bc9-e968793da626/scratchpad/join-m.png',fullPage:true});
  await mike.fill('#name','Mike'); await mike.fill('#email','mike@cutting-edgecarpentry.com'); await mike.fill('#password','mikes-own-password-1'); await mike.click('.auth-form button[type=submit]'); await mike.waitForLoadState('networkidle');
  console.log('mike lands on:',mike.url(), '| signed in?', (await mike.content()).includes('Welcome, Mike'));
  await mike.goto(link); console.log('link reused ->', (await mike.content()).includes('expired') ? 'blocked (good)' : 'STILL WORKS (bad)');
  await matt.goto(base+'/admin/settings'); console.log('users listed:', (await matt.locator('.userlist li').allTextContents()).map(s=>s.trim().replace(/\s+/g,' ')));
  await b.close();
})().catch(e=>{console.error('FAIL',e);process.exit(1);});
