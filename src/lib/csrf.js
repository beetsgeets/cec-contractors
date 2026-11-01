// Per-session CSRF token. Forms include it as a hidden input; fetch() calls
// send it in the X-CSRF-Token header.
const crypto = require('crypto');

function csrf(req, res, next) {
  if (!req.session.csrf) req.session.csrf = crypto.randomBytes(24).toString('hex');
  res.locals.csrf = req.session.csrf;
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    // multipart forms can't be read before multer runs, so they pass the token in the URL
    const sent = (req.body && req.body._csrf) || req.get('x-csrf-token') || req.query._csrf;
    if (!sent || sent !== req.session.csrf) {
      return res.status(403).send('Your session expired. Go back, refresh the page, and try again.');
    }
  }
  next();
}

module.exports = { csrf };
