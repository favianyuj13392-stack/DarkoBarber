import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Users, Sparkles } from 'lucide-react';
import { SPRING_TOUCH } from '../../constants/springs';
import type { BarberPresenceStatus } from '../../services/presence.service';
import { presenceService } from '../../services/presence.service';

interface BarberPresenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  barberName?: string;
  shopName?: string;
}

export const BarberPresenceModal: FC<BarberPresenceModalProps> = ({
  isOpen,
  onClose,
  barberName = 'Brian López',
  shopName = 'Fade Studio — Sopocachi',
}) => {
  const [currentStatus, setCurrentStatus] = useState<BarberPresenceStatus>(
    presenceService.getStatus()
  );
  const [waitingCount, setWaitingCount] = useState<number>(
    presenceService.getWaitingCount()
  );
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    return presenceService.subscribe((status, count) => {
      setCurrentStatus(status);
      setWaitingCount(count);
    });
  }, []);

  const handleApplyChanges = (newStatus: BarberPresenceStatus, newCount: number) => {
    setCurrentStatus(newStatus);
    setWaitingCount(newCount);
    presenceService.setPresence(newStatus, newCount);

    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={SPRING_TOUCH}
          className="relative w-full max-w-md rounded-3xl bg-[#0D0D0D] border border-white/15 p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(182,143,78,0.15)] space-y-6 text-left overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase tracking-widest font-mono text-[#B68F4E] font-bold">
                Semáforo & Cola en Vivo
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight font-serif mt-0.5">
                Estado de tu Sillón
              </h2>
              <p className="text-xs text-[#D9C9B0]/60 mt-0.5">
                {barberName} · {shopName}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* 1. SELECCIÓN DE ESTADO DEL SILLÓN (Semáforo) */}
          <div className="space-y-2.5">
            <span className="text-xs font-semibold text-white/80 block">
              1. ¿En qué estado está tu puesto?
            </span>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Disponible (GREEN) */}
              <button
                type="button"
                onClick={() => handleApplyChanges('GREEN', 0)}
                className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  currentStatus === 'GREEN'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                    : 'bg-white/[0.03] border-white/10 text-white/60 hover:border-white/20 hover:text-white'
                }`}
              >
                <div className="relative">
                  <div className="w-4 h-4 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  {currentStatus === 'GREEN' && (
                    <Check className="w-3 h-3 text-black absolute inset-0 m-auto stroke-[3]" />
                  )}
                </div>
                <span className="text-xs font-bold leading-tight">Disponible</span>
                <span className="text-[9px] text-white/50">Sillón Libre</span>
              </button>

              {/* En Pausa (YELLOW) */}
              <button
                type="button"
                onClick={() => handleApplyChanges('YELLOW', waitingCount)}
                className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  currentStatus === 'YELLOW'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                    : 'bg-white/[0.03] border-white/10 text-white/60 hover:border-white/20 hover:text-white'
                }`}
              >
                <div className="relative">
                  <div className="w-4 h-4 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                  {currentStatus === 'YELLOW' && (
                    <Check className="w-3 h-3 text-black absolute inset-0 m-auto stroke-[3]" />
                  )}
                </div>
                <span className="text-xs font-bold leading-tight">En Pausa</span>
                <span className="text-[9px] text-white/50">Descanso</span>
              </button>

              {/* Ocupado (RED) */}
              <button
                type="button"
                onClick={() => handleApplyChanges('RED', waitingCount)}
                className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  currentStatus === 'RED'
                    ? 'bg-red-500/20 border-red-400 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                    : 'bg-white/[0.03] border-white/10 text-white/60 hover:border-white/20 hover:text-white'
                }`}
              >
                <div className="relative">
                  <div className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
                  {currentStatus === 'RED' && (
                    <Check className="w-3 h-3 text-black absolute inset-0 m-auto stroke-[3]" />
                  )}
                </div>
                <span className="text-xs font-bold leading-tight">Ocupado</span>
                <span className="text-[9px] text-white/50">Cortando</span>
              </button>
            </div>
          </div>

          {/* 2. SELECTOR DE FILA DE ESPERA (Lista en Barbería) */}
          <div className="space-y-2.5 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white/80 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#B68F4E]" />
                <span>2. Clientes esperando en el local:</span>
              </span>
              <span className="text-[10px] font-mono text-[#B68F4E]">
                {waitingCount === 0
                  ? 'Sin cola'
                  : waitingCount === 1
                  ? '1 a 2 personas'
                  : '3+ personas'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                { count: 0, label: '0 en espera', sub: 'Atención inmediata' },
                { count: 1, label: '1 a 2 personas', sub: 'Demora ~25 min' },
                { count: 2, label: '3+ personas', sub: 'Demora ~50 min' },
              ].map((item) => {
                const isSelected = waitingCount === item.count;
                return (
                  <button
                    key={item.count}
                    type="button"
                    onClick={() => {
                      const newStatus =
                        currentStatus === 'GREEN' && item.count > 0 ? 'YELLOW' : currentStatus;
                      handleApplyChanges(newStatus, item.count);
                    }}
                    className={`py-3 px-2 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                      isSelected
                        ? 'bg-[#B68F4E]/25 border-[#B68F4E] text-white shadow-md'
                        : 'bg-white/[0.03] border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    <span className="text-xs font-bold">{item.label}</span>
                    <span className="text-[9px] text-white/50">{item.sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Vista previa explicativa para el barbero */}
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-3 text-xs text-[#D9C9B0]/80">
            <Sparkles className="w-4 h-4 text-[#B68F4E] shrink-0" />
            <p className="leading-snug">
              Los clientes en el mapa verán tu pin en{' '}
              <strong className="text-white">
                {currentStatus === 'GREEN'
                  ? 'VERDE (Disponible ahora)'
                  : currentStatus === 'YELLOW'
                  ? 'AMARILLO (En espera / Pausa)'
                  : 'ROJO (Ocupado cortando)'}
              </strong>
              {waitingCount > 0 ? ` con ${waitingCount === 1 ? '1-2' : '3+'} personas en cola.` : '.'}
            </p>
          </div>

          {savedToast && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-xs font-bold text-emerald-400 flex items-center justify-center gap-1.5 py-1"
            >
              <Check className="w-4 h-4" />
              <span>¡Semáforo actualizado en vivo!</span>
            </motion.div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
