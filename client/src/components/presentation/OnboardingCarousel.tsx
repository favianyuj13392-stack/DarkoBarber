import { useState } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { SPRING_TOUCH, SPRING_MODAL } from '../../constants/springs';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';

interface SlideData {
  image: string;
  titleRegular: string;
  titleAccent?: string;
  description: string;
}

const DOT_SIZE = 8;
const DOT_GAP = 8;

const contentVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
  exit: { transition: { staggerChildren: 0.03, staggerDirection: -1 as const } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: SPRING_MODAL },
  exit: { opacity: 0, y: -8, transition: SPRING_MODAL },
};

const itemVariantsReduced = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

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
  const reduceMotion = usePrefersReducedMotion();
  const itemMotion = reduceMotion ? itemVariantsReduced : itemVariants;

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
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.05 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={reduceMotion ? { duration: 0 } : SPRING_MODAL}
            className="w-full h-full object-cover object-center filter brightness-85 contrast-105"
          />
        </AnimatePresence>
        {/* Degradado Cinematográfico Inferior y Superior */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent" />
        {/* Ambient gold/coral glow */}
        <div className="fade-ambient absolute inset-0 mix-blend-screen opacity-80 pointer-events-none" />
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
            variants={contentVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="space-y-3"
          >
            <motion.h2
              variants={itemMotion}
              className="font-serif text-4xl md:text-5xl leading-[1.1] tracking-tight text-white"
            >
              {currentSlide.titleRegular}
              {currentSlide.titleAccent && (
                <span className="font-editorial block text-gold-gradient">
                  {currentSlide.titleAccent}
                </span>
              )}
            </motion.h2>
            <motion.p
              variants={itemMotion}
              className="text-sm md:text-base text-[#D9C9B0]/80 font-light leading-relaxed max-w-sm"
            >
              {currentSlide.description}
            </motion.p>
          </motion.div>
        </AnimatePresence>

        {/* Control bar: glass capsule with sliding pagination and CTA */}
        <div className="fade-surface rounded-full flex items-center justify-between py-2 pl-6 pr-2">
          <div
            className="relative flex items-center"
            style={{ gap: DOT_GAP }}
            role="group"
            aria-label="Onboarding progress"
          >
            {ONBOARDING_SLIDES.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-current={currentIndex === idx ? 'true' : undefined}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Ir al slide ${idx + 1}`}
                style={{ width: DOT_SIZE, height: DOT_SIZE }}
                className="rounded-full bg-white/40 hover:bg-white/60 transition-colors cursor-pointer"
              />
            ))}
            <motion.span
              aria-hidden="true"
              initial={false}
              animate={{ x: currentIndex * (DOT_SIZE + DOT_GAP) }}
              transition={reduceMotion ? { duration: 0 } : SPRING_TOUCH}
              style={{ width: DOT_SIZE, height: DOT_SIZE }}
              className="absolute left-0 top-0 rounded-full bg-gradient-to-r from-[#F3E9DC] to-[#B68F4E] shadow-[0_0_10px_rgba(182,143,78,0.6)] pointer-events-none"
            />
          </div>

          <motion.button
            type="button"
            onClick={handleNext}
            whileHover={reduceMotion ? undefined : { y: -2 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
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
