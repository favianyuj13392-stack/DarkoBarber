import type {
  ExploreBarber,
  ShopItem,
  BarberServiceItem,
  ActiveBooking,
} from '../types/explore';

const DEFAULT_SERVICES: BarberServiceItem[] = [
  {
    id: 'srv-fade-pro',
    name: 'Corte Fade / Degradado',
    description: 'Degradado a elección (#0, #0.5, #1) con afeitado navaja y acabado mate con cera.',
    priceBs: 60,
    durationMin: 40,
    category: 'fade',
  },
  {
    id: 'srv-barba-spa',
    name: 'Perfilado de Barba & Toalla Caliente',
    description: 'Vapor de ozono, aceite de argán, toalla caliente y navajazo de precisión.',
    priceBs: 40,
    durationMin: 30,
    category: 'barba',
  },
  {
    id: 'srv-combo-completo',
    name: 'Combo FADE Total (Corte + Barba + Mascarilla)',
    description: 'Servicio premium completo: Degradado + Barba esculpida + Mascarilla exfoliante negra.',
    priceBs: 90,
    durationMin: 65,
    category: 'combo',
  },
  {
    id: 'srv-clasico-tijera',
    name: 'Corte Clásico a Tijera',
    description: 'Tijera tradicional europea, lavado capilar purificante y peinado pomada.',
    priceBs: 50,
    durationMin: 35,
    category: 'clasico',
  },
  {
    id: 'srv-spa-capilar',
    name: 'Lavado Purificante & Masaje Cráneo',
    description: 'Shampoo mentolado, exfoliación de cuero cabelludo y masaje tónico estimulante.',
    priceBs: 30,
    durationMin: 20,
    category: 'spa',
  },
];

const MOCK_BARBERS: ExploreBarber[] = [
  {
    id: 'barber-brian-16',
    name: 'Brian López',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
    shopId: 'shop-estudio-16',
    shopName: 'Estudio 16',
    address: 'Av. 20 de Octubre #2140, Sopocachi',
    zone: 'Sopocachi',
    lat: -16.5118,
    lng: -68.1292,
    status: 'GREEN',
    waitingCount: 0,
    rating: 4.9,
    reviewCount: 94,
    distanceKm: 0.4,
    specialties: ['Low Fade', 'Mid Fade', 'Skin Fade', 'Perfilado Navaja'],
    bio: 'Especialista en degradados milimétricos y texturizados modernos. Certificado FADE Pro Academy.',
    experienceYears: 3,
    totalCuts: 84,
    priceRange: 'Bs 40 - 90',
    services: DEFAULT_SERVICES,
    portfolio: [
      'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517832606589-7629c3397143?w=600&auto=format&fit=crop&q=80',
    ],
    isFavorite: true,
  },
  {
    id: '5ededbde-c44a-407e-8262-802406e623ea',
    name: 'Diego Arce',
    avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format&fit=crop&q=80',
    shopId: 'shop-sopocachi-darko',
    shopName: 'Darko Studio',
    address: 'Av. 20 de Octubre #2314, esq. Rosendo Gutiérrez',
    zone: 'Sopocachi',
    lat: -16.5113,
    lng: -68.1287,
    status: 'GREEN',
    waitingCount: 0,
    rating: 4.9,
    reviewCount: 156,
    distanceKm: 0.5,
    specialties: ['Low Fade', 'Skin Fade', 'Perfilado de Barba', 'Tijera Clásica'],
    bio: 'Master Barber con 8 años de experiencia. Especialista en Low Fade, Taper y diseño de barba perfilada.',
    experienceYears: 8,
    totalCuts: 1420,
    priceRange: 'Bs 50 - 100',
    services: DEFAULT_SERVICES,
    portfolio: [
      'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=600&auto=format&fit=crop&q=80',
    ],
    isFavorite: false,
  },
  {
    id: '6fdedbde-c44a-407e-8262-802406e623eb',
    name: 'Marco Vera',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&auto=format&fit=crop&q=80',
    shopId: 'shop-sopocachi-darko',
    shopName: 'Darko Studio',
    address: 'Av. 20 de Octubre #2314, esq. Rosendo Gutiérrez',
    zone: 'Sopocachi',
    lat: -16.5113,
    lng: -68.1287,
    status: 'RED',
    waitingCount: 2,
    rating: 4.8,
    reviewCount: 88,
    distanceKm: 0.5,
    specialties: ['High Fade', 'Freestyle', 'Crop Francés'],
    bio: 'Barbero de precisión. Freestyle, líneas navaja y texturizados europeos.',
    experienceYears: 4,
    totalCuts: 630,
    priceRange: 'Bs 45 - 85',
    services: DEFAULT_SERVICES,
    portfolio: [
      'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517832606589-7629c3397143?w=600&auto=format&fit=crop&q=80',
    ],
    isFavorite: false,
  },
  {
    id: '7adedbde-c44a-407e-8262-802406e623ec',
    name: 'Mateo Quispe',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=500&auto=format&fit=crop&q=80',
    shopId: 'shop-miraflores-fade',
    shopName: 'FADE Miraflores',
    address: 'Av. Busch #1420, entre Villalobos y Pasoskanki',
    zone: 'Miraflores',
    lat: -16.4998,
    lng: -68.1205,
    status: 'YELLOW',
    waitingCount: 1,
    rating: 4.7,
    reviewCount: 71,
    distanceKm: 1.8,
    specialties: ['Mid Fade', 'Barba Toalla Caliente', 'Diseño Cejas'],
    bio: 'Especialista en degradados limpios y mantenimiento de barbas largas con toalla caliente.',
    experienceYears: 5,
    totalCuts: 410,
    priceRange: 'Bs 40 - 75',
    services: DEFAULT_SERVICES,
    portfolio: [
      'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=600&auto=format&fit=crop&q=80',
    ],
    isFavorite: false,
  },
  {
    id: '8bdedbde-c44a-407e-8262-802406e623ed',
    name: 'Lucas Fernández',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=500&auto=format&fit=crop&q=80',
    shopId: 'shop-san-miguel-fade',
    shopName: 'FADE San Miguel Studio',
    address: 'Calle 21 de Calacoto #8320, San Miguel',
    zone: 'San Miguel',
    lat: -16.5412,
    lng: -68.0821,
    status: 'GREEN',
    waitingCount: 0,
    rating: 4.9,
    reviewCount: 112,
    distanceKm: 4.2,
    specialties: ['Taper Fade', 'Tijera Texturizado', 'Tratamiento Capilar'],
    bio: 'Estilista capilar y barbero de autor. Asesoramiento morfológico según tipo de rostro.',
    experienceYears: 6,
    totalCuts: 890,
    priceRange: 'Bs 60 - 110',
    services: DEFAULT_SERVICES,
    portfolio: [
      'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=600&auto=format&fit=crop&q=80',
    ],
    isFavorite: false,
  },
];

