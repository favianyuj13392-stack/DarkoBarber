import { PrismaClient } from '@prisma/client';

export async function cleanDatabase(prisma: PrismaClient) {
  await prisma.cutPhoto.deleteMany({});
  await prisma.cut.deleteMany({});
  await prisma.clientProfile.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.presence.deleteMany({});
  await prisma.barber.deleteMany({});
}
