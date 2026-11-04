import { useEffect } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scissors, ShieldCheck, Phone, Sparkles } from 'lucide-react';
import { SPRING_TOUCH, SPRING_MODAL } from '../../constants/springs';
import type { IncomingClientHandshake } from '../../services/presence.service';

interface IncomingClientChairModalProps {
  client: IncomingClientHandshake | null;
  onAccept: (client: IncomingClientHandshake) => void;
  onDismiss: () => void;
}

export const IncomingClientChairModal: FC<IncomingClientChairModalProps> = ({
  client,
  onAccept,
  onDismiss,
}) => {
  useEffect(() => {
    if (client) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([80, 50, 120]);
      }
    }
  }, [client]);

  if (!client) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl select-none overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={SPRING_MODAL}
          className="relative z-10 w-full max-w-sm rounded-3xl bg-[#0E0D0B] border-2 border-[#B68F4E]/60 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(182,143,78,0.25)] p-6 space-y-6 text-center overflow-hidden"
        >
          {/* Luz ambiental decorativa */}
          <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-[#B68F4E]/20 blur-2xl pointer-events-none" />

          {/* Encabezado */}
          <div className="space-y-1 relative z-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#B68F4E]/15 border border-[#B68F4E]/30 text-[10px] font-mono tracking-widest text-[#B68F4E] uppercase">
              <Sparkles className="w-3 h-3 text-[#B68F4E] animate-spin" />
              <span>¡Nuevo cliente en sillón!</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight font-serif pt-1">
              Vinculación de Historial
            </h2>
            <p className="text-xs text-[#D9C9B0]/80 font-light">
              Un cliente acaba de escanear tu código de espejo y te autorizó acceso a su ficha técnica.
            </p>
          </div>

          {/* Tarjeta del Cliente */}
          <div className="fade-surface rounded-2xl p-4 border border-white/10 flex items-center gap-4 text-left shadow-inner relative z-10">
            <div className="relative w-16 h-16 rounded-full overflow-hidden border-2 border-[#B68F4E] shrink-0 shadow-md">
              <img
                src={client.avatarUrl || '/assets/images/1.png'}
                alt={client.displayName}
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-black" />
            </div>

            <div className="space-y-1 flex-1 min-w-0">
              <h3 className="text-base font-bold text-white tracking-tight truncate">
                {client.displayName}
              </h3>
              <div className="flex items-center gap-1 text-xs text-[#D9C9B0]/70 font-mono">
                <Phone className="w-3 h-3 text-[#B68F4E]" />
                <span>{client.phone}</span>
              </div>
              <div className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                <ShieldCheck className="w-3 h-3" />
                <span>Historial verificado</span>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div className="space-y-2.5 pt-1 relative z-10">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              onClick={() => onAccept(client)}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-sm tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(217,201,176,0.35)] cursor-pointer flex items-center justify-center gap-2 hover:brightness-105 transition-all"
            >
              <Scissors className="w-4 h-4 text-black" />
              <span>Aceptar y ver historial</span>
            </motion.button>

            <button
              type="button"
              onClick={onDismiss}
              className="w-full py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-[#D9C9B0]/70 hover:text-white transition-colors cursor-pointer"
            >
              Ahora no
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default IncomingClientChairModal;
