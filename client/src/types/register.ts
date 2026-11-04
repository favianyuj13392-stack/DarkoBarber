export interface ClientRegisterState {
  role: 'cliente' | 'barbero';
  email: string;
  password: string;
  displayName: string;
  birthDate: string;
  city: string;
  avatarUrl: string | null;
  selectedCutTypes: string[];
  selectedPriceRange: string;
  referencePhotoUrl: string | null;
}

export const INITIAL_REGISTER_STATE: ClientRegisterState = {
  role: 'cliente',
  email: '',
  password: '',
  displayName: 'Ernesto Salinas',
  birthDate: '2006-03-12',
  city: 'La Paz',
  avatarUrl: null,
  selectedCutTypes: ['Mid Fade', 'Corte clásico'],
  selectedPriceRange: '50 - 80 Bs',
  referencePhotoUrl: null,
};

export interface BarberServiceItem {
  id: string;
  name: string;
  priceBs: number;
  enabled: boolean;
  photo: string;
}

export interface BarberDaySchedule {
  day: string;
  hours: string;
  enabled: boolean;
}

export interface BarberRegisterState {
  role: 'barbero';
  email: string;
  password: string;
  displayName: string;
  city: string;
  currentShop: string;
  avatarUrl: string | null;
  services: BarberServiceItem[];
  schedule: BarberDaySchedule[];
  reservationMethod: 'automatica' | 'manual';
}

export const INITIAL_BARBER_SERVICES: BarberServiceItem[] = [
  { id: 'corte-clasico', name: 'Corte clásico', priceBs: 50, enabled: true, photo: '/assets/images/1.png' },
  { id: 'low-fade', name: 'Low Fade', priceBs: 60, enabled: true, photo: '/assets/images/2.png' },
  { id: 'mid-fade', name: 'Mid Fade', priceBs: 60, enabled: true, photo: '/assets/images/3.png' },
  { id: 'high-fade', name: 'High Fade', priceBs: 70, enabled: true, photo: '/assets/images/4.png' },
  { id: 'barba', name: 'Barba', priceBs: 40, enabled: false, photo: '/assets/images/1.png' },
];

export const INITIAL_BARBER_SCHEDULE: BarberDaySchedule[] = [
  { day: 'Lunes', hours: '10:00 - 20:00', enabled: true },
  { day: 'Martes', hours: '10:00 - 20:00', enabled: true },
  { day: 'Miércoles', hours: '10:00 - 20:00', enabled: true },
  { day: 'Jueves', hours: '10:00 - 20:00', enabled: true },
  { day: 'Viernes', hours: '10:00 - 20:00', enabled: true },
  { day: 'Sábado', hours: '10:00 - 18:00', enabled: true },
  { day: 'Domingo', hours: 'Cerrado', enabled: false },
];

export const INITIAL_BARBER_REGISTER_STATE: BarberRegisterState = {
  role: 'barbero',
  email: '',
  password: '',
  displayName: 'Brian López',
  city: 'La Paz',
  currentShop: 'Estudio 16',
  avatarUrl: null,
  services: INITIAL_BARBER_SERVICES,
  schedule: INITIAL_BARBER_SCHEDULE,
  reservationMethod: 'automatica',
};
