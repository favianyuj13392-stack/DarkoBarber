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
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import type {
  BarberRegisterState,
  BarberServiceItem,
} from '../../types/register';
import { INITIAL_BARBER_REGISTER_STATE } from '../../types/register';
import { registerBarber, loginWithGoogle, createBarberService, type LoginResponse } from '../../services/auth.service';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';

interface BarberRegisterWizardProps {
  initialStep?: number;
  onCancel: () => void;
  onRegisterSuccess: (loginData: LoginResponse) => void;
  onSwitchToClient?: () => void;
}

const FIELD_LABEL = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D9C9B0]/80 block';
const FIELD_INPUT =
  'w-full py-3 rounded-2xl bg-white/[0.03] border border-white/10 text-white placeholder-white/50 text-sm focus:outline-none focus:border-[#B68F4E]/70 focus:ring-2 focus:ring-[#B68F4E]/25 focus:shadow-[0_0_24px_rgba(182,143,78,0.18)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-colors';
const MINI_INPUT =
  'px-3 py-2 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white placeholder-white/50 focus:outline-none focus:border-[#B68F4E]/70 focus:ring-2 focus:ring-[#B68F4E]/25 transition-colors';
const ERROR_BOX =
  'p-3 rounded-xl bg-red-950/40 border border-red-500/30 border-l-2 border-l-[#E85A44] text-xs leading-snug text-red-100';
const PRIMARY_BTN =
  'w-full py-3.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-sm tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(217,201,176,0.3)] cursor-pointer';

