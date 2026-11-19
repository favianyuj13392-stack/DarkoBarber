import { PrismaClient } from '@prisma/client';
import { emailService as defaultEmailService, EmailService } from '../../services/email/email.service';
import { laPazDaysBetween, laPazMonthStartUtc } from '../../utils/la-paz-date';

export const PRO_REMINDER_EMAIL_MONTHLY_LIMIT = 12;
export const DEFAULT_CUT_CYCLE_DAYS = 21;

export interface FidelityCutInput {
  id: string;
  startedAt: Date;
  chips: any;
  clientProfile?: {
    id: string;
    name: string;
    clientId?: string | null;
    client?: {
      id: string;
      displayName?: string | null;
      phone?: string | null;
      email?: string | null;
    } | null;
  } | null;
  clientProfileId?: string;
}

export interface FidelityStats {
  totalCuts: number;
  uniqueClients: number;
  recurringClients: number;
  recurrenceRate: number; // 0 - 100 percentage
  averageCycleDays: number | null;
  topStyles: { name: string; count: number }[];
}

export interface ClientDueForCut {
  clientId: string;
  clientName: string;
  phone: string | null;
  email: string | null;
  daysSinceLastCut: number;
  averageCycleDays: number;
  daysOverdue: number;
  lastCutDate: string;
  whatsappUrl: string | null;
}

