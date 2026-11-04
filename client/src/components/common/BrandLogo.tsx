import type { FC } from 'react';
import { motion } from 'framer-motion';

interface BrandLogoProps {
  variant?: 'full' | 'icon' | 'icon-box';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

/**
 * Luxury FADE canonical logo with gold/crema gradient specular lighting.
 */
export const BrandLogo: FC<BrandLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
}) => {
  const sizeMap = {
    sm: { icon: 26, text: 'text-lg', height: 26 },
    md: { icon: 36, text: 'text-2xl', height: 36 },
    lg: { icon: 52, text: 'text-4xl', height: 52 },
    xl: { icon: 72, text: 'text-5xl', height: 72 },
  };

  const currentSize = sizeMap[size];

  const IsotypeSVG = (
    <svg
      width={currentSize.icon}
      height={currentSize.icon}
      viewBox="0 0 100 115"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 drop-shadow-[0_2px_8px_rgba(217,201,176,0.35)]"
      aria-label="Isotipo FADE"
    >
      <defs>
        <linearGradient id="fadeGoldShine" x1="0" y1="0" x2="100" y2="115" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F5EBDD" />
          <stop offset="50%" stopColor="#D9C9B0" />
          <stop offset="100%" stopColor="#B68F4E" />
        </linearGradient>
      </defs>
      <path
        d="M20 18C20 9.16 27.16 2 36 2H76C86 2 92.5 8.5 90.5 18.5C88.5 28.5 76 34 68 34C60 34 46.5 35 40 43C53 38 68 39 74 46C79 52 74 63 64 66C52 69.5 40 68 40 76C40 86 42 98 42 104C42 110.63 36.63 116 30 116C23.37 116 20 110.63 20 104V18Z"
        fill="url(#fadeGoldShine)"
      />
      <path
        d="M20 74C23 60 31 46 44 40C34 45 27 57 23 68L20 74Z"
        fill="#000000"
        opacity="0.4"
      />
    </svg>
  );

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center ${className}`}>
        {IsotypeSVG}
      </div>
    );
  }

  if (variant === 'icon-box') {
    return (
      <motion.div
        whileTap={{ scale: 0.95 }}
        className={`inline-flex items-center justify-center rounded-2xl bg-gradient-to-b from-[#1E1E1E] to-[#101010] border border-white/10 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_20px_rgba(0,0,0,0.8)] ${className}`}
        style={{ width: currentSize.icon + 22, height: currentSize.icon + 22 }}
      >
        {IsotypeSVG}
      </motion.div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-3.5 select-none ${className}`}>
      {IsotypeSVG}
      <div className="flex flex-col leading-none">
        <span
          className={`font-black tracking-[0.24em] bg-gradient-to-b from-[#FFFFFF] via-[#EADBCA] to-[#C9B69B] bg-clip-text text-transparent uppercase ${currentSize.text}`}
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          FADE
        </span>
        <span
          className="text-[9px] tracking-[0.22em] text-[#B68F4E] font-medium uppercase mt-0.5"
          style={{ fontFamily: "'Inter', sans-serif" }}
        >
          Tu historial · Tu estilo
        </span>
      </div>
    </div>
  );
};

export default BrandLogo;
