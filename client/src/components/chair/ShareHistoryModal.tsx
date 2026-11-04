import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Share2, Check } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { SPRING_TOUCH, SPRING_MODAL } from '../../constants/springs';
import type { ScannedBarberInfo } from './QrScannerModal';

interface ShareHistoryModalProps {
  isOpen: boolean;
  barber: ScannedBarberInfo | null;
  onClose: () => void;
  onConfirmShare: () => void;
}

export const ShareHistoryModal: FC<ShareHistoryModalProps> = ({
  isOpen,
  barber,
  onClose,
  onConfirmShare,
}) => {
  if (!isOpen || !barber) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl select-none overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={SPRING_MODAL}
          className="relative z-10 w-full max-w-sm flex flex-col justify-between py-6 space-y-6 text-center"
        >
          {/* Header Brand */}
          <div className="flex justify-start">
            <BrandLogo variant="full" size="md" />
          </div>

          {/* Barber Avatar & Details */}
          <div className="flex flex-col items-center space-y-3 pt-4">
            <div className="relative w-24 h-24 rounded-full p-1 border-2 border-[#B68F4E]/60 shadow-[0_0_25px_rgba(182,143,78,0.3)]">
              <img
                src={barber.avatarUrl}
                alt={barber.barberName}
                className="w-full h-full object-cover rounded-full"
              />
              <div className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#D9C9B0] text-black shadow-md">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </div>

            <div className="space-y-0.5">
              <h2 className="text-xl font-bold text-white tracking-tight">
                {barber.barberName}
              </h2>
              <p className="text-xs text-[#D9C9B0]/70 font-mono">
                Barbero · {barber.shopName}
              </p>
            </div>
          </div>

          {/* Question Title */}
          <div className="space-y-4 px-2">
            <h1 className="text-2xl font-bold text-white tracking-tight font-serif leading-snug">
              ¿Quieres compartir tu historial de cortes con el barbero {barber.barberName}?
            </h1>

            {/* Privacy Shield Box */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-left">
              <ShieldCheck className="w-5 h-5 text-[#B68F4E] shrink-0 mt-0.5" />
              <p className="text-xs text-[#D9C9B0]/80 leading-relaxed font-light">
                Esto le permitirá ver tus últimos cortes, preferencias y estilo para darte una mejor experiencia.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              onClick={onConfirmShare}
              className="w-full py-4 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-sm tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_20px_rgba(217,201,176,0.35)] cursor-pointer flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4 text-black" />
              <span>Compartir historial</span>
            </motion.button>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold transition-colors cursor-pointer"
            >
              Ahora no
            </button>
          </div>

          {/* Footer note */}
          <p className="text-[11px] text-[#D9C9B0]/50 font-light">
            Puedes cambiar esta opción en cualquier momento desde tu perfil.
          </p>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ShareHistoryModal;