const MOCK_SHOPS: ShopItem[] = [
  {
    id: 'shop-estudio-16',
    name: 'Estudio 16 Barbería',
    address: 'Av. 20 de Octubre #2140, Sopocachi',
    zone: 'Sopocachi',
    lat: -16.5118,
    lng: -68.1292,
    rating: 4.9,
    reviewCount: 142,
    distanceKm: 0.4,
    photos: [
      'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1517832606589-7629c3397143?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=900&auto=format&fit=crop&q=80',
    ],
    isOpen: true,
    hours: 'Lun - Sáb: 09:00 - 20:30',
    barberIds: ['barber-brian-16', '5ededbde-c44a-407e-8262-802406e623ea'],
    services: DEFAULT_SERVICES,
    isVerified: true,
    isFavorite: true,
  },
  {
    id: 'shop-sopocachi-darko',
    name: 'Darko Studio Sopocachi',
    address: 'Av. 20 de Octubre #2314, esq. Rosendo Gutiérrez',
    zone: 'Sopocachi',
    lat: -16.5113,
    lng: -68.1287,
    rating: 4.8,
    reviewCount: 210,
    distanceKm: 0.5,
    photos: [
      'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=900&auto=format&fit=crop&q=80',
    ],
    isOpen: true,
    hours: 'Lun - Dom: 10:00 - 21:00',
    barberIds: ['5ededbde-c44a-407e-8262-802406e623ea', '6fdedbde-c44a-407e-8262-802406e623eb'],
    services: DEFAULT_SERVICES,
    isVerified: true,
    isFavorite: false,
  },
  {
    id: 'shop-san-miguel-fade',
    name: 'FADE San Miguel Studio',
    address: 'Calle 21 de Calacoto #8320, San Miguel',
    zone: 'San Miguel',
    lat: -16.5412,
    lng: -68.0821,
    rating: 4.9,
    reviewCount: 165,
    distanceKm: 4.2,
    photos: [
      'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=900&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=900&auto=format&fit=crop&q=80',
    ],
    isOpen: true,
    hours: 'Lun - Sáb: 09:30 - 20:00',
    barberIds: ['8bdedbde-c44a-407e-8262-802406e623ed'],
    services: DEFAULT_SERVICES,
    isVerified: true,
    isFavorite: false,
  },
  {
    id: 'shop-miraflores-fade',
    name: 'FADE Miraflores',
    address: 'Av. Busch #1420, entre Villalobos y Pasoskanki',
    zone: 'Miraflores',
    lat: -16.4998,
    lng: -68.1205,
    rating: 4.7,
    reviewCount: 89,
    distanceKm: 1.8,
    photos: [
      'https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=900&auto=format&fit=crop&q=80',
    ],
    isOpen: true,
    hours: 'Mar - Dom: 10:00 - 19:30',
    barberIds: ['7adedbde-c44a-407e-8262-802406e623ec'],
    services: DEFAULT_SERVICES,
    isVerified: true,
    isFavorite: false,
  },
];

