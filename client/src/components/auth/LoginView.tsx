import { useState } from 'react';
import type { FC, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Loader2, ArrowRight, Smartphone, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { RoleSelector, type UserRole } from './RoleSelector';
import { EmailPasswordInput } from './EmailPasswordInput';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { loginWithEmailPassword, type LoginResponse } from '../../services/auth.service';
import { SPRING_TOUCH } from '../../constants/springs';

interface LoginViewProps {
  onLoginSuccess: (data: LoginResponse) => void;
  onShowOnboarding: () => void;
  onShowRegister?: () => void;
  initialResetToken?: string;
}

export const LoginView: FC<LoginViewProps> = ({
  onLoginSuccess,
  onShowOnboarding,
  onShowRegister,
  initialResetToken,
}) => {
  const [role, setRole] = useState<UserRole>('barbero');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(Boolean(initialResetToken));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !email.includes('@')) {
      setErrorMessage('Ingresa un correo electrónico válido');
      return;
    }

    if (!password || password.length < 4) {
      setErrorMessage('Ingresa tu contraseña');
      return;
    }

    setLoading(true);

    try {
      const result = await loginWithEmailPassword(email, password, role);
      onLoginSuccess(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Ocurrió un error inesperado al iniciar sesión');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    // Disparador de Google OAuth (se conectará con el cliente Google Identity Services)
    setErrorMessage('Conectando con Google Sign-In...');
  };

  return (
    <div className="relative min-h-screen w-full flex bg-black text-[#F5EBDD] overflow-hidden select-none">
      {/* =========================================================================
          DESKTOP LEFT CANVAS: Arte Cinematográfico de Barbería Vintage (Split-Screen)
          ========================================================================= */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden border-r border-white/10">
        {/* Fotografía de Fondo con Zoom Sutil */}
        <div className="absolute inset-0 z-0">
          <img
            src="/assets/images/desktoplogin.png"
            alt="Sillón de barbero FADE en ambiente vintage"
            className="w-full h-full object-cover object-center filter brightness-90 contrast-105"
          />
          {/* Oclusión Cenital y Viñeta de Lujo */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/30 to-black" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/60" />
        </div>

        {/* Top Header en Canvas Izquierdo */}
        <div className="relative z-10 flex items-center justify-between">
          <BrandLogo variant="full" size="md" />
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-black/50 text-[#D9C9B0] border border-white/10 backdrop-blur-md">
            <ShieldCheck className="w-3.5 h-3.5 text-[#B68F4E]" />
            Acceso Seguro
          </span>
        </div>

        {/* Cita Editorial Central */}
        <div className="relative z-10 max-w-lg space-y-4 my-auto">
          <span className="text-xs uppercase tracking-[0.24em] font-semibold text-[#B68F4E]">
            Artesanía Capilar & Tecnología
          </span>
          <h2 className="font-serif text-4xl xl:text-5xl leading-tight text-white">
            Más que un corte. <br />
            <span className="italic font-serif text-gold-gradient">
              Tu identidad.
            </span>
          </h2>
          <p className="text-sm xl:text-base text-[#D9C9B0]/80 font-light leading-relaxed max-w-md">
            Conectamos a los mejores barberos profesionales con clientes que
            valoran la técnica, la precisión y la constancia de su estilo.
          </p>
        </div>

        {/* Footer Canvas Izquierdo */}
        <div className="relative z-10 flex items-center justify-between text-xs text-[#D9C9B0]/60">
          <span>© 2026 FADE · DarkoSync Barber</span>
          <button
            type="button"
            onClick={onShowOnboarding}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Ver presentación de la app
          </button>
        </div>
      </div>

      {/* =========================================================================
          RIGHT / MOBILE CONTAINER: Tarjeta Flotante Centrada en Thumb-Zone
          ========================================================================= */}
      <div className="w-full lg:w-1/2 min-h-screen relative flex items-center justify-center p-4 sm:p-8 z-10">
        {/* Fondo Móvil Específico (< lg) */}
        <div className="lg:hidden absolute inset-0 z-0">
          <img
            src="/assets/images/movillogin.png"
            alt="Fondo Móvil FADE"
            className="w-full h-full object-cover object-center filter brightness-65 contrast-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/85 to-black/60" />
        </div>

        {/* Tarjeta de Login (Dark Luxury Glass) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={SPRING_TOUCH}
          className="fade-surface relative z-10 w-full max-w-md rounded-3xl p-6 sm:p-8 space-y-6"
        >
          {/* Header de la Tarjeta */}
          <div className="flex flex-col items-center text-center space-y-2">
            <div className="lg:hidden mb-2">
              <BrandLogo variant="full" size="md" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Bienvenido a FADE
            </h1>
            <p className="text-xs text-[#D9C9B0]/70 font-light tracking-wide">
              Ingresa tus credenciales para acceder a tu cuenta
            </p>
          </div>

          {/* Selector de Rol [Soy Barbero ⇄ Soy Cliente] */}
          <div className="space-y-1.5">
            <RoleSelector selectedRole={role} onChange={setRole} />
          </div>

          {/* Mensaje de Error */}
          <AnimatePresence>
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"
              >
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span className="leading-tight">{errorMessage}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Formulario */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <EmailPasswordInput
              email={email}
              password={password}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onForgotPassword={() => setIsForgotPasswordOpen(true)}
              disabled={loading}
            />

            {/* Botón CTA Primario Esculpido */}
            <motion.button
              type="submit"
              disabled={loading}
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              className="fade-btn-primary w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-xs md:text-sm tracking-[0.12em] font-black cursor-pointer shadow-[0_8px_24px_-4px_rgba(217,201,176,0.35)] disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Autenticando...</span>
                </>
              ) : (
                <>
                  <span>Ingresar a FADE</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          {/* Separador Visual */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <span className="relative z-10 bg-[#161616] px-3 text-[10px] tracking-[0.16em] uppercase text-[#D9C9B0]/50">
              o continúa con
            </span>
          </div>

          {/* Botón Google Único Estándar */}
          <div>
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="fade-btn-secondary w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 text-xs font-semibold tracking-wide text-white hover:border-[#B68F4E]/40 hover:bg-white/10 transition-all cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.55 0 2.95.53 4.04 1.58l3.03-3.03C17.23 1.74 14.8 1 12 1 7.42 1 3.51 3.58 1.57 7.34l3.69 2.87C6.14 7.33 8.84 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58l3.71 2.88c2.16-1.99 3.71-4.93 3.71-8.7z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.26 14.79c-.2-.61-.32-1.26-.32-1.93s.12-1.32.32-1.93L1.57 7.34C.57 9.39 0 11.63 0 14s.57 4.61 1.57 6.66l3.69-2.87z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c3.24 0 5.95-1.08 7.93-2.91l-3.71-2.88c-1.07.72-2.45 1.16-4.22 1.16-3.16 0-5.86-2.33-6.74-5.21L1.57 16.03C3.51 19.79 7.42 22.37 12 22.37z"
                />
              </svg>
              <span>Continuar con Google</span>
            </button>
          </div>

          {/* Links y Switch a Presentación */}
          <div className="pt-2 flex flex-col items-center gap-2 text-xs text-[#D9C9B0]/70">
            <p>
              ¿No tienes cuenta?{' '}
              <span
                onClick={onShowRegister}
                className="text-[#B68F4E] font-semibold hover:underline cursor-pointer"
              >
                Crear cuenta
              </span>
            </p>
            <button
              type="button"
              onClick={onShowOnboarding}
              className="flex items-center gap-1.5 text-[11px] text-[#B68F4E]/80 hover:text-[#B68F4E] transition-colors mt-1 cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Ver presentación interactiva</span>
            </button>
          </div>
        </motion.div>
      </div>

      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        initialEmail={email}
        initialToken={initialResetToken}
      />
    </div>
  );
};
