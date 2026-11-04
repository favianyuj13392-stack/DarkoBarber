import { useState } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, User, Store, Check } from 'lucide-react';
import { MOCK_BARBER_FILTERS } from '../../data/mockHistory';
import { SPRING_TOUCH, SPRING_MODAL } from '../../constants/springs';

interface HistorialFilterModalProps {
  isOpen: boolean;
  selectedBarberId: string;
  onSelectBarber: (barberId: string) => void;
  onClose: () => void;
}

export const HistorialFilterModal: FC<HistorialFilterModalProps> = ({
  isOpen,
  selectedBarberId,
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
          <div className="relative flex items-center p-1 rounded-2xl bg-black/60 border border-white/10">
            <button
              type="button"
              onClick={() => setFilterType('barbero')}
              className={`relative z-10 flex-1 py-2.5 text-xs font-semibold tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                filterType === 'barbero' ? 'text-black font-bold' : 'text-[#D9C9B0]/70'
              }`}
            >
              {filterType === 'barbero' && (
                <motion.div
                  layoutId="filterTypePill"
                  transition={SPRING_TOUCH}
                  className="absolute inset-0 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91]"
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>Barbero</span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterType('barberia')}
              className={`relative z-10 flex-1 py-2.5 text-xs font-semibold tracking-wider rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                filterType === 'barberia' ? 'text-black font-bold' : 'text-[#D9C9B0]/70'
              }`}
            >
              {filterType === 'barberia' && (
                <motion.div
                  layoutId="filterTypePill"
                  transition={SPRING_TOUCH}
                  className="absolute inset-0 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91]"
                />
              )}
              <span className="relative z-10 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" />
                <span>Barbería</span>
              </span>
            </button>
          </div>

          {/* Lista de Barberos */}
          <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
            {MOCK_BARBER_FILTERS.map((item) => {
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
