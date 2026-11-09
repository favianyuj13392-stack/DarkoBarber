import { Resend } from 'resend';
import { IMailAdapter, SendMailOptions, SendMailResult } from './mail.types';

export class ResendMailAdapter implements IMailAdapter {
  private resendInstance: Resend | null = null;
  private explicitApiKey?: string;
  private readonly defaultFrom: string;
  private readonly defaultReplyTo: string;

  constructor(apiKey?: string, from?: string, replyTo?: string) {
    this.explicitApiKey = apiKey;
    this.defaultFrom = from || process.env.RESEND_FROM || 'Fade <fade@mail.darkosync.com>';
    this.defaultReplyTo = replyTo || process.env.RESEND_REPLY_TO || 'soporte@darkosync.com';
  }

  private getClient(): Resend | null {
    if (this.resendInstance) return this.resendInstance;

    const key = this.explicitApiKey || process.env.RESEND_API_KEY;
    if (key && key.trim().length > 0) {
      this.resendInstance = new Resend(key.trim());
      return this.resendInstance;
    }

    return null;
  }

  async send(options: SendMailOptions): Promise<SendMailResult> {
    const recipientList = Array.isArray(options.to) ? options.to : [options.to];
    const client = this.getClient();

    if (!client) {
      console.warn('[ResendMailAdapter] Warning: RESEND_API_KEY not configured. Running in mock/dry-run mode.');
      console.info('[ResendMailAdapter:DRY-RUN] Email simulated (no API key configured):', {
        to: recipientList,
        subject: options.subject,
      });
      return {
        success: true,
        messageId: `dry-run-${Date.now()}`,
      };
    }

    try {
      const fromAddress = process.env.RESEND_FROM || this.defaultFrom;
      const replyToAddress = options.replyTo || process.env.RESEND_REPLY_TO || this.defaultReplyTo;

      const response = await client.emails.send({
        from: fromAddress,
        to: recipientList,
        subject: options.subject,
        html: options.html,
        text: options.text,
        replyTo: replyToAddress,
      });

      if (response.error) {
        console.error('[ResendMailAdapter] Resend API error response:', {
          errorName: response.error.name,
          errorMessage: response.error.message,
          to: recipientList,
        });

        return {
          success: false,
          error: response.error.message,
        };
      }

      return {
        success: true,
        messageId: response.data?.id,
      };
    } catch (err: unknown) {
      // Fail-safe: capture network/API exceptions without exposing API key
      const errorMessage = err instanceof Error ? err.message : 'Unknown communication error';
      console.error('[ResendMailAdapter] Network or runtime exception while dispatching email:', {
        error: errorMessage,
        to: recipientList,
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }
}
