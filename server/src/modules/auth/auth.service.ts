import { PrismaClient, Barber, Client } from '@prisma/client';
import { LoginInput, RegisterInput, GoogleAuthInput } from './auth.schemas';
import { hashSecret, verifySecret } from '../../utils/crypto';

export type AuthResult = {
  role: 'barbero' | 'cliente';
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    role: 'barbero' | 'cliente';
    avatarUrl?: string | null;
    shopId?: string | null;
    plan?: string | null;
    phone?: string | null;
  };
  barber?: Barber | null;
  client?: Client | null;
};

export class AuthService {
  constructor(private prisma: PrismaClient) {}

  async authenticate(input: LoginInput): Promise<AuthResult | null> {
    if (input.role === 'barbero') {
      let barber: Barber | null = null;

      if (input.type === 'pin') {
        barber = await this.prisma.barber.findUnique({
          where: { phone: input.identifier },
        });
        if (!barber || !barber.pinHash || !verifySecret(input.secret, barber.pinHash)) {
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
          // Fallback: check if client exists with this identifier
          const client = await this.prisma.client.findFirst({
            where: {
              OR: [
                { email: input.identifier },
                { phone: input.identifier },
              ],
            },
          });
          if (client && client.passwordHash && verifySecret(input.secret, client.passwordHash)) {
            return {
              role: 'cliente',
              user: {
                id: client.id,
                email: client.email,
                displayName: client.displayName,
                role: 'cliente',
                avatarUrl: client.avatarUrl,
                shopId: null,
                phone: client.phone,
              },
              client,
            };
          }
          return null;
        }
      }

      const updatedBarber = await this.prisma.barber.update({
        where: { id: barber.id },
        data: { deviceId: input.deviceId ?? barber.deviceId ?? 'web-barber' },
      });

      return {
        role: 'barbero',
        user: {
          id: updatedBarber.id,
          email: updatedBarber.email,
          displayName: updatedBarber.displayName,
          role: 'barbero',
          avatarUrl: updatedBarber.avatarUrl,
          shopId: updatedBarber.shopId,
          plan: updatedBarber.plan,
          phone: updatedBarber.phone,
        },
        barber: updatedBarber,
      };
    } else {
      // Cliente
      const client = await this.prisma.client.findFirst({
        where: {
          OR: [
            { email: input.identifier },
            { phone: input.identifier },
          ],
        },
      });

      if (!client || !client.passwordHash || !verifySecret(input.secret, client.passwordHash)) {
        return null;
      }

      return {
        role: 'cliente',
        user: {
          id: client.id,
          email: client.email,
          displayName: client.displayName,
          role: 'cliente',
          avatarUrl: client.avatarUrl,
          shopId: null,
          phone: client.phone,
        },
        client,
      };
    }
  }

