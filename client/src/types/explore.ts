export type BarberPresenceStatus = 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';

export interface BarberServiceItem {
  id: string;
  name: string;
  description: string;
  priceBs: number;
  durationMin: number;
  category: 'fade' | 'barba' | 'combo' | 'spa' | 'clasico';
}

export interface ExploreBarber {
  id: string;
  name: string;
  avatar: string;
  shopId: string;
  shopName: string;
  address: string;
  zone: string;
  lat: number;
  lng: number;
  status: BarberPresenceStatus;
  waitingCount: number;
  rating: number;
  reviewCount: number;
  distanceKm: number;
  specialties: string[];
  bio: string;
  experienceYears: number;
  totalCuts: number;
  priceRange: string;
  services: BarberServiceItem[];
  portfolio: string[];
  isFavorite?: boolean;
}

export interface ShopItem {
  id: string;
  name: string;
  address: string;
  zone: string;
  lat: number;
  lng: number;
  rating: number;
  reviewCount: number;
  distanceKm: number;
  photos: string[];
  isOpen: boolean;
  hours: string;
  barberIds: string[];
  services: BarberServiceItem[];
  isVerified?: boolean;
  isFavorite?: boolean;
}

export interface FilterOptions {
  searchQuery: string;
  onlyAvailableNow: boolean;
  onlyThisWeek: boolean;
  maxDistanceKm: number;
  selectedZones: string[];
  priceRanges: string[]; // '<50' | '50-80' | '80-120' | '120+'
  selectedServices: string[];
  minRating: number;
  subTab: 'todos' | 'barberias' | 'barberos';
}

export interface BookingSlot {
  time: string;
  period: 'manana' | 'tarde' | 'noche';
  available: boolean;
}

export interface BookingDay {
  id: string;
  dayName: string; // e.g. "VIE"
  dayNumber: number; // e.g. 16
  monthName: string; // e.g. "OCT"
  fullDate: string; // e.g. "2026-10-16"
  isToday?: boolean;
}

export interface ActiveBooking {
  id: string;
  dateBadge: string; // "VIE 16 OCT"
  timeRange: string; // "16:00 - 16:30"
  shopName: string; // "Estudio 16"
  barberName: string; // "Brian López"
  barberAvatar: string;
  serviceName: string; // "Corte Degradado + Perfilado"
  status: 'confirmada' | 'en_camino' | 'completada';
}
