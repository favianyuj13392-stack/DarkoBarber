import { useState, type FC } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Share2,
  Heart,
  Navigation,
  Star,
  CheckCircle2,
  Clock,
  MapPin,
  Coffee,
  Wifi,
  Wind,
  CreditCard,
  ChevronRight,
} from 'lucide-react';
import type { ShopItem, ExploreBarber } from '../../types/explore';

interface ShopDetailViewProps {
  shop: ShopItem;
  barbers: ExploreBarber[];
  onBack: () => void;
  onSelectBarber: (barber: ExploreBarber) => void;
  onQuickBookBarber: (barber: ExploreBarber) => void;
  onToggleFavorite: (shopId: string) => void;
}

export const ShopDetailView: FC<ShopDetailViewProps> = ({
  shop,
  barbers,
  onBack,
  onSelectBarber,
  onQuickBookBarber,
  onToggleFavorite,
}) => {
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'info' | 'servicios' | 'barberos' | 'fotos'>('barberos');
  const [shareCopied, setShareCopied] = useState(false);

  // Barbers working at this shop
  const shopBarbers = barbers.filter((b) => shop.barberIds.includes(b.id) || b.shopId === shop.id);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: shop.name,
        text: `Conoce ${shop.name} en FADE Dark Luxury Grooming`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    }
  };

  const handleOpenMaps = () => {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${shop.lat},${shop.lng}`,
      '_blank'
    );
  };

  return (
    <div className="w-full pb-32 pt-2 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      {/* 1. Header con Botón Volver y Acciones */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleFavorite(shop.id)}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-red-400 hover:bg-white/10 transition-colors cursor-pointer"
            title="Guardar como favorito"
          >
            <Heart
              className={`w-4 h-4 ${shop.isFavorite ? 'fill-red-500 text-red-500' : ''}`}
            />
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs font-semibold"
          >
            <Share2 className="w-4 h-4" />
            <span>{shareCopied ? '¡Copiado!' : 'Compartir'}</span>
          </button>
        </div>
      </div>

      {/* 2. Photo Carousel */}
      <div className="relative w-full h-64 sm:h-80 rounded-3xl overflow-hidden border border-white/15 shadow-[0_20px_45px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.18)]">
        <img
          src={shop.photos[activePhotoIndex]}
          alt={shop.name}
          className="w-full h-full object-cover transition-all duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

        {/* Counter Badge */}
        <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/15 text-xs font-mono font-bold text-white">
          {activePhotoIndex + 1} / {shop.photos.length}
        </div>

        {/* Thumbnails indicator */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 px-4">
          {shop.photos.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActivePhotoIndex(idx)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                activePhotoIndex === idx ? 'w-8 bg-[#B68F4E]' : 'w-2 bg-white/30 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      </div>

      {/* 3. Shop Info Header */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
                {shop.name}
              </h1>
              {shop.isVerified && <CheckCircle2 className="w-5 h-5 text-[#B68F4E]" />}
            </div>
            <p className="text-xs sm:text-sm text-[#D9C9B0] flex items-center gap-1.5 mt-1">
              <MapPin className="w-4 h-4 text-[#B68F4E] flex-shrink-0" />
              <span>{shop.address}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-white/5 border border-white/10 text-white font-bold">
              <Star className="w-4 h-4 text-[#B68F4E] fill-current" />
              <span className="text-sm">{shop.rating}</span>
              <span className="text-xs text-white/50">({shop.reviewCount})</span>
            </div>
          </div>
        </div>

        {/* Status pill & distance */}
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Abierto ahora
          </span>
          <span className="text-[#D9C9B0]/70 flex items-center gap-1 font-mono">
            <Clock className="w-3.5 h-3.5" />
            {shop.hours}
          </span>
          <span className="text-white/40">•</span>
          <span className="text-white/60 font-mono">{shop.distanceKm} km de ti</span>
        </div>

        {/* 3 Quick Action Buttons */}
        <div className="grid grid-cols-3 gap-3 pt-2">
          <button
            type="button"
            onClick={handleOpenMaps}
            className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl bg-white/5 hover:bg-[#B68F4E]/15 border border-white/10 hover:border-[#B68F4E]/40 text-xs font-semibold text-[#F5EBDD] transition-all cursor-pointer"
          >
            <Navigation className="w-4 h-4 text-[#B68F4E]" />
            <span>Cómo llegar</span>
          </button>
          <button
            type="button"
            onClick={() => onToggleFavorite(shop.id)}
            className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl bg-white/5 hover:bg-[#B68F4E]/15 border border-white/10 hover:border-[#B68F4E]/40 text-xs font-semibold text-[#F5EBDD] transition-all cursor-pointer"
          >
            <Heart
              className={`w-4 h-4 ${shop.isFavorite ? 'fill-red-500 text-red-500' : 'text-[#B68F4E]'}`}
            />
            <span>{shop.isFavorite ? 'Guardado' : 'Guardar'}</span>
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-2xl bg-white/5 hover:bg-[#B68F4E]/15 border border-white/10 hover:border-[#B68F4E]/40 text-xs font-semibold text-[#F5EBDD] transition-all cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-[#B68F4E]" />
            <span>Compartir</span>
          </button>
        </div>
      </div>

      {/* 4. Tabs Internas */}
      <div className="border-b border-white/10">
        <div className="flex gap-6 overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'barberos', label: `Barberos (${shopBarbers.length})` },
              { id: 'servicios', label: `Servicios (${shop.services.length})` },
              { id: 'info', label: 'Información' },
              { id: 'fotos', label: `Fotos (${shop.photos.length})` },
            ] as const
          ).map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`pb-3 text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer relative select-none ${
                  isActive ? 'text-[#B68F4E] font-bold' : 'text-white/50 hover:text-white'
                }`}
              >
                {t.label}
                {isActive && (
                  <motion.div
                    layoutId="activeShopTabIndicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B68F4E]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Tab Content */}
      <div className="space-y-4">
        {/* TAB BARBEROS */}
        {activeTab === 'barberos' && (
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
              Equipo de Barberos
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {shopBarbers.map((barber) => (
                <div
                  key={barber.id}
                  onClick={() => onSelectBarber(barber)}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-white/[0.04] to-transparent border border-white/10 hover:border-[#B68F4E]/40 hover:bg-white/[0.06] transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <img
                        src={barber.avatar}
                        alt={barber.name}
                        className="w-13 h-13 rounded-2xl object-cover border border-white/15"
                      />
                      <span
                        className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-black ${
                          barber.status === 'GREEN'
                            ? 'bg-emerald-400'
                            : barber.status === 'YELLOW'
                            ? 'bg-amber-400'
                            : 'bg-rose-500'
                        }`}
                      />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white group-hover:text-[#F3E9DC] transition-colors">
                        {barber.name}
                      </h4>
                      <div className="flex items-center gap-1.5 text-xs text-[#D9C9B0]/80 mt-0.5">
                        <Star className="w-3 h-3 text-[#B68F4E] fill-current" />
                        <span>{barber.rating}</span>
                        <span>•</span>
                        <span>{barber.experienceYears} años exp</span>
                      </div>
                      <p className="text-[11px] text-white/50 truncate max-w-[180px]">
                        {barber.specialties.join(', ')}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickBookBarber(barber);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-gradient-to-b from-[#F3E9DC] to-[#D9C9B0] text-black text-xs font-extrabold uppercase tracking-wider shadow-sm hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                  >
                    Agendar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB SERVICIOS */}
        {activeTab === 'servicios' && (
          <div className="space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
              Menú de Servicios Oficial
            </h3>
            <div className="space-y-2.5">
              {shop.services.map((srv) => (
                <div
                  key={srv.id}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">{srv.name}</h4>
                    <p className="text-xs text-white/60 max-w-md">{srv.description}</p>
                    <span className="text-[11px] text-[#D9C9B0]/70 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {srv.durationMin} minutos
                    </span>
                  </div>
                  <div className="text-right flex-shrink-0 pl-4">
                    <span className="text-sm font-mono font-bold text-[#B68F4E]">
                      {srv.priceBs} Bs
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB INFORMACIÓN */}
        {activeTab === 'info' && (
          <div className="space-y-5 text-sm">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
                Sobre el estudio
              </h4>
              <p className="text-xs text-white/80 leading-relaxed">
                Estudio premier de barbería clásica y diseño de corte contemporáneo en el corazón de
                Sopocachi. Equipado con sillones hidráulicos de piel italiana, toalleros calientes
                japoneses y estación de café de especialidad para acompañar tu sesión.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
                Comodidades & Amenidades
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex items-center gap-2 text-xs text-white/80">
                  <Coffee className="w-4 h-4 text-[#B68F4E]" />
                  <span>Café de especialidad</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/80">
                  <Wifi className="w-4 h-4 text-[#B68F4E]" />
                  <span>WiFi de alta velocidad</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/80">
                  <Wind className="w-4 h-4 text-[#B68F4E]" />
                  <span>Climatizado</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/80">
                  <CreditCard className="w-4 h-4 text-[#B68F4E]" />
                  <span>QR y Tarjetas</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB FOTOS */}
        {activeTab === 'fotos' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {shop.photos.map((photo, i) => (
              <div
                key={i}
                onClick={() => setActivePhotoIndex(i)}
                className="relative h-40 rounded-2xl overflow-hidden border border-white/15 cursor-pointer group"
              >
                <img
                  src={photo}
                  alt={`Foto local ${i + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sticky Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/90 border-t border-white/10 backdrop-blur-2xl z-30">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (shopBarbers.length > 0) {
                onQuickBookBarber(shopBarbers[0]);
              }
            }}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-extrabold text-xs uppercase tracking-wider shadow-[0_8px_24px_rgba(217,201,176,0.35),inset_0_1px_0_rgba(255,255,255,0.8)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Reservar cita en este estudio</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
