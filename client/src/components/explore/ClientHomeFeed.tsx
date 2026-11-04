import type { FC } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  MapPin,
  Bell,
  Star,
  ChevronRight,
  Clock,
  Sparkles,
  Calendar,
  CheckCircle2,
} from 'lucide-react';
import type { ExploreBarber, ShopItem, ActiveBooking } from '../../types/explore';
import { BrandLogo } from '../common/BrandLogo';

interface ClientHomeFeedProps {
  barbers: ExploreBarber[];
  shops: ShopItem[];
  activeBooking: ActiveBooking | null;
  onSelectBarber: (barber: ExploreBarber) => void;
  onSelectShop: (shop: ShopItem) => void;
  onOpenMap: () => void;
  onOpenSearch: () => void;
  onFilterAvailableNow: () => void;
  onFilterNearMe: () => void;
  onQuickBook: (barber: ExploreBarber) => void;
}

export const ClientHomeFeed: FC<ClientHomeFeedProps> = ({
  barbers,
  shops,
  activeBooking,
  onSelectBarber,
  onSelectShop,
  onOpenMap,
  onOpenSearch,
  onFilterAvailableNow,
  onFilterNearMe,
  onQuickBook,
}) => {
  const availableBarbers = barbers.filter((b) => b.status === 'GREEN');
  const recommendedBarbers = barbers.filter((b) => b.rating >= 4.8);

  return (
    <div className="w-full pb-28 pt-2 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-7">
      {/* 1. Header con Ciudad e Isotipo */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-sm">
            <MapPin className="w-3.5 h-3.5 text-[#B68F4E]" />
            <span className="text-xs font-semibold text-white tracking-wide">La Paz</span>
            <span className="text-[10px] text-[#B68F4E]">▾</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="block lg:hidden">
            <BrandLogo variant="icon" size="sm" />
          </div>
          <button
            type="button"
            className="relative p-2.5 rounded-full bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Notificaciones"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#B68F4E] ring-2 ring-black" />
          </button>
        </div>
      </div>

      {/* 2. Hero Search "¿Qué corte va hoy?" */}
      <div className="space-y-3">
        <div>
          <span className="text-[11px] uppercase tracking-[0.2em] font-mono text-[#B68F4E] font-semibold">
            Dark Luxury Grooming
          </span>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight mt-0.5">
            ¿Qué corte va hoy?
          </h1>
        </div>

        {/* Search Bar Input */}
        <div
          onClick={onOpenSearch}
          className="relative flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-white/[0.07] to-white/[0.03] border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_25px_rgba(0,0,0,0.5)] cursor-pointer hover:border-[#B68F4E]/50 transition-all group"
        >
          <Search className="w-4 h-4 text-[#D9C9B0]/70 group-hover:text-[#B68F4E] transition-colors" />
          <span className="text-xs sm:text-sm text-white/50 tracking-wide font-normal">
            Buscar barbero, barbería o zona...
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenMap();
              }}
              className="px-2.5 py-1 rounded-lg bg-[#B68F4E]/15 border border-[#B68F4E]/30 text-[#D9C9B0] text-[11px] font-semibold hover:bg-[#B68F4E]/30 transition-colors flex items-center gap-1"
            >
              <MapPin className="w-3 h-3 text-[#B68F4E]" />
              <span className="hidden sm:inline">Ver Mapa</span>
            </button>
          </div>
        </div>

        {/* Quick Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          <button
            type="button"
            className="flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-bold bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black shadow-[0_2px_10px_rgba(217,201,176,0.3),inset_0_1px_0_rgba(255,255,255,0.8)] cursor-pointer"
          >
            Todos
          </button>
          <button
            type="button"
            onClick={onFilterAvailableNow}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Disponibles ahora</span>
          </button>
          <button
            type="button"
            onClick={onFilterNearMe}
            className="flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <MapPin className="w-3 h-3 text-[#B68F4E]" />
            <span>Cerca de mí</span>
          </button>
        </div>
      </div>

      {/* 3. Card "Tu próxima reserva" (Destacada) */}
      {activeBooking && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1E1C18] via-[#151412] to-[#0D0D0C] border border-[#B68F4E]/30 p-5 shadow-[0_15px_35px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(217,201,176,0.25)]"
        >
          {/* Subtle gold glow behind card */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#B68F4E]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#B68F4E]/20 text-[#F5EBDD] border border-[#B68F4E]/40 text-[10px] font-mono font-bold tracking-wider uppercase">
                <Calendar className="w-3 h-3 text-[#B68F4E]" />
                {activeBooking.dateBadge}
              </span>
              <span className="text-xs text-[#D9C9B0]/70 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {activeBooking.timeRange}
              </span>
            </div>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-full">
              <CheckCircle2 className="w-3 h-3" />
              Confirmada
            </span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <img
                src={activeBooking.barberAvatar}
                alt={activeBooking.barberName}
                className="w-13 h-13 rounded-2xl object-cover border border-[#B68F4E]/40 shadow-md"
              />
              <div>
                <h3 className="text-base font-bold text-white tracking-tight">
                  {activeBooking.shopName}
                </h3>
                <p className="text-xs text-[#D9C9B0]/90">
                  Con <strong className="text-white">{activeBooking.barberName}</strong>
                </p>
                <p className="text-[11px] text-white/50 mt-0.5 truncate max-w-[200px] sm:max-w-xs">
                  {activeBooking.serviceName}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const b = barbers.find((x) => x.name.includes(activeBooking.barberName)) || barbers[0];
                onSelectBarber(b);
              }}
              className="flex-shrink-0 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-[#B68F4E]/20 text-white hover:text-[#F3E9DC] border border-white/15 text-xs font-semibold tracking-wide transition-all cursor-pointer flex items-center gap-1"
            >
              <span>Ver cita</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}

      {/* 4. Carrusel "Barberos disponibles ahora" */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-base font-bold text-white tracking-tight">
              Barberos disponibles ahora
            </h2>
          </div>
          <button
            type="button"
            onClick={onOpenSearch}
            className="text-xs font-semibold text-[#B68F4E] hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>Ver todos</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Horizontal Carousel */}
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {availableBarbers.map((barber) => (
            <motion.div
              key={barber.id}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
              onClick={() => onSelectBarber(barber)}
              className="flex-shrink-0 w-64 rounded-3xl bg-gradient-to-b from-[#181818] via-[#121212] to-[#0A0A0A] border border-white/10 hover:border-[#B68F4E]/50 p-4 shadow-[0_12px_28px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12)] cursor-pointer group flex flex-col justify-between"
            >
              <div>
                <div className="relative mb-3">
                  <img
                    src={barber.avatar}
                    alt={barber.name}
                    className="w-full h-36 rounded-2xl object-cover object-top border border-white/10"
                  />
                  {/* Presence Status Badge */}
                  <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/15">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-bold text-white tracking-wider uppercase font-mono">
                      Libre
                    </span>
                  </div>

                  {/* Rating Badge */}
                  <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/15 text-xs text-[#F5EBDD] font-bold">
                    <Star className="w-3 h-3 text-[#B68F4E] fill-current" />
                    <span>{barber.rating}</span>
                  </div>
                </div>

                <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-[#F3E9DC] transition-colors">
                  {barber.name}
                </h3>
                <p className="text-xs text-[#D9C9B0]/80 truncate">{barber.shopName}</p>
                <p className="text-[11px] text-white/50 mt-0.5">
                  {barber.zone} · A {Math.round(barber.distanceKm * 1000)} m
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#B68F4E]">
                  {barber.priceRange}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onQuickBook(barber);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-b from-[#F3E9DC] to-[#D9C9B0] text-black text-xs font-extrabold uppercase tracking-wider shadow-sm hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                >
                  Reservar
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 5. Sección Barberías Destacadas */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#B68F4E]" />
            <h2 className="text-base font-bold text-white tracking-tight">Estudios destacados</h2>
          </div>
          <button
            type="button"
            onClick={onOpenSearch}
            className="text-xs font-semibold text-[#B68F4E] hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <span>Ver mapa</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {shops.slice(0, 3).map((shop) => (
            <motion.div
              key={shop.id}
              whileHover={{ y: -3 }}
              onClick={() => onSelectShop(shop)}
              className="rounded-3xl bg-gradient-to-b from-[#161616] to-[#0A0A0A] border border-white/10 hover:border-[#B68F4E]/40 p-4 shadow-lg cursor-pointer group"
            >
              <div className="relative h-40 mb-3 rounded-2xl overflow-hidden border border-white/10">
                <img
                  src={shop.photos[0]}
                  alt={shop.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/15 text-xs text-white font-bold">
                  <Star className="w-3 h-3 text-[#B68F4E] fill-current" />
                  <span>{shop.rating}</span>
                  <span className="text-[10px] text-white/50">({shop.reviewCount})</span>
                </div>
                <div className="absolute bottom-2.5 left-2.5">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#B68F4E] bg-black/70 px-2 py-0.5 rounded-md border border-white/10">
                    {shop.zone}
                  </span>
                </div>
              </div>

              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight group-hover:text-[#D9C9B0] transition-colors">
                    {shop.name}
                  </h3>
                  <p className="text-xs text-white/50 truncate max-w-[200px] mt-0.5">
                    {shop.address}
                  </p>
                </div>
                <span className="text-xs text-[#D9C9B0] font-mono">
                  {shop.distanceKm} km
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* 6. Sección "Recomendados para ti" */}
      <div className="space-y-3.5">
        <h2 className="text-base font-bold text-white tracking-tight">Recomendados para ti</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {recommendedBarbers.map((barber) => (
            <div
              key={barber.id}
              onClick={() => onSelectBarber(barber)}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-white/[0.04] to-transparent border border-white/10 hover:border-[#B68F4E]/40 hover:bg-white/[0.06] transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <img
                  src={barber.avatar}
                  alt={barber.name}
                  className="w-12 h-12 rounded-xl object-cover border border-white/15"
                />
                <div>
                  <h4 className="text-sm font-bold text-white group-hover:text-[#F3E9DC] transition-colors">
                    {barber.name}
                  </h4>
                  <p className="text-xs text-[#D9C9B0]/70">{barber.shopName}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-white/50">
                    <span className="flex items-center gap-0.5 text-[#B68F4E] font-semibold">
                      <Star className="w-3 h-3 fill-current" />
                      {barber.rating}
                    </span>
                    <span>•</span>
                    <span>{barber.experienceYears} años exp</span>
                  </div>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