const MOCK_ACTIVE_BOOKING: ActiveBooking = {
  id: 'booking-active-1',
  dateBadge: 'VIE 16 OCT',
  timeRange: '16:00 - 16:30',
  shopName: 'Estudio 16',
  barberName: 'Brian López',
  barberAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
  serviceName: 'Corte Degradado + Perfilado',
  status: 'confirmada',
};

export async function fetchExploreData(): Promise<{
  barbers: ExploreBarber[];
  shops: ShopItem[];
  activeBooking: ActiveBooking;
}> {
  try {
    const res = await fetch('/presence/map?json=1');
    if (res.ok) {
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : data.value;

      if (Array.isArray(rawList) && rawList.length > 0) {
        // Map backend barbers and merge with our rich presentation profiles
        const mergedBarbers: ExploreBarber[] = rawList.map((item) => {
          const existing = MOCK_BARBERS.find(
            (b) =>
              b.id === item.barberId ||
              b.name.toLowerCase().includes(item.displayName.toLowerCase())
          );

          // Si el barbero tiene fotos públicas en su portafolio de la base de datos, ponerlas primero
          const dbPhotos: string[] = Array.isArray(item.portfolio) ? item.portfolio : [];
          const basePhotos = existing?.portfolio || MOCK_BARBERS[0].portfolio;
          const realPortfolio =
            dbPhotos.length > 0
              ? [...dbPhotos, ...basePhotos.filter((p: string) => !dbPhotos.includes(p))]
              : basePhotos;

          return {
            id: item.barberId,
            name: item.displayName,
            avatar:
              item.avatarUrl ||
              existing?.avatar ||
              'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80',
            shopId: item.shopId || 'shop-sopocachi-darko',
            shopName: item.shopName || 'Darko Studio',
            address: item.address || 'Av. 20 de Octubre #2314',
            zone: item.zone || 'Sopocachi',
            lat: typeof item.latitude === 'number' ? item.latitude : -16.5113,
            lng: typeof item.longitude === 'number' ? item.longitude : -68.1287,
            status: (item.status as any) || 'GREEN',
            waitingCount: item.waitingCount || 0,
            rating: existing?.rating || 5.0,
            reviewCount: existing?.reviewCount || 1,
            distanceKm: existing?.distanceKm || 0.5,
            specialties:
              item.specialties?.length > 0
                ? item.specialties
                : existing?.specialties || ['Fade', 'Barba'],
            bio: item.bio || existing?.bio || 'Master Barber profesional en FADE.',
            experienceYears: existing?.experienceYears || 2,
            totalCuts: existing?.totalCuts || 1,
            priceRange: existing?.priceRange || 'Bs 50 - 90',
            services: existing?.services || DEFAULT_SERVICES,
            portfolio: realPortfolio,
            isFavorite: existing?.isFavorite || false,
          };
        });

        // Ensure Brian López is in list (from mockups) ONLY if neither DB nor merged list already has him
        if (!mergedBarbers.some((b) => b.id === 'barber-brian-16' || b.name.toLowerCase().includes('brian'))) {
          mergedBarbers.unshift(MOCK_BARBERS[0]);
        }

        return {
          barbers: mergedBarbers,
          shops: MOCK_SHOPS,
          activeBooking: MOCK_ACTIVE_BOOKING,
        };
      }
    }
  } catch (err) {
    console.warn('Failed to fetch from live /presence/map, falling back to mock exploration data:', err);
  }

  return {
    barbers: MOCK_BARBERS,
    shops: MOCK_SHOPS,
    activeBooking: MOCK_ACTIVE_BOOKING,
  };
}
