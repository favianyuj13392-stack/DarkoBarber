import type { FC } from 'react';
import { motion } from 'framer-motion';
import { BrandLogo } from '../common/BrandLogo';
import { SPRING_TOUCH } from '../../constants/springs';

interface SplashScreenProps {
  onStart: () => void;
  onDirectLogin?: () => void;
}

export const SplashScreen: FC<SplashScreenProps> = ({ onStart, onDirectLogin }) => {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center px-6 py-12 overflow-hidden select-none bg-black">
      {/* Fondo Fotográfico de Lujo con Oclusión Gradual */}
      <div className="absolute inset-0 z-0">
        <picture>
          <source media="(min-width: 768px)" srcSet="/assets/images/desktoplogin.png" />
          <img
            src="/assets/images/movillogin.png"
            alt="Sillón de barbería FADE"
            className="w-full h-full object-cover object-center scale-105 filter brightness-75 contrast-110"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60" />
      </div>

      {/* Top Bar Spacer */}
      <div className="relative z-10 w-full flex justify-end">
        {onDirectLogin && (
          <button
            type="button"
            onClick={onDirectLogin}
            className="text-xs uppercase tracking-[0.16em] text-[#D9C9B0]/70 hover:text-white transition-colors py-2 px-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10"
          >
            Iniciar sesión
          </button>
        )}
      </div>

      {/* Centro: Isotipo y Brand Claim */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative z-10 flex flex-col items-center text-center space-y-6 max-w-sm"
      >
        <div className="scale-125 md:scale-150 py-4">
          <BrandLogo variant="icon" size="xl" />
        </div>

        <div className="space-y-3">
          <h1
            className="text-4xl md:text-5xl font-black tracking-[0.28em] text-white uppercase drop-shadow-[0_4px_12px_rgba(0,0,0,0.8)]"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            FADE
          </h1>
          <p
            className="text-xs md:text-sm font-medium tracking-[0.24em] text-[#D9C9B0] uppercase"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            TU HISTORIAL. TU ESTILO.
          </p>
        </div>
      </motion.div>

      {/* Botón Inferior Comenzar */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-xs"
      >
        <motion.button
          type="button"
          onClick={onStart}
          whileTap={{ scale: 0.96 }}
          transition={SPRING_TOUCH}
          className="fade-btn-primary w-full py-4 rounded-2xl text-xs md:text-sm tracking-[0.12em] font-black cursor-pointer shadow-[0_10px_30px_rgba(217,201,176,0.35)]"
        >
          Comenzar
        </motion.button>
      </motion.div>
    </div>
  );
};
