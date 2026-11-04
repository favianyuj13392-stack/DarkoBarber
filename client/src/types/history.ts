export interface CutPhotoItem {
  id: string;
  url: string;
  angle: 'Frontal' | 'Lateral Izquierdo' | 'Lateral Derecho' | 'Trasero';
  isPublic?: boolean;
}

export interface HaircutItem {
  id: string;
  date: string;
  rawDate: string; // ISO date for sorting
  monthGroup: string; // e.g. "Octubre 2026", "Septiembre 2026"
  styleName: string;
  barberName: string;
  barberAvatar?: string;
  shopName: string;
  durationMinutes: number;
  priceBs: number;
  barberNotes: string;
  photos: CutPhotoItem[];
  coverPhoto: string;
  category: 'corte' | 'barba' | 'combo';
  isFavorite?: boolean;
  isVerified?: boolean;
  specs: {
    degradedNumber: string; // e.g. "#0.5"
    fadeType: string; // e.g. "Mid Fade"
    upperTreatment: string; // e.g. "Texturizado tijera"
    beardTreatment: string; // e.g. "Perfilado con navaja"
  };
}

export interface ClientPreferences {
  generalNotes: string;
  likes: string[];
  dislikes: string[];
}
