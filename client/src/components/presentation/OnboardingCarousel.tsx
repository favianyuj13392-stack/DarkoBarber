import { useState } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { SPRING_TOUCH } from '../../constants/springs';

interface SlideData {
  image: string;
  titleRegular: string;
  titleAccent?: string;
  description: string;
}

const ONBOARDING_SLIDES: SlideData[] = [
  {
    image: '/assets/images/1.png',
    titleRegular: 'Más que un corte. ',
    titleAccent: 'Tu historial.',
    description: 'Encuentra barberos, reserva, guarda tus cortes y crea tu estilo.',
  },
  {
    image: '/assets/images/2.png',
    titleRegular: 'Barberos reales, ',
    titleAccent: 'cerca de ti.',
    description: 'Descubre profesionales, revisa sus trabajos, horarios, servicios y precios.',
  },
  {
    image: '/assets/images/3.png',
    titleRegular: 'Tu historial ',
    titleAccent: 'siempre contigo.',
    description: 'Guarda cada corte, agrega fotos, notas y observa tu evolución.',
  },
  {
    image: '/assets/images/4.png',
    titleRegular: 'Para barberos ',
    titleAccent: 'que dejan huella.',
    description: 'Gestiona tu agenda, tus clientes y muestra tu trabajo al mundo.',
  },
];

interface OnboardingCarouselProps {
  onComplete: () => void;
}

export const OnboardingCarousel: FC<OnboardingCarouselProps> = ({ onComplete }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = () => {
    if (currentIndex < ONBOARDING_SLIDES.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  const currentSlide = ONBOARDING_SLIDES[currentIndex];

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between px-6 py-10 overflow-hidden select-none bg-black">
      {/* Background Image Carousel con Crossfade Suave */}
      <div className="absolute inset-0 z-0">
        <AnimatePresence mode="wait">
          <motion.img
            key={currentSlide.image}
            src={currentSlide.image}
            alt="FADE Presentación"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeInOut' }}
            className="w-full h-full object-cover object-center filter brightness-85 contrast-105"
          />
        </AnimatePresence>
        {/* Degradado Cinematográfico Inferior y Superior */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />
      </div>

      {/* Top Header con Botón Saltar */}
      <div className="relative z-10 w-full flex items-center justify-between">
        <span className="text-[11px] font-bold tracking-[0.2em] text-[#B68F4E] uppercase">
          FADE
        </span>
        <button
          type="button"
          onClick={onComplete}
          className="text-xs uppercase tracking-[0.16em] text-[#D9C9B0]/70 hover:text-white transition-colors py-1.5 px-3 rounded-full bg-black/40 backdrop-blur-md border border-white/10 cursor-pointer"
        >
          Saltar
        </button>
      </div>

      {/* Bottom Content Area: Título, Descripción, Paginación y Botón */}
      <div className="relative z-10 w-full max-w-md mx-auto space-y-8 pb-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4 }}
            className="space-y-3"
          >
            <h2 className="font-serif text-3xl md:text-4xl leading-tight text-white">
              {currentSlide.titleRegular}
              {currentSlide.titleAccent && (
                <span className="italic font-serif block text-gold-gradient">
                  {currentSlide.titleAccent}
                </span>
              )}
            </h2>
            <p className="text-sm md:text-base text-[#D9C9B0]/80 font-light leading-relaxed max-w-sm">
              {currentSlide.description}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Barra de Controles: Dots a la izquierda, Botón Circular a la derecha */}
        <div className="flex items-center justify-between pt-2">
          {/* Indicador de Dots */}
          <div className="flex items-center gap-2">
            {ONBOARDING_SLIDES.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Ir al slide ${idx + 1}`}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  currentIndex === idx
                    ? 'w-7 bg-gradient-to-r from-[#F3E9DC] to-[#B68F4E] shadow-[0_0_10px_rgba(182,143,78,0.5)]'
                    : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
              />
            ))}
          </div>

          {/* Botón Circular Oro con Flecha */}
          <motion.button
            type="button"
            onClick={handleNext}
            whileTap={{ scale: 0.9 }}
            transition={SPRING_TOUCH}
            aria-label={currentIndex === ONBOARDING_SLIDES.length - 1 ? 'Finalizar' : 'Siguiente'}
            className="w-14 h-14 rounded-full flex items-center justify-center bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_24px_-4px_rgba(217,201,176,0.45)] cursor-pointer"
          >
            <ChevronRight className="w-6 h-6 stroke-[2.5]" />
          </motion.button>
        </div>
      </div>
    </div>
  );
};
