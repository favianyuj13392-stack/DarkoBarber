import { useState } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  QrCode,
  User,
  ChevronRight,
  CheckCircle2,
  X,
  Camera,
} from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { SPRING_TOUCH, SPRING_MODAL } from '../../constants/springs';
import { startCut, finalizeCut, type CutChips } from '../../services/cuts.service';
import { presenceService } from '../../services/presence.service';

interface RepeatCutConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCutFinalized: () => void;
  onCapturePhoto?: () => void;
}

export const RepeatCutConfigModal: FC<RepeatCutConfigModalProps> = ({
  isOpen,
  onClose,
  onCutFinalized,
  onCapturePhoto,
}) => {
  // Selected chips
  const [baseLateral, setBaseLateral] = useState<string>('#0.5');
  const [tipoDegradado, setTipoDegradado] = useState<string>('Mid Fade');
  const [parteSuperior, setParteSuperior] = useState<string>('Texturizado');
  const [barbaOption, setBarbaOption] = useState<string>('No');

  // Cut Execution State
  const [isCutActive, setIsCutActive] = useState(false);
  const [activeCutId, setActiveCutId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleStartCut = async () => {
    setLoading(true);
    try {
      const res = await startCut('client-santiago');
      setActiveCutId(res.cut.id);
      setIsCutActive(true);
      // Actualizar presencia a RED (Ocupado en sillón)
      presenceService.setStatus('RED');
    } finally {
      setLoading(false);
    }
  };

  const handleFinishCut = async () => {
    setLoading(true);
    const chips: CutChips = {
      baseLateral,
      tipoDegradado,
      parteSuperior,
      barba: {
        included: barbaOption !== 'No',
        alturaMejilla: barbaOption !== 'No' ? barbaOption : undefined,
      },
    };

    try {
      if (activeCutId) {
        await finalizeCut(activeCutId, chips);
      }
      setIsCutActive(false);
      onCutFinalized();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/95 backdrop-blur-2xl select-none overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={SPRING_MODAL}
          className="relative z-10 w-full max-w-md min-h-screen sm:min-h-0 sm:max-h-[92vh] sm:rounded-3xl p-6 sm:p-7 space-y-6 text-left flex flex-col justify-between overflow-y-auto"
        >
          {/* =========================================================================
              HEADER: BrandLogo FADE + Ícono Scan QR / Cerrar
              ========================================================================= */}
          <header className="flex items-center justify-between">
            <BrandLogo variant="full" size="md" />

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="p-2 rounded-full bg-white/5 border border-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                aria-label="Código QR"
              >
                <QrCode className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* =========================================================================
              TÍTULO Y SUBTÍTULO
              ========================================================================= */}
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-serif">
              Repetir último corte
            </h1>
            <p className="text-xs text-[#D9C9B0]/70 font-light leading-relaxed">
              Estos son los parámetros del último corte. Puedes modificarlos o iniciar directamente.
            </p>
          </div>

          {/* Banner de Corte en Progreso si está activo */}
          {isCutActive && (
            <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 flex items-center justify-between animate-pulse">
              <div className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]" />
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Corte en sillón en curso
                  </h4>
                  <span className="text-[10px] text-red-300 font-mono">
                    Presencia: Ocupado (RED)
                  </span>
                </div>
              </div>
              {onCapturePhoto && (
                <button
                  type="button"
                  onClick={onCapturePhoto}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5 text-[#B68F4E]" />
                  <span>Foto</span>
                </button>
              )}
            </div>
          )}

          {/* =========================================================================
              SELECTORES DE CHIPS
              ========================================================================= */}
          <div className="space-y-4">
            {/* 1. Degradado */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/90 uppercase tracking-wider font-mono">
                Degradado
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {['#0', '#0.5', '#1', '#1.5', '#2'].map((val) => {
                  const isSelected = baseLateral === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setBaseLateral(val)}
                      className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#D9C9B0] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_2px_10px_rgba(217,201,176,0.3)] font-bold'
                          : 'bg-white/5 border border-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Tipo */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/90 uppercase tracking-wider font-mono">
                Tipo
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {['Low Fade', 'Mid Fade', 'High Fade'].map((val) => {
                  const isSelected = tipoDegradado === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setTipoDegradado(val)}
                      className={`px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#D9C9B0] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_2px_10px_rgba(217,201,176,0.3)] font-bold'
                          : 'bg-white/5 border border-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Parte superior */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/90 uppercase tracking-wider font-mono">
                Parte superior
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {['Texturizado', 'Recto', 'Degradado'].map((val) => {
                  const isSelected = parteSuperior === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setParteSuperior(val)}
                      className={`px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#D9C9B0] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_2px_10px_rgba(217,201,176,0.3)] font-bold'
                          : 'bg-white/5 border border-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. Barba */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-white/90 uppercase tracking-wider font-mono">
                Barba
              </label>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                {['No', 'Sí', 'Alta', 'Media', 'Baja'].map((val) => {
                  const isSelected = barbaOption === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setBarbaOption(val)}
                      className={`px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#D9C9B0] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_2px_10px_rgba(217,201,176,0.3)] font-bold'
                          : 'bg-white/5 border border-white/10 text-white/70 hover:text-white'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* =========================================================================
              FOTOS DEL CORTE (4)
              ========================================================================= */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                Fotos del corte (4)
              </h3>
              <button
                type="button"
                className="text-xs text-[#D9C9B0]/70 hover:text-white flex items-center gap-1 cursor-pointer"
              >
                <span>Ver todas</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                { angle: 'Frontal', img: '/assets/images/1.png' },
                { angle: 'Lado izquierdo', img: '/assets/images/2.png' },
                { angle: 'Lado derecho', img: '/assets/images/3.png' },
                { angle: 'Lado trasero', img: '/assets/images/4.png' },
              ].map((item) => (
                <div
                  key={item.angle}
                  className="relative aspect-4/3 rounded-2xl overflow-hidden border border-white/10 bg-[#161616] group"
                >
                  <img
                    src={item.img}
                    alt={item.angle}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 text-[10px] text-white">
                    <User className="w-3 h-3 text-[#B68F4E]" />
                    <span>{item.angle}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* =========================================================================
              BOTÓN DE ACCIÓN: Iniciar corte / Terminar corte
              ========================================================================= */}
          <div className="pt-4 pb-2">
            {!isCutActive ? (
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                transition={SPRING_TOUCH}
                onClick={handleStartCut}
                disabled={loading}
                className="w-full py-4 rounded-full bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-sm tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_6px_25px_rgba(217,201,176,0.35)] cursor-pointer flex items-center justify-center gap-3 disabled:opacity-50"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Iniciar corte</span>
              </motion.button>
            ) : (
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                transition={SPRING_TOUCH}
                onClick={handleFinishCut}
                disabled={loading}
                className="w-full py-4 rounded-full bg-gradient-to-b from-emerald-300 via-emerald-400 to-emerald-500 text-black font-bold text-sm tracking-wide shadow-[0_6px_25px_rgba(16,185,129,0.4)] cursor-pointer flex items-center justify-center gap-3"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>Terminar corte y registrar</span>
              </motion.button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default RepeatCutConfigModal;
