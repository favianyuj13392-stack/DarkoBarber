import { PrismaClient } from '@prisma/client';

export async function cleanDatabase(prisma: PrismaClient) {
  const dbUrl = process.env.DATABASE_URL || '';
  if (
    process.env.NODE_ENV === 'production' ||
    dbUrl.includes('supabase.co') ||
    dbUrl.includes('pooler.supabase.com')
  ) {
    throw new Error(
      'FATAL CIRCUIT BREAKER: cleanDatabase() blocked. Refusing to run deleteMany on production/Supabase database!'
    );
  }

  await prisma.cutPhoto.deleteMany({});
  await prisma.cut.deleteMany({});
  await prisma.clientProfile.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.presence.deleteMany({});
  await prisma.barber.deleteMany({});
}
