import type {
  ExploreBarber,
  ShopItem,
  BarberServiceItem,
  ActiveBooking,
} from '../types/explore';
import { getStoredToken, getStoredUser } from './auth.service';

const DEFAULT_AVATAR =
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80';

/**
 * Loads real active services for a given barber from the public endpoint.
 */
export async function fetchPublicBarberServices(barberId: string): Promise<BarberServiceItem[]> {
  try {
    const res = await fetch(`/api/barbers/${barberId}/services`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data)
      ? data.map((s: any) => ({
          id: s.id,
          name: s.name,
          description: s.description || '',
          priceBs: Number(s.priceBs) || 0,
          durationMin: Number(s.durationMin) || 30,
          category: s.category || 'fade',
        }))
      : [];
  } catch (err) {
    console.warn(`Could not load services for barber ${barberId}:`, err);
    return [];
  }
}

/**
 * Resolves the client's upcoming active booking from the database, or null if none.
 */
async function fetchActiveClientBooking(): Promise<ActiveBooking | null> {
  const token = getStoredToken();
  const user = getStoredUser();
  if (!token || user?.role !== 'cliente') return null;

  try {
    const res = await fetch('/api/clients/me/bookings', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const bookings = await res.json();
    if (!Array.isArray(bookings) || bookings.length === 0) return null;

    // Find earliest upcoming booking that is CONFIRMED or PENDING
    const active = bookings.find(
      (b: any) => b.status === 'CONFIRMED' || b.status === 'PENDING'
    );
    if (!active) return null;

    const dateObj = new Date(active.date + 'T12:00:00Z');
    const dayNames = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    const monthNames = [
      'ENE',
      'FEB',
      'MAR',
      'ABR',
      'MAY',
      'JUN',
      'JUL',
      'AGO',
      'SEP',
      'OCT',
      'NOV',
      'DIC',
    ];
    const dateBadge = isNaN(dateObj.getTime())
      ? active.date
      : `${dayNames[dateObj.getUTCDay()]} ${dateObj.getUTCDate()} ${monthNames[dateObj.getUTCMonth()]}`;

    const barberName = active.barberName || active.barber?.displayName || 'Barbero FADE';
    const shopName = active.shopName || active.barber?.shop?.name || 'Fade Studio';
    const barberAvatar = active.barberAvatar || active.barber?.avatarUrl || DEFAULT_AVATAR;

    return {
      id: active.id,
      barberId: active.barberId || active.barber?.id,
      shopId: active.shopId || active.barber?.shop?.id,
      dateBadge,
      timeRange: active.time
        ? `${active.time} - ${active.durationMin ? `(${active.durationMin} min)` : ''}`.trim()
        : '',
      shopName,
      barberName,
      barberAvatar,
      serviceName: active.serviceName || 'Servicio FADE',
      status: active.status === 'CONFIRMED' ? 'confirmada' : 'pendiente',
    };
  } catch (err) {
    console.warn('Could not fetch active client booking:', err);
    return null;
  }
}

/**
 * Loads real shops from PostgreSQL /shops endpoint.
 */
async function fetchShopsList(): Promise<ShopItem[]> {
  try {
    const res = await fetch('/api/shops');
    if (!res.ok) return [];
    const shops = await res.json();
    if (!Array.isArray(shops)) return [];

    return shops.map((s: any) => ({
      id: s.id,
      name: s.name,
      address: s.address || '',
      zone: s.zone || 'Sopocachi',
      lat: typeof s.latitude === 'number' ? s.latitude : -16.5118,
      lng: typeof s.longitude === 'number' ? s.longitude : -68.1292,
      rating: 5.0,
      reviewCount: 0,
      distanceKm: 0.5,
      photos: s.photoUrl ? [s.photoUrl] : [],
      isOpen: s.isActive ?? true,
      hours: 'Lun - Sáb: 09:00 - 20:30',
      barberIds: Array.isArray(s.barbers) ? s.barbers.map((b: any) => b.id) : [],
      services: [],
      isVerified: true,
      isFavorite: false,
    }));
  } catch (err) {
    console.warn('Could not fetch shops from API:', err);
    return [];
  }
}

export async function fetchExploreData(): Promise<{
  barbers: ExploreBarber[];
  shops: ShopItem[];
  activeBooking: ActiveBooking | null;
}> {
  let barbers: ExploreBarber[] = [];

  try {
    const res = await fetch('/presence/map?json=1');
    if (res.ok) {
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : data.value;

      if (Array.isArray(rawList)) {
        barbers = rawList.map((item: any) => {
          const dbPhotos: string[] = Array.isArray(item.portfolio) ? item.portfolio : [];
          const rawServices = Array.isArray(item.services) ? item.services : [];

          const services: BarberServiceItem[] = rawServices.map((s: any) => ({
            id: s.id,
            name: s.name,
            description: s.description || '',
            priceBs: Number(s.priceBs) || 0,
            durationMin: Number(s.durationMin) || 30,
            category: s.category || 'fade',
          }));

          const prices = services.map((s) => s.priceBs);
          const priceRange =
            prices.length === 0
              ? 'Sin servicios'
              : prices.length === 1
              ? `Bs ${prices[0]}`
              : `Bs ${Math.min(...prices)} - ${Math.max(...prices)}`;

          return {
            id: item.barberId,
            name: item.displayName,
            phone: item.phone || null,
            avatar: item.avatarUrl || DEFAULT_AVATAR,
            shopId: item.shopId || '',
            shopName: item.shopName || 'Darko Studio',
            address: item.address || '',
            zone: item.zone || 'Sopocachi',
            lat: typeof item.latitude === 'number' ? item.latitude : -16.5113,
            lng: typeof item.longitude === 'number' ? item.longitude : -68.1287,
            status: item.status || 'GRAY',
            waitingCount: item.waitingCount || 0,
            rating: 5.0,
            reviewCount: 0,
            distanceKm: 0.5,
            specialties:
              Array.isArray(item.specialties) && item.specialties.length > 0
                ? item.specialties
                : ['Fade', 'Perfilado'],
            bio: item.bio || 'Barbero profesional certificado FADE.',
            experienceYears: 2,
            totalCuts: 0,
            priceRange,
            services,
            portfolio: dbPhotos,
            plan: item.plan || 'PRO',
            isFavorite: false,
          };
        });
      }
    }
  } catch (err) {
    console.warn('Failed to fetch from live /presence/map:', err);
  }

  const [shops, activeBooking] = await Promise.all([
    fetchShopsList(),
    fetchActiveClientBooking(),
  ]);

  const enrichedShops = shops.map((s) => {
    const ids = new Set(s.barberIds);
    for (const b of barbers) {
      if (b.shopId === s.id) {
        ids.add(b.id);
      }
    }
    return {
      ...s,
      barberIds: Array.from(ids),
    };
  });

  return {
    barbers,
    shops: enrichedShops,
    activeBooking,
  };
}
