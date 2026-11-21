import { useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
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
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const count = options.length;
    if (count === 0) return;
    const current = Math.max(
      0,
      options.findIndex((option) => option.value === value),
    );
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (current + 1) % count;
        break;
      case 'ArrowLeft':
        next = (current - 1 + count) % count;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(options[next].value);
    tabRefs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={handleKeyDown}
      className={`relative flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10 ${className}`}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={`relative flex-1 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-[0.12em] cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9C9B0] focus-visible:ring-offset-1 focus-visible:ring-offset-black ${
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
