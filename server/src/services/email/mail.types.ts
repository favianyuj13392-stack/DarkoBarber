export interface SendMailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface IMailAdapter {
  send(options: SendMailOptions): Promise<SendMailResult>;
}
