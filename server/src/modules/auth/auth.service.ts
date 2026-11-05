import { PrismaClient, Barber, Client } from '@prisma/client';
import { OAuth2Client } from 'google-auth-library';
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

  private googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

  async googleAuth(input: GoogleAuthInput): Promise<AuthResult> {
    let payload: { sub: string; email: string; name?: string; picture?: string };

    const googleClientId = process.env.GOOGLE_CLIENT_ID;

    // In local non-production environment, permit explicit test tokens for CI
    if (
      process.env.NODE_ENV !== 'production' &&
      (input.idToken.startsWith('mock-') || input.idToken.startsWith('test-') || input.idToken.startsWith('header.'))
    ) {
      try {
        const parts = input.idToken.split('.');
        if (parts.length === 3) {
          const parsed = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          payload = {
            sub: parsed.sub || `mock-${Date.now()}`,
            email: parsed.email || `${input.role}-test@darkobarber.com`,
            name: parsed.name || 'Test User',
            picture: parsed.picture,
          };
        } else {
          payload = {
            sub: `mock-google-${input.idToken}`,
            email: `${input.role}-test@darkobarber.com`,
            name: 'Test User',
          };
        }
      } catch {
        payload = {
          sub: `mock-google-${input.idToken}`,
          email: `${input.role}-test@darkobarber.com`,
          name: 'Test User',
        };
      }
    } else {
      if (!googleClientId) {
        throw new Error(
          'Security Error: GOOGLE_CLIENT_ID is not configured in environment variables. Google token audience validation is required.'
        );
      }

      try {
        const ticket = await this.googleClient.verifyIdToken({
          idToken: input.idToken,
          audience: googleClientId,
        });
        const ticketPayload = ticket.getPayload();
        if (!ticketPayload || !ticketPayload.sub || !ticketPayload.email) {
          throw new Error('Invalid token payload from Google');
        }
        payload = {
          sub: ticketPayload.sub,
          email: ticketPayload.email,
          name: ticketPayload.name,
          picture: ticketPayload.picture,
        };
      } catch (err: unknown) {
        const reason = err instanceof Error ? err.message : 'Invalid cryptographic signature or expired token';
        throw new Error(`Google token verification failed: ${reason}`);
      }
    }

    const googleId = payload.sub;
    const email = payload.email.toLowerCase();
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

  async getBarberFullProfile(barberId: string) {
    const barber = await this.prisma.barber.findUnique({
      where: { id: barberId },
      include: {
        shop: true,
        presence: true,
        cuts: {
          where: { status: 'FINISHED' },
          include: {
            photos: {
              where: { isPublic: true },
            },
          },
          orderBy: { finishedAt: 'desc' },
        },
      },
    });

    if (!barber) return null;

    const publicPhotos = barber.cuts.flatMap((c) => c.photos.map((p) => p.r2Key));

    return {
      id: barber.id,
      displayName: barber.displayName,
      email: barber.email,
      phone: barber.phone,
      avatarUrl: barber.avatarUrl,
      bio: barber.bio || 'Master Barber profesional en FADE.',
      specialties: barber.specialties?.length > 0 ? barber.specialties : ['Fade', 'Barba', 'Tijera'],
      instagram: barber.instagram || null,
      linkedin: barber.linkedin || null,
      plan: barber.plan,
      shopId: barber.shopId,
      shopName: barber.shop?.name || 'Fade Studio — Sopocachi',
      shopAddress: barber.shop?.address || 'Av. 20 de Octubre #2140',
      shopZone: barber.shop?.zone || 'Sopocachi',
      status: barber.presence?.status || 'GREEN',
      waitingCount: barber.presence?.waitingCount || 0,
      totalCuts: barber.cuts.length,
      portfolio: publicPhotos,
    };
  }

  async updateBarberProfile(
    barberId: string,
    data: {
      displayName?: string;
      bio?: string;
      specialties?: string[];
      instagram?: string;
      linkedin?: string;
      avatarUrl?: string;
      phone?: string;
    }
  ) {
    const updated = await this.prisma.barber.update({
      where: { id: barberId },
      data: {
        ...(data.displayName ? { displayName: data.displayName } : {}),
        ...(data.bio !== undefined ? { bio: data.bio } : {}),
        ...(data.specialties ? { specialties: data.specialties } : {}),
        ...(data.instagram !== undefined ? { instagram: data.instagram } : {}),
        ...(data.linkedin !== undefined ? { linkedin: data.linkedin } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
        ...(data.phone !== undefined ? { phone: data.phone } : {}),
      },
      include: {
        shop: true,
        presence: true,
      },
    });

    return updated;
  }
}
