import { describe, it, expect } from 'vitest';
import {
  computeFidelityStats,
  computeDueForCutClients,
  buildWhatsAppReminderUrl,
  FidelityCutInput,
  DEFAULT_CUT_CYCLE_DAYS,
} from '../src/modules/fidelity/fidelity.service';

describe('fidelity.service: pure functions', () => {
  describe('buildWhatsAppReminderUrl', () => {
    it('returns null if no phone provided', () => {
      expect(buildWhatsAppReminderUrl(null, 'Carlos', 'Darko', 25)).toBeNull();
      expect(buildWhatsAppReminderUrl('', 'Carlos', 'Darko', 25)).toBeNull();
    });

    it('formats 8-digit Bolivian number with 591 country code', () => {
      const url = buildWhatsAppReminderUrl('77212345', 'Carlos', 'Darko', 25);
      expect(url).toContain('https://wa.me/59177212345?text=');
      expect(url).toContain(encodeURIComponent('Carlos'));
      expect(url).toContain(encodeURIComponent('Darko'));
      expect(url).toContain(encodeURIComponent('25'));
    });

    it('keeps existing country code if already present', () => {
      const url = buildWhatsAppReminderUrl('+59177212345', 'Carlos', 'Darko', 20);
      expect(url).toContain('https://wa.me/59177212345?text=');
    });
  });

  describe('computeFidelityStats', () => {
    it('returns zeroes when cuts array is empty', () => {
      const stats = computeFidelityStats([]);
      expect(stats.totalCuts).toBe(0);
      expect(stats.uniqueClients).toBe(0);
      expect(stats.recurringClients).toBe(0);
      expect(stats.recurrenceRate).toBe(0);
      expect(stats.averageCycleDays).toBeNull();
      expect(stats.topStyles).toEqual([]);
    });

    it('computes stats for single cuts per client', () => {
      const cuts: FidelityCutInput[] = [
        {
          id: 'c1',
          startedAt: new Date('2026-11-01T10:00:00Z'),
          chips: { styleName: 'Mid Fade' },
          clientProfileId: 'client-1',
        },
        {
          id: 'c2',
          startedAt: new Date('2026-11-05T10:00:00Z'),
          chips: { styleName: 'Mid Fade' },
          clientProfileId: 'client-2',
        },
      ];

      const stats = computeFidelityStats(cuts);
      expect(stats.totalCuts).toBe(2);
      expect(stats.uniqueClients).toBe(2);
      expect(stats.recurringClients).toBe(0);
      expect(stats.recurrenceRate).toBe(0);
      expect(stats.averageCycleDays).toBeNull();
      expect(stats.topStyles).toEqual([{ name: 'Mid Fade', count: 2 }]);
    });

    it('computes recurrence rate and average cycle for returning clients', () => {
      const cuts: FidelityCutInput[] = [
        // Client 1: 3 cuts, intervals 14 days and 16 days -> avg 15 days
        {
          id: 'c1',
          startedAt: new Date('2026-10-01T10:00:00Z'),
          chips: { styleName: 'Taper Fade' },
          clientProfileId: 'client-1',
        },
        {
          id: 'c2',
          startedAt: new Date('2026-10-15T10:00:00Z'),
          chips: { styleName: 'Taper Fade' },
          clientProfileId: 'client-1',
        },
        {
          id: 'c3',
          startedAt: new Date('2026-10-31T10:00:00Z'),
          chips: { styleName: 'Buzz Cut' },
          clientProfileId: 'client-1',
        },
        // Client 2: 1 cut
        {
          id: 'c4',
          startedAt: new Date('2026-10-20T10:00:00Z'),
          chips: { styleName: 'Taper Fade' },
          clientProfileId: 'client-2',
        },
      ];

      const stats = computeFidelityStats(cuts);
      expect(stats.totalCuts).toBe(4);
      expect(stats.uniqueClients).toBe(2);
      expect(stats.recurringClients).toBe(1);
      expect(stats.recurrenceRate).toBe(50); // 1 out of 2 = 50%
      expect(stats.averageCycleDays).toBe(15);
      expect(stats.topStyles).toEqual([
        { name: 'Taper Fade', count: 3 },
        { name: 'Buzz Cut', count: 1 },
      ]);
    });
  });

  describe('computeDueForCutClients', () => {
    it('identifies overdue clients based on default 21 days benchmark', () => {
      const now = new Date('2026-11-20T12:00:00Z');
      const cuts: FidelityCutInput[] = [
        // Client 1: Cut on Oct 25 -> 26 days ago (due!)
        {
          id: 'c1',
          startedAt: new Date('2026-10-25T12:00:00Z'),
          chips: null,
          clientProfile: {
            id: 'p1',
            name: 'Mario',
            client: {
              id: 'cl-1',
              displayName: 'Mario Gomez',
              phone: '71122334',
              email: 'mario@example.com',
            },
          },
        },
        // Client 2: Cut on Nov 15 -> 5 days ago (not due)
        {
          id: 'c2',
          startedAt: new Date('2026-11-15T12:00:00Z'),
          chips: null,
          clientProfile: {
            id: 'p2',
            name: 'Andres',
            client: {
              id: 'cl-2',
              displayName: 'Andres Rios',
              phone: '79988776',
              email: 'andres@example.com',
            },
          },
        },
      ];

      const due = computeDueForCutClients(cuts, 'Barbero Test', now);
      expect(due).toHaveLength(1);
      expect(due[0].clientId).toBe('cl-1');
      expect(due[0].clientName).toBe('Mario Gomez');
      expect(due[0].daysSinceLastCut).toBe(26);
      expect(due[0].averageCycleDays).toBe(DEFAULT_CUT_CYCLE_DAYS); // 21
      expect(due[0].daysOverdue).toBe(5);
      expect(due[0].whatsappUrl).toContain('59171122334');
    });

    it('uses personal cycle if client has 2+ cuts', () => {
      const now = new Date('2026-11-20T12:00:00Z');
      const cuts: FidelityCutInput[] = [
        // Client has 14-day personal cycle: cut 1 on Oct 20, cut 2 on Nov 03 (14 days apart)
        // From Nov 03 to Nov 20 = 17 days elapsed -> 3 days overdue!
        {
          id: 'c1',
          startedAt: new Date('2026-10-20T12:00:00Z'),
          chips: null,
          clientProfileId: 'cl-frequent',
          clientProfile: {
            id: 'p1',
            name: 'Juan Perez',
            client: {
              id: 'cl-frequent',
              displayName: 'Juan Perez',
              phone: null,
              email: null,
            },
          },
        },
        {
          id: 'c2',
          startedAt: new Date('2026-11-03T12:00:00Z'),
          chips: null,
          clientProfileId: 'cl-frequent',
          clientProfile: {
            id: 'p1',
            name: 'Juan Perez',
            client: {
              id: 'cl-frequent',
              displayName: 'Juan Perez',
              phone: null,
              email: null,
            },
          },
        },
      ];

      const due = computeDueForCutClients(cuts, 'Barbero Test', now);
      expect(due).toHaveLength(1);
      expect(due[0].clientId).toBe('cl-frequent');
      expect(due[0].averageCycleDays).toBe(14);
      expect(due[0].daysSinceLastCut).toBe(17);
      expect(due[0].daysOverdue).toBe(3);
    });
  });
});
