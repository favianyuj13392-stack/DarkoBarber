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
  initialStatus?: BarberPresenceStatus;
}

export const BarberPresenceModal: FC<BarberPresenceModalProps> = ({
  isOpen,
  onClose,
  barberName = 'Brian López',
  shopName = 'Fade Studio — Sopocachi',
  initialStatus,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<BarberPresenceStatus>(
    initialStatus || presenceService.getStatus()
  );
  const [selectedWaiting, setSelectedWaiting] = useState<number>(
    presenceService.getWaitingCount()
  );
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => {
    if (initialStatus) {
      setSelectedStatus(initialStatus);
    } else {
      setSelectedStatus(presenceService.getStatus());
    }
    setSelectedWaiting(presenceService.getWaitingCount());
  }, [isOpen, initialStatus]);

  const handleConfirm = () => {
    presenceService.setPresence(selectedStatus, selectedWaiting);

    setSavedToast(true);
    setTimeout(() => {
      setSavedToast(false);
      onClose();
    }, 400);
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
          className="absolute inset-0 bg-black/85 backdrop-blur-md"
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
              <span className="text-[10px] uppercase tracking-widest font-mono text-[#B68F4E] font-bold flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-[#B68F4E]" />
                <span>Semáforo & Fila en Vivo</span>
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

          {/* 1. SELECCIÓN DE ESTADO (Semáforo) */}
          <div className="space-y-2.5">
            <span className="text-xs font-semibold text-white/80 block">
              1. Selecciona el estado de tu puesto:
            </span>

            <div className="grid grid-cols-3 gap-2.5">
              {/* Disponible (GREEN) */}
              <button
                type="button"
                onClick={() => {
                  setSelectedStatus('GREEN');
                  if (selectedWaiting > 0) setSelectedWaiting(0);
                }}
                className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  selectedStatus === 'GREEN'
                    ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-[0_0_15px_rgba(52,211,153,0.3)]'
                    : 'bg-white/[0.03] border-white/10 text-white/60 hover:border-white/20 hover:text-white'
                }`}
              >
                <div className="relative">
                  <div className="w-4 h-4 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  {selectedStatus === 'GREEN' && (
                    <Check className="w-3 h-3 text-black absolute inset-0 m-auto stroke-[3]" />
                  )}
                </div>
                <span className="text-xs font-bold leading-tight">Disponible</span>
                <span className="text-[9px] text-white/50">Sillón Libre</span>
              </button>

              {/* En Pausa (YELLOW) */}
              <button
                type="button"
                onClick={() => setSelectedStatus('YELLOW')}
                className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  selectedStatus === 'YELLOW'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.3)]'
                    : 'bg-white/[0.03] border-white/10 text-white/60 hover:border-white/20 hover:text-white'
                }`}
              >
                <div className="relative">
                  <div className="w-4 h-4 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                  {selectedStatus === 'YELLOW' && (
                    <Check className="w-3 h-3 text-black absolute inset-0 m-auto stroke-[3]" />
                  )}
                </div>
                <span className="text-xs font-bold leading-tight">En Pausa</span>
                <span className="text-[9px] text-white/50">Descanso</span>
              </button>

              {/* Ocupado (RED) */}
              <button
                type="button"
                onClick={() => setSelectedStatus('RED')}
                className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                  selectedStatus === 'RED'
                    ? 'bg-red-500/20 border-red-400 text-red-200 shadow-[0_0_15px_rgba(239,68,68,0.3)]'
                    : 'bg-white/[0.03] border-white/10 text-white/60 hover:border-white/20 hover:text-white'
                }`}
              >
                <div className="relative">
                  <div className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
                  {selectedStatus === 'RED' && (
                    <Check className="w-3 h-3 text-black absolute inset-0 m-auto stroke-[3]" />
                  )}
                </div>
                <span className="text-xs font-bold leading-tight">Ocupado</span>
                <span className="text-[9px] text-white/50">Cortando</span>
              </button>
            </div>
          </div>

          {/* 2. SELECTOR DE PERSONAS EN SALA DE ESPERA (Pop-Up) */}
          <div className="space-y-2.5 pt-2 border-t border-white/10">
            <div className="fade-surface rounded-2xl p-4 border border-white/10 flex items-center justify-between text-left">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-[#B68F4E]">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Clientes en sala de espera</p>
                  <p className="text-[11px] text-[#D9C9B0]/60">Afecta el tiempo estimado en el mapa</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedWaiting((prev) => Math.max(0, prev - 1))}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono text-sm flex items-center justify-center cursor-pointer transition-colors"
                >
                  -
                </button>
                <span className="w-7 text-center text-sm font-mono font-bold text-[#B68F4E]">
                  {selectedWaiting}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedWaiting((prev) => prev + 1)}
                  className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-mono text-sm flex items-center justify-center cursor-pointer transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          {/* Botón de Confirmación */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleConfirm}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-xs tracking-wider shadow-lg hover:brightness-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>Confirmar Estado del Sillón</span>
            </button>
          </div>

          {/* Feedback Toast */}
          <AnimatePresence>
            {savedToast && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute inset-x-6 bottom-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs font-bold text-center backdrop-blur-md shadow-xl"
              >
                ✓ Estado y fila sincronizados en vivo
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BarberPresenceModal;
