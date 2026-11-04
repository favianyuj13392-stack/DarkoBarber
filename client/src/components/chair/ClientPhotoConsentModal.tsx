import { useEffect } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, Lock, Sparkles } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { SPRING_TOUCH, SPRING_MODAL } from '../../constants/springs';
import type { PhotoConsentRequestPayload } from '../../services/chair.service';

interface ClientPhotoConsentModalProps {
  request: PhotoConsentRequestPayload | null;
  onConsent: (isPublic: boolean) => void;
}

export const ClientPhotoConsentModal: FC<ClientPhotoConsentModalProps> = ({
  request,
  onConsent,
}) => {
  useEffect(() => {
    if (request && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 150]);
    }
  }, [request]);

  if (!request) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl select-none overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 20 }}
          transition={SPRING_MODAL}
          className="relative z-10 w-full max-w-sm rounded-3xl bg-[#0E0D0B] border-2 border-[#B68F4E]/60 shadow-[0_25px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(182,143,78,0.25)] p-6 space-y-5 text-center overflow-hidden"
        >
          {/* Header Brand */}
          <div className="flex justify-between items-center">
            <BrandLogo variant="full" size="sm" />
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#B68F4E]/20 text-[#B68F4E] text-[10px] font-mono tracking-wider uppercase">
              <Sparkles className="w-3 h-3" />
              <span>Corte finalizado</span>
            </span>
          </div>

          {/* Foto de Evidencia Subida por el Barbero */}
          <div className="relative aspect-4/3 rounded-2xl overflow-hidden border-2 border-[#B68F4E]/40 shadow-xl bg-black">
            <img
              src={request.photoUrl || '/assets/images/1.png'}
              alt="Nuevo corte realizado"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-3">
              <div className="text-left space-y-0.5">
                <span className="text-[10px] font-mono text-[#B68F4E] uppercase tracking-wider">
                  Estilo realizado
                </span>
                <p className="text-sm font-bold text-white tracking-tight">
                  {request.styleName || 'Fade Clásico · Texturizado'}
                </p>
              </div>
            </div>
          </div>

          {/* Pregunta y Descripción */}
          <div className="space-y-1.5 px-1">
            <h2 className="text-lg font-bold text-white tracking-tight font-serif">
              ¿Autorizas a {request.barberName} a publicar tu corte?
            </h2>
            <p className="text-xs text-[#D9C9B0]/80 font-light leading-relaxed">
              Tu barbero desea incluir esta fotografía en su portafolio público de FADE. Siempre puedes optar por mantenerla 100% privada en tu historial.
            </p>
          </div>

          {/* Botones de Decisión */}
          <div className="space-y-2.5 pt-1">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              onClick={() => onConsent(true)}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-xs tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(217,201,176,0.35)] cursor-pointer flex items-center justify-center gap-2 hover:brightness-105 transition-all"
            >
              <Globe className="w-4 h-4 text-black" />
              <span>Autorizar en portafolio público</span>
            </motion.button>

            <button
              type="button"
              onClick={() => onConsent(false)}
              className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#D9C9B0] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              <Lock className="w-3.5 h-3.5 text-[#B68F4E]" />
              <span>Solo en mi historial privado</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ClientPhotoConsentModal;
