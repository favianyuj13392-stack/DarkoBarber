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
  Upload,
  Calendar,
  MapPin,
  User,
  ChevronRight,
  Check,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { SPRING_TOUCH, SPRING_SLIDE } from '../../constants/springs';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import type { ClientRegisterState } from '../../types/register';
import { INITIAL_REGISTER_STATE } from '../../types/register';
import { registerClient, loginWithGoogle, type LoginResponse } from '../../services/auth.service';
import { GoogleSignInButton } from '../auth/GoogleSignInButton';

interface ClientRegisterWizardProps {
  initialStep?: number;
  onCancel: () => void;
  onRegisterSuccess: (loginData: LoginResponse) => void;
  onSwitchToBarber?: () => void;
}

const FIELD_LABEL = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D9C9B0]/80 block';
const FIELD_WRAP =
  'flex items-center rounded-2xl bg-white/[0.03] border border-white/10 px-3.5 py-1.5 transition-colors focus-within:border-[#B68F4E]/70 focus-within:ring-2 focus-within:ring-[#B68F4E]/25 focus-within:shadow-[0_0_24px_rgba(182,143,78,0.18)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]';
const FIELD_INPUT =
  'w-full bg-transparent py-2 text-sm text-white placeholder-white/20 focus:outline-none';
const ERROR_BOX =
  'p-3 rounded-xl bg-red-950/40 border border-red-500/30 border-l-2 border-l-[#E85A44] text-red-100 text-xs leading-snug';

