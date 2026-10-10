import { PrismaClient, Plan } from '@prisma/client';
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

  console.log(`Seeded Barber: ${barber.displayName} (${barber.email} / ${barber.phone}) at ${shop.name}`);
  return { shop, barber };
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
