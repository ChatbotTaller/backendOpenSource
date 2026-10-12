const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email';
const DEFAULT_LOGO_URL = 'https://multichat-reyespolo.vercel.app/ReyesPolo.jpeg';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function getLogoUrl() {
  try {
    const url = new URL(process.env.EMAIL_LOGO_URL || DEFAULT_LOGO_URL);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('URL de logo inválida');
    return url.toString();
  } catch {
    return DEFAULT_LOGO_URL;
  }
}

function renderPasswordResetEmail(resetUrl) {
  const safeLink = escapeHtml(resetUrl);
  const safeLogo = escapeHtml(getLogoUrl());

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0b0b0e;color:#f8f7f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Solicitaste restablecer tu acceso administrativo a MARA. El enlace vence en 15 minutos.</div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#0b0b0e;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:560px;background:#17171b;border:1px solid #303035;border-radius:18px;">
        <tr><td style="padding:28px 32px 22px;border-bottom:1px solid #303035;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="padding-right:14px;"><img src="${safeLogo}" width="54" height="54" alt="Logo de Taller Reyes Polo" style="display:block;width:54px;height:54px;border-radius:12px;border:1px solid #6b2220;background:#000;"></td>
            <td><div style="color:#fff;font-size:17px;font-weight:700;line-height:1.3;">Taller Reyes Polo</div><div style="color:#a8a7ad;font-size:12px;line-height:1.5;">Asistente virtual MARA</div></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:32px 32px 28px;">
          <div style="color:#ff6858;font-size:11px;font-weight:700;letter-spacing:1.5px;">SEGURIDAD DE TU CUENTA</div>
          <h1 style="margin:12px 0 14px;color:#fff;font-size:27px;line-height:1.2;">Recupera tu acceso</h1>
          <p style="margin:0 0 22px;color:#cbcbd0;font-size:15px;line-height:1.7;">Recibimos una solicitud para cambiar la contraseña del panel administrativo de MARA. Para continuar, utiliza el botón de abajo.</p>
          <table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="#d82d20" style="border-radius:10px;">
            <a href="${safeLink}" style="display:inline-block;padding:15px 24px;color:#fff;font-size:14px;font-weight:700;text-decoration:none;">Restablecer contraseña &rarr;</a>
          </td></tr></table>
          <p style="margin:22px 0 0;color:#a8a7ad;font-size:13px;line-height:1.6;">El enlace vence en <strong style="color:#fff;">15 minutos</strong> y solo funciona hasta que cambies la contraseña.</p>
          <p style="margin:10px 0 0;color:#a8a7ad;font-size:13px;line-height:1.6;">Si el botón no funciona, <a href="${safeLink}" style="color:#ff8d80;text-decoration:underline;">abre el enlace desde aquí</a>.</p>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #303035;background:#121215;border-radius:0 0 18px 18px;">
          <p style="margin:0;color:#a8a7ad;font-size:12px;line-height:1.6;">¿No solicitaste este cambio? Ignora el mensaje. Tu contraseña seguirá igual. Nunca compartas este correo ni el enlace con otra persona.</p>
        </td></tr>
      </table>
      <p style="margin:18px 0 0;color:#777780;font-size:11px;">Taller Reyes Polo · Trujillo, La Libertad</p>
    </td></tr>
  </table>
</body></html>`;
}

async function sendPasswordResetEmail(to, resetUrl) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) throw new Error('Brevo no configurado');

  const response = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      sender: { name: 'Taller Reyes Polo', email: senderEmail },
      to: [{ email: to }],
      subject: 'Restablece tu contraseña de MARA | Taller Reyes Polo',
      htmlContent: renderPasswordResetEmail(resetUrl),
      tags: ['mara-password-reset']
    }),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const error = new Error('Brevo rechazó el correo transaccional');
    error.status = response.status;
    throw error;
  }
}

module.exports = { sendPasswordResetEmail, renderPasswordResetEmail };
