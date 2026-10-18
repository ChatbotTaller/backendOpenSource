const jwt = require('jsonwebtoken');
const { getRequiredEnv } = require('../config/environment');

const PRIVACY_NOTICE_VERSION = '2026-10-11';

function acknowledgePrivacyNotice(req, res) {
  if (req.body?.accepted !== true || req.body?.version !== PRIVACY_NOTICE_VERSION) {
    return res.status(400).json({ error: 'Debes revisar la versión vigente del aviso.' });
  }

  const token = jwt.sign(
    { version: PRIVACY_NOTICE_VERSION },
    getRequiredEnv('JWT_SECRET'),
    { issuer: 'mara', audience: 'privacy-notice', expiresIn: '30m' }
  );
  res.set('Cache-Control', 'no-store');
  return res.json({ acknowledgement: token, version: PRIVACY_NOTICE_VERSION });
}

function requirePrivacyAcknowledgement(req, res, next) {
  const token = req.headers['x-privacy-acknowledgement'];
  if (typeof token !== 'string' || !token) {
    return res.status(403).json({ error: 'Revisa el aviso de privacidad antes de identificarte.' });
  }

  try {
    const payload = jwt.verify(token, getRequiredEnv('JWT_SECRET'), {
      issuer: 'mara',
      audience: 'privacy-notice'
    });
    if (payload.version !== PRIVACY_NOTICE_VERSION) throw new Error('Versión anterior');
    req.privacyNoticeVersion = payload.version;
    return next();
  } catch {
    return res.status(403).json({ error: 'La confirmación del aviso venció. Revísalo nuevamente.' });
  }
}

module.exports = {
  PRIVACY_NOTICE_VERSION,
  acknowledgePrivacyNotice,
  requirePrivacyAcknowledgement
};
