import { useState } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, User, Users, CheckCircle2 } from 'lucide-react';
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

  if (!isOpen) return null;

  const handleConfirm = () => {
    presenceService.updateWaitingCount(selectedCount);
    onComplete(selectedCount);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl select-none overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={SPRING_MODAL}
          className="relative z-10 w-full max-w-sm rounded-3xl bg-[#0E0D0B] border border-[#B68F4E]/30 p-6 space-y-6 text-left shadow-2xl"
        >
          {/* Header Brand */}
          <div className="flex justify-start">
            <BrandLogo variant="full" size="md" />
          </div>

          {/* Banner: Corte Finalizado */}
          <div className="flex items-start gap-3.5 pt-1">
            <div className="w-8 h-8 rounded-full bg-[#D9C9B0] text-black flex items-center justify-center shrink-0 shadow-md">
              <Check className="w-5 h-5 stroke-[3]" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#D9C9B0]">
                Corte registrado con éxito
              </h3>
              <p className="text-xs text-white/80 leading-relaxed font-light">
                Las fotos y fórmula técnica han quedado guardadas.
              </p>
            </div>
          </div>

          <div className="border-t border-white/10" />

          {/* Question Title */}
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-white font-serif leading-snug">
              ¿Cuánta gente espera en sala?
            </h1>
            <p className="text-xs text-[#D9C9B0]/70 font-light">
              Selecciona el estado real del salón para actualizar el mapa en vivo de clientes.
            </p>
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {/* Opción 1: 0 - Nadie */}
            <motion.div
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              onClick={() => setSelectedCount(0)}
              className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                selectedCount === 0
                  ? 'bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black border-transparent shadow-md font-bold'
                  : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-6 flex justify-center">
                  <User className={`w-5 h-5 ${selectedCount === 0 ? 'text-black' : 'text-[#D9C9B0]'}`} />
                </div>
                <span className="h-4 w-[1px] bg-white/20" />
                <span className="text-sm font-medium">0 - Nadie esperando</span>
              </div>
              {selectedCount === 0 && (
                <div className="w-5 h-5 rounded-full bg-black text-[#D9C9B0] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </motion.div>

            {/* Opción 2: 1 a 2 personas */}
            <motion.div
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              onClick={() => setSelectedCount(1)}
              className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                selectedCount === 1
                  ? 'bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black border-transparent shadow-md font-bold'
                  : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-6 flex justify-center">
                  <Users className={`w-5 h-5 ${selectedCount === 1 ? 'text-black' : 'text-[#D9C9B0]'}`} />
                </div>
                <span className="h-4 w-[1px] bg-white/20" />
                <span className="text-sm font-medium">1 a 2 personas</span>
              </div>
              {selectedCount === 1 && (
                <div className="w-5 h-5 rounded-full bg-black text-[#D9C9B0] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </motion.div>

            {/* Opción 3: 3 o más */}
            <motion.div
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              onClick={() => setSelectedCount(2)}
              className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                selectedCount === 2
                  ? 'bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black border-transparent shadow-md font-bold'
                  : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-6 flex justify-center">
                  <Users className={`w-5 h-5 ${selectedCount === 2 ? 'text-black' : 'text-[#D9C9B0]'}`} />
                </div>
                <span className="h-4 w-[1px] bg-white/20" />
                <span className="text-sm font-medium">3 o más personas</span>
              </div>
              {selectedCount === 2 && (
                <div className="w-5 h-5 rounded-full bg-black text-[#D9C9B0] flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </motion.div>
          </div>

          {/* Botón de Confirmación Explícito Obligatorio */}
          <div className="pt-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              onClick={handleConfirm}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-xs tracking-wide shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-black" />
              <span>Confirmar y liberar sillón</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default LoungeWaitingModal;
