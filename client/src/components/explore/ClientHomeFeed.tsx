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
import { AnimatedNumber } from '../common/AnimatedNumber';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import { SPRING_TOUCH, SPRING_MODAL } from '../../constants/springs';

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

const pageVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const sectionVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { ...SPRING_MODAL, staggerChildren: 0.06 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: SPRING_MODAL },
};

const reducedPageVariants = {
  hidden: {},
  visible: {},
};

const reducedItemVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0 } },
};

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
  const reduceMotion = usePrefersReducedMotion();
  const pageMotion = reduceMotion ? reducedPageVariants : pageVariants;
  const sectionMotion = reduceMotion ? reducedItemVariants : sectionVariants;
  const cardMotion = reduceMotion ? reducedItemVariants : cardVariants;
  const hoverProps = reduceMotion
    ? {}
    : { whileHover: { y: -2 }, whileTap: { scale: 0.98 }, transition: SPRING_TOUCH };

  const availableBarbers = barbers.filter((b) => b.status === 'GREEN');
  const recommendedBarbers = barbers.filter((b) => b.rating >= 4.8);

  // Anchor of the "available now" bento: the best rated available barber.
  const anchorBarber = availableBarbers.reduce<ExploreBarber | null>(
    (best, b) => (best === null || b.rating > best.rating ? b : best),
    null
  );
  const satelliteBarbers = availableBarbers.filter((b) => b.id !== anchorBarber?.id);
  const topSatellites = satelliteBarbers.slice(0, 2);
  const restBarbers = satelliteBarbers.slice(2);

  const featuredShops = shops.slice(0, 3);
  const anchorShop = featuredShops[0];
  const satelliteShops = featuredShops.slice(1);

  const renderCompactBarber = (barber: ExploreBarber) => (
    <motion.div
      key={barber.id}
      variants={cardMotion}
      {...hoverProps}
      onClick={() => onSelectBarber(barber)}
      className="fade-surface rounded-3xl p-3.5 hover:border-[#B68F4E]/50 cursor-pointer group flex items-center gap-3.5"
    >
      <img
        src={barber.avatar}
        alt={barber.name}
        className="w-16 h-16 rounded-2xl object-cover object-top border border-white/10 flex-shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] font-bold text-emerald-300 tracking-wider uppercase font-mono">
            Libre
          </span>
        </div>
        <h3 className="text-sm font-bold text-white tracking-tight truncate group-hover:text-[#F3E9DC] transition-colors">
          {barber.name}
        </h3>
        <p className="text-xs text-[#D9C9B0]/80 truncate">{barber.shopName}</p>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-white/50">
          <span className="flex items-center gap-0.5 text-[#B68F4E] font-semibold">
            <Star className="w-3 h-3 fill-current" />
            <AnimatedNumber value={barber.rating} decimals={1} />
          </span>
          <span>·</span>
          <span className="font-mono text-[#B68F4E]">{barber.priceRange}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onQuickBook(barber);
        }}
        className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-gradient-to-b from-[#F3E9DC] to-[#D9C9B0] text-black text-xs font-extrabold uppercase tracking-wider shadow-sm hover:brightness-105 active:scale-95 transition-all cursor-pointer"
      >
        Reservar
      </button>
    </motion.div>
  );

  return (
    <motion.div
      variants={pageMotion}
      initial="hidden"
      animate="visible"
      className="w-full pb-28 pt-2 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8"
    >
      {/* 1. Header con Ciudad e Isotipo */}
      <motion.div variants={sectionMotion} className="flex items-center justify-between pt-2">
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
      </motion.div>

      {/* 2. Hero Search "¿Qué corte va hoy?" */}
      <motion.div variants={sectionMotion} className="space-y-4">
        <div>
          <span className="text-[11px] uppercase tracking-[0.2em] font-mono text-[#B68F4E] font-semibold">
            Dark Luxury Grooming
          </span>
          <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white tracking-tight mt-1 leading-[1.1]">
            ¿Qué corte <span className="font-editorial text-gold-gradient">va hoy?</span>
          </h1>
        </div>

        {/* Search Bar Input */}
        <div
          onClick={onOpenSearch}
          className="fade-surface relative flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer hover:border-[#B68F4E]/50 transition-all group"
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
      </motion.div>

      {/* 3. Card "Tu próxima reserva" (Destacada) */}
      {activeBooking && (
        <motion.div
          variants={sectionMotion}
          className="fade-surface-elevated relative overflow-hidden rounded-3xl border-[#B68F4E]/30 p-5 sm:p-6"
        >
          {/* Subtle gold glow behind card */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#B68F4E]/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#B68F4E]/20 text-[#F5EBDD] border border-[#B68F4E]/40 text-[10px] font-mono font-bold tracking-wider uppercase">
                <Calendar className="w-3 h-3 text-[#B68F4E]" />
                {activeBooking.dateBadge}
              </span>
              <span className="text-xs text-[#D9C9B0]/70 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {activeBooking.timeRange}
              </span>
            </div>
            {activeBooking.status === 'confirmada' ? (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="w-3 h-3" />
                Confirmada
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-full">
                <Clock className="w-3 h-3 text-amber-400" />
                Por Confirmar
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <img
                src={activeBooking.barberAvatar}
                alt={activeBooking.barberName}
                className="w-14 h-14 rounded-2xl object-cover border border-[#B68F4E]/40 shadow-md"
              />
              <div>
                <h3 className="text-lg font-serif font-bold text-white tracking-tight">
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
                const b =
                  (activeBooking.barberId && barbers.find((x) => x.id === activeBooking.barberId)) ||
                  barbers.find((x) => x.name.toLowerCase() === activeBooking.barberName.toLowerCase()) ||
                  barbers.find((x) => x.name.includes(activeBooking.barberName)) ||
                  barbers[0];
                if (b) {
                  onSelectBarber(b);
                }
              }}
              className="flex-shrink-0 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-[#B68F4E]/20 text-white hover:text-[#F3E9DC] border border-white/15 text-xs font-semibold tracking-wide transition-all cursor-pointer flex items-center gap-1"
            >
              <span>Ver cita</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}

      {/* 4. Bento "Barberos disponibles ahora" */}
      <motion.section variants={sectionMotion} className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-xl font-serif font-bold text-white tracking-tight">
              Barberos <span className="font-editorial text-gold-gradient">disponibles ahora</span>
            </h2>
            <span className="text-xs font-mono font-bold text-[#B68F4E] px-2 py-0.5 rounded-full bg-[#B68F4E]/10 border border-[#B68F4E]/25">
              <AnimatedNumber value={availableBarbers.length} />
            </span>
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

        {anchorBarber && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Anchor: dominant visual (about 60% width) */}
            <motion.div
              variants={cardMotion}
              {...hoverProps}
              onClick={() => onSelectBarber(anchorBarber)}
              className="fade-surface rounded-[28px] p-4 hover:border-[#B68F4E]/50 cursor-pointer group flex flex-col justify-between md:col-span-3 md:row-span-2"
            >
              <div className="relative mb-4 flex-1 min-h-56">
                <img
                  src={anchorBarber.avatar}
                  alt={anchorBarber.name}
                  className="absolute inset-0 w-full h-full rounded-2xl object-cover object-top border border-white/10"
                />
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/15">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] font-bold text-white tracking-wider uppercase font-mono">
                    Libre
                  </span>
                </div>
                <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/15 text-sm text-[#F5EBDD] font-bold">
                  <Star className="w-3.5 h-3.5 text-[#B68F4E] fill-current" />
                  <AnimatedNumber value={anchorBarber.rating} decimals={1} />
                </div>
              </div>

              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-xl font-serif font-bold text-white tracking-tight group-hover:text-[#F3E9DC] transition-colors">
                    {anchorBarber.name}
                  </h3>
                  <p className="text-sm text-[#D9C9B0]/80 truncate">{anchorBarber.shopName}</p>
                  <p className="text-xs text-white/50 mt-0.5">
                    {anchorBarber.zone} · A {Math.round(anchorBarber.distanceKm * 1000)} m
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className="text-xs font-mono font-bold text-[#B68F4E]">
                    {anchorBarber.priceRange}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onQuickBook(anchorBarber);
                    }}
                    className="px-4 py-2 rounded-xl bg-gradient-to-b from-[#F3E9DC] to-[#D9C9B0] text-black text-xs font-extrabold uppercase tracking-wider shadow-sm hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                  >
                    Reservar
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Satellites */}
            {topSatellites.map((barber) => (
              <div key={barber.id} className="md:col-span-2 flex flex-col">
                {renderCompactBarber(barber)}
              </div>
            ))}
          </div>
        )}

        {restBarbers.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {restBarbers.map((barber) => renderCompactBarber(barber))}
          </div>
        )}
      </motion.section>

      {/* 5. Bento "Estudios destacados" */}
      <motion.section variants={sectionMotion} className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#B68F4E]" />
            <h2 className="text-xl font-serif font-bold text-white tracking-tight">
              Estudios <span className="font-editorial text-gold-gradient">destacados</span>
            </h2>
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

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {anchorShop && (
            <motion.div
              variants={cardMotion}
              {...hoverProps}
              onClick={() => onSelectShop(anchorShop)}
              className="fade-surface rounded-[28px] p-4 hover:border-[#B68F4E]/40 cursor-pointer group lg:col-span-3 lg:row-span-2 flex flex-col"
            >
              <div className="relative flex-1 min-h-64 mb-4 rounded-2xl overflow-hidden border border-white/10">
                <img
                  src={anchorShop.photos[0]}
                  alt={anchorShop.name}
                  className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-black/70 backdrop-blur-md border border-white/15 text-sm text-white font-bold">
                  <Star className="w-3.5 h-3.5 text-[#B68F4E] fill-current" />
                  <AnimatedNumber value={anchorShop.rating} decimals={1} />
                  <span className="text-[10px] text-white/50">({anchorShop.reviewCount})</span>
                </div>
                <div className="absolute bottom-3 left-3">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#B68F4E] bg-black/70 px-2 py-0.5 rounded-md border border-white/10">
                    {anchorShop.zone}
                  </span>
                </div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-xl font-serif font-bold text-white tracking-tight group-hover:text-[#D9C9B0] transition-colors">
                    {anchorShop.name}
                  </h3>
                  <p className="text-xs text-white/50 truncate mt-0.5">{anchorShop.address}</p>
                </div>
                <span className="text-xs text-[#D9C9B0] font-mono flex-shrink-0">
                  <AnimatedNumber value={anchorShop.distanceKm} decimals={1} /> km
                </span>
              </div>
            </motion.div>
          )}

          {satelliteShops.map((shop) => (
            <motion.div
              key={shop.id}
              variants={cardMotion}
              {...hoverProps}
              onClick={() => onSelectShop(shop)}
              className="fade-surface rounded-3xl p-3.5 hover:border-[#B68F4E]/40 cursor-pointer group lg:col-span-2 flex items-center gap-3.5"
            >
              <img
                src={shop.photos[0]}
                alt={shop.name}
                className="w-20 h-20 rounded-2xl object-cover border border-white/10 flex-shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#B68F4E]">
                  {shop.zone}
                </span>
                <h3 className="text-sm font-bold text-white tracking-tight truncate group-hover:text-[#D9C9B0] transition-colors">
                  {shop.name}
                </h3>
                <p className="text-xs text-white/50 truncate">{shop.address}</p>
                <div className="flex items-center gap-2 mt-0.5 text-[11px] text-white/60">
                  <span className="flex items-center gap-0.5 text-[#B68F4E] font-semibold">
                    <Star className="w-3 h-3 fill-current" />
                    <AnimatedNumber value={shop.rating} decimals={1} />
                  </span>
                  <span className="text-white/50">({shop.reviewCount})</span>
                  <span className="font-mono text-[#D9C9B0]">
                    <AnimatedNumber value={shop.distanceKm} decimals={1} /> km
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* 6. Sección "Recomendados para ti" */}
      <motion.section variants={sectionMotion} className="space-y-4">
        <h2 className="text-xl font-serif font-bold text-white tracking-tight">
          Recomendados <span className="font-editorial text-gold-gradient">para ti</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {recommendedBarbers.map((barber) => (
            <motion.div
              key={barber.id}
              variants={cardMotion}
              {...hoverProps}
              onClick={() => onSelectBarber(barber)}
              className="fade-surface flex items-center justify-between p-3.5 rounded-2xl hover:border-[#B68F4E]/40 cursor-pointer group"
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
                      <AnimatedNumber value={barber.rating} decimals={1} />
                    </span>
                    <span>•</span>
                    <span>
                      <AnimatedNumber value={barber.experienceYears} /> años exp
                    </span>
                  </div>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white transition-colors" />
            </motion.div>
          ))}
        </div>
      </motion.section>
    </motion.div>
  );
};