export const ClientRegisterWizard: FC<ClientRegisterWizardProps> = ({
  initialStep = 1,
  onCancel,
  onRegisterSuccess,
  onSwitchToBarber,
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
  const [step, setStep] = useState<number>(initialStep);

  useEffect(() => {
    if (initialStep) {
      setStep(initialStep);
    }
  }, [initialStep]);
  const [form, setForm] = useState<ClientRegisterState>(INITIAL_REGISTER_STATE);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registeredSession, setRegisteredSession] = useState<LoginResponse | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

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

  const handleReferencePhotoChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setForm((prev) => ({ ...prev, referencePhotoUrl: url }));
    }
  };

  const toggleCutType = (cutType: string) => {
    setForm((prev) => {
      const exists = prev.selectedCutTypes.includes(cutType);
      return {
        ...prev,
        selectedCutTypes: exists
          ? prev.selectedCutTypes.filter((t) => t !== cutType)
          : [...prev.selectedCutTypes, cutType],
      };
    });
  };

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

  const handleGoogleSuccess = async (credential: string) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const session = await loginWithGoogle(credential, 'cliente');
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

  const handleFinish = async () => {
    if (registeredSession) {
      onRegisterSuccess(registeredSession);
      return;
    }

    if (!form.displayName.trim()) {
      setErrorMessage('Ingresa tu nombre para crear la cuenta');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const session = await registerClient(form.email, form.password, form.displayName);
      setRegisteredSession(session);
      onRegisterSuccess(session);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al registrar la cuenta';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-ambient relative min-h-screen w-full text-[#F5EBDD] flex flex-col justify-between p-4 sm:p-8 select-none overflow-x-hidden">
      {/* Top Header con Botón Atrás y Progreso */}
      <header className="relative z-10 w-full max-w-md mx-auto flex items-center justify-between py-2">
        {step < 6 ? (
          <motion.button
            type="button"
            onClick={handleBack}
            whileHover={hoverMotion}
            whileTap={tapMotion}
            transition={SPRING_TOUCH}
            className="p-2.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-[#D9C9B0] transition-colors cursor-pointer"
            aria-label="Atrás"
          >
            <ArrowLeft className="w-4 h-4" />
          </motion.button>
        ) : (
          <div className="w-9" />
        )}

        <div className="flex items-center gap-1.5">
          <BrandLogo variant="icon" size="sm" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B68F4E]">
            Registro FADE
          </span>
        </div>

        {step < 6 ? (
          <span className="text-[10px] font-mono font-semibold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-[#D9C9B0]/70">
            Paso {step} de 5
          </span>
        ) : (
          <div className="w-9" />
        )}
      </header>

      {/* Progress: spring-driven fill (scaleX) over a static track */}
      {step < 6 && (
        <div
          className="relative z-10 w-full max-w-md mx-auto h-1 rounded-full bg-white/10 overflow-hidden"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={5}
          aria-valuenow={step}
        >
          <motion.div
            className="absolute inset-0 origin-left rounded-full bg-gradient-to-r from-[#B68F4E] to-[#D9C9B0]"
            initial={false}
            animate={{ scaleX: step / 5 }}
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
              key="step-1"
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
                    setForm((prev) => ({ ...prev, role: 'cliente' }));
                    setStep(2);
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
                  onClick={() => {
                    if (onSwitchToBarber) {
                      onSwitchToBarber();
                    } else {
                      setForm((prev) => ({ ...prev, role: 'barbero' }));
                      setStep(2);
                    }
                  }}
                  className="fade-surface rounded-3xl p-5 flex items-center gap-4 cursor-pointer border border-white/10 hover:border-[#B68F4E]/60 transition-colors group shadow-xl"
                >
                  <div className="relative w-20 h-24 rounded-2xl overflow-hidden border border-white/10 shrink-0">
                    <motion.img
                      src="/assets/images/4.png"
                      alt="Barbero FADE"
                      variants={{ hover: { scale: 1.05 } }}
                      transition={SPRING_TOUCH}
                      className="w-full h-full object-cover object-center"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-1.5 left-1.5 p-1 rounded-full bg-black/60 text-[#B68F4E]">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                  </div>

                  <div className="flex-1 space-y-1">
                    <h3 className="text-base font-bold text-white tracking-tight group-hover:text-[#B68F4E] transition-colors">
                      Soy barbero
                    </h3>
                    <p className="text-xs text-[#D9C9B0]/70 leading-relaxed font-light">
                      Gestiona tu agenda, atrae nuevos clientes y haz crecer tu negocio.
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
              </div>
            </motion.div>
          )}

          {/* =========================================================================
              PASO 2: Credenciales Estándar (Correo, Contraseña y Google) - 2.png
              ========================================================================= */}
          {step === 2 && (
            <motion.div
              key="step-2"
              {...fadeStepMotion}
              className="relative"
            >
              {/* Glass layer is a static sibling: it never wraps the Google iframe. */}
              <div
                aria-hidden="true"
                className="fade-surface absolute inset-0 rounded-3xl shadow-2xl pointer-events-none"
              />
              <div className="relative p-6 sm:p-8 space-y-6 text-left">
              <div className="space-y-1 text-center">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Crea tu <span className="font-editorial text-gold-gradient">cuenta</span>
                </h2>
                <p className="text-xs text-[#D9C9B0]/70 font-light">
                  Ingresa tu correo y define una contraseña segura
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
                {/* Correo */}
                <div className="space-y-1.5">
                  <label htmlFor="reg-email" className={FIELD_LABEL}>
                    Correo Electrónico
                  </label>
                  <div className={FIELD_WRAP}>
                    <Mail className="w-4 h-4 text-[#B68F4E] mr-3 shrink-0" />
                    <input
                      id="reg-email"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="ernesto.salinas@ejemplo.com"
                      autoComplete="email"
                      className={FIELD_INPUT}
                    />
                  </div>
                </div>

                {/* Contraseña */}
                <div className="space-y-1.5">
                  <label htmlFor="reg-pass" className={FIELD_LABEL}>
                    Contraseña
                  </label>
                  <div className={FIELD_WRAP}>
                    <Lock className="w-4 h-4 text-[#B68F4E] mr-3 shrink-0" />
                    <input
                      id="reg-pass"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                      className={FIELD_INPUT}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="p-1.5 text-[#D9C9B0]/60 hover:text-[#F5EBDD] transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <motion.button
                  type="submit"
                  whileHover={hoverMotion}
                  whileTap={tapMotion}
                  transition={SPRING_TOUCH}
                  className="fade-btn-primary w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-xs md:text-sm tracking-[0.12em] font-black cursor-pointer shadow-[0_8px_24px_-4px_rgba(217,201,176,0.35)] mt-2"
                >
                  <span>Continuar</span>
                </motion.button>
              </form>

              {/* Separador */}
              <div className="relative flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <span className="relative z-10 bg-[#161616] px-3 text-[10px] tracking-[0.16em] uppercase text-[#D9C9B0]/50">
                  o
                </span>
              </div>

              {/* Google Button */}
              <div>
                <GoogleSignInButton
                  onSuccess={handleGoogleSuccess}
                  onError={(msg) => setErrorMessage(msg)}
                  text="continue_with"
                  shape="rectangular"
                  disabled={loading}
                />
              </div>

              <p className="text-[10px] text-[#D9C9B0]/50 text-center leading-relaxed">
                Al continuar, aceptas nuestros Términos y Condiciones
              </p>
              </div>
            </motion.div>
          )}

          {/* =========================================================================
              PASO 3: Completar Perfil (Avatar, Nombre, Cumpleaños, Ciudad) - 3.png
              ========================================================================= */}
          {step === 3 && (
            <motion.div
              key="step-3"
              {...stepMotion}
              className="fade-surface rounded-3xl p-6 sm:p-8 space-y-6 text-left border border-white/10 shadow-2xl"
            >
              <div className="space-y-1 text-center">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Completa tu <span className="font-editorial text-gold-gradient">perfil</span>
                </h2>
                <p className="text-xs text-[#D9C9B0]/70 font-light">
                  Personaliza tu ficha de cliente en FADE
                </p>
              </div>

              {/* Avatar Selector Circular */}
              <div className="flex flex-col items-center">
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
                  className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[#B68F4E]/50 p-1 cursor-pointer group shadow-[0_0_20px_rgba(182,143,78,0.25)]"
                >
                  <motion.img
                    src={form.avatarUrl || '/assets/images/1.png'}
                    alt="Avatar de cliente"
                    variants={{ hover: { scale: 1.05 } }}
                    transition={SPRING_TOUCH}
                    className="w-full h-full object-cover rounded-full"
                  />
                  <div className="absolute bottom-0 right-0 p-2 rounded-full bg-[#D9C9B0] text-black shadow-lg">
                    <Camera className="w-3.5 h-3.5" />
                  </div>
                </motion.div>
                <span className="text-[10px] text-[#D9C9B0]/60 mt-2">
                  Toca para cambiar foto
                </span>
              </div>

              <div className="space-y-4">
                {/* Nombre */}
                <div className="space-y-1.5">
                  <label htmlFor="prof-name" className={FIELD_LABEL}>
                    Nombre Completo
                  </label>
                  <div className={FIELD_WRAP}>
                    <User className="w-4 h-4 text-[#B68F4E] mr-3 shrink-0" />
                    <input
                      id="prof-name"
                      type="text"
                      value={form.displayName}
                      onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                      placeholder="Ernesto Salinas"
                      className={FIELD_INPUT}
                    />
                  </div>
                </div>

                {/* Fecha de Nacimiento */}
                <div className="space-y-1.5">
                  <label htmlFor="prof-birth" className={FIELD_LABEL}>
                    Fecha de Nacimiento
                  </label>
                  <div className={FIELD_WRAP}>
                    <Calendar className="w-4 h-4 text-[#B68F4E] mr-3 shrink-0" />
                    <input
                      id="prof-birth"
                      type="date"
                      value={form.birthDate}
                      onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                      className={`${FIELD_INPUT} [color-scheme:dark]`}
                    />
                  </div>
                </div>

                {/* Ciudad */}
                <div className="space-y-1.5">
                  <label htmlFor="prof-city" className={FIELD_LABEL}>
                    Ciudad
                  </label>
                  <div className={FIELD_WRAP}>
                    <MapPin className="w-4 h-4 text-[#B68F4E] mr-3 shrink-0" />
                    <input
                      id="prof-city"
                      type="text"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="La Paz"
                      className={FIELD_INPUT}
                    />
                  </div>
                </div>

                <motion.button
                  type="button"
                  onClick={() => setStep(4)}
                  disabled={!form.displayName.trim()}
                  whileHover={hoverMotion}
                  whileTap={tapMotion}
                  transition={SPRING_TOUCH}
                  className="fade-btn-primary w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-xs md:text-sm tracking-[0.12em] font-black cursor-pointer shadow-[0_8px_24px_-4px_rgba(217,201,176,0.35)] mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span>Continuar</span>
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* =========================================================================
              PASO 4: Preferencias Capilares y Rango de Precio - 4.png
              ========================================================================= */}
          {step === 4 && (
            <motion.div
              key="step-4"
              {...stepMotion}
              className="fade-surface rounded-3xl p-6 sm:p-7 space-y-6 text-left border border-white/10 shadow-2xl"
            >
              <div className="space-y-1 text-center">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Tus <span className="font-editorial text-gold-gradient">preferencias</span>
                </h2>
                <p className="text-xs text-[#D9C9B0]/70 font-light">
                  Esto nos ayudará a recomendarte mejores barberos.
                </p>
              </div>

              {/* Tipos de corte con fotos y tags */}
              <div className="space-y-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D9C9B0]/80 block">
                  Tipos de corte que te interesan
                </span>

                {/* Cards con fotos */}
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { name: 'Low Fade', img: '/assets/images/1.png' },
                    { name: 'Mid Fade', img: '/assets/images/3.png' },
                    { name: 'High Fade', img: '/assets/images/4.png' },
                  ].map((item) => {
                    const isSelected = form.selectedCutTypes.includes(item.name);
                    return (
                      <motion.div
                        key={item.name}
                        onClick={() => toggleCutType(item.name)}
                        animate={{ scale: isSelected && !reduceMotion ? 1.02 : 1 }}
                        whileHover={hoverMotion}
                        whileTap={tapMotion}
                        transition={SPRING_TOUCH}
                        className={`relative aspect-[3/4] rounded-2xl overflow-hidden border cursor-pointer transition-colors ${
                          isSelected
                            ? 'border-[#B68F4E] ring-2 ring-[#B68F4E]/40 shadow-[0_0_16px_rgba(182,143,78,0.35)]'
                            : 'border-white/10 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={item.img}
                          alt={item.name}
                          className="w-full h-full object-cover object-center"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />
                        <span className="absolute bottom-2 inset-x-1 text-center text-[10px] font-bold text-white tracking-tight">
                          {item.name}
                        </span>
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 p-1 rounded-full bg-[#B68F4E] text-black">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Tags adicionales */}
                <div className="flex items-center gap-2 pt-1">
                  {['Corte clásico', 'Crop', 'Otro'].map((tag) => {
                    const isSelected = form.selectedCutTypes.includes(tag);
                    return (
                      <motion.button
                        key={tag}
                        type="button"
                        onClick={() => toggleCutType(tag)}
                        whileHover={hoverMotion}
                        whileTap={tapMotion}
                        transition={SPRING_TOUCH}
                        className={`flex-1 py-2 px-2 rounded-xl text-xs font-semibold tracking-wider transition-colors cursor-pointer border ${
                          isSelected
                            ? 'bg-[#B68F4E]/20 border-[#B68F4E] text-white shadow-[0_0_10px_rgba(182,143,78,0.25)]'
                            : 'bg-black/50 border-white/10 text-[#D9C9B0]/70 hover:text-white'
                        }`}
                      >
                        {tag}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Rango de precio por corte */}
              <div className="space-y-3">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D9C9B0]/80 block">
                  Rango de precio por corte
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {['< 50 Bs', '50 - 80 Bs', '80 - 120 Bs', '> 120 Bs'].map((range) => {
                    const isSelected = form.selectedPriceRange === range;
                    return (
                      <motion.button
                        key={range}
                        type="button"
                        onClick={() => setForm({ ...form, selectedPriceRange: range })}
                        whileHover={hoverMotion}
                        whileTap={tapMotion}
                        transition={SPRING_TOUCH}
                        className={`py-2.5 px-1 rounded-xl text-[11px] font-mono font-semibold transition-colors cursor-pointer border ${
                          isSelected
                            ? 'bg-[#B68F4E]/20 border-[#B68F4E] text-[#F5EBDD] shadow-[0_0_12px_rgba(182,143,78,0.3)]'
                            : 'bg-black/50 border-white/10 text-[#D9C9B0]/60 hover:text-white'
                        }`}
                      >
                        {range}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <motion.button
                type="button"
                onClick={() => setStep(5)}
                whileHover={hoverMotion}
                whileTap={tapMotion}
                transition={SPRING_TOUCH}
                className="fade-btn-primary w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-xs md:text-sm tracking-[0.12em] font-black cursor-pointer shadow-[0_8px_24px_-4px_rgba(217,201,176,0.35)] mt-2"
              >
                <span>Continuar</span>
              </motion.button>
            </motion.div>
          )}

          {/* =========================================================================
              PASO 5: Agregar Foto de Referencia (Opcional) - 5.png
              ========================================================================= */}
          {step === 5 && (
            <motion.div
              key="step-5"
              {...stepMotion}
              className="fade-surface rounded-3xl p-6 sm:p-7 space-y-6 text-center border border-white/10 shadow-2xl"
            >
              <div className="space-y-1">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Agrega una <span className="font-editorial text-gold-gradient">foto</span> <span className="text-[#D9C9B0]/60 font-light text-base">(opcional)</span>
                </h2>
                <p className="text-xs text-[#D9C9B0]/70 font-light">
                  Esto ayudará a los barberos a conocerte mejor.
                </p>
              </div>

              {/* Visor Grande de Foto */}
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 shadow-xl mx-auto">
                <img
                  src={form.referencePhotoUrl || '/assets/images/1.png'}
                  alt="Referencia de corte"
                  className="w-full h-full object-cover object-center filter brightness-95"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                <span className="absolute bottom-3 left-3 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full bg-black/60 text-[#D9C9B0] border border-white/10">
                  {form.referencePhotoUrl ? 'Foto Seleccionada' : 'Foto de Muestra'}
                </span>
              </div>

              {/* Input oculto para subir foto */}
              <input
                type="file"
                ref={photoInputRef}
                onChange={handleReferencePhotoChange}
                accept="image/*"
                className="hidden"
              />

              <div className="space-y-3 pt-2">
                <motion.button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  whileHover={hoverMotion}
                  whileTap={tapMotion}
                  transition={SPRING_TOUCH}
                  className="fade-btn-secondary w-full py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2.5 text-xs font-semibold tracking-wider cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-[#B68F4E]" />
                  <span>Tomar foto</span>
                </motion.button>

                <motion.button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  whileHover={hoverMotion}
                  whileTap={tapMotion}
                  transition={SPRING_TOUCH}
                  className="fade-btn-secondary w-full py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2.5 text-xs font-semibold tracking-wider cursor-pointer"
                >
                  <Upload className="w-4 h-4 text-[#B68F4E]" />
                  <span>Subir desde galería</span>
                </motion.button>

                <button
                  type="button"
                  onClick={() => setStep(6)}
                  className="text-xs text-[#D9C9B0]/70 hover:text-white transition-colors pt-2 block mx-auto cursor-pointer"
                >
                  Omitir por ahora
                </button>
              </div>
            </motion.div>
          )}

          {/* =========================================================================
              PASO 6: Confirmación Final (¡Listo!) - 6.png
              ========================================================================= */}
          {step === 6 && (
            <motion.div
              key="step-6"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : SPRING_TOUCH}
              className="fade-surface rounded-3xl p-8 sm:p-10 space-y-8 text-center border border-white/10 shadow-2xl"
            >
              {/* Checkmark Dorado Grande */}
              <div className="flex justify-center">
                <motion.div
                  initial={reduceMotion ? { opacity: 0 } : { scale: 0 }}
                  animate={reduceMotion ? { opacity: 1 } : { scale: 1 }}
                  transition={
                    reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 400, damping: 20 }
                  }
                  className="w-24 h-24 rounded-full border-2 border-[#B68F4E] flex items-center justify-center shadow-[0_0_35px_rgba(182,143,78,0.4)] bg-gradient-to-b from-[#2A2A2A] to-[#121212]"
                >
                  <Check className="w-12 h-12 text-[#B68F4E] stroke-[2.5]" />
                </motion.div>
              </div>

              <div className="space-y-3 max-w-xs mx-auto">
                <h1 className="font-editorial text-3xl sm:text-4xl font-bold text-gold-gradient tracking-tight">
                  ¡Listo!
                </h1>
                <h2 className="text-base sm:text-lg font-bold text-[#F5EBDD]">
                  Tu cuenta de cliente ha sido creada.
                </h2>
                <p className="text-xs sm:text-sm text-[#D9C9B0]/75 leading-relaxed font-light">
                  Ya puedes explorar barberos, reservar tu próxima cita y guardar tu historial de cortes.
                </p>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="p-4 rounded-2xl bg-red-950/50 border border-red-500/40 border-l-2 border-l-[#E85A44] text-red-100 text-xs space-y-2 text-center max-w-sm mx-auto shadow-lg"
                >
                  <p className="leading-snug">{errorMessage}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(2);
                      setErrorMessage(null);
                    }}
                    className="text-[#B68F4E] underline hover:text-white transition-colors cursor-pointer text-[11px] font-semibold block mx-auto"
                  >
                    Modificar correo o contraseña
                  </button>
                </div>
              )}

              <div>
                <motion.button
                  type="button"
                  onClick={handleFinish}
                  disabled={loading}
                  whileHover={hoverMotion}
                  whileTap={tapMotion}
                  transition={SPRING_TOUCH}
                  className="fade-btn-primary w-full py-4 rounded-2xl text-xs md:text-sm tracking-[0.14em] font-black cursor-pointer shadow-[0_10px_30px_rgba(217,201,176,0.35)] uppercase flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Registrando cuenta...</span>
                    </>
                  ) : (
                    <span>Comenzar</span>
                  )}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer Branding */}
      <footer className="relative z-10 w-full text-center py-2 text-[10px] text-[#D9C9B0]/40">
        FADE · Tu historial · Tu estilo
      </footer>
    </div>
  );
};

export default ClientRegisterWizard;
