import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Calendar, Sparkles, ChevronRight, Search } from 'lucide-react';
import { SPRING_TOUCH, SPRING_MODAL } from '../../constants/springs';

interface CutReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExploreBarbers: () => void;
}

export const CutReminderModal: FC<CutReminderModalProps> = ({
  isOpen,
  onClose,
  onExploreBarbers,
}) => {
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
          className="fade-surface-elevated relative z-10 w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-6 sm:p-8 space-y-7 text-center select-none border border-white/10"
        >
          {/* Header */}
          <div className="flex items-center justify-between text-left">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-[#D9C9B0] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-xs uppercase tracking-[0.2em] font-bold text-[#B68F4E]">
              Recordatorios FADE
            </span>
            <div className="w-8" />
          </div>

          {/* Icon & Message */}
          <div className="flex flex-col items-center space-y-4 py-2">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-b from-[#2A2A2A] to-[#121212] border border-[#B68F4E]/30 flex items-center justify-center text-[#B68F4E] shadow-[0_0_30px_rgba(182,143,78,0.2)]">
              <Calendar className="w-9 h-9 stroke-[1.8]" />
            </div>

            <div className="space-y-2 max-w-xs">
              <h2 className="text-2xl font-bold tracking-tight text-white leading-snug font-serif">
                Tu último corte fue hace <br />
                <span className="text-gold-gradient font-sans font-black">
                  5 semanas.
                </span>
              </h2>
              <p className="text-xs text-[#D9C9B0]/70 leading-relaxed font-light">
                Para mantener la silueta y definición de tu corte, te sugerimos agendar una sesión de mantenimiento.
              </p>
            </div>
          </div>

          {/* Primary CTA */}
          <div>
            <motion.button
              type="button"
              onClick={() => {
                onExploreBarbers();
                onClose();
              }}
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              className="fade-btn-primary w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-xs md:text-sm tracking-[0.12em] font-black cursor-pointer shadow-[0_8px_24px_-4px_rgba(217,201,176,0.35)]"
            >
              <Search className="w-4 h-4" />
              <span>Buscar disponibilidad</span>
            </motion.button>
          </div>

          {/* Recommended Style Card */}
          <div className="text-left space-y-2 pt-2">
            <span className="text-[10px] uppercase font-bold tracking-[0.18em] text-[#D9C9B0]/60 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#B68F4E]" />
              Estilo recomendado
            </span>

            <div
              onClick={() => {
                onExploreBarbers();
                onClose();
              }}
              className="flex items-center justify-between p-3.5 rounded-2xl bg-black/50 border border-white/5 hover:border-[#B68F4E]/30 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-3">
                <img
                  src="/assets/images/1.png"
                  alt="Mid Fade Textura"
                  className="w-12 h-12 rounded-xl object-cover border border-white/10"
                />
                <div>
                  <span className="text-sm font-bold text-white block group-hover:text-[#B68F4E] transition-colors">
                    Mid Fade Textura
                  </span>
                  <span className="text-[11px] text-[#D9C9B0]/60">
                    Basado en tus últimos cortes
                  </span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-[#B68F4E] transition-colors" />
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
