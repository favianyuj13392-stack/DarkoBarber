import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { MailCheck, MailWarning } from 'lucide-react';
import {
  fetchEmailVerificationStatus,
  requestEmailVerification,
  type EmailVerificationStatus,
} from '../../services/email-verification.service';

interface EmailVerificationCardProps {
  /** Compact banner: rendered only while the email is not verified. */
  compact?: boolean;
}

type RequestState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'rate-limited'; retryAfterSeconds?: number }
  | { kind: 'no-email' }
  | { kind: 'error' };

export const EmailVerificationCard: FC<EmailVerificationCardProps> = ({ compact = false }) => {
  const [status, setStatus] = useState<EmailVerificationStatus | null>(null);
  const [request, setRequest] = useState<RequestState>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;
    fetchEmailVerificationStatus().then((res) => {
      if (!cancelled) setStatus(res);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRequest = async () => {
    setRequest({ kind: 'sending' });
    const result = await requestEmailVerification();
    if (result.kind === 'already-verified') {
      setStatus((prev) => ({ email: prev?.email ?? null, verified: true }));
      setRequest({ kind: 'idle' });
      return;
    }
    setRequest(result);
  };

  // Unknown status (not signed in or request failed): show nothing rather than guess.
  if (!status) return null;

  if (status.verified) {
    if (compact) return null;
    return (
      <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 flex items-center gap-3 text-xs text-left">
        <MailCheck className="w-5 h-5 text-emerald-400 shrink-0" />
        <span className="text-emerald-200">Tu correo está verificado.</span>
      </div>
    );
  }

  const sending = request.kind === 'sending';

  let feedback: string | null = null;
  if (request.kind === 'sent') {
    feedback = 'Te enviamos un correo con el enlace de verificación. Revisa tu bandeja y spam.';
  } else if (request.kind === 'rate-limited') {
    feedback = request.retryAfterSeconds
      ? `Ya pediste un correo hace poco. Intenta de nuevo en ${request.retryAfterSeconds} segundos.`
      : 'Pediste demasiados correos. Intenta de nuevo más tarde.';
  } else if (request.kind === 'no-email') {
    feedback = 'Tu cuenta no tiene un correo registrado. Agrégalo en tu perfil primero.';
  } else if (request.kind === 'error') {
    feedback = 'No pudimos enviar el correo. Intenta de nuevo en unos minutos.';
  }

  return (
    <div
      className={`${compact ? 'p-3' : 'p-4'} rounded-2xl bg-amber-950/30 border border-amber-500/30 text-xs text-left space-y-2`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <MailWarning className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-amber-200 block">Verifica tu correo</span>
            {!compact && (
              <p className="text-[11px] text-amber-100/70">
                {status.email
                  ? `Confirma ${status.email} para validar tu cuenta.`
                  : 'Agrega y confirma un correo para validar tu cuenta.'}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          disabled={sending}
          onClick={handleRequest}
          className="px-3.5 py-2 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-[11px] cursor-pointer disabled:opacity-50 whitespace-nowrap"
        >
          {sending ? 'Enviando...' : 'Verificar mi correo'}
        </button>
      </div>
      {feedback && (
        <p role="status" className="text-[11px] text-amber-100/80">
          {feedback}
        </p>
      )}
    </div>
  );
};

export default EmailVerificationCard;