  async register(input: RegisterInput): Promise<{ error?: string; message?: string; result?: AuthResult }> {
    // Check if email is already taken
    const [existingBarberWithEmail, existingClientWithEmail] = await Promise.all([
      this.prisma.barber.findUnique({ where: { email: input.email } }),
      this.prisma.client.findUnique({ where: { email: input.email } }),
    ]);

    if (existingBarberWithEmail || existingClientWithEmail) {
      return {
        error: 'EMAIL_ALREADY_EXISTS',
        message: 'El correo electrónico ya se encuentra registrado',
      };
    }

    if (input.phone) {
      const [existingBarberWithPhone, existingClientWithPhone] = await Promise.all([
        this.prisma.barber.findUnique({ where: { phone: input.phone } }),
        this.prisma.client.findUnique({ where: { phone: input.phone } }),
      ]);
      if (existingBarberWithPhone || existingClientWithPhone) {
        return {
          error: 'PHONE_ALREADY_EXISTS',
          message: 'El número de teléfono ya se encuentra registrado',
        };
      }
    }

    const passwordHash = hashSecret(input.password);

    if (input.role === 'barbero') {
      const barber = await this.prisma.barber.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          passwordHash,
          phone: input.phone || null,
          deviceId: input.deviceId || `device-${Date.now()}`,
          plan: 'AUTONOMO',
        },
      });

      await this.prisma.presence.create({
        data: {
          barberId: barber.id,
          status: 'GRAY',
          waitingCount: 0,
        },
      });

      return {
        result: {
          role: 'barbero',
          user: {
            id: barber.id,
            email: barber.email,
            displayName: barber.displayName,
            role: 'barbero',
            avatarUrl: barber.avatarUrl,
            shopId: barber.shopId,
            plan: barber.plan,
            phone: barber.phone,
          },
          barber,
        },
      };
    } else {
      const client = await this.prisma.client.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          passwordHash,
          phone: input.phone || null,
          profiles: {
            create: [
              {
                name: input.displayName,
              },
            ],
          },
        },
        include: { profiles: true },
      });

      return {
        result: {
          role: 'cliente',
          user: {
            id: client.id,
            email: client.email,
            displayName: client.displayName,
            role: 'cliente',
            avatarUrl: client.avatarUrl,
            shopId: null,
            phone: client.phone,
          },
          client,
        },
      };
    }
  }

  async googleAuth(input: GoogleAuthInput): Promise<AuthResult> {
    let payload: { sub?: string; email?: string; name?: string; picture?: string } = {};

    try {
      if (input.idToken.includes('.')) {
        const parts = input.idToken.split('.');
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const json = Buffer.from(base64, 'base64').toString('utf8');
        payload = JSON.parse(json);
      } else if (input.idToken.startsWith('{')) {
        payload = JSON.parse(input.idToken);
      } else {
        const emailMatch = input.idToken.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        const email = emailMatch ? emailMatch[0] : `user-${input.idToken.slice(0, 8)}@gmail.com`;
        payload = {
          sub: `google-${Buffer.from(input.idToken).toString('hex').slice(0, 16)}`,
          email,
          name: 'Google User',
          picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400',
        };
      }
    } catch {
      payload = {
        sub: `google-${Date.now()}`,
        email: 'google-user@darkobarber.com',
        name: 'Google User',
      };
    }

    const googleId = payload.sub || `google-${Date.now()}`;
    const email = payload.email || `google-${Date.now()}@darkobarber.com`;
    const displayName = payload.name || 'Usuario';
    const avatarUrl = payload.picture || null;

    if (input.role === 'barbero') {
      let barber = await this.prisma.barber.findFirst({
        where: {
          OR: [{ googleId }, { email }],
        },
      });

      if (barber) {
        barber = await this.prisma.barber.update({
          where: { id: barber.id },
          data: {
            googleId,
            avatarUrl: barber.avatarUrl || avatarUrl,
            deviceId: input.deviceId ?? barber.deviceId ?? 'web-barber',
          },
        });
      } else {
        barber = await this.prisma.barber.create({
          data: {
            email,
            googleId,
            displayName,
            avatarUrl,
            deviceId: input.deviceId || `device-${Date.now()}`,
            plan: 'AUTONOMO',
          },
        });

        await this.prisma.presence.create({
          data: {
            barberId: barber.id,
            status: 'GRAY',
            waitingCount: 0,
          },
        });
      }

      return {
        role: 'barbero',
        user: {
          id: barber.id,
          email: barber.email,
          displayName: barber.displayName,
          role: 'barbero',
          avatarUrl: barber.avatarUrl,
          shopId: barber.shopId,
          plan: barber.plan,
          phone: barber.phone,
        },
        barber,
      };
    } else {
      let client = await this.prisma.client.findFirst({
        where: {
          OR: [{ googleId }, { email }],
        },
      });

      if (client) {
        client = await this.prisma.client.update({
          where: { id: client.id },
          data: {
            googleId,
            displayName: client.displayName || displayName,
            avatarUrl: client.avatarUrl || avatarUrl,
          },
        });
      } else {
        client = await this.prisma.client.create({
          data: {
            email,
            googleId,
            displayName,
            avatarUrl,
            profiles: {
              create: [{ name: displayName }],
            },
          },
        });
      }

      return {
        role: 'cliente',
        user: {
          id: client.id,
          email: client.email,
          displayName: client.displayName,
          role: 'cliente',
          avatarUrl: client.avatarUrl,
          shopId: null,
          phone: client.phone,
        },
        client,
      };
    }
  }

  async getMe(userId: string) {
    // 1. Check if it's a barber
    const barber = await this.prisma.barber.findUnique({
      where: { id: userId },
    });

    if (barber) {
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
        email: barber.email,
        role: 'barbero',
        avatarUrl: barber.avatarUrl,
        shopId: barber.shopId,
        plan: barber.plan,
        activeCutId: activeCut?.id ?? null,
      };
    }

    // 2. Check if it's a client
    const client = await this.prisma.client.findUnique({
      where: { id: userId },
    });

    if (client) {
      return {
        id: client.id,
        displayName: client.displayName,
        email: client.email,
        phone: client.phone,
        role: 'cliente',
        avatarUrl: client.avatarUrl,
        shopId: null,
      };
    }

    return null;
  }
}
