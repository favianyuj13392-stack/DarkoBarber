import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Sparkles, Shield } from 'lucide-react';
import { SPRING_TOUCH, SPRING_MODAL } from '../../constants/springs';

interface PhotoConsentModalProps {
  isOpen: boolean;
  photoUrl?: string;
  onConsent: (isPublic: boolean) => void;
  onClose?: () => void;
}

export const PhotoConsentModal: FC<PhotoConsentModalProps> = ({
  isOpen,
  photoUrl = '/assets/images/1.png',
  onConsent,
}) => {
  if (!isOpen) return null;

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
          {/* Photo Preview Container */}
          <div className="relative w-64 h-64 mx-auto rounded-3xl overflow-hidden border border-white/15 shadow-[0_10px_30px_rgba(0,0,0,0.8)] group">
            <img
              src={photoUrl}
              alt="Foto del corte"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-black/60 border border-white/20 flex items-center justify-center shadow-xl">
                <Lock className="w-6 h-6 text-[#D9C9B0]" />
              </div>
            </div>
          </div>

          {/* Copy and Explanations */}
          <div className="space-y-3 px-2">
            <h1 className="text-2xl font-bold text-white tracking-tight font-serif leading-snug">
              ¿Publicar en el portafolio del barbero?
            </h1>
            <p className="text-xs text-[#D9C9B0]/80 leading-relaxed font-light max-w-xs mx-auto">
              Esta foto se guardará en tu historial privado. Si autorizas, también aparecerá en el portafolio público del barbero.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              onClick={() => onConsent(true)}
              className="w-full py-4 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-sm tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_20px_rgba(217,201,176,0.35)] cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-black" />
              <span>Sí, publicar</span>
            </motion.button>

            <button
              type="button"
              onClick={() => onConsent(false)}
              className="w-full py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Shield className="w-4 h-4 text-[#D9C9B0]/60" />
              <span>Mantener privada</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PhotoConsentModal;
