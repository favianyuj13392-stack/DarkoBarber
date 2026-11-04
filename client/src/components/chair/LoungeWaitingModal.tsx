import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, User, Users } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { SPRING_TOUCH, SPRING_MODAL } from '../../constants/springs';
import { presenceService } from '../../services/presence.service';

interface LoungeWaitingModalProps {
  isOpen: boolean;
  onComplete: (waitingCount: number) => void;
}

export const LoungeWaitingModal: FC<LoungeWaitingModalProps> = ({
  isOpen,
  onComplete,
}) => {
  const [selectedCount, setSelectedCount] = useState<number>(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(5);

  useEffect(() => {
    if (!isOpen) return;

    setSelectedCount(0);
    setSecondsRemaining(5);

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleSelect(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  const handleSelect = (count: number) => {
    setSelectedCount(count);
    // Enviar evento de presencia en tiempo real
    presenceService.updateWaitingCount(count);
    setTimeout(() => {
      onComplete(count);
    }, 400);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl select-none overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={SPRING_MODAL}
          className="relative z-10 w-full max-w-sm flex flex-col justify-between py-6 space-y-6 text-left"
        >
          {/* Header Brand */}
          <div className="flex justify-start">
            <BrandLogo variant="full" size="md" />
          </div>

          {/* Banner: Corte Finalizado */}
          <div className="flex items-start gap-3.5 pt-2">
            <div className="w-8 h-8 rounded-full bg-[#D9C9B0] text-black flex items-center justify-center shrink-0 shadow-md">
              <Check className="w-5 h-5 stroke-[3]" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#D9C9B0]">
                Corte finalizado
              </h3>
              <p className="text-xs text-white/80 leading-relaxed font-light">
                ¡Gran trabajo! El corte ha sido guardado en el historial del cliente.
              </p>
            </div>
          </div>

          <div className="border-t border-white/10" />

          {/* Question Title */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-serif leading-snug">
              ¿Cuánta gente espera en sala?
            </h1>
            <p className="text-xs text-[#D9C9B0]/70 font-light">
              Ayúdanos a mantener una buena experiencia en el estudio.
            </p>
          </div>

          {/* Options */}
          <div className="space-y-3">
            {/* Opción 1: 0 - Nadie */}
            <motion.div
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              onClick={() => handleSelect(0)}
              className={`p-4 rounded-3xl border flex items-center justify-between cursor-pointer transition-all ${
                selectedCount === 0
                  ? 'bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black border-transparent shadow-[0_4px_20px_rgba(217,201,176,0.3)] font-bold'
                  : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-6 flex justify-center">
                  <User className={`w-5 h-5 ${selectedCount === 0 ? 'text-black' : 'text-[#D9C9B0]'}`} />
                </div>
                <span className="h-5 w-[1px] bg-white/20" />
                <span className="text-base font-medium">0 - Nadie</span>
              </div>
              {selectedCount === 0 && (
                <div className="w-6 h-6 rounded-full bg-black text-[#D9C9B0] flex items-center justify-center">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
              )}
            </motion.div>

            {/* Opción 2: 1 a 2 personas */}
            <motion.div
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              onClick={() => handleSelect(1)}
              className={`p-4 rounded-3xl border flex items-center justify-between cursor-pointer transition-all ${
                selectedCount === 1
                  ? 'bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black border-transparent shadow-[0_4px_20px_rgba(217,201,176,0.3)] font-bold'
                  : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-6 flex justify-center">
                  <Users className={`w-5 h-5 ${selectedCount === 1 ? 'text-black' : 'text-[#D9C9B0]'}`} />
                </div>
                <span className="h-5 w-[1px] bg-white/20" />
                <span className="text-base font-medium">1 a 2 personas</span>
              </div>
              {selectedCount === 1 && (
                <div className="w-6 h-6 rounded-full bg-black text-[#D9C9B0] flex items-center justify-center">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
              )}
            </motion.div>

            {/* Opción 3: 3 o más */}
            <motion.div
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              onClick={() => handleSelect(2)}
              className={`p-4 rounded-3xl border flex items-center justify-between cursor-pointer transition-all ${
                selectedCount === 2
                  ? 'bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black border-transparent shadow-[0_4px_20px_rgba(217,201,176,0.3)] font-bold'
                  : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="w-6 flex justify-center">
                  <Users className={`w-5 h-5 ${selectedCount === 2 ? 'text-black' : 'text-[#D9C9B0]'}`} />
                </div>
                <span className="h-5 w-[1px] bg-white/20" />
                <span className="text-base font-medium">3 o más</span>
              </div>
              {selectedCount === 2 && (
                <div className="w-6 h-6 rounded-full bg-black text-[#D9C9B0] flex items-center justify-center">
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
              )}
            </motion.div>
          </div>

          {/* Countdown timer footer */}
          <div className="pt-2 text-center">
            <p className="text-xs text-[#D9C9B0]/60 font-mono">
              Si no tocas en <span className="text-[#B68F4E] font-bold">{secondsRemaining}s</span> se asume 0
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default LoungeWaitingModal;
