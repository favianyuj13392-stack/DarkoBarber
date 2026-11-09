import { IMailAdapter, SendMailResult } from './mail.types';
import { ResendMailAdapter } from './resend.adapter';
import {
  renderPasswordResetTemplate,
  renderTestEmailTemplate,
  PasswordResetTemplateParams,
} from './email.templates';

export class EmailService {
  constructor(private adapter: IMailAdapter = new ResendMailAdapter()) {}

  /**
   * Dispatches a password recovery email with both a clickable direct link and a numeric/alphanumeric code.
   */
  async sendPasswordResetEmail(
    to: string,
    params: PasswordResetTemplateParams
  ): Promise<SendMailResult> {
    const { subject, html, text } = renderPasswordResetTemplate(params);

    return this.adapter.send({
      to,
      subject,
      html,
      text,
    });
  }

  /**
   * Dispatches a connectivity test email.
   */
  async sendTestEmail(to: string): Promise<SendMailResult> {
    const { subject, html, text } = renderTestEmailTemplate({
      recipient: to,
      timestamp: new Date().toISOString(),
    });

    return this.adapter.send({
      to,
      subject,
      html,
      text,
    });
  }
}

export const emailService = new EmailService();
