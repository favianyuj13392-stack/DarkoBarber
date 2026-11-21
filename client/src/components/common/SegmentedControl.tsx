import { useId } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { SPRING_TOUCH } from '../../constants/springs';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = '',
}: SegmentedControlProps<T>) {
  const layoutId = useId();

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`relative flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10 ${className}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`relative flex-1 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors ${
              active ? 'text-black' : 'text-fade-crema/70 hover:text-white'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={SPRING_TOUCH}
                className="absolute inset-0 rounded-full bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91]"
                aria-hidden="true"
              />
            )}
            <span className="relative z-10">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
