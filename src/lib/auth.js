// Passwords (scrypt, built into Node — no native deps), login rate limiting,
// and the middleware that protects admin routes.
const crypto = require('crypto');
const { q } = require('../db');

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  try {
    const [, saltHex, hashHex] = stored.split('$');
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(password, salt, expected.length, { N: 16384, r: 8, p: 1 });
    return crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// Simple in-memory limiter: 8 failed attempts per IP per 15 minutes.
const attempts = new Map();
function loginAllowed(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec) return true;
  if (now - rec.first > 15 * 60 * 1000) { attempts.delete(ip); return true; }
  return rec.count < 8;
}
function loginFailed(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.first > 15 * 60 * 1000) attempts.set(ip, { first: now, count: 1 });
  else rec.count++;
}
function loginSucceeded(ip) { attempts.delete(ip); }

// Attach req.user from the session cookie (if any).
function loadUser(req, res, next) {
  req.user = null;
  if (req.session && req.session.uid) {
    req.user = q.users.byId(req.session.uid) || null;
    if (!req.user) req.session = null;
  }
  res.locals.user = req.user;
  next();
}

function requireUser(req, res, next) {
  if (req.user) return next();
  if (q.users.count() === 0) return res.redirect('/admin/setup');
  req.session.returnTo = req.originalUrl;
  res.redirect('/admin/login');
}

module.exports = { hashPassword, verifyPassword, loginAllowed, loginFailed, loginSucceeded, loadUser, requireUser };
