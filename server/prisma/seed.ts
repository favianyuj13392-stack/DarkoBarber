import { PrismaClient, Plan, PresenceStatus } from '@prisma/client';
import { hashSecret } from '../src/utils/crypto';

const prisma = new PrismaClient();

export async function seed() {
  console.log('Starting DarkoBarber database seeding with La Paz pilot data...');

  const pinHash = hashSecret('1234');
  const passwordHash = hashSecret('Secret123!');

  // 1. Seed Shops across La Paz commercial zones
  const shopSopocachi = await prisma.shop.upsert({
    where: { id: 'shop-sopocachi-darko' },
    update: {
      name: 'Darko Studio',
      address: 'Av. 20 de Octubre #2314, esq. Rosendo Gutiérrez',
      zone: 'Sopocachi',
      latitude: -16.5113,
      longitude: -68.1287,
    },
    create: {
      id: 'shop-sopocachi-darko',
      name: 'Darko Studio',
      address: 'Av. 20 de Octubre #2314, esq. Rosendo Gutiérrez',
      zone: 'Sopocachi',
      latitude: -16.5113,
      longitude: -68.1287,
    },
  });

  const shopMiraflores = await prisma.shop.upsert({
    where: { id: 'shop-miraflores-fade' },
    update: {
      name: 'FADE Miraflores',
      address: 'Av. Busch #1420, entre Villalobos y Pasoskanki',
      zone: 'Miraflores',
      latitude: -16.4998,
      longitude: -68.1205,
    },
    create: {
      id: 'shop-miraflores-fade',
      name: 'FADE Miraflores',
      address: 'Av. Busch #1420, entre Villalobos y Pasoskanki',
      zone: 'Miraflores',
      latitude: -16.4998,
      longitude: -68.1205,
    },
  });

  const shopSanMiguel = await prisma.shop.upsert({
    where: { id: 'shop-san-miguel-fade' },
    update: {
      name: 'FADE San Miguel Studio',
      address: 'Calle 21 de Calacoto #8320, San Miguel',
      zone: 'San Miguel',
      latitude: -16.5412,
      longitude: -68.0821,
    },
    create: {
      id: 'shop-san-miguel-fade',
      name: 'FADE San Miguel Studio',
      address: 'Calle 21 de Calacoto #8320, San Miguel',
      zone: 'San Miguel',
      latitude: -16.5412,
      longitude: -68.0821,
    },
  });

  // 2. Seed Barbers with LinkedIn, Instagram, Bio, and Specialties
  // Barber 1: Diego Arce (Pilot Barber, Sopocachi)
  const barberDiego = await prisma.barber.upsert({
    where: { phone: '77212345' },
    update: {
      email: 'diego@darkobarber.com',
      displayName: 'Diego',
      pinHash,
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
      bio: 'Master Barber con 8 años de experiencia. Especialista en Low Fade, Taper y diseño de barba perfilada.',
      linkedin: 'https://linkedin.com/in/diego-arce-barber',
      instagram: 'https://instagram.com/diego_fade_bo',
      specialties: ['Low Fade', 'Skin Fade', 'Perfilado de Barba', 'Tijera Clásica'],
      plan: Plan.AUTONOMO,
      shopId: shopSopocachi.id,
      deviceId: null,
    },
    create: {
      id: '5ededbde-c44a-407e-8262-802406e623ea',
      email: 'diego@darkobarber.com',
      phone: '77212345',
      displayName: 'Diego',
      pinHash,
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
      bio: 'Master Barber con 8 años de experiencia. Especialista en Low Fade, Taper y diseño de barba perfilada.',
      linkedin: 'https://linkedin.com/in/diego-arce-barber',
      instagram: 'https://instagram.com/diego_fade_bo',
      specialties: ['Low Fade', 'Skin Fade', 'Perfilado de Barba', 'Tijera Clásica'],
      plan: Plan.AUTONOMO,
      shopId: shopSopocachi.id,
      deviceId: null,
    },
  });

  // Barber 2: Marco Vera (Sopocachi - Same shop as Diego -> triggers Spiderfy)
  const barberMarco = await prisma.barber.upsert({
    where: { phone: '77212346' },
    update: {
      email: 'marco@darkobarber.com',
      displayName: 'Marco Vera',
      pinHash,
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
      bio: 'Barbero de precisión. Freestyle, líneas navaja y texturizados europeos.',
      linkedin: 'https://linkedin.com/in/marco-vera-barber',
      instagram: 'https://instagram.com/marco_cuts_lapaz',
      specialties: ['High Fade', 'Freestyle', 'Crop Francés'],
      plan: Plan.AUTONOMO,
      shopId: shopSopocachi.id,
      deviceId: null,
    },
    create: {
      id: '6fdedbde-c44a-407e-8262-802406e623eb',
      email: 'marco@darkobarber.com',
      phone: '77212346',
      displayName: 'Marco Vera',
      pinHash,
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
      bio: 'Barbero de precisión. Freestyle, líneas navaja y texturizados europeos.',
      linkedin: 'https://linkedin.com/in/marco-vera-barber',
      instagram: 'https://instagram.com/marco_cuts_lapaz',
      specialties: ['High Fade', 'Freestyle', 'Crop Francés'],
      plan: Plan.AUTONOMO,
      shopId: shopSopocachi.id,
      deviceId: null,
    },
  });

  // Barber 3: Mateo Quispe (Miraflores)
  const barberMateo = await prisma.barber.upsert({
    where: { phone: '77212347' },
    update: {
      email: 'mateo@darkobarber.com',
      displayName: 'Mateo Quispe',
      pinHash,
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
      bio: 'Especialista en degradados limpios y mantenimiento de barbas largas con toalla caliente.',
      linkedin: 'https://linkedin.com/in/mateo-quispe-barber',
      instagram: 'https://instagram.com/mateo_miraflores_cuts',
      specialties: ['Mid Fade', 'Barba Toalla Caliente', 'Diseño Cejas'],
      plan: Plan.AUTONOMO,
      shopId: shopMiraflores.id,
      deviceId: null,
    },
    create: {
      id: '7adedbde-c44a-407e-8262-802406e623ec',
      email: 'mateo@darkobarber.com',
      phone: '77212347',
      displayName: 'Mateo Quispe',
      pinHash,
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
      bio: 'Especialista en degradados limpios y mantenimiento de barbas largas con toalla caliente.',
      linkedin: 'https://linkedin.com/in/mateo-quispe-barber',
      instagram: 'https://instagram.com/mateo_miraflores_cuts',
      specialties: ['Mid Fade', 'Barba Toalla Caliente', 'Diseño Cejas'],
      plan: Plan.AUTONOMO,
      shopId: shopMiraflores.id,
      deviceId: null,
    },
  });

  // Barber 4: Lucas Fernández (San Miguel)
  const barberLucas = await prisma.barber.upsert({
    where: { phone: '77212348' },
    update: {
      email: 'lucas@darkobarber.com',
      displayName: 'Lucas Fernández',
      pinHash,
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80',
      bio: 'Estilista capilar y barbero de autor. Asesoramiento morfológico según tipo de rostro.',
      linkedin: 'https://linkedin.com/in/lucas-fernandez-fade',
      instagram: 'https://instagram.com/lucas_fade_sanmiguel',
      specialties: ['Taper Fade', 'Tijera Texturizado', 'Tratamiento Capilar'],
      plan: Plan.AUTONOMO,
      shopId: shopSanMiguel.id,
      deviceId: null,
    },
    create: {
      id: '8bdedbde-c44a-407e-8262-802406e623ed',
      email: 'lucas@darkobarber.com',
      phone: '77212348',
      displayName: 'Lucas Fernández',
      pinHash,
      passwordHash,
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=400&auto=format&fit=crop&q=80',
      bio: 'Estilista capilar y barbero de autor. Asesoramiento morfológico según tipo de rostro.',
      linkedin: 'https://linkedin.com/in/lucas-fernandez-fade',
      instagram: 'https://instagram.com/lucas_fade_sanmiguel',
      specialties: ['Taper Fade', 'Tijera Texturizado', 'Tratamiento Capilar'],
      plan: Plan.AUTONOMO,
      shopId: shopSanMiguel.id,
      deviceId: null,
    },
  });

  // 3. Seed Presences with diverse initial statuses
  const presenceDiego = await prisma.presence.upsert({
    where: { barberId: barberDiego.id },
    update: { status: PresenceStatus.GREEN, waitingCount: 0 },
    create: { barberId: barberDiego.id, status: PresenceStatus.GREEN, waitingCount: 0 },
  });

  await prisma.presence.upsert({
    where: { barberId: barberMarco.id },
    update: { status: PresenceStatus.RED, waitingCount: 0 },
    create: { barberId: barberMarco.id, status: PresenceStatus.RED, waitingCount: 0 },
  });

  await prisma.presence.upsert({
    where: { barberId: barberMateo.id },
    update: { status: PresenceStatus.YELLOW, waitingCount: 1 },
    create: { barberId: barberMateo.id, status: PresenceStatus.YELLOW, waitingCount: 1 },
  });

  await prisma.presence.upsert({
    where: { barberId: barberLucas.id },
    update: { status: PresenceStatus.GREEN, waitingCount: 0 },
    create: { barberId: barberLucas.id, status: PresenceStatus.GREEN, waitingCount: 0 },
  });

  // 4. Seed Sample Client Carlos Mendoza
  const client = await prisma.client.upsert({
    where: { phone: '70123456' },
    update: {
      email: 'carlos@darkobarber.com',
      displayName: 'Carlos Mendoza',
      passwordHash,
    },
    create: {
      phone: '70123456',
      email: 'carlos@darkobarber.com',
      displayName: 'Carlos Mendoza',
      passwordHash,
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

  console.log(`Seeded 3 Shops in La Paz: Sopocachi, Miraflores, San Miguel.`);
  console.log(`Seeded 4 Barbers: Diego (GREEN), Marco (RED), Mateo (YELLOW), Lucas (GREEN).`);
  console.log(`Seeded Client: ${client.profiles[0].name} (${client.phone})`);

  return {
    shop: shopSopocachi,
    barber: barberDiego,
    presence: presenceDiego,
    client,
    shops: [shopSopocachi, shopMiraflores, shopSanMiguel],
    barbers: [barberDiego, barberMarco, barberMateo, barberLucas],
  };
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
