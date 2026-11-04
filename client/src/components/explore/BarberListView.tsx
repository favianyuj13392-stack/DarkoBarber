import type { FC } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Map as MapIcon,
  SlidersHorizontal,
  Star,
  Heart,
  MapPin,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { ExploreBarber, ShopItem, FilterOptions } from '../../types/explore';

interface BarberListViewProps {
  barbers: ExploreBarber[];
  shops: ShopItem[];
  filters: FilterOptions;
  onChangeFilters: (filters: FilterOptions) => void;
  onOpenFiltersModal: () => void;
  onSwitchToMap: () => void;
  onSelectBarber: (barber: ExploreBarber) => void;
  onSelectShop: (shop: ShopItem) => void;
  onQuickBook: (barber: ExploreBarber) => void;
  onToggleFavoriteBarber: (id: string) => void;
  onToggleFavoriteShop: (id: string) => void;
}

export const BarberListView: FC<BarberListViewProps> = ({
  barbers,
  shops,
  filters,
  onChangeFilters,
  onOpenFiltersModal,
  onSwitchToMap,
  onSelectBarber,
  onSelectShop,
  onQuickBook,
  onToggleFavoriteBarber,
  onToggleFavoriteShop,
}) => {
  // Apply filtering logic
  const filteredBarbers = barbers.filter((b) => {
    // Search query
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      const matchName = b.name.toLowerCase().includes(q);
      const matchShop = b.shopName.toLowerCase().includes(q);
      const matchZone = b.zone.toLowerCase().includes(q);
      const matchSpec = b.specialties.some((s) => s.toLowerCase().includes(q));
      if (!matchName && !matchShop && !matchZone && !matchSpec) return false;
    }
    // Only available now
    if (filters.onlyAvailableNow && b.status !== 'GREEN') return false;
    // Max distance
    if (b.distanceKm > filters.maxDistanceKm) return false;
    // Selected zones
    if (filters.selectedZones.length > 0 && !filters.selectedZones.includes(b.zone)) return false;
    // Rating
    if (filters.minRating > 0 && b.rating < filters.minRating) return false;

    return true;
  });

  const filteredShops = shops.filter((s) => {
    if (filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchZone = s.zone.toLowerCase().includes(q);
      const matchAddress = s.address.toLowerCase().includes(q);
      if (!matchName && !matchZone && !matchAddress) return false;
    }
    if (s.distanceKm > filters.maxDistanceKm) return false;
    if (filters.selectedZones.length > 0 && !filters.selectedZones.includes(s.zone)) return false;
    if (filters.minRating > 0 && s.rating < filters.minRating) return false;

    return true;
  });

  const activeFiltersCount =
    (filters.onlyAvailableNow ? 1 : 0) +
    (filters.onlyThisWeek ? 1 : 0) +
    filters.selectedZones.length +
    filters.priceRanges.length +
    filters.selectedServices.length +
    (filters.minRating > 0 ? 1 : 0);

  return (
    <div className="w-full pb-28 pt-2 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-5">
      {/* 1. Header con Buscador y Toggle a Mapa */}
      <div className="flex items-center gap-2 pt-1">
        <div className="relative flex-1 flex items-center">
          <Search className="absolute left-3.5 w-4 h-4 text-white/40 pointer-events-none" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => onChangeFilters({ ...filters, searchQuery: e.target.value })}
            placeholder="Buscar barbero, barbería o zona..."
            className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/40 text-xs sm:text-sm focus:outline-none focus:border-[#B68F4E]/60 focus:bg-white/[0.08] transition-all shadow-inner"
          />
          {filters.searchQuery && (
            <button
              type="button"
              onClick={() => onChangeFilters({ ...filters, searchQuery: '' })}
              className="absolute right-3 text-xs text-white/40 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Botón Mapa */}
        <button
          type="button"
          onClick={onSwitchToMap}
          className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-3 rounded-2xl bg-white/5 hover:bg-[#B68F4E]/20 text-[#D9C9B0] hover:text-[#F3E9DC] border border-white/15 text-xs font-semibold tracking-wide transition-all cursor-pointer shadow-sm"
          title="Ver en mapa interactivo"
        >
          <MapIcon className="w-4 h-4 text-[#B68F4E]" />
          <span className="hidden sm:inline">Mapa</span>
        </button>
      </div>

      {/* 2. Filtros Rápidos & Subtabs */}
      <div className="space-y-3">
        {/* Pills fila superior */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={onOpenFiltersModal}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
              activeFiltersCount > 0
                ? 'bg-[#B68F4E] text-black border-[#B68F4E] shadow-[0_0_12px_rgba(182,143,78,0.4)]'
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filtros {activeFiltersCount > 0 ? `(${activeFiltersCount})` : ''}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              onChangeFilters({
                ...filters,
                onlyAvailableNow: !filters.onlyAvailableNow,
              })
            }
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
              filters.onlyAvailableNow
                ? 'bg-[#F3E9DC] text-black border-[#F3E9DC] font-bold'
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                filters.onlyAvailableNow ? 'bg-black' : 'bg-emerald-400'
              }`}
            />
            <span>Disponibles ahora</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const current = filters.minRating === 4.8 ? 0 : 4.8;
              onChangeFilters({ ...filters, minRating: current });
            }}
            className={`flex-shrink-0 flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer ${
              filters.minRating >= 4.8
                ? 'bg-[#F3E9DC] text-black border-[#F3E9DC] font-bold'
                : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
            }`}
          >
            <Star className="w-3 h-3 text-[#B68F4E] fill-current" />
            <span>Top Rated (4.8+)</span>
          </button>
        </div>

        {/* Sub-tabs: [Todos | Barberías | Barberos] */}
        <div className="flex rounded-2xl bg-black/60 p-1 border border-white/10 max-w-md">
          {(['todos', 'barberias', 'barberos'] as const).map((tab) => {
            const isActive = filters.subTab === tab;
            const labels = {
              todos: 'Todos',
              barberias: `Barberías (${filteredShops.length})`,
              barberos: `Barberos (${filteredBarbers.length})`,
            };

            return (
              <button
                key={tab}
                type="button"
                onClick={() => onChangeFilters({ ...filters, subTab: tab })}
                className={`relative flex-1 py-1.5 text-xs font-semibold rounded-xl transition-all cursor-pointer select-none text-center ${
                  isActive ? 'text-black font-bold' : 'text-[#D9C9B0]/70 hover:text-white'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="subTabHighlight"
                    className="absolute inset-0 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] shadow-sm"
                  />
                )}
                <span className="relative z-10">{labels[tab]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Lista Vertical de Resultados */}
      <div className="space-y-4 pt-1">
        {/* Render Barberías si subTab es 'todos' o 'barberias' */}
        {(filters.subTab === 'todos' || filters.subTab === 'barberias') &&
          filteredShops.map((shop) => (
            <motion.div
              key={shop.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => onSelectShop(shop)}
              className="relative p-4 rounded-3xl bg-gradient-to-b from-[#181818] via-[#121212] to-[#0A0A0A] border border-white/10 hover:border-[#B68F4E]/40 shadow-[0_12px_28px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12)] cursor-pointer group flex flex-col sm:flex-row gap-4"
            >
              {/* Foto destacada */}
              <div className="relative w-full sm:w-44 h-36 rounded-2xl overflow-hidden border border-white/10 flex-shrink-0">
                <img
                  src={shop.photos[0]}
                  alt={shop.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavoriteShop(shop.id);
                  }}
                  className="absolute top-2.5 right-2.5 p-2 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-white/70 hover:text-red-400 transition-colors"
                >
                  <Heart
                    className={`w-3.5 h-3.5 ${
                      shop.isFavorite ? 'fill-red-500 text-red-500' : ''
                    }`}
                  />
                </button>
                <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/15 text-xs text-white font-bold">
                  <Star className="w-3 h-3 text-[#B68F4E] fill-current" />
                  <span>{shop.rating}</span>
                </div>
              </div>

              {/* Contenido Barbería */}
              <div className="flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
                      Estudio Verificado
                    </span>
                    <CheckCircle2 className="w-3 h-3 text-[#B68F4E]" />
                  </div>
                  <h3 className="text-base font-bold text-white tracking-tight group-hover:text-[#F3E9DC] transition-colors mt-0.5">
                    {shop.name}
                  </h3>
                  <p className="text-xs text-white/50 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3 text-[#B68F4E]" />
                    <span>{shop.address}</span>
                  </p>
                  <p className="text-xs text-[#D9C9B0]/70 flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    <span>{shop.hours}</span>
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/10">
                  <span className="text-xs font-mono text-[#D9C9B0]">
                    {shop.zone} · A {Math.round(shop.distanceKm * 1000)} m
                  </span>
                  <span className="text-xs font-semibold text-[#B68F4E] group-hover:underline">
                    Ver barberos ({shop.barberIds.length}) →
                  </span>
                </div>
              </div>
            </motion.div>
          ))}

        {/* Render Barberos si subTab es 'todos' o 'barberos' */}
        {(filters.subTab === 'todos' || filters.subTab === 'barberos') &&
          filteredBarbers.map((barber) => {
            const statusConfig = {
              GREEN: {
                label: 'Disponible ahora',
                dotClass: 'bg-emerald-400 animate-pulse',
                textColor: 'text-emerald-400',
              },
              YELLOW: {
                label: `1 en espera (~20 min)`,
                dotClass: 'bg-amber-400',
                textColor: 'text-amber-400',
              },
              RED: {
                label: 'Ocupado en sillón',
                dotClass: 'bg-rose-500',
                textColor: 'text-rose-400',
              },
              GRAY: {
                label: 'No disponible',
                dotClass: 'bg-white/40',
                textColor: 'text-white/40',
              },
            }[barber.status];

            return (
              <motion.div
                key={barber.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => onSelectBarber(barber)}
                className="relative p-4 rounded-3xl bg-gradient-to-b from-[#181818] via-[#121212] to-[#0A0A0A] border border-white/10 hover:border-[#B68F4E]/40 shadow-[0_12px_28px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12)] cursor-pointer group flex flex-col sm:flex-row gap-4"
              >
                {/* Avatar con Halo de Presencia */}
                <div className="relative w-full sm:w-36 h-36 rounded-2xl overflow-hidden border border-white/15 flex-shrink-0">
                  <img
                    src={barber.avatar}
                    alt={barber.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavoriteBarber(barber.id);
                    }}
                    className="absolute top-2.5 right-2.5 p-2 rounded-full bg-black/70 backdrop-blur-md border border-white/15 text-white/70 hover:text-red-400 transition-colors"
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${
                        barber.isFavorite ? 'fill-red-500 text-red-500' : ''
                      }`}
                    />
                  </button>

                  {/* Rating badge */}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/15 text-xs text-white font-bold">
                    <Star className="w-3 h-3 text-[#B68F4E] fill-current" />
                    <span>{barber.rating}</span>
                  </div>
                </div>

                {/* Info Barbero */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <h3 className="text-base font-bold text-white tracking-tight group-hover:text-[#F3E9DC] transition-colors">
                          {barber.name}
                        </h3>
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#B68F4E]" />
                      </div>
                      <span className="text-xs font-mono font-bold text-[#B68F4E]">
                        {barber.priceRange}
                      </span>
                    </div>

                    <p className="text-xs text-[#D9C9B0] mt-0.5 font-medium">
                      {barber.shopName} · {barber.zone}
                    </p>

                    {/* Chips de Especialidades */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {barber.specialties.map((spec) => (
                        <span
                          key={spec}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-white/70"
                        >
                          {spec}
                        </span>
                      ))}
                    </div>

                    {/* Estado en vivo */}
                    <div className="flex items-center gap-2 mt-2.5">
                      <span className={`w-2 h-2 rounded-full ${statusConfig.dotClass}`} />
                      <span className={`text-xs font-semibold ${statusConfig.textColor}`}>
                        {statusConfig.label}
                      </span>
                    </div>
                  </div>

                  {/* Botones inferiores */}
                  <div className="flex items-center justify-between pt-3 mt-3 border-t border-white/10">
                    <span className="text-xs text-white/50">
                      {barber.totalCuts}+ cortes realizados
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickBook(barber);
                      }}
                      className="px-4 py-1.5 rounded-xl bg-gradient-to-b from-[#F3E9DC] to-[#D9C9B0] text-black text-xs font-extrabold uppercase tracking-wider shadow-sm hover:brightness-105 active:scale-95 transition-all cursor-pointer"
                    >
                      Reservar
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}

        {filteredBarbers.length === 0 && filteredShops.length === 0 && (
          <div className="text-center py-16 px-4 rounded-3xl bg-white/[0.02] border border-white/10">
            <Sparkles className="w-8 h-8 text-[#B68F4E] mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-white">No encontramos resultados</p>
            <p className="text-xs text-white/50 mt-1">
              Prueba cambiando los filtros o buscando en otra zona de La Paz.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
