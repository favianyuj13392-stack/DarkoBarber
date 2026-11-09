import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { emailService } from '../src/services/email/email.service';

async function main() {
  const targetEmail = process.argv[2] || 'ernestosalinasm@gmail.com';

  console.log('--------------------------------------------------');
  console.log('   FADE — Resend Transactional Email Test CLI    ');
  console.log('--------------------------------------------------');
  console.log(`Remitente:   ${process.env.RESEND_FROM || 'Fade <fade@mail.darkosync.com>'}`);
  console.log(`Destinatario: ${targetEmail}`);
  console.log(`API Key:     ${process.env.RESEND_API_KEY ? `${process.env.RESEND_API_KEY.substring(0, 7)}...` : 'NO DEFINIDA'}`);
  console.log('--------------------------------------------------');

  console.log('Enviando correo de prueba vía Resend...');
  const result = await emailService.sendTestEmail(targetEmail);

  if (result.success) {
    console.log('✅ Correo de prueba enviado exitosamente!');
    console.log(`ID de Mensaje: ${result.messageId}`);
  } else {
    console.error('❌ Error enviando correo de prueba:', result.error);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Excepción no controlada:', err);
  process.exit(1);
});
