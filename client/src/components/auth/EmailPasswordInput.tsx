import { useState } from 'react';
import type { FC, ChangeEvent } from 'react';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';

interface EmailPasswordInputProps {
  email: string;
  password: string;
  onEmailChange: (val: string) => void;
  onPasswordChange: (val: string) => void;
  disabled?: boolean;
}

export const EmailPasswordInput: FC<EmailPasswordInputProps> = ({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  disabled = false,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-4 w-full">
      {/* Campo de Correo Electrónico */}
      <div className="space-y-1.5 text-left">
        <label
          htmlFor="email-input"
          className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D9C9B0]/80"
        >
          Correo Electrónico
        </label>
        <div className="flex items-center rounded-2xl bg-black/60 border border-white/10 px-3.5 py-1.5 transition-all duration-200 focus-within:border-[#B68F4E]/60 focus-within:shadow-[0_0_20px_rgba(182,143,78,0.18)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="pr-3 text-[#B68F4E]">
            <Mail className="w-4 h-4" />
          </div>

          <input
            id="email-input"
            type="email"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onEmailChange(e.target.value)}
            placeholder="tu.correo@ejemplo.com"
            disabled={disabled}
            autoComplete="email"
            className="w-full bg-transparent py-2 text-sm md:text-base font-normal text-white placeholder-white/20 tracking-normal focus:outline-none disabled:opacity-50"
          />
        </div>
      </div>

      {/* Campo de Contraseña */}
      <div className="space-y-1.5 text-left">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password-input"
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D9C9B0]/80"
          >
            Contraseña
          </label>
          <span className="text-[10px] text-[#B68F4E]/70 hover:underline cursor-pointer">
            ¿Olvidaste tu contraseña?
          </span>
        </div>

        <div className="flex items-center rounded-2xl bg-black/60 border border-white/10 px-3.5 py-1.5 transition-all duration-200 focus-within:border-[#B68F4E]/60 focus-within:shadow-[0_0_20px_rgba(182,143,78,0.18)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="pr-3 text-[#B68F4E]">
            <Lock className="w-4 h-4" />
          </div>

          <input
            id="password-input"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => onPasswordChange(e.target.value)}
            placeholder="••••••••"
            disabled={disabled}
            autoComplete="current-password"
            className="w-full bg-transparent py-2 text-sm md:text-base font-sans tracking-wide text-white placeholder-white/20 focus:outline-none disabled:opacity-50"
          />

          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="p-1.5 text-[#D9C9B0]/60 hover:text-[#F5EBDD] transition-colors cursor-pointer"
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
