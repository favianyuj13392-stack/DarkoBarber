import { useState, useEffect } from 'react';
import type { FC, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, CheckCircle2, AlertCircle, Loader2, KeyRound, ArrowRight } from 'lucide-react';
import { SPRING_TOUCH } from '../../constants/springs';
import { requestPasswordReset, resetPassword } from '../../services/auth.service';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  initialToken?: string;
  onSuccessLoginPrompt?: () => void;
}

export const ForgotPasswordModal: FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
  initialToken = '',
  onSuccessLoginPrompt,
}) => {
  const [step, setStep] = useState<'REQUEST' | 'RESET' | 'SUCCESS'>('REQUEST');
  const [email, setEmail] = useState(initialEmail);
  const [token, setToken] = useState(initialToken);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialToken) {
      setToken(initialToken);
      setStep('RESET');
    }
  }, [initialToken]);

  useEffect(() => {
    if (initialEmail) {
      setEmail(initialEmail);
    }
  }, [initialEmail]);

  if (!isOpen) return null;

  const handleRequestReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Ingresa un correo electrónico válido');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await requestPasswordReset(email);
      setSuccessMsg(res.message);
      setStep('RESET');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar solicitud');
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteReset = async (e: FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setErrorMsg('Ingresa el código o token de recuperación');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMsg('La nueva contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Las contraseñas no coinciden');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await resetPassword(token, newPassword);
      setSuccessMsg(res.message);
      setStep('SUCCESS');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al restablecer contraseña');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(false);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="absolute inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={SPRING_TOUCH}
          className="relative w-full max-w-md rounded-3xl bg-[#0D0D0D] border border-white/15 p-6 sm:p-7 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(182,143,78,0.15)] space-y-5 text-left overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="text-[10px] uppercase tracking-widest font-mono text-[#B68F4E] font-bold">
                Seguridad de Cuenta
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight font-serif mt-0.5">
                {step === 'REQUEST'
                  ? 'Recuperar Contraseña'
                  : step === 'RESET'
                  ? 'Nueva Contraseña'
                  : '¡Contraseña Actualizada!'}
              </h2>
            </div>

            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && step !== 'SUCCESS' && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* PASO 1: SOLICITAR ENLACE */}
          {step === 'REQUEST' && (
            <form onSubmit={handleRequestReset} className="space-y-4">
              <p className="text-xs text-[#D9C9B0]/70 leading-relaxed">
                Ingresa el correo electrónico asociado a tu cuenta FADE. Te enviaremos un correo con un enlace seguro y un código para que elijas una nueva contraseña.
              </p>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#D9C9B0]/80">
                  Correo Electrónico
                </label>
                <div className="flex items-center rounded-2xl bg-black/60 border border-white/10 px-3.5 py-1.5 focus-within:border-[#B68F4E]/60 transition-all">
                  <Mail className="w-4 h-4 text-[#B68F4E] mr-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu.correo@ejemplo.com"
                    required
                    className="w-full bg-transparent py-2 text-sm text-white placeholder-white/20 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="fade-btn-primary w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold tracking-wider cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enviando correo...</span>
                    </>
                  ) : (
                    <>
                      <span>Enviar Instrucciones</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setStep('RESET')}
                  className="text-xs text-[#B68F4E]/80 hover:text-[#B68F4E] hover:underline cursor-pointer"
                >
                  ¿Ya tienes un código o token? Haz clic aquí
                </button>
              </div>
            </form>
          )}

          {/* PASO 2: INGRESAR TOKEN Y NUEVA CONTRASEÑA */}
          {step === 'RESET' && (
            <form onSubmit={handleExecuteReset} className="space-y-4">
              <p className="text-xs text-[#D9C9B0]/70 leading-relaxed">
                Ingresa el código que te enviamos por correo (revisa también tu carpeta de spam) y define tu nueva contraseña.
              </p>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#D9C9B0]/80">
                  Código o Token
                </label>
                <div className="flex items-center rounded-2xl bg-black/60 border border-white/10 px-3.5 py-1.5 focus-within:border-[#B68F4E]/60 transition-all">
                  <KeyRound className="w-4 h-4 text-[#B68F4E] mr-3" />
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="Código de verificación"
                    required
                    className="w-full bg-transparent py-2 text-sm text-white placeholder-white/20 focus:outline-none font-mono tracking-wider"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#D9C9B0]/80">
                  Nueva Contraseña
                </label>
                <div className="flex items-center rounded-2xl bg-black/60 border border-white/10 px-3.5 py-1.5 focus-within:border-[#B68F4E]/60 transition-all">
                  <Lock className="w-4 h-4 text-[#B68F4E] mr-3" />
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    className="w-full bg-transparent py-2 text-sm text-white placeholder-white/20 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-[#D9C9B0]/80">
                  Confirmar Contraseña
                </label>
                <div className="flex items-center rounded-2xl bg-black/60 border border-white/10 px-3.5 py-1.5 focus-within:border-[#B68F4E]/60 transition-all">
                  <Lock className="w-4 h-4 text-[#B68F4E] mr-3" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    required
                    className="w-full bg-transparent py-2 text-sm text-white placeholder-white/20 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="fade-btn-primary w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold tracking-wider cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Actualizando...</span>
                    </>
                  ) : (
                    <span>Guardar Nueva Contraseña</span>
                  )}
                </button>
              </div>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setStep('REQUEST')}
                  className="text-xs text-white/50 hover:text-white hover:underline cursor-pointer"
                >
                  ← Volver a solicitar código
                </button>
              </div>
            </form>
          )}

          {/* PASO 3: ÉXITO */}
          {step === 'SUCCESS' && (
            <div className="text-center space-y-4 py-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>

              <p className="text-xs text-[#D9C9B0]/80 leading-relaxed max-w-xs mx-auto">
                Tu contraseña ha sido actualizada con éxito. Ya puedes iniciar sesión con tus nuevas credenciales.
              </p>

              <button
                type="button"
                onClick={() => {
                  handleClose();
                  if (onSuccessLoginPrompt) onSuccessLoginPrompt();
                }}
                className="fade-btn-primary w-full py-3.5 rounded-2xl text-xs font-bold tracking-wider cursor-pointer"
              >
                Ir a Iniciar Sesión
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