/** Formats Bolivian or international phone numbers for wa.me links */
export function buildWhatsAppReminderUrl(
  phone: string | null | undefined,
  clientName: string,
  barberDisplayName: string,
  daysSinceLastCut: number
): string | null {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, '');
  if (!clean) return null;
  const finalPhone = clean.length === 8 ? `591${clean}` : clean;

  const message = `¡Hola ${clientName}! 👋 Te saluda ${barberDisplayName} de FADE. Hace ya ${daysSinceLastCut} días desde tu último corte y es el momento ideal para renovar el estilo. ¿Te gustaría coordinar un espacio esta semana?`;
  return `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
}

/** Pure calculation of barber fidelity and recurrence metrics */
export function computeFidelityStats(cuts: FidelityCutInput[]): FidelityStats {
  const totalCuts = cuts.length;
  if (totalCuts === 0) {
    return {
      totalCuts: 0,
      uniqueClients: 0,
      recurringClients: 0,
      recurrenceRate: 0,
      averageCycleDays: null,
      topStyles: [],
    };
  }

  const clientCutsMap = new Map<string, Date[]>();
  const styleCountMap = new Map<string, number>();

  for (const cut of cuts) {
    const clientId = cut.clientProfile?.clientId || cut.clientProfileId || 'anon';
    if (!clientCutsMap.has(clientId)) {
      clientCutsMap.set(clientId, []);
    }
    clientCutsMap.get(clientId)!.push(new Date(cut.startedAt));

    // Extract style name from chips
    let styleName = 'Corte Estándar';
    if (cut.chips && typeof cut.chips === 'object') {
      const c = cut.chips as Record<string, any>;
      if (c.styleName && typeof c.styleName === 'string' && c.styleName.trim()) {
        styleName = c.styleName.trim();
      } else if (c.notes && typeof c.notes === 'string' && c.notes.trim()) {
        styleName = c.notes.trim().slice(0, 24);
      }
    }
    styleCountMap.set(styleName, (styleCountMap.get(styleName) || 0) + 1);
  }

  const uniqueClients = clientCutsMap.size;
  let recurringClients = 0;
  let totalIntervalDays = 0;
  let totalIntervalsCount = 0;

  for (const dates of clientCutsMap.values()) {
    if (dates.length >= 2) {
      recurringClients++;
      dates.sort((a, b) => a.getTime() - b.getTime());
      for (let i = 1; i < dates.length; i++) {
        const diff = Math.max(1, laPazDaysBetween(dates[i - 1], dates[i]));
        totalIntervalDays += diff;
        totalIntervalsCount++;
      }
    }
  }

  const recurrenceRate = uniqueClients > 0
    ? Math.round((recurringClients / uniqueClients) * 100)
    : 0;

  const averageCycleDays = totalIntervalsCount > 0
    ? Math.round(totalIntervalDays / totalIntervalsCount)
    : null;

  const topStyles = Array.from(styleCountMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return {
    totalCuts,
    uniqueClients,
    recurringClients,
    recurrenceRate,
    averageCycleDays,
    topStyles,
  };
}

/** Pure identification of clients overdue for their next haircut */
export function computeDueForCutClients(
  cuts: FidelityCutInput[],
  barberDisplayName: string,
  now: Date = new Date()
): ClientDueForCut[] {
  if (cuts.length === 0) return [];

  // Group cuts by client
  const clientGroups = new Map<
    string,
    {
      clientName: string;
      phone: string | null;
      email: string | null;
      dates: Date[];
    }
  >();

  for (const cut of cuts) {
    const clientId =
      cut.clientProfile?.client?.id ||
      cut.clientProfile?.clientId ||
      cut.clientProfileId ||
      'anon';

    const clientName =
      cut.clientProfile?.client?.displayName ||
      cut.clientProfile?.name ||
      'Cliente';

    const phone = cut.clientProfile?.client?.phone || null;
    const email = cut.clientProfile?.client?.email || null;

    if (!clientGroups.has(clientId)) {
      clientGroups.set(clientId, {
        clientName,
        phone,
        email,
        dates: [],
      });
    }

    const group = clientGroups.get(clientId)!;
    group.dates.push(new Date(cut.startedAt));
    if (!group.phone && phone) group.phone = phone;
    if (!group.email && email) group.email = email;
  }

  const dueList: ClientDueForCut[] = [];

  for (const [clientId, info] of clientGroups.entries()) {
    info.dates.sort((a, b) => a.getTime() - b.getTime());
    const lastCutDate = info.dates[info.dates.length - 1];
    const daysSinceLastCut = Math.max(0, laPazDaysBetween(lastCutDate, now));

    // Calculate personal cycle or fallback to default 21 days
    let cycleDays = DEFAULT_CUT_CYCLE_DAYS;
    if (info.dates.length >= 2) {
      let intervalSum = 0;
      for (let i = 1; i < info.dates.length; i++) {
        intervalSum += Math.max(1, laPazDaysBetween(info.dates[i - 1], info.dates[i]));
      }
      const rawAvg = Math.round(intervalSum / (info.dates.length - 1));
      // Clamp between 7 and 60 days to prevent distorted outlier averages
      cycleDays = Math.min(60, Math.max(7, rawAvg));
    }

    if (daysSinceLastCut >= cycleDays) {
      const daysOverdue = daysSinceLastCut - cycleDays;
      const whatsappUrl = buildWhatsAppReminderUrl(
        info.phone,
        info.clientName,
        barberDisplayName,
        daysSinceLastCut
      );

      dueList.push({
        clientId,
        clientName: info.clientName,
        phone: info.phone,
        email: info.email,
        daysSinceLastCut,
        averageCycleDays: cycleDays,
        daysOverdue,
        lastCutDate: lastCutDate.toISOString(),
        whatsappUrl,
      });
    }
  }

  // Sort by highest days overdue (most urgent reactivation first)
  return dueList.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export class FidelityService {
  constructor(
    private prisma: PrismaClient,
    private mailer: Pick<EmailService, 'sendDueForCutReminderEmail'> = defaultEmailService
  ) {}

  /** Retrieves fidelity stats for a barber. If barber is not PRO, returns isPro: false */
  async getFidelityStats(barberId: string) {
    const barber = await this.prisma.barber.findUnique({
      where: { id: barberId },
      select: { id: true, plan: true, displayName: true },
    });

    if (!barber || barber.plan !== 'PRO') {
      return {
        isPro: false,
        message: 'Función de estadísticas y analítica exclusiva del Plan Pro',
        stats: null,
      };
    }

    const cuts = await this.prisma.cut.findMany({
      where: {
        barberId,
        status: 'FINISHED',
      },
      include: {
        clientProfile: {
          include: {
            client: true,
          },
        },
      },
      orderBy: { startedAt: 'asc' },
    });

    const stats = computeFidelityStats(cuts);

    return {
      isPro: true,
      stats,
    };
  }

  /**
   * Retrieves clients due for a haircut based on personal cycle.
   * Exclusively available for PRO barbers.
   */
  async getDueForCutClients(barberId: string, now: Date = new Date()) {
    const barber = await this.prisma.barber.findUnique({
      where: { id: barberId },
      select: { id: true, plan: true, displayName: true },
    });

    if (!barber || barber.plan !== 'PRO') {
      return {
        isPro: false,
        message: 'Función de reactivación y alertas exclusiva del Plan Pro',
        emailQuota: {
          sentThisMonth: 0,
          monthlyLimit: PRO_REMINDER_EMAIL_MONTHLY_LIMIT,
          remaining: 0,
        },
        dueClients: [],
      };
    }

    const cuts = await this.prisma.cut.findMany({
      where: {
        barberId,
        status: 'FINISHED',
      },
      include: {
        clientProfile: {
          include: {
            client: true,
          },
        },
      },
      orderBy: { startedAt: 'asc' },
    });

    const dueClients = computeDueForCutClients(cuts, barber.displayName, now);

    // Calculate monthly email reminder quota
    const monthStart = laPazMonthStartUtc(now);
    let sentThisMonth = 0;
    try {
      sentThisMonth = await this.prisma.barberReminderLog.count({
        where: {
          barberId,
          channel: 'EMAIL',
          sentAt: { gte: monthStart },
        },
      });
    } catch {
      // Table fallback if DB migration not applied yet
      sentThisMonth = 0;
    }

    const remaining = Math.max(0, PRO_REMINDER_EMAIL_MONTHLY_LIMIT - sentThisMonth);

    return {
      isPro: true,
      emailQuota: {
        sentThisMonth,
        monthlyLimit: PRO_REMINDER_EMAIL_MONTHLY_LIMIT,
        remaining,
      },
      dueClients,
    };
  }

  /**
   * Dispatches a branded reminder email to a client due for a cut.
   * Gated to PRO with rate limiting (12 emails/mo).
   */
  async sendDueForCutReminder(
    barberId: string,
    clientId: string,
    now: Date = new Date()
  ) {
    const barber = await this.prisma.barber.findUnique({
      where: { id: barberId },
      select: { id: true, plan: true, displayName: true },
    });

    if (!barber || barber.plan !== 'PRO') {
      return {
        error: 'FORBIDDEN',
        message: 'El envío de notificaciones automáticas es exclusivo del Plan Pro',
      };
    }

    // Check monthly quota
    const monthStart = laPazMonthStartUtc(now);
    let sentThisMonth = 0;
    try {
      sentThisMonth = await this.prisma.barberReminderLog.count({
        where: {
          barberId,
          channel: 'EMAIL',
          sentAt: { gte: monthStart },
        },
      });
    } catch {
      sentThisMonth = 0;
    }

    if (sentThisMonth >= PRO_REMINDER_EMAIL_MONTHLY_LIMIT) {
      return {
        error: 'QUOTA_EXCEEDED',
        message: `Has alcanzado el límite mensual de ${PRO_REMINDER_EMAIL_MONTHLY_LIMIT} recordatorios automáticos por email. Puedes seguir contactando a tus clientes ilimitadamente por WhatsApp.`,
        remaining: 0,
      };
    }

    // Find client
    let client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, email: true, displayName: true },
    });

    if (!client) {
      // Check if clientId was passed as clientProfileId
      const profile = await this.prisma.clientProfile.findUnique({
        where: { id: clientId },
        include: { client: true },
      });
      if (profile?.client) {
        client = {
          id: profile.client.id,
          email: profile.client.email,
          displayName: profile.client.displayName || profile.name,
        };
      }
    }

    if (!client || !client.email) {
      return {
        error: 'CLIENT_NO_EMAIL',
        message: 'El cliente no tiene un correo electrónico registrado en FADE. Contáctalo vía WhatsApp.',
      };
    }

    // Find days since last cut
    const lastCut = await this.prisma.cut.findFirst({
      where: {
        barberId,
        status: 'FINISHED',
        OR: [
          { clientProfile: { clientId: client.id } },
          { clientProfileId: clientId },
        ],
      },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    });

    const daysSinceLastCut = lastCut
      ? Math.max(1, laPazDaysBetween(new Date(lastCut.startedAt), now))
      : DEFAULT_CUT_CYCLE_DAYS;

    // Dispatch email
    const mailResult = await this.mailer.sendDueForCutReminderEmail(client.email, {
      clientName: client.displayName || 'Cliente',
      barberName: barber.displayName,
      daysSinceLastCut,
      bookingUrl: 'https://fade.darkosync.com',
    });

    if (!mailResult.success) {
      return {
        error: 'EMAIL_SEND_FAILED',
        message: 'No se pudo enviar el correo de recordatorio.',
      };
    }

    // Record in DB
    try {
      await this.prisma.barberReminderLog.create({
        data: {
          barberId,
          clientId: client.id,
          channel: 'EMAIL',
          sentAt: now,
        },
      });
    } catch {
      // Ignored if table not created
    }

    return {
      success: true,
      message: `Recordatorio enviado exitosamente a ${client.email}`,
      remaining: Math.max(0, PRO_REMINDER_EMAIL_MONTHLY_LIMIT - sentThisMonth - 1),
    };
  }
}
