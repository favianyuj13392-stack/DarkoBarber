import { PrismaClient, Plan, PresenceStatus } from '@prisma/client';
import { hashSecret } from '../src/utils/crypto';

const prisma = new PrismaClient();

export async function seed() {
  console.log('Starting DarkoBarber database seeding...');

  // 1. Create or upsert Shop
  const shop = await prisma.shop.upsert({
    where: { id: 'shop-pilot-darko-studio' },
    update: {
      name: 'Darko Studio',
      address: 'Av. Pilot 1234',
    },
    create: {
      id: 'shop-pilot-darko-studio',
      name: 'Darko Studio',
      address: 'Av. Pilot 1234',
    },
  });

  // 2. Create or upsert Pilot Barber Diego
  const pinHash = hashSecret('1234');
  const passwordHash = hashSecret('Secret123!');

  const barber = await prisma.barber.upsert({
    where: { phone: '77212345' },
    update: {
      email: 'diego@darkobarber.com',
      displayName: 'Diego',
      pinHash,
      passwordHash,
      plan: Plan.AUTONOMO,
      shopId: shop.id,
      deviceId: null,
    },
    create: {
      email: 'diego@darkobarber.com',
      phone: '77212345',
      displayName: 'Diego',
      pinHash,
      passwordHash,
      plan: Plan.AUTONOMO,
      shopId: shop.id,
      deviceId: null,
    },
  });

  // 3. Create or upsert Presence for Pilot Barber Diego
  const presence = await prisma.presence.upsert({
    where: { barberId: barber.id },
    update: {
      status: PresenceStatus.GRAY,
      waitingCount: 0,
      activeCutId: null,
      expiresAt: null,
    },
    create: {
      barberId: barber.id,
      status: PresenceStatus.GRAY,
      waitingCount: 0,
      activeCutId: null,
      expiresAt: null,
    },
  });

  // 4. Create or upsert Sample Client Carlos Mendoza
  const client = await prisma.client.upsert({
    where: { phone: '70123456' },
    update: {},
    create: {
      phone: '70123456',
      profiles: {
        create: [
          {
            id: 'prof-carlos-456',
            name: 'Carlos Mendoza',
          },
        ],
      },
    },
    include: { profiles: true },
  });

  console.log(`Seeded Barber: ${barber.displayName} (${barber.email} / ${barber.phone}) at ${shop.name} with Presence ${presence.status}`);
  console.log(`Seeded Client: ${client.profiles[0].name} (${client.phone})`);
  return { shop, barber, presence, client };
}

if (require.main === module) {
  seed()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error(e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
