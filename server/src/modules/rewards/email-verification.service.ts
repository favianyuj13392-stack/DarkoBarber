import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { emailService as defaultEmailService, EmailService } from '../../services/email/email.service';
import { getRewardsConfig } from './rewards.config';
import { toLaPazDateString } from '../../utils/la-paz-date';

export const MIN_SECONDS_BETWEEN_VERIFICATION_EMAILS = 60;

export type VerifyRequestResult =
  | { status: 'ALREADY_VERIFIED' }
  | { status: 'SENT' }
  | { status: 'NO_EMAIL' }
  | { status: 'NOT_FOUND' }
  | { status: 'RATE_LIMITED'; reason: 'COOLDOWN' | 'DAILY_LIMIT'; retryAfterSeconds?: number }
  | { status: 'SEND_FAILED' };

/**
 * The verification token is `<clientId>.<secret>`. Only a SHA-256 of the secret
 * bound to the client's email at issue time is stored. If the email changes after the
 * link was issued, the recomputed hash no longer matches, so a link sent to one
 * address can never verify a different one.
 */
function hashToken(secret: string, email: string): string {
  return crypto.createHash('sha256').update(`${secret}:${email.trim().toLowerCase()}`).digest('hex');
}

export class EmailVerificationService {
  constructor(
    private prisma: PrismaClient,
    private mailer: Pick<EmailService, 'sendEmailVerificationEmail'> = defaultEmailService
  ) {}

  async requestVerification(clientId: string, now: Date = new Date()): Promise<VerifyRequestResult> {
    const config = getRewardsConfig();
    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client) return { status: 'NOT_FOUND' };
    if (client.emailVerifiedAt) return { status: 'ALREADY_VERIFIED' };
    if (!client.email) return { status: 'NO_EMAIL' };

    // Look back 36h so every La Paz day (24h) is fully covered regardless of offset.
    const recent = await this.prisma.emailVerificationToken.findMany({
      where: { clientId, createdAt: { gt: new Date(now.getTime() - 36 * 3600 * 1000) } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const last = recent[0];
    if (last) {
      const elapsed = (now.getTime() - last.createdAt.getTime()) / 1000;
      if (elapsed < MIN_SECONDS_BETWEEN_VERIFICATION_EMAILS) {
        return {
          status: 'RATE_LIMITED',
          reason: 'COOLDOWN',
          retryAfterSeconds: Math.ceil(MIN_SECONDS_BETWEEN_VERIFICATION_EMAILS - elapsed),
        };
      }
    }

    const today = toLaPazDateString(now);
    const sentToday = recent.filter((t) => toLaPazDateString(t.createdAt) === today).length;
    if (sentToday >= config.emailVerificationMaxPerDay) {
      return { status: 'RATE_LIMITED', reason: 'DAILY_LIMIT' };
    }

    const secret = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(now.getTime() + config.emailVerificationTtlHours * 3600 * 1000);

    // The row is created before sending so failed sends still count against the quota.
    await this.prisma.emailVerificationToken.create({
      data: { clientId, tokenHash: hashToken(secret, client.email), expiresAt },
    });

    const verifyUrl = `${config.appPublicUrl}/verify-email?token=${encodeURIComponent(`${clientId}.${secret}`)}`;
    const result = await this.mailer.sendEmailVerificationEmail(client.email, {
      name: client.displayName || undefined,
      verifyUrl,
      expiresInHours: config.emailVerificationTtlHours,
    });

    return result.success ? { status: 'SENT' } : { status: 'SEND_FAILED' };
  }

  /**
   * Consumes a verification token. Returns the verified client id, or null for any
   * failure (malformed, unknown, expired, used, email changed): callers must not
   * distinguish the causes.
   */
  async verifyToken(rawToken: string, now: Date = new Date()): Promise<string | null> {
    const dot = rawToken.indexOf('.');
    if (dot <= 0 || dot === rawToken.length - 1) return null;
    const clientId = rawToken.slice(0, dot);
    const secret = rawToken.slice(dot + 1);

    const client = await this.prisma.client.findUnique({ where: { id: clientId } });
    if (!client || !client.email) return null;

    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash: hashToken(secret, client.email) },
    });
    if (!record || record.clientId !== clientId || record.usedAt || record.expiresAt <= now) {
      return null;
    }

    const verified = await this.prisma.$transaction(async (tx) => {
      // Guarded update: only one concurrent request can consume the token.
      const consumed = await tx.emailVerificationToken.updateMany({
        where: { id: record.id, usedAt: null },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) return false;

      await tx.client.updateMany({
        where: { id: clientId, emailVerifiedAt: null },
        data: { emailVerifiedAt: now },
      });
      await tx.emailVerificationToken.updateMany({
        where: { clientId, usedAt: null },
        data: { usedAt: now },
      });
      return true;
    });

    return verified ? clientId : null;
  }
}
