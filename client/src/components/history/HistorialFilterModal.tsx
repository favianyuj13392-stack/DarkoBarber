import { useState } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, User, Store, Check } from 'lucide-react';
import { SPRING_MODAL } from '../../constants/springs';
import { SegmentedControl } from '../common/SegmentedControl';

export interface BarberFilterOption {
  id: string;
  name: string;
  shop: string;
  count: number;
}

interface HistorialFilterModalProps {
  isOpen: boolean;
  selectedBarberId: string;
  barbers?: BarberFilterOption[];
  onSelectBarber: (barberId: string) => void;
  onClose: () => void;
}

export const HistorialFilterModal: FC<HistorialFilterModalProps> = ({
  isOpen,
  selectedBarberId,
  barbers = [{ id: 'all', name: 'Todos los profesionales', shop: 'Todas las sedes', count: 0 }],
  onSelectBarber,
  onClose,
}) => {
  const [filterType, setFilterType] = useState<'barbero' | 'barberia'>('barbero');

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={SPRING_MODAL}
          className="fade-surface-elevated relative z-10 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 space-y-6 text-left select-none border border-white/10"
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-[#D9C9B0] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h3 className="text-lg font-bold text-white tracking-tight">
              Filtrar historial
            </h3>
          </div>

          {/* Selector Barbero / Barbería */}
          <SegmentedControl<'barbero' | 'barberia'>
            ariaLabel="Tipo de filtro"
            value={filterType}
            onChange={setFilterType}
            options={[
              {
                value: 'barbero',
                label: (
                  <span className="flex items-center justify-center gap-1.5">
                    <User className="w-3.5 h-3.5" />
                    <span>Barbero</span>
                  </span>
                ),
              },
              {
                value: 'barberia',
                label: (
                  <span className="flex items-center justify-center gap-1.5">
                    <Store className="w-3.5 h-3.5" />
                    <span>Barbería</span>
                  </span>
                ),
              },
            ]}
          />

          {/* Lista de Barberos */}
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {barbers.map((item) => {
              const isSelected = selectedBarberId === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectBarber(item.id);
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#B68F4E]/15 border-[#B68F4E]/60 text-white'
                      : 'bg-black/40 border-white/5 hover:border-white/20 text-[#D9C9B0]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#2A2A2A] to-[#121212] border border-white/10 flex items-center justify-center text-[#B68F4E] font-bold text-sm shrink-0">
                      {item.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-semibold text-white block">
                        {item.name}
                      </span>
                      <span className="text-[11px] text-[#D9C9B0]/60">
                        {item.shop}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-[#B68F4E]">
                      {item.count} cortes
                    </span>
                    {isSelected ? (
                      <Check className="w-4 h-4 text-[#B68F4E]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-white/30" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
