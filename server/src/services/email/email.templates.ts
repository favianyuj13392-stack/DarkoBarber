export interface PasswordResetTemplateParams {
  name?: string;
  resetUrl: string;
  token: string;
  expiresInMinutes?: number;
}

export interface TestEmailTemplateParams {
  recipient: string;
  timestamp: string;
}

export function renderPasswordResetTemplate({
  name = 'Colega',
  resetUrl,
  token,
  expiresInMinutes = 30,
}: PasswordResetTemplateParams): { subject: string; html: string; text: string } {
  const subject = 'FADE — Restablecer tu contraseña';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #050505;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #F5EBDD;
    }
    .wrapper {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .card {
      background: #0d0d0d;
      border: 1px solid rgba(182, 143, 78, 0.25);
      border-radius: 20px;
      padding: 36px 32px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.8);
    }
    .brand {
      text-align: center;
      margin-bottom: 28px;
    }
    .brand-logo {
      font-size: 28px;
      font-weight: 900;
      letter-spacing: 0.25em;
      color: #B68F4E;
      text-transform: uppercase;
      margin: 0;
    }
    .brand-tagline {
      font-size: 11px;
      letter-spacing: 0.15em;
      color: #D9C9B0;
      opacity: 0.6;
      text-transform: uppercase;
      margin-top: 4px;
    }
    h1 {
      font-size: 20px;
      color: #FFFFFF;
      margin: 0 0 16px 0;
      font-weight: 700;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #D9C9B0;
      margin: 0 0 16px 0;
    }
    .token-box {
      background: #141414;
      border: 1px dashed rgba(182, 143, 78, 0.4);
      border-radius: 12px;
      padding: 16px;
      text-align: center;
      margin: 24px 0;
    }
    .token-label {
      font-size: 11px;
      letter-spacing: 0.1em;
      color: #B68F4E;
      text-transform: uppercase;
      margin-bottom: 6px;
    }
    .token-code {
      font-family: monospace;
      font-size: 22px;
      font-weight: bold;
      color: #FFFFFF;
      letter-spacing: 0.15em;
    }
    .btn-container {
      text-align: center;
      margin: 28px 0;
    }
    .btn {
      display: inline-block;
      background: linear-gradient(180deg, #F3E9DC 0%, #D9C9B0 50%, #C2AE91 100%);
      color: #050505 !important;
      text-decoration: none;
      font-weight: 700;
      font-size: 14px;
      padding: 14px 32px;
      border-radius: 12px;
      letter-spacing: 0.05em;
      box-shadow: 0 8px 20px rgba(182, 143, 78, 0.3);
    }
    .footer {
      text-align: center;
      margin-top: 28px;
      font-size: 12px;
      color: #736b5e;
      line-height: 1.5;
    }
    .divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.08);
      margin: 24px 0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="card">
      <div class="brand">
        <h2 class="brand-logo">FADE</h2>
        <div class="brand-tagline">Barber Hub & Ecosistema de Precisión</div>
      </div>

      <h1>Recuperación de Contraseña</h1>
      <p>Hola <strong>${name}</strong>,</p>
      <p>Recibimos una solicitud para restablecer la contraseña asociada a tu cuenta en <strong>FADE</strong>. Puedes cambiarla haciendo clic en el siguiente botón:</p>

      <div class="btn-container">
        <a href="${resetUrl}" target="_blank" class="btn">Restablecer mi Contraseña</a>
      </div>

      <div class="token-box">
        <div class="token-label">Código de Verificación</div>
        <div class="token-code">${token}</div>
      </div>

      <p style="font-size: 13px; color: #a89f91;">
        ⏰ Este enlace y código son válidos durante <strong>${expiresInMinutes} minutos</strong>.
      </p>

      <div class="divider"></div>

      <p style="font-size: 12px; color: #736b5e; margin-bottom: 0;">
        Si tú no solicitaste este cambio, puedes desestimar este mensaje de forma segura. Tu cuenta y contraseña actual continúan protegidas.
      </p>
    </div>

    <div class="footer">
      <p>FADE — DarkoBarber Ecosystem<br>
      Este es un correo transaccional automático. Si necesitas asistencia, contáctanos en <a href="mailto:soporte@darkosync.com" style="color: #B68F4E;">soporte@darkosync.com</a>.</p>
    </div>
  </div>
</body>
</html>`;

  const text = `FADE — Recuperación de Contraseña

Hola ${name},

Recibimos una solicitud para restablecer la contraseña de tu cuenta en FADE.

Para continuar, ingresa al siguiente enlace en tu navegador:
${resetUrl}

O utiliza el siguiente código de verificación en la aplicación:
Código: ${token}

Este código expira en ${expiresInMinutes} minutos.

Si no solicitaste este cambio, ignora este mensaje.

---
FADE Barber Hub (soporte@darkosync.com)`;

  return { subject, html, text };
}

export function renderTestEmailTemplate({
  recipient,
  timestamp,
}: TestEmailTemplateParams): { subject: string; html: string; text: string } {
  const subject = 'FADE — Verificación de Servicio de Correos Resend';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>${subject}</title>
  <style>
    body { margin: 0; background-color: #050505; color: #F5EBDD; font-family: sans-serif; }
    .card { max-width: 540px; margin: 30px auto; background: #0e0e0e; border: 1px solid #B68F4E; border-radius: 16px; padding: 28px; }
    .badge { display: inline-block; background: rgba(52, 211, 153, 0.15); color: #34D399; border: 1px solid rgba(52, 211, 153, 0.4); padding: 4px 12px; border-radius: 8px; font-size: 11px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="card">
    <div style="text-align:center; margin-bottom: 16px;">
      <h2 style="color: #B68F4E; margin: 0; letter-spacing: 0.2em;">FADE</h2>
      <span class="badge">INTEGRACIÓN EXITOSA</span>
    </div>
    <h3 style="color: #FFFFFF;">Servicio de Correo Operativo</h3>
    <p style="font-size: 14px; color: #D9C9B0;">
      Este es un mensaje de prueba emitido desde <strong>Fade &lt;fade@mail.darkosync.com&gt;</strong> a través de <strong>Resend</strong>.
    </p>
    <ul style="font-size: 13px; color: #a89f91;">
      <li>Destinatario: <strong>${recipient}</strong></li>
      <li>Timestamp: <strong>${timestamp}</strong></li>
      <li>Proveedor: <strong>Resend API</strong></li>
    </ul>
  </div>
</body>
</html>`;

  const text = `FADE — Verificación de Servicio de Correos Resend

La integración con Resend está funcionando correctamente.
Destinatario: ${recipient}
Fecha: ${timestamp}
Remitente: Fade <fade@mail.darkosync.com>`;

  return { subject, html, text };
}
