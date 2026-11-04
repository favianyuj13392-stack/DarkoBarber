import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, RotateCcw, Star, Check } from 'lucide-react';
import type { FilterOptions } from '../../types/explore';

interface FilterDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterOptions;
  onChangeFilters: (filters: FilterOptions) => void;
  totalResultsCount: number;
}

const AVAILABLE_ZONES = ['Sopocachi', 'San Miguel', 'Miraflores', 'Centro', 'Calacoto', 'Achumani'];
const PRICE_RANGES = [
  { id: '<50', label: '< 50 Bs' },
  { id: '50-80', label: '50 - 80 Bs' },
  { id: '80-120', label: '80 - 120 Bs' },
  { id: '120+', label: '120+ Bs' },
];
const POPULAR_SERVICES = [
  'Fade / Degradado',
  'Perfilado de Barba',
  'Corte Clásico',
  'Lavado & Spa',
  'Combo Completo',
];

export const FilterDrawerModal: FC<FilterDrawerModalProps> = ({
  isOpen,
  onClose,
  filters,
  onChangeFilters,
  totalResultsCount,
}) => {
  if (!isOpen) return null;

  const handleReset = () => {
    onChangeFilters({
      searchQuery: '',
      onlyAvailableNow: false,
      onlyThisWeek: false,
      maxDistanceKm: 8,
      selectedZones: [],
      priceRanges: [],
      selectedServices: [],
      minRating: 0,
      subTab: filters.subTab,
    });
  };

  const toggleZone = (zone: string) => {
    const exists = filters.selectedZones.includes(zone);
    onChangeFilters({
      ...filters,
      selectedZones: exists
        ? filters.selectedZones.filter((z) => z !== zone)
        : [...filters.selectedZones, zone],
    });
  };

  const togglePriceRange = (rangeId: string) => {
    const exists = filters.priceRanges.includes(rangeId);
    onChangeFilters({
      ...filters,
      priceRanges: exists
        ? filters.priceRanges.filter((r) => r !== rangeId)
        : [...filters.priceRanges, rangeId],
    });
  };

  const toggleService = (srv: string) => {
    const exists = filters.selectedServices.includes(srv);
    onChangeFilters({
      ...filters,
      selectedServices: exists
        ? filters.selectedServices.filter((s) => s !== s)
        : [...filters.selectedServices, srv],
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Drawer Sheet */}
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="relative w-full max-w-lg max-h-[90vh] bg-gradient-to-b from-[#181818] via-[#121212] to-[#0A0A0A] border-t sm:border border-white/15 rounded-t-3xl sm:rounded-3xl shadow-[0_-15px_40px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.18)] flex flex-col z-10 overflow-hidden"
        >
          {/* Grab Bar (Mobile) */}
          <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold tracking-tight text-white">Filtros</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-[#D9C9B0] font-mono">
                {totalResultsCount} encontrados
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-[#D9C9B0]/70 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body Content - Scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 text-sm text-[#F5EBDD]/90">
            {/* 1. Disponibilidad */}
            <div className="space-y-2.5">
              <span className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
                Disponibilidad
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onChangeFilters({
                      ...filters,
                      onlyAvailableNow: !filters.onlyAvailableNow,
                    })
                  }
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide border transition-all cursor-pointer ${
                    filters.onlyAvailableNow
                      ? 'bg-[#B68F4E] text-black border-[#B68F4E] shadow-[0_0_14px_rgba(182,143,78,0.4)]'
                      : 'bg-white/5 text-[#D9C9B0]/80 border-white/10 hover:border-white/20'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      filters.onlyAvailableNow ? 'bg-black' : 'bg-emerald-400 animate-pulse'
                    }`}
                  />
                  <span>Disponibles ahora</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onChangeFilters({
                      ...filters,
                      onlyThisWeek: !filters.onlyThisWeek,
                    })
                  }
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold tracking-wide border transition-all cursor-pointer ${
                    filters.onlyThisWeek
                      ? 'bg-[#B68F4E] text-black border-[#B68F4E] shadow-[0_0_14px_rgba(182,143,78,0.4)]'
                      : 'bg-white/5 text-[#D9C9B0]/80 border-white/10 hover:border-white/20'
                  }`}
                >
                  <span>Esta semana</span>
                </button>
              </div>
            </div>

            {/* 2. Ubicación & Distancia */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
                  Distancia máxima
                </span>
                <span className="text-xs font-bold text-white font-mono bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
                  {filters.maxDistanceKm} km
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="15"
                step="1"
                value={filters.maxDistanceKm}
                onChange={(e) =>
                  onChangeFilters({
                    ...filters,
                    maxDistanceKm: Number(e.target.value),
                  })
                }
                className="w-full accent-[#B68F4E] bg-white/10 h-1.5 rounded-lg cursor-pointer"
              />

              <div className="pt-2">
                <span className="text-xs text-white/50 block mb-2">Zonas de La Paz:</span>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_ZONES.map((zone) => {
                    const isSelected = filters.selectedZones.includes(zone);
                    return (
                      <button
                        key={zone}
                        type="button"
                        onClick={() => toggleZone(zone)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#F3E9DC] text-black border-[#F3E9DC] font-bold'
                            : 'bg-white/5 text-[#D9C9B0]/70 border-white/10 hover:border-white/25'
                        }`}
                      >
                        {zone}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 3. Rango de Precio */}
            <div className="space-y-2.5">
              <span className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
                Rango de Precio
              </span>
              <div className="grid grid-cols-2 gap-2">
                {PRICE_RANGES.map((pr) => {
                  const isSelected = filters.priceRanges.includes(pr.id);
                  return (
                    <button
                      key={pr.id}
                      type="button"
                      onClick={() => togglePriceRange(pr.id)}
                      className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#B68F4E]/20 border-[#B68F4E] text-[#F5EBDD] font-bold'
                          : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 text-[#B68F4E]" />}
                      <span>{pr.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Servicios */}
            <div className="space-y-2.5">
              <span className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
                Servicios requeridos
              </span>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SERVICES.map((srv) => {
                  const isSelected = filters.selectedServices.includes(srv);
                  return (
                    <button
                      key={srv}
                      type="button"
                      onClick={() => toggleService(srv)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#F3E9DC] text-black border-[#F3E9DC] font-bold'
                          : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'
                      }`}
                    >
                      {srv}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. Calificación Mínima */}
            <div className="space-y-2.5">
              <span className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
                Calificación mínima
              </span>
              <div className="flex gap-2">
                {[
                  { value: 0, label: 'Todas' },
                  { value: 4.5, label: '4.5+' },
                  { value: 4.8, label: '4.8+' },
                ].map((item) => {
                  const isSelected = filters.minRating === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => onChangeFilters({ ...filters, minRating: item.value })}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#B68F4E] text-black border-[#B68F4E] font-bold shadow-[0_0_12px_rgba(182,143,78,0.3)]'
                          : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'
                      }`}
                    >
                      {item.value > 0 && <Star className="w-3.5 h-3.5 fill-current" />}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Sticky Bottom CTA */}
          <div className="p-4 bg-black/80 border-t border-white/10 backdrop-blur-xl">
            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-extrabold text-xs uppercase tracking-wider shadow-[0_8px_24px_rgba(217,201,176,0.35),inset_0_1px_0_rgba(255,255,255,0.8)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer"
            >
              Aplicar filtros ({totalResultsCount} resultados)
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
