import { useState } from 'react';
import type { FC, ChangeEvent } from 'react';
import { Lock, Eye, EyeOff } from 'lucide-react';

interface PhonePinInputProps {
  phone: string;
  pin: string;
  onPhoneChange: (val: string) => void;
  onPinChange: (val: string) => void;
  disabled?: boolean;
}

export const PhonePinInput: FC<PhonePinInputProps> = ({
  phone,
  pin,
  onPhoneChange,
  onPinChange,
  disabled = false,
}) => {
  const [showPin, setShowPin] = useState(false);

  const handlePhoneInput = (e: ChangeEvent<HTMLInputElement>) => {
    // Only numbers, max 8 digits for Bolivia mobile
    const raw = e.target.value.replace(/\D/g, '').slice(0, 8);
    onPhoneChange(raw);
  };

  const handlePinInput = (e: ChangeEvent<HTMLInputElement>) => {
    // Only numbers, max 4 digits
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    onPinChange(raw);
  };

  return (
    <div className="space-y-4 w-full">
      {/* Campo de Teléfono */}
      <div className="space-y-1.5 text-left">
        <label
          htmlFor="phone-input"
          className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D9C9B0]/80"
        >
          Número de Celular
        </label>
        <div className="flex items-center rounded-2xl bg-black/60 border border-white/10 px-3 py-1.5 transition-all duration-200 focus-within:border-[#B68F4E]/60 focus-within:shadow-[0_0_20px_rgba(182,143,78,0.18)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          {/* Prefijo Bolivia */}
          <div className="flex items-center gap-1.5 pr-3 border-r border-white/10 select-none">
            <span className="text-base" role="img" aria-label="Bandera Bolivia">
              🇧🇴
            </span>
            <span className="text-xs font-semibold text-[#F5EBDD] tracking-wider">
              +591
            </span>
          </div>

          <input
            id="phone-input"
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={handlePhoneInput}
            placeholder="77212345"
            disabled={disabled}
            className="w-full bg-transparent px-3 py-2 text-sm md:text-base font-medium text-white placeholder-white/20 tracking-wider focus:outline-none disabled:opacity-50"
          />
        </div>
      </div>

      {/* Campo de PIN / Clave */}
      <div className="space-y-1.5 text-left">
        <div className="flex items-center justify-between">
          <label
            htmlFor="pin-input"
            className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D9C9B0]/80"
          >
            PIN de Acceso (4 dígitos)
          </label>
          <span className="text-[10px] text-[#B68F4E]/70 font-mono">
            {pin.length}/4
          </span>
        </div>

        <div className="flex items-center rounded-2xl bg-black/60 border border-white/10 px-3 py-1.5 transition-all duration-200 focus-within:border-[#B68F4E]/60 focus-within:shadow-[0_0_20px_rgba(182,143,78,0.18)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <div className="pl-1 pr-2 text-[#B68F4E]">
            <Lock className="w-4 h-4" />
          </div>

          <input
            id="pin-input"
            type={showPin ? 'text' : 'password'}
            inputMode="numeric"
            value={pin}
            onChange={handlePinInput}
            placeholder="••••"
            maxLength={4}
            disabled={disabled}
            className="w-full bg-transparent px-2 py-2 text-sm md:text-base font-mono tracking-[0.3em] text-white placeholder-white/20 focus:outline-none disabled:opacity-50"
          />

          <button
            type="button"
            onClick={() => setShowPin(!showPin)}
            className="p-1.5 text-[#D9C9B0]/60 hover:text-[#F5EBDD] transition-colors cursor-pointer"
            aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
          >
            {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
};
