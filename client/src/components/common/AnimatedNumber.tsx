import { useLayoutEffect, useRef } from 'react';
import type { FC } from 'react';
import { animate, useMotionValue, useReducedMotion } from 'framer-motion';

interface AnimatedNumberProps {
  value: number | null | undefined;
  decimals?: number;
  /** Plain text rendered before the number (e.g. "$"). Never animated. */
  prefix?: string;
  /** Plain text rendered after the number (e.g. "%", " Bs"). Never animated. */
  suffix?: string;
  /** Text shown when `value` is null, undefined, NaN or infinite. */
  placeholder?: string;
  className?: string;
}

const isValidNumber = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n);

/**
 * Counts up to `value` with a spring. Only the digits are animated: they are
 * written straight to a DOM node through a motion value (no React state per
 * frame). Prefix/suffix are static sibling spans. Invalid values render the
 * placeholder and never feed NaN/Infinity into the animation. Respects
 * prefers-reduced-motion.
 */
export const AnimatedNumber: FC<AnimatedNumberProps> = ({
  value,
  decimals = 0,
  prefix,
  suffix,
  placeholder = '—',
  className,
}) => {
  const numberRef = useRef<HTMLSpanElement>(null);
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  // True once a valid number has been displayed; the next change then
  // animates from the current displayed value instead of from zero.
  const hasShownValue = useRef(false);

  const valid = isValidNumber(value);
  const target = valid ? value : null;

  useLayoutEffect(() => {
    const node = numberRef.current;
    if (!node) return;

    if (target === null) {
      hasShownValue.current = false;
      node.textContent = placeholder;
      return;
    }

    const render = (n: number) => {
      node.textContent = n.toFixed(decimals);
    };

    if (reduceMotion) {
      motionValue.set(target);
      hasShownValue.current = true;
      render(target);
      return;
    }

    if (!hasShownValue.current) {
      motionValue.jump(0);
      render(0);
    } else {
      render(motionValue.get());
    }
    hasShownValue.current = true;

    const unsubscribe = motionValue.on('change', render);
    const controls = animate(motionValue, target, {
      type: 'spring',
      stiffness: 120,
      damping: 20,
      mass: 0.8,
    });
    return () => {
      unsubscribe();
      controls.stop();
    };
  }, [target, decimals, placeholder, reduceMotion, motionValue]);

  return (
    <span className={className}>
      {valid && prefix ? <span>{prefix}</span> : null}
      <span ref={numberRef} />
      {valid && suffix ? <span>{suffix}</span> : null}
    </span>
  );
};
