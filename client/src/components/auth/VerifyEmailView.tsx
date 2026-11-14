import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { confirmEmailVerification } from '../../services/email-verification.service';

interface VerifyEmailViewProps {
  token: string | null;
  onContinue: () => void;
}

type VerifyState = 'loading' | 'success' | 'error';

export const VerifyEmailView: FC<VerifyEmailViewProps> = ({ token, onContinue }) => {
  const [state, setState] = useState<VerifyState>(token ? 'loading' : 'error');

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    confirmEmailVerification(token).then((ok) => {
      if (!cancelled) setState(ok ? 'success' : 'error');
    });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 bg-black">
      <div className="w-full max-w-sm p-8 rounded-3xl bg-white/[0.03] border border-white/10 text-center space-y-5">
        {state === 'loading' && (
          <>
            <Loader2 className="w-10 h-10 text-[#B68F4E] animate-spin mx-auto" />
            <p className="text-sm text-[#D9C9B0]">Verificando tu correo...</p>
          </>
        )}

        {state === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h1 className="text-xl font-serif font-bold text-white">Correo verificado</h1>
            <p className="text-xs text-[#D9C9B0]/70">
              Listo, tu correo quedó confirmado. Ya puedes seguir usando FADE.
            </p>
          </>
        )}

        {state === 'error' && (
          <>
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
            <h1 className="text-xl font-serif font-bold text-white">Enlace no válido</h1>
            <p role="alert" className="text-xs text-[#D9C9B0]/70">
              Este enlace de verificación es inválido o venció. Inicia sesión y solicita uno nuevo desde tu perfil.
            </p>
          </>
        )}

        {state !== 'loading' && (
          <button
            type="button"
            onClick={onContinue}
            className="w-full py-3 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-sm cursor-pointer"
          >
            Continuar
          </button>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailView;
