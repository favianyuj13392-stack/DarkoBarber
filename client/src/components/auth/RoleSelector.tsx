import { useId, useRef } from 'react';
import type { FC, KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { Scissors, User } from 'lucide-react';
import { SPRING_TOUCH } from '../../constants/springs';

export type UserRole = 'barbero' | 'cliente';

interface RoleSelectorProps {
  selectedRole: UserRole;
  onChange: (role: UserRole) => void;
  className?: string;
}

export const RoleSelector: FC<RoleSelectorProps> = ({
  selectedRole,
  onChange,
  className = '',
}) => {
  const layoutId = useId();
  const tabRefs = useRef<Record<UserRole, HTMLButtonElement | null>>({
    barbero: null,
    cliente: null,
  });

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const roles: UserRole[] = ['barbero', 'cliente'];
    const current = roles.indexOf(selectedRole);
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
        next = (current + 1) % roles.length;
        break;
      case 'ArrowLeft':
        next = (current - 1 + roles.length) % roles.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = roles.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(roles[next]);
    tabRefs.current[roles[next]]?.focus();
  };

  return (
    <div
      className={`relative flex items-center p-1 rounded-2xl bg-black/60 border border-white/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.6)] backdrop-blur-md ${className}`}
      role="tablist"
      aria-label="Selección de Rol"
      onKeyDown={handleKeyDown}
    >
      {/* Botón Soy Barbero */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        transition={SPRING_TOUCH}
        ref={(node) => {
          tabRefs.current.barbero = node;
        }}
        role="tab"
        aria-selected={selectedRole === 'barbero'}
        tabIndex={selectedRole === 'barbero' ? 0 : -1}
        onClick={() => onChange('barbero')}
        className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold tracking-wider transition-colors duration-200 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9C9B0] focus-visible:ring-offset-1 focus-visible:ring-offset-black ${
          selectedRole === 'barbero'
            ? 'text-black font-bold'
            : 'text-[#D9C9B0]/70 hover:text-[#F5EBDD]'
        }`}
      >
        {selectedRole === 'barbero' && (
          <motion.div
            layoutId={layoutId}
            transition={SPRING_TOUCH}
            className="absolute inset-0 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(217,201,176,0.3)]"
          />
        )}
        <span className="relative z-10 flex items-center gap-2">
          <Scissors className="w-3.5 h-3.5" />
          <span>Soy Barbero</span>
        </span>
      </motion.button>

      {/* Botón Soy Cliente */}
      <motion.button
        type="button"
        whileTap={{ scale: 0.98 }}
        transition={SPRING_TOUCH}
        ref={(node) => {
          tabRefs.current.cliente = node;
        }}
        role="tab"
        aria-selected={selectedRole === 'cliente'}
        tabIndex={selectedRole === 'cliente' ? 0 : -1}
        onClick={() => onChange('cliente')}
        className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs font-semibold tracking-wider transition-colors duration-200 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9C9B0] focus-visible:ring-offset-1 focus-visible:ring-offset-black ${
          selectedRole === 'cliente'
            ? 'text-black font-bold'
            : 'text-[#D9C9B0]/70 hover:text-[#F5EBDD]'
        }`}
      >
        {selectedRole === 'cliente' && (
          <motion.div
            layoutId={layoutId}
            transition={SPRING_TOUCH}
            className="absolute inset-0 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(217,201,176,0.3)]"
          />
        )}
        <span className="relative z-10 flex items-center gap-2">
          <User className="w-3.5 h-3.5" />
          <span>Soy Cliente</span>
        </span>
      </motion.button>
    </div>
  );
};
