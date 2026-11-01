// Sends estimate-request emails through Resend's HTTP API (no SDK needed).
const { RESEND_API_KEY, MAIL_FROM, SITE_URL } = require('../config');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function sendLeadEmail(lead, toList, origin) {
  const site = origin || SITE_URL;
  if (!RESEND_API_KEY) return { ok: false, reason: 'RESEND_API_KEY not set' };
  const to = toList.map(s => s.trim()).filter(Boolean);
  if (!to.length) return { ok: false, reason: 'no recipients configured' };

  const rows = [
    ['Name', lead.name], ['Phone', lead.phone], ['Email', lead.email], ['Town', lead.town],
    ['Project', lead.project_type],
  ].filter(([, v]) => v);
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:15px;color:#1E2A33;max-width:560px">
      <h2 style="color:#00263A;margin:0 0 12px">New estimate request</h2>
      <table style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#35546A">${esc(k)}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>`).join('')}</table>
      <p style="white-space:pre-wrap;border-left:3px solid #8EC9E8;padding-left:12px;margin:16px 0">${esc(lead.message)}</p>
      <p style="color:#35546A;font-size:13px">Reply to this email to answer ${esc(lead.name || 'them')} directly.${lead.phone ? ` Or call ${esc(lead.phone)}.` : ''}<br>
      Every request is also saved under <a href="${site}/admin/leads">Estimate requests</a> on the website.</p>
    </div>`;
  const text = `New estimate request\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${lead.message}\n\nSaved at ${site}/admin/leads`;

  const body = {
    from: MAIL_FROM,
    to,
    subject: `Estimate request from ${lead.name || 'website'}${lead.town ? ` (${lead.town})` : ''}`,
    html, text,
  };
  if (lead.email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(lead.email)) body.reply_to = lead.email;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const t = await r.text().catch(() => '');
    return { ok: false, reason: `Resend ${r.status}: ${t.slice(0, 300)}` };
  }
  return { ok: true };
}

module.exports = { sendLeadEmail };
