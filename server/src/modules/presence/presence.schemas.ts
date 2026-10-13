import { z } from 'zod';
import { PresenceStatus } from '@prisma/client';

/**
 * Waiting count mapping for lounge micro-tap:
 * 0: 0 people / "Nadie" (no clients waiting in lounge)
 * 1: 1 to 2 people / "1 a 2" (light wait)
 * 2: 3 or more people / "3 o más" (busy wait)
 */
export const WAITING_COUNT_VALUES = [0, 1, 2] as const;
export type WaitingCount = (typeof WAITING_COUNT_VALUES)[number];

export const waitingCountSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
]);

export const heartbeatMessageSchema = z.object({
  type: z.literal('HEARTBEAT'),
});

export const updateWaitingCountMessageSchema = z.object({
  type: z.literal('UPDATE_WAITING_COUNT'),
  waitingCount: waitingCountSchema,
});

/**
 * Manual status changes from client are strictly restricted:
 * - 'GREEN': manual ready / return from break
 * - 'GRAY': manual off-shift / break
 * Any attempt to manually set 'RED' or 'YELLOW' is rejected because
 * those states are strictly governed by active cut lifecycle and lounge micro-tap.
 */
export const setStatusMessageSchema = z.object({
  type: z.literal('SET_STATUS'),
  status: z.enum(['GREEN', 'GRAY']),
});

export const clientPresenceMessageSchema = z.discriminatedUnion('type', [
  heartbeatMessageSchema,
  updateWaitingCountMessageSchema,
  setStatusMessageSchema,
]);

export type ClientPresenceMessage = z.infer<typeof clientPresenceMessageSchema>;

export interface PresenceConnectedMessage {
  type: 'PRESENCE_CONNECTED';
  status: PresenceStatus;
  waitingCount: number;
  activeCutId: string | null;
}

export interface HeartbeatAckMessage {
  type: 'HEARTBEAT_ACK';
  timestamp: string;
}

export interface PresenceChangedMessage {
  type: 'PRESENCE_CHANGED';
  barberId: string;
  status: PresenceStatus;
  waitingCount: number;
  activeCutId: string | null;
}

export interface PresenceErrorMessage {
  type: 'ERROR';
  code: string;
  message: string;
}

export type ServerPresenceMessage =
  | PresenceConnectedMessage
  | HeartbeatAckMessage
  | PresenceChangedMessage
  | PresenceErrorMessage;

export interface ChairMapItem {
  barberId: string;
  displayName: string;
  shopId: string | null;
  shopName: string | null;
  status: PresenceStatus;
  waitingCount: number;
  updatedAt: string;
}
