import { PrismaClient } from '@prisma/client';
import { LoginInput } from './auth.schemas';
import { verifySecret } from '../../utils/crypto';

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async authenticate(input: LoginInput) {
    let barber = null;

    if (input.type === 'pin') {
      barber = await this.prisma.barber.findUnique({
        where: { phone: input.identifier },
      });
      if (!barber || !verifySecret(input.secret, barber.pinHash)) {
        return null;
      }
    } else {
      barber = await this.prisma.barber.findFirst({
        where: {
          OR: [
            { email: input.identifier },
            { phone: input.identifier },
          ],
        },
      });
      if (!barber || !barber.passwordHash || !verifySecret(input.secret, barber.passwordHash)) {
        return null;
      }
    }

    const updatedBarber = await this.prisma.barber.update({
      where: { id: barber.id },
      data: { deviceId: input.deviceId },
    });

    return updatedBarber;
  }

  async getMe(barberId: string) {
    const barber = await this.prisma.barber.findUnique({
      where: { id: barberId },
    });
    if (!barber) return null;

    const activeCut = await this.prisma.cut.findFirst({
      where: {
        barberId: barber.id,
        status: 'IN_PROGRESS',
      },
    });

    return {
      id: barber.id,
      displayName: barber.displayName,
      phone: barber.phone,
      shopId: barber.shopId,
      plan: barber.plan,
      activeCutId: activeCut?.id ?? null,
    };
  }
}