export const BarberRegisterWizard: FC<BarberRegisterWizardProps> = ({
  initialStep = 1,
  onCancel,
  onRegisterSuccess,
  onSwitchToClient,
}) => {
  const reduceMotion = usePrefersReducedMotion();
  const hoverMotion = reduceMotion ? undefined : { scale: 1.02 };
  const tapMotion = reduceMotion ? undefined : { scale: 0.97 };
  // Step transition: small slide with a spring; opacity-only when reduced.
  const stepMotion = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0 },
      }
    : {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
        transition: SPRING_SLIDE,
      };
  // Opacity-only variant for the step that embeds the Google iframe: no
  // transform/filter/backdrop-filter may sit in the iframe's ancestor chain.
  const fadeStepMotion = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: reduceMotion ? { duration: 0 } : SPRING_SLIDE,
  };
  // Staggered entrance for list rows. Applied on a wrapper that only plays on
  // mount, so the stagger delay never leaks into tap/toggle animations.
  const rowEnter = (index: number) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: reduceMotion ? { duration: 0 } : { ...SPRING_SLIDE, delay: Math.min(index, 8) * 0.04 },
  });
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

    if (!form.password || form.password.length < 8) {
      setErrorMessage('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    setStep(3);
  };

  // Google Real OAuth Login
  const handleGoogleSuccess = async (credential: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const session = await loginWithGoogle(credential, 'barbero');
      setRegisteredSession(session);
      setForm((prev) => ({
        ...prev,
        email: session.user.email || prev.email,
        displayName: session.user.displayName || prev.displayName,
        avatarUrl: session.user.avatarUrl || prev.avatarUrl,
      }));
      setStep(3);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al autenticar con Google';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
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
  // Services are created explicitly from what the barber enabled in step 4; nothing is seeded implicitly.
  const servicesSavedRef = useRef(false);
  const saveChosenServices = async () => {
    if (servicesSavedRef.current) return;
    servicesSavedRef.current = true;
    const chosen = form.services.filter((s) => s.enabled);
    const results = await Promise.allSettled(
      chosen.map((s) => createBarberService({ name: s.name, priceBs: s.priceBs }))
    );
    if (results.some((r) => r.status === 'rejected')) {
      console.warn('Some services could not be saved; the barber can add them from the profile.');
    }
  };

  const handleFinish = async () => {
    if (registeredSession) {
      await saveChosenServices();
      onRegisterSuccess(registeredSession);
      return;
    }

    if (!form.email || !form.password || !form.displayName.trim()) {
      setErrorMessage('Completa tu correo, contraseña y nombre para crear la cuenta');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const session = await registerBarber(form.email, form.password, form.displayName);
      setRegisteredSession(session);
      await saveChosenServices();
      onRegisterSuccess(session);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al crear la cuenta de barbero';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-ambient relative min-h-screen w-full text-[#F5EBDD] flex flex-col justify-between p-4 sm:p-8 select-none overflow-x-hidden">
      {/* Top Header con Botón Atrás y Progreso */}
      <header className="relative z-10 w-full max-w-md mx-auto flex items-center justify-between py-2">
        {step < 7 ? (
          <motion.button
            type="button"
            onClick={handleBack}
            whileHover={hoverMotion}
            whileTap={tapMotion}
            transition={SPRING_TOUCH}
            className="p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-[#D9C9B0] transition-colors cursor-pointer"
            aria-label="Atrás"
          >
            <ArrowLeft className="w-5 h-5" />
          </motion.button>
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

      {/* Progress: spring-driven fill (scaleX) over a static track */}
      {step > 1 && step < 7 && (
        <div
          className="relative z-10 w-full max-w-md mx-auto h-1 rounded-full bg-white/10 overflow-hidden"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={step - 1}
        >
          <motion.div
            className="absolute inset-0 origin-left rounded-full bg-gradient-to-r from-[#B68F4E] to-[#D9C9B0]"
            initial={false}
            animate={{ scaleX: (step - 1) / 5 }}
            transition={reduceMotion ? { duration: 0 } : SPRING_SLIDE}
          />
        </div>
      )}

      {/* Contenedor Central con Transición de Pasos */}
      <main className="relative z-10 w-full max-w-md mx-auto flex-1 flex flex-col justify-center py-4">
        <AnimatePresence mode="wait">
          {/* =========================================================================
              PASO 1: Selección de Rol (¿Cómo quieres usar FADE?) - 1.png
              ========================================================================= */}
          {step === 1 && (
            <motion.div
              key="barber-step-1"
              {...stepMotion}
              className="space-y-6 text-left"
            >
              <div className="space-y-2 text-center sm:text-left">
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-serif">
                  ¿Cómo quieres usar <br />
                  <span className="font-editorial text-gold-gradient font-black">FADE?</span>
                </h1>
                <p className="text-xs sm:text-sm text-[#D9C9B0]/70 leading-relaxed font-light">
                  Puedes cambiar el modo en cualquier momento desde tu perfil.
                </p>
              </div>

              <div className="space-y-4">
                {/* Opción Soy Cliente */}
                <motion.div
                  whileHover={reduceMotion ? undefined : 'hover'}
                  whileTap={tapMotion}
                  transition={SPRING_TOUCH}
                  onClick={() => {
                    if (onSwitchToClient) {
                      onSwitchToClient();
                    } else {
                      onCancel();
                    }
                  }}
                  className="fade-surface rounded-3xl p-5 flex items-center gap-4 cursor-pointer border border-white/10 hover:border-[#B68F4E]/60 transition-colors group shadow-xl"
                >
                  <div className="relative w-20 h-24 rounded-2xl overflow-hidden border border-white/10 shrink-0">
                    <motion.img
                      src="/assets/images/1.png"
                      alt="Cliente FADE"
                      variants={{ hover: { scale: 1.05 } }}
                      transition={SPRING_TOUCH}
                      className="w-full h-full object-cover object-center"
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

                  <motion.span
                    variants={{ hover: { x: 4 } }}
                    transition={SPRING_TOUCH}
                    className="shrink-0 inline-flex"
                  >
                    <ChevronRight className="w-5 h-5 text-white/40 group-hover:text-[#B68F4E] transition-colors" />
                  </motion.span>
                </motion.div>

                {/* Opción Soy Barbero */}
                <motion.div
                  whileHover={reduceMotion ? undefined : 'hover'}
                  whileTap={tapMotion}
                  transition={SPRING_TOUCH}
                  onClick={() => setStep(2)}
                  className="fade-surface rounded-3xl p-5 flex items-center gap-4 cursor-pointer border-2 border-[#B68F4E] bg-[#B68F4E]/5 group shadow-[0_0_25px_rgba(182,143,78,0.25)]"
                >
                  <div className="relative w-20 h-24 rounded-2xl overflow-hidden border border-[#B68F4E]/40 shrink-0">
                    <motion.img
                      src="/assets/images/2.png"
                      alt="Barbero Profesional FADE"
                      variants={{ hover: { scale: 1.05 } }}
                      transition={SPRING_TOUCH}
                      className="w-full h-full object-cover object-center"
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

                  <motion.span
                    variants={{ hover: { x: 4 } }}
                    transition={SPRING_TOUCH}
                    className="shrink-0 inline-flex"
                  >
                    <ChevronRight className="w-5 h-5 text-[#B68F4E]" />
                  </motion.span>
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
              {...fadeStepMotion}
              className="space-y-6 text-left"
            >
              <div className="space-y-1 text-center sm:text-left">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#B68F4E]">
                  Paso 1 de 5 · Acceso Pro
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-serif">
                  Crea tu <span className="font-editorial text-gold-gradient">cuenta</span>
                </h1>
                <p className="text-xs text-[#D9C9B0]/70">
                  Comienza a configurar tu perfil profesional de barbero.
                </p>
              </div>

              {errorMessage && (
                <motion.div
                  role="alert"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduceMotion ? { duration: 0 } : SPRING_TOUCH}
                  className={ERROR_BOX}
                >
                  {errorMessage}
                </motion.div>
              )}

              <form onSubmit={handleStep2Submit} className="space-y-4">
                {/* Email */}
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL}>
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B68F4E]" />
                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="brian.barber@fade.bo"
                      className={`${FIELD_INPUT} pl-10 pr-4`}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL}>
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B68F4E]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Mínimo 8 caracteres"
                      className={`${FIELD_INPUT} pl-10 pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#D9C9B0]/60 hover:text-[#F5EBDD] transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Botón Continuar */}
                <motion.button
                  type="submit"
                  whileHover={hoverMotion}
                whileTap={tapMotion}
                  transition={SPRING_TOUCH}
                  className={`${PRIMARY_BTN} mt-2`}
                >
                  Continuar
                </motion.button>
              </form>

              {/* Separador */}
              <div className="relative flex items-center justify-center">
                <div className="border-t border-white/10 w-full" />
                <span className="bg-[#0A0A0A] px-3 text-[11px] font-mono text-white/65 uppercase">
                  o
                </span>
              </div>

              {/* Botón Google Oficial con Google Identity Services */}
              <div className="pt-1">
                <GoogleSignInButton
                  onSuccess={handleGoogleSuccess}
                  onError={(msg) => setErrorMessage(msg)}
                  text="continue_with"
                  shape="rectangular"
                  disabled={loading}
                />
              </div>

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
              {...stepMotion}
              className="space-y-6 text-left"
            >
              <div className="space-y-1 text-center sm:text-left">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#B68F4E]">
                  Paso 2 de 5 · Identidad
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-serif">
                  Completa tu perfil <span className="font-editorial text-gold-gradient">profesional</span>
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
                <motion.div
                  onClick={() => avatarInputRef.current?.click()}
                  whileHover={reduceMotion ? undefined : 'hover'}
                  whileTap={tapMotion}
                  transition={SPRING_TOUCH}
                  className="relative w-28 h-28 rounded-full border-2 border-[#B68F4E]/60 p-1 cursor-pointer group shadow-[0_0_20px_rgba(182,143,78,0.2)]"
                >
                  <div className="w-full h-full rounded-full overflow-hidden bg-neutral-900 border border-white/10 flex items-center justify-center">
                    {form.avatarUrl ? (
                      <motion.img
                        src={form.avatarUrl}
                        alt="Avatar"
                        variants={{ hover: { scale: 1.05 } }}
                        transition={SPRING_TOUCH}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <motion.img
                        src="/assets/images/3.png"
                        alt="Avatar por defecto"
                        variants={{ hover: { scale: 1.05 } }}
                        transition={SPRING_TOUCH}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  {/* Badge Cámara */}
                  <div className="absolute bottom-0 right-0 p-2 rounded-full bg-gradient-to-b from-[#F3E9DC] to-[#C2AE91] text-black shadow-lg">
                    <Camera className="w-4 h-4" />
                  </div>
                </motion.div>
                <span className="text-[11px] text-[#D9C9B0]/60 mt-2">
                  Toca para cambiar foto de perfil
                </span>
              </div>

              {/* Formulario */}
              <div className="space-y-4">
                {/* Nombre */}
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL}>
                    Nombre completo
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B68F4E]" />
                    <input
                      type="text"
                      value={form.displayName}
                      onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                      placeholder="Brian López"
                      className={`${FIELD_INPUT} pl-10 pr-4`}
                    />
                  </div>
                </div>

                {/* Ciudad */}
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL}>
                    Ciudad
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B68F4E]" />
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="La Paz"
                      className={`${FIELD_INPUT} pl-10 pr-4`}
                    />
                  </div>
                </div>

                {/* Barbería actual */}
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL}>
                    Barbería actual (opcional)
                  </label>
                  <div className="relative">
                    <Store className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B68F4E]" />
                    <input
                      type="text"
                      value={form.currentShop}
                      onChange={(e) => setForm({ ...form, currentShop: e.target.value })}
                      placeholder="Estudio 16 o Autónomo"
                      className={`${FIELD_INPUT} pl-10 pr-4`}
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <motion.button
                      type="button"
                      onClick={() => setForm({ ...form, currentShop: 'Estudio 16' })}
                      whileHover={hoverMotion}
                      whileTap={tapMotion}
                      transition={SPRING_TOUCH}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-mono border transition-colors cursor-pointer ${
                        form.currentShop === 'Estudio 16'
                          ? 'bg-[#B68F4E]/20 border-[#B68F4E] text-[#B68F4E]'
                          : 'bg-white/5 border-white/10 text-white/60'
                      }`}
                    >
                      Estudio 16
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={() => setForm({ ...form, currentShop: 'Independiente / Autónomo' })}
                      whileHover={hoverMotion}
                      whileTap={tapMotion}
                      transition={SPRING_TOUCH}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-mono border transition-colors cursor-pointer ${
                        form.currentShop === 'Independiente / Autónomo'
                          ? 'bg-[#B68F4E]/20 border-[#B68F4E] text-[#B68F4E]'
                          : 'bg-white/5 border-white/10 text-white/60'
                      }`}
                    >
                      Independiente
                    </motion.button>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[#D9C9B0]/50 font-light">
                Podrás cambiar o agregar barberías después desde tu perfil.
              </p>

              <motion.button
                type="button"
                whileHover={hoverMotion}
                whileTap={tapMotion}
                transition={SPRING_TOUCH}
                onClick={() => setStep(4)}
                disabled={!form.displayName.trim()}
                className={`${PRIMARY_BTN} disabled:opacity-40 disabled:cursor-not-allowed`}
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
              {...stepMotion}
              className="space-y-5 text-left"
            >
              <div className="space-y-1 text-center sm:text-left">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#B68F4E]">
                  Paso 3 de 5 · Carta de Servicios
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-serif">
                  Servicios que <span className="font-editorial text-gold-gradient">ofreces</span>
                </h1>
                <p className="text-xs text-[#D9C9B0]/70">
                  Puedes configurarlos y editarlos después.
                </p>
              </div>

              {/* Lista táctil de servicios con switches interactivos */}
              <div className="space-y-3">
                {form.services.map((service, index) => (
                  <motion.div key={service.id} {...rowEnter(index)}>
                  <motion.div
                    onClick={() => toggleService(service.id)}
                    whileTap={tapMotion}
                    transition={SPRING_TOUCH}
                    className={`fade-surface rounded-2xl p-3 sm:p-3.5 flex items-center justify-between border cursor-pointer transition-[opacity,background-color,border-color] ${
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
                        initial={false}
                        animate={{ x: service.enabled ? 20 : 0 }}
                        transition={reduceMotion ? { duration: 0 } : SPRING_TOUCH}
                        className={`w-4 h-4 rounded-full shadow-md ${
                          service.enabled ? 'bg-black' : 'bg-neutral-400'
                        }`}
                      />
                    </div>
                  </motion.div>
                  </motion.div>
                ))}
              </div>

              {/* Formulario para añadir servicio custom */}
              {isAddingService ? (
                <form
                  onSubmit={handleAddCustomService}
                  className="p-4 rounded-2xl bg-white/[0.04] border border-[#B68F4E]/40 space-y-3"
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
                      className={`flex-1 ${MINI_INPUT}`}
                    />
                    <input
                      type="number"
                      placeholder="Bs"
                      value={newServicePrice}
                      onChange={(e) => setNewServicePrice(e.target.value)}
                      className={`w-20 font-mono ${MINI_INPUT}`}
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <motion.button
                      type="button"
                      onClick={() => setIsAddingService(false)}
                      whileTap={tapMotion}
                      transition={SPRING_TOUCH}
                      className="px-3 py-1.5 rounded-lg text-xs text-white/50 hover:text-white transition-colors cursor-pointer"
                    >
                      Cancelar
                    </motion.button>
                    <motion.button
                      type="submit"
                      whileHover={hoverMotion}
                      whileTap={tapMotion}
                      transition={SPRING_TOUCH}
                      className="px-4 py-1.5 rounded-lg bg-[#B68F4E] text-black text-xs font-bold cursor-pointer"
                    >
                      Añadir
                    </motion.button>
                  </div>
                </form>
              ) : (
                <motion.button
                  type="button"
                  onClick={() => setIsAddingService(true)}
                  whileHover={hoverMotion}
                  whileTap={tapMotion}
                  transition={SPRING_TOUCH}
                  className="w-full py-3 rounded-2xl border border-[#B68F4E]/50 bg-black/40 hover:bg-[#B68F4E]/10 text-xs font-semibold text-[#D9C9B0] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-[#B68F4E]" />
                  <span>Agregar servicio</span>
                </motion.button>
              )}

              <motion.button
                type="button"
                whileHover={hoverMotion}
                whileTap={tapMotion}
                transition={SPRING_TOUCH}
                onClick={() => setStep(5)}
                className={PRIMARY_BTN}
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
              {...stepMotion}
              className="space-y-5 text-left"
            >
              <div className="space-y-1 text-center sm:text-left">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#B68F4E]">
                  Paso 4 de 5 · Disponibilidad
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-serif">
                  Horario de <span className="font-editorial text-gold-gradient">trabajo</span>
                </h1>
                <p className="text-xs text-[#D9C9B0]/70">
                  Define tus días y horarios. Podrás modificarlos en cualquier momento.
                </p>
              </div>

              {/* Lista de Días */}
              <div className="space-y-2.5">
                {form.schedule.map((dayItem, index) => (
                  <motion.div key={dayItem.day} {...rowEnter(index)}>
                  <motion.div
                    onClick={() => toggleScheduleDay(dayItem.day)}
                    whileTap={tapMotion}
                    transition={SPRING_TOUCH}
                    className={`fade-surface rounded-2xl p-3 sm:p-3.5 flex items-center justify-between border cursor-pointer transition-[opacity,background-color,border-color] ${
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
                          initial={false}
                          animate={{ x: dayItem.enabled ? 20 : 0 }}
                          transition={reduceMotion ? { duration: 0 } : SPRING_TOUCH}
                          className={`w-4 h-4 rounded-full shadow-md ${
                            dayItem.enabled ? 'bg-black' : 'bg-neutral-400'
                          }`}
                        />
                      </div>
                    </div>
                  </motion.div>
                  </motion.div>
                ))}
              </div>

              <motion.button
                type="button"
                whileHover={hoverMotion}
                whileTap={tapMotion}
                transition={SPRING_TOUCH}
                onClick={() => setStep(6)}
                className={PRIMARY_BTN}
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
              {...stepMotion}
              className="space-y-6 text-left"
            >
              <div className="space-y-1 text-center sm:text-left">
                <span className="text-[11px] font-mono uppercase tracking-widest text-[#B68F4E]">
                  Paso 5 de 5 · Modalidad de Agenda
                </span>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight font-serif">
                  Método de <span className="font-editorial text-gold-gradient">reservas</span>
                </h1>
                <p className="text-xs text-[#D9C9B0]/70">
                  Elige cómo quieres recibir reservas.
                </p>
              </div>

              <div className="space-y-4">
                {/* Opción 1: Confirmación automática */}
                <motion.div
                  onClick={() => setForm({ ...form, reservationMethod: 'automatica' })}
                  whileTap={tapMotion}
                  transition={SPRING_TOUCH}
                  className={`fade-surface rounded-3xl p-5 border cursor-pointer transition-colors ${
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
                </motion.div>

                {/* Opción 2: Confirmación manual */}
                <motion.div
                  onClick={() => setForm({ ...form, reservationMethod: 'manual' })}
                  whileTap={tapMotion}
                  transition={SPRING_TOUCH}
                  className={`fade-surface rounded-3xl p-5 border cursor-pointer transition-colors ${
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
                </motion.div>
              </div>

              {/* Info pill */}
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/10 text-[#D9C9B0]/70 text-xs">
                <Info className="w-4 h-4 text-[#B68F4E] shrink-0" />
                <span>Podrás cambiar esta opción en cualquier momento desde tus ajustes.</span>
              </div>

              <motion.button
                type="button"
                whileHover={hoverMotion}
                whileTap={tapMotion}
                transition={SPRING_TOUCH}
                onClick={() => setStep(7)}
                className={PRIMARY_BTN}
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
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : SPRING_SLIDE}
              className="space-y-6 text-center py-6"
            >
              {/* Checkmark dorado con resplandor */}
              <div className="relative mx-auto w-24 h-24 rounded-full border-2 border-[#B68F4E] flex items-center justify-center shadow-[0_0_40px_rgba(182,143,78,0.4)]">
                <div className="w-20 h-20 rounded-full bg-gradient-to-b from-[#B68F4E]/30 to-transparent flex items-center justify-center">
                  <Check className="w-10 h-10 text-[#B68F4E] stroke-[2.5]" />
                </div>
              </div>

              <div className="space-y-2">
                <h1 className="font-editorial text-3xl font-bold text-gold-gradient tracking-tight">
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
                <div role="alert" className={`${ERROR_BOX} text-left`}>
                  {errorMessage}
                </div>
              )}

              {/* Botón Primario Comenzar */}
              <motion.button
                type="button"
                whileHover={hoverMotion}
                whileTap={tapMotion}
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
