import { useEffect, useRef } from 'react';
import type { FC } from 'react';
import { animate, useMotionValue, useReducedMotion } from 'framer-motion';

interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

/**
 * Counts up to `value` with a spring. Writes text directly to the DOM node
 * to avoid re-rendering on every frame. Respects prefers-reduced-motion.
 */
export const AnimatedNumber: FC<AnimatedNumberProps> = ({
  value,
  decimals = 0,
  prefix = '',
  suffix = '',
  className,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(reduceMotion ? value : 0);

  useEffect(() => {
    const format = (n: number) => `${prefix}${n.toFixed(decimals)}${suffix}`;
    const node = ref.current;
    const render = (n: number) => {
      if (node) node.textContent = format(n);
    };

    if (reduceMotion) {
      motionValue.set(value);
      render(value);
      return;
    }

    const unsubscribe = motionValue.on('change', render);
    const controls = animate(motionValue, value, {
      type: 'spring',
      stiffness: 120,
      damping: 20,
      mass: 0.8,
    });
    return () => {
      unsubscribe();
      controls.stop();
    };
  }, [value, decimals, prefix, suffix, reduceMotion, motionValue]);

  return (
    <span ref={ref} className={className}>
      {`${prefix}${(reduceMotion ? value : 0).toFixed(decimals)}${suffix}`}
    </span>
  );
};
