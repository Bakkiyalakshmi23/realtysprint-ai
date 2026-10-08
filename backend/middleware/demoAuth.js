'use strict';

function requireDemoAuth(req, res, next) {
  // Existing UI login is demo-only. This header is likewise a local demo gate,
  // never a production identity provider or credential.
  if (process.env.NODE_ENV === 'production') {
    return res.status(503).json({ success: false, error: 'Demo authentication is disabled in production.' });
  }
  const authorization = req.headers.authorization || '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const token = req.headers['x-demo-session'] || bearer;
  if (token !== 'realtysprint-demo-session') {
    return res.status(401).json({ success: false, error: 'Authentication required. Sign in to the demo dashboard.' });
  }
  req.demoUser = { id: 'demo-admin', email: 'admin@realtysprint.ai', name: 'Founder', role: 'administrator' };
  return next();
}

module.exports = { requireDemoAuth };
