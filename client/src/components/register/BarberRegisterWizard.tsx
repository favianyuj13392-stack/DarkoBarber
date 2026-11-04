import { useState, useRef, useEffect } from 'react';
import type { FC, FormEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Camera,
  User,
  MapPin,
  Store,
  ChevronRight,
  Check,
  Plus,
  Info,
  Loader2,
  Scissors,
} from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { SPRING_TOUCH, SPRING_SLIDE } from '../../constants/springs';
import type {
  BarberRegisterState,
  BarberServiceItem,
} from '../../types/register';
import { INITIAL_BARBER_REGISTER_STATE } from '../../types/register';
import { registerBarber, type LoginResponse } from '../../services/auth.service';

interface BarberRegisterWizardProps {
  initialStep?: number;
  onCancel: () => void;
  onRegisterSuccess: (loginData: LoginResponse) => void;
  onSwitchToClient?: () => void;
}

export const BarberRegisterWizard: FC<BarberRegisterWizardProps> = ({
  initialStep = 1,
  onCancel,
  onRegisterSuccess,
  onSwitchToClient,
}) => {
  const [step, setStep] = useState<number>(initialStep);

  useEffect(() => {
    if (initialStep) {
      setStep(initialStep);
    }
  }, [initialStep]);

  const [form, setForm] = useState<BarberRegisterState>(INITIAL_BARBER_REGISTER_STATE);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registeredSession, setRegisteredSession] = useState<LoginResponse | null>(null);

  // Modal para agregar servicio custom en Paso 4
  const [isAddingService, setIsAddingService] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('50');

  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleBack = () => {
    if (step > 1) {
      setStep((prev) => prev - 1);
      setErrorMessage(null);
    } else {
      onCancel();
    }
  };

  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setForm((prev) => ({ ...prev, avatarUrl: url }));
    }
  };

  // Validación y envío Paso 2
  const handleStep2Submit = (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!form.email || !form.email.includes('@')) {
      setErrorMessage('Ingresa un correo electrónico válido');
      return;
    }

    if (!form.password || form.password.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setStep(3);
  };

  // Google Mock Login
  const handleGoogleClick = () => {
    setForm((prev) => ({
      ...prev,
      email: prev.email || 'brian.barber@fade.bo',
      password: prev.password || 'BarberPass123!',
      displayName: prev.displayName || 'Brian López',
    }));
    setStep(3);
  };

  // Toggle servicios en Paso 4
  const toggleService = (id: string) => {
    setForm((prev) => ({
      ...prev,
      services: prev.services.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ),
    }));
  };

  // Agregar servicio personalizado
  const handleAddCustomService = (e: FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;

    const newService: BarberServiceItem = {
      id: `custom-${Date.now()}`,
      name: newServiceName.trim(),
      priceBs: Number(newServicePrice) || 50,
      enabled: true,
      photo: '/assets/images/2.png',
    };

    setForm((prev) => ({
      ...prev,
      services: [...prev.services, newService],
    }));

    setNewServiceName('');
    setNewServicePrice('50');
    setIsAddingService(false);
  };

  // Toggle días en Paso 5
  const toggleScheduleDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      schedule: prev.schedule.map((d) => {
        if (d.day === day) {
          const nextEnabled = !d.enabled;
          return {
            ...d,
            enabled: nextEnabled,
            hours: nextEnabled ? '10:00 - 20:00' : 'Cerrado',
          };
        }
        return d;
      }),
    }));
  };

  // Finalizar registro Paso 7
  const handleFinish = async () => {
    if (registeredSession) {
      onRegisterSuccess(registeredSession);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const session = await registerBarber(
        form.email || 'brian.barber@fade.bo',
        form.password || 'Password123!',
        form.displayName || 'Brian López'
      );
      setRegisteredSession(session);
      onRegisterSuccess(session);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear la cuenta de barbero';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-[#F5EBDD] flex flex-col justify-between p-4 sm:p-8 select-none overflow-x-hidden">
      {/* Background Glow */}
      <div 
        className="absolute w-[500px] h-[500px] rounded-full blur-[150px] pointer-events-none opacity-15 top-0 -left-20 bg-[#B68F4E]"
        aria-hidden="true"
      />
      <div 
        className="absolute w-[400px] h-[400px] rounded-full blur-[140px] pointer-events-none opacity-10 bottom-0 -right-20 bg-[#D9C9B0]"
        aria-hidden="true"
      />

      {/* Top Header con Botón Atrás y Progreso */}
      <header className="relative z-10 w-full max-w-md mx-auto flex items-center justify-between py-2">
        {step < 7 ? (
          <button
            type="button"
            onClick={handleBack}
            className="p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-[#D9C9B0] transition-colors cursor-pointer"
            aria-label="Atrás"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <div className="w-10" />
        )}

        <div className="flex items-center gap-1.5">
          <BrandLogo variant="icon" size="sm" />
          <span className="text-xs uppercase font-mono tracking-widest text-[#B68F4E] font-semibold">
            FADE Pro
          </span>
        </div>

        {step > 1 && step < 7 ? (
          <span className="text-xs font-mono text-[#D9C9B0]/60">
            {step - 1} / 5
          </span>
        ) : (
          <div className="w-10" />
        )}
      </header>

      {/* Contenedor Central con Transición de Pasos */}
      <main className="relative z-10 w-full max-w-md mx-auto flex-1 flex flex-col justify-center py-4">
        <AnimatePresence mode="wait">
          {/* =========================================================================
              PASO 1: Selección de Rol (¿Cómo quieres usar FADE?) - 1.png
              ========================================================================= */}
          {step === 1 && (
            <motion.div
              key="barber-step-1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={SPRING_SLIDE}
              className="space-y-6 text-left"
            >
              <div className="space-y-2 text-center sm:text-left">
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-serif">
                  ¿Cómo quieres usar <br />
                  <span className="text-gold-gradient font-sans font-black">FADE?</span>
                </h1>
                <p className="text-xs sm:text-sm text-[#D9C9B0]/70 leading-relaxed font-light">
                  Puedes cambiar el modo en cualquier momento desde tu perfil.
                </p>
              </div>

              <div className="space-y-4">
                {/* Opción Soy Cliente */}
                <motion.div
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING_TOUCH}
                  onClick={() => {
                    if (onSwitchToClient) {
                      onSwitchToClient();
                    } else {
                      onCancel();
                    }
                  }}
                  className="fade-surface rounded-3xl p-5 flex items-center gap-4 cursor-pointer border border-white/10 hover:border-[#B68F4E]/60 transition-all group shadow-xl"
                >
                  <div className="relative w-20 h-24 rounded-2xl overflow-hidden border border-white/10 shrink-0">
                    <img
                      src="/assets/images/1.png"
                      alt="Cliente FADE"
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-1.5 left-1.5 p-1 rounded-full bg-black/60 text-[#B68F4E]">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div className="flex-1 space-y-1">
                    <h3 className="text-base font-bold text-white tracking-tight group-hover:text-[#B68F4E] transition-colors">
                      Soy cliente
                    </h3>
                    <p className="text-xs text-[#D9C9B0]/70 leading-relaxed font-light">
                      Encuentra barberos, reserva tu próxima cita y guarda tu historial de cortes.
                    </p>
                  </div>

                  <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-[#B68F4E] group-hover:translate-x-1 transition-all shrink-0" />
                </motion.div>

                {/* Opción Soy Barbero */}
                <motion.div
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING_TOUCH}
                  onClick={() => setStep(2)}
                  className="fade-surface rounded-3xl p-5 flex items-center gap-4 cursor-pointer border-2 border-[#B68F4E] bg-[#B68F4E]/5 group shadow-[0_0_25px_rgba(182,143,78,0.25)]"
                >
                  <div className="relative w-20 h-24 rounded-2xl overflow-hidden border border-[#B68F4E]/40 shrink-0">
                    <img
                      src="/assets/images/2.png"
                      alt="Barbero Profesional FADE"
                      className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-1.5 left-1.5 p-1 rounded-full bg-black/60 text-[#B68F4E]">
                      <Scissors className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-white tracking-tight text-[#B68F4E]">
                        Soy barbero
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-[#B68F4E]/20 text-[#B68F4E] border border-[#B68F4E]/40">
                        PRO
                      </span>
                    </div>
                    <p className="text-xs text-[#D9C9B0]/80 leading-relaxed font-light">
                      Gestiona tu agenda, atrae nuevos clientes y haz crecer tu negocio.
                    </p>
                  </div>

                  <ChevronRight className="w-5 h-5 text-[#B68F4E] group-hover:translate-x-1 transition-all shrink-0" />
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* =========================================================================
              PASO 2: Crea tu cuenta (2.png)
              ========================================================================= */}
          {step === 2 && (
            <motion.div
              key="barber-step-2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={SPRING_SLIDE}
              className="space-y-6 text-left"
            >
              <div className="space-y-1 text-center sm:text-left">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#B68F4E]">
                  Paso 1 de 5 · Acceso Pro
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-serif">
                  Crea tu cuenta
                </h1>
                <p className="text-xs text-[#D9C9B0]/70">
                  Comienza a configurar tu perfil profesional de barbero.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-200">
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleStep2Submit} className="space-y-4">
                {/* Email */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#D9C9B0]/80 block">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="brian.barber@fade.bo"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-[#B68F4E] transition-all"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#D9C9B0]/80 block">
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full pl-10 pr-10 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-[#B68F4E] transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Botón Continuar */}
                <motion.button
                  type="submit"
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING_TOUCH}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-sm tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(217,201,176,0.3)] cursor-pointer mt-2"
                >
                  Continuar
                </motion.button>
              </form>

              {/* Separador */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-white/10 w-full" />
                <span className="bg-black px-3 text-[11px] font-mono text-white/40 uppercase">
                  o
                </span>
              </div>

              {/* Botón Google */}
              <button
                type="button"
                onClick={handleGoogleClick}
                className="w-full py-3 px-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-sm font-medium flex items-center justify-center gap-3 transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continuar con Google</span>
              </button>

              <p className="text-[11px] text-center text-[#D9C9B0]/50 font-light">
                Al continuar, aceptas nuestros Términos y Condiciones
              </p>
            </motion.div>
          )}

          {/* =========================================================================
              PASO 3: Completa tu perfil profesional (3.png)
              ========================================================================= */}
          {step === 3 && (
            <motion.div
              key="barber-step-3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={SPRING_SLIDE}
              className="space-y-6 text-left"
            >
              <div className="space-y-1 text-center sm:text-left">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#B68F4E]">
                  Paso 2 de 5 · Identidad
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-serif">
                  Completa tu perfil profesional
                </h1>
              </div>

              {/* Avatar interactivo con botón cámara */}
              <div className="flex flex-col items-center justify-center pt-2">
                <input
                  type="file"
                  ref={avatarInputRef}
                  onChange={handleAvatarChange}
                  accept="image/*"
                  className="hidden"
                />
                <div
                  onClick={() => avatarInputRef.current?.click()}
                  className="relative w-28 h-28 rounded-full border-2 border-[#B68F4E]/60 p-1 cursor-pointer group shadow-[0_0_20px_rgba(182,143,78,0.2)]"
                >
                  <div className="w-full h-full rounded-full overflow-hidden bg-neutral-900 border border-white/10 flex items-center justify-center">
                    {form.avatarUrl ? (
                      <img
                        src={form.avatarUrl}
                        alt="Avatar"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <img
                        src="/assets/images/3.png"
                        alt="Avatar por defecto"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    )}
                  </div>
                  {/* Badge Cámara */}
                  <div className="absolute bottom-0 right-0 p-2 rounded-full bg-gradient-to-b from-[#F3E9DC] to-[#C2AE91] text-black shadow-lg">
                    <Camera className="w-4 h-4" />
                  </div>
                </div>
                <span className="text-[11px] text-[#D9C9B0]/60 mt-2">
                  Toca para cambiar foto de perfil
                </span>
              </div>

              {/* Formulario */}
              <div className="space-y-4">
                {/* Nombre */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#D9C9B0]/80 block">
                    Nombre completo
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type="text"
                      value={form.displayName}
                      onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                      placeholder="Brian López"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-[#B68F4E] transition-all"
                    />
                  </div>
                </div>

                {/* Ciudad */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#D9C9B0]/80 block">
                    Ciudad
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="La Paz"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-[#B68F4E] transition-all"
                    />
                  </div>
                </div>

                {/* Barbería actual */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-[#D9C9B0]/80 block">
                    Barbería actual (opcional)
                  </label>
                  <div className="relative">
                    <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input
                      type="text"
                      value={form.currentShop}
                      onChange={(e) => setForm({ ...form, currentShop: e.target.value })}
                      placeholder="Estudio 16 o Autónomo"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-[#B68F4E] transition-all"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, currentShop: 'Estudio 16' })}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-mono border transition-all cursor-pointer ${
                        form.currentShop === 'Estudio 16'
                          ? 'bg-[#B68F4E]/20 border-[#B68F4E] text-[#B68F4E]'
                          : 'bg-white/5 border-white/10 text-white/60'
                      }`}
                    >
                      Estudio 16
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, currentShop: 'Independiente / Autónomo' })}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-mono border transition-all cursor-pointer ${
                        form.currentShop === 'Independiente / Autónomo'
                          ? 'bg-[#B68F4E]/20 border-[#B68F4E] text-[#B68F4E]'
                          : 'bg-white/5 border-white/10 text-white/60'
                      }`}
                    >
                      Independiente
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[#D9C9B0]/50 font-light">
                Podrás cambiar o agregar barberías después desde tu perfil.
              </p>

              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                transition={SPRING_TOUCH}
                onClick={() => setStep(4)}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-sm tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(217,201,176,0.3)] cursor-pointer"
              >
                Continuar
              </motion.button>
            </motion.div>
          )}

          {/* =========================================================================
              PASO 4: Servicios que ofreces (4.png)
              ========================================================================= */}
          {step === 4 && (
            <motion.div
              key="barber-step-4"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={SPRING_SLIDE}
              className="space-y-5 text-left"
            >
              <div className="space-y-1 text-center sm:text-left">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#B68F4E]">
                  Paso 3 de 5 · Carta de Servicios
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-serif">
                  Servicios que ofreces
                </h1>
                <p className="text-xs text-[#D9C9B0]/70">
                  Puedes configurarlos y editarlos después.
                </p>
              </div>

              {/* Lista táctil de servicios con switches interactivos */}
              <div className="space-y-3">
                {form.services.map((service) => (
                  <div
                    key={service.id}
                    onClick={() => toggleService(service.id)}
                    className={`fade-surface rounded-2xl p-3 sm:p-3.5 flex items-center justify-between border cursor-pointer transition-all ${
                      service.enabled
                        ? 'border-[#B68F4E]/40 bg-[#B68F4E]/5'
                        : 'border-white/10 opacity-60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/10 shrink-0">
                        <img
                          src={service.photo}
                          alt={service.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white tracking-tight">
                          {service.name}
                        </h4>
                        <span className="text-xs font-mono text-[#B68F4E]">
                          {service.priceBs} Bs
                        </span>
                      </div>
                    </div>

                    {/* Switch interactivo */}
                    <div
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                        service.enabled ? 'bg-[#D9C9B0]' : 'bg-neutral-800'
                      }`}
                    >
                      <motion.div
                        layout
                        transition={SPRING_TOUCH}
                        className={`w-4 h-4 rounded-full shadow-md ${
                          service.enabled ? 'bg-black translate-x-5' : 'bg-neutral-400 translate-x-0'
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Formulario para añadir servicio custom */}
              {isAddingService ? (
                <form
                  onSubmit={handleAddCustomService}
                  className="p-4 rounded-2xl bg-white/5 border border-[#B68F4E]/40 space-y-3"
                >
                  <div className="text-xs font-bold text-[#B68F4E]">
                    Nuevo Servicio
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nombre del servicio (ej. Diseño freestyle)"
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-black border border-white/10 text-xs text-white placeholder-white/30"
                    />
                    <input
                      type="number"
                      placeholder="Bs"
                      value={newServicePrice}
                      onChange={(e) => setNewServicePrice(e.target.value)}
                      className="w-20 px-3 py-2 rounded-xl bg-black border border-white/10 text-xs text-white font-mono"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => setIsAddingService(false)}
                      className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-[#B68F4E] text-black text-xs font-bold"
                    >
                      Añadir
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAddingService(true)}
                  className="w-full py-3 rounded-2xl border border-[#B68F4E]/50 bg-black/40 hover:bg-[#B68F4E]/10 text-xs font-semibold text-[#D9C9B0] flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#B68F4E]" />
                  <span>Agregar servicio</span>
                </button>
              )}

              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                transition={SPRING_TOUCH}
                onClick={() => setStep(5)}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-sm tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(217,201,176,0.3)] cursor-pointer"
              >
                Continuar
              </motion.button>
            </motion.div>
          )}

          {/* =========================================================================
              PASO 5: Horario de trabajo (5.png)
              ========================================================================= */}
          {step === 5 && (
            <motion.div
              key="barber-step-5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={SPRING_SLIDE}
              className="space-y-5 text-left"
            >
              <div className="space-y-1 text-center sm:text-left">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#B68F4E]">
                  Paso 4 de 5 · Disponibilidad
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-serif">
                  Horario de trabajo
                </h1>
                <p className="text-xs text-[#D9C9B0]/70">
                  Define tus días y horarios. Podrás modificarlos en cualquier momento.
                </p>
              </div>

              {/* Lista de Días */}
              <div className="space-y-2.5">
                {form.schedule.map((dayItem) => (
                  <div
                    key={dayItem.day}
                    onClick={() => toggleScheduleDay(dayItem.day)}
                    className={`fade-surface rounded-2xl p-3 sm:p-3.5 flex items-center justify-between border cursor-pointer transition-all ${
                      dayItem.enabled
                        ? 'border-white/10 hover:border-[#B68F4E]/30'
                        : 'border-white/5 opacity-50'
                    }`}
                  >
                    <span className="text-sm font-semibold text-white">
                      {dayItem.day}
                    </span>

                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono text-[#D9C9B0]/80">
                        {dayItem.hours}
                      </span>

                      {/* Switch */}
                      <div
                        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
                          dayItem.enabled ? 'bg-[#D9C9B0]' : 'bg-neutral-800'
                        }`}
                      >
                        <motion.div
                          layout
                          transition={SPRING_TOUCH}
                          className={`w-4 h-4 rounded-full shadow-md ${
                            dayItem.enabled ? 'bg-black translate-x-5' : 'bg-neutral-400 translate-x-0'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                transition={SPRING_TOUCH}
                onClick={() => setStep(6)}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-sm tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(217,201,176,0.3)] cursor-pointer"
              >
                Continuar
              </motion.button>
            </motion.div>
          )}

          {/* =========================================================================
              PASO 6: Método de reservas (6.png)
              ========================================================================= */}
          {step === 6 && (
            <motion.div
              key="barber-step-6"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={SPRING_SLIDE}
              className="space-y-6 text-left"
            >
              <div className="space-y-1 text-center sm:text-left">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#B68F4E]">
                  Paso 5 de 5 · Modalidad de Agenda
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-serif">
                  Método de reservas
                </h1>
                <p className="text-xs text-[#D9C9B0]/70">
                  Elige cómo quieres recibir reservas.
                </p>
              </div>

              <div className="space-y-4">
                {/* Opción 1: Confirmación automática */}
                <div
                  onClick={() => setForm({ ...form, reservationMethod: 'automatica' })}
                  className={`fade-surface rounded-3xl p-5 border cursor-pointer transition-all ${
                    form.reservationMethod === 'automatica'
                      ? 'border-2 border-[#B68F4E] bg-[#B68F4E]/10 shadow-[0_0_20px_rgba(182,143,78,0.2)]'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="pt-0.5">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          form.reservationMethod === 'automatica'
                            ? 'border-[#B68F4E]'
                            : 'border-white/30'
                        }`}
                      >
                        {form.reservationMethod === 'automatica' && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#B68F4E]" />
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-white">
                        Confirmación automática
                      </h4>
                      <p className="text-xs text-[#D9C9B0]/70 leading-relaxed font-light">
                        Las reservas se confirman al instante si hay disponibilidad en tu horario.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Opción 2: Confirmación manual */}
                <div
                  onClick={() => setForm({ ...form, reservationMethod: 'manual' })}
                  className={`fade-surface rounded-3xl p-5 border cursor-pointer transition-all ${
                    form.reservationMethod === 'manual'
                      ? 'border-2 border-[#B68F4E] bg-[#B68F4E]/10 shadow-[0_0_20px_rgba(182,143,78,0.2)]'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="pt-0.5">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          form.reservationMethod === 'manual'
                            ? 'border-[#B68F4E]'
                            : 'border-white/30'
                        }`}
                      >
                        {form.reservationMethod === 'manual' && (
                          <div className="w-2.5 h-2.5 rounded-full bg-[#B68F4E]" />
                        )}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-bold text-white">
                        Confirmación manual
                      </h4>
                      <p className="text-xs text-[#D9C9B0]/70 leading-relaxed font-light">
                        Tú revisas y aceptas o rechazas cada solicitud de reserva antes de agendar.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Info pill */}
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 text-[#D9C9B0]/70 text-xs">
                <Info className="w-4 h-4 text-[#B68F4E] shrink-0" />
                <span>Podrás cambiar esta opción en cualquier momento desde tus ajustes.</span>
              </div>

              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                transition={SPRING_TOUCH}
                onClick={() => setStep(7)}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-sm tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(217,201,176,0.3)] cursor-pointer"
              >
                Finalizar
              </motion.button>
            </motion.div>
          )}

          {/* =========================================================================
              PASO 7: Confirmación Final (7.png)
              ========================================================================= */}
          {step === 7 && (
            <motion.div
              key="barber-step-7"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={SPRING_SLIDE}
              className="space-y-6 text-center py-6"
            >
              {/* Checkmark dorado con resplandor */}
              <div className="relative mx-auto w-24 h-24 rounded-full border-2 border-[#B68F4E] flex items-center justify-center shadow-[0_0_40px_rgba(182,143,78,0.4)]">
                <div className="w-20 h-20 rounded-full bg-gradient-to-b from-[#B68F4E]/30 to-transparent flex items-center justify-center">
                  <Check className="w-10 h-10 text-[#B68F4E] stroke-[2.5]" />
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="text-3xl font-bold text-white tracking-tight font-serif">
                  ¡Listo!
                </h1>
                <p className="text-base font-semibold text-[#D9C9B0]">
                  Tu perfil de barbero ha sido creado.
                </p>
                <p className="text-xs text-[#D9C9B0]/70 max-w-xs mx-auto leading-relaxed font-light">
                  Ya puedes gestionar tu agenda, recibir reservas y conectar con nuevos clientes en FADE.
                </p>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-xs text-red-200 text-left">
                  {errorMessage}
                </div>
              )}

              {/* Botón Primario Comenzar */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                transition={SPRING_TOUCH}
                onClick={handleFinish}
                disabled={loading}
                className="w-full py-4 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-sm tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_20px_rgba(217,201,176,0.35)] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Iniciando FADE Pro...</span>
                  </>
                ) : (
                  <span>Comenzar</span>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Branding Sutil */}
      <footer className="relative z-10 w-full max-w-md mx-auto text-center py-2">
        <span className="text-[10px] font-mono text-white/30 uppercase tracking-widest">
          DarkoSync Barber · FADE Pro Edition
        </span>
      </footer>
    </div>
  );
};

export default BarberRegisterWizard;
