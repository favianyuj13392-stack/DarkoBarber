import { useState, useEffect, useCallback } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles, CheckCircle2, Gift, QrCode, ArrowRight, Check, Clock, AlertCircle } from 'lucide-react';
import { SPRING_TOUCH } from '../../constants/springs';
import type { BarberAcquisitionProgress } from '../../services/auth.service';
import { fetchBarberAcquisitions, claimFreeMonthReward } from '../../services/auth.service';

interface BarberGrowthCardProps {
  onRewardClaimed?: () => void;
  compact?: boolean;
}

export const BarberGrowthCard: FC<BarberGrowthCardProps> = ({
  onRewardClaimed,
  compact = false,
}) => {
  const [data, setData] = useState<BarberAcquisitionProgress | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetchBarberAcquisitions();
      setData(res);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'No pudimos cargar tu progreso.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleClaim = async () => {
    setClaiming(true);
    setClaimError(null);
    try {
      const res = await claimFreeMonthReward();
      // The month is credited only after an admin approves the claim.
      setData((prev) => (prev ? { ...prev, claim: res.claim } : prev));
      setToastMsg('Solicitud enviada. Un administrador la revisará antes de acreditar tu mes gratis.');
      setTimeout(() => setToastMsg(null), 5000);
      onRewardClaimed?.();
    } catch (err) {
      setClaimError(err instanceof Error ? err.message : 'No pudimos enviar tu solicitud.');
      // Refresh so the card reflects the real server state (e.g. already claimed).
      void load();
    } finally {
      setClaiming(false);
    }
  };

  if (!data) {
    return (
      <div
        className={`${compact ? 'p-4 rounded-2xl' : 'p-6 rounded-3xl'} bg-black border border-[#B68F4E]/30 text-left text-xs text-[#D9C9B0]/70`}
      >
        {loadError ? (
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2" role="alert">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{loadError}</span>
            </span>
            <button
              type="button"
              onClick={() => void load()}
              className="px-3 py-1.5 rounded-lg border border-white/15 text-white text-[11px] font-semibold cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        ) : (
          <span>Cargando programa de crecimiento...</span>
        )}
      </div>
    );
  }

  const { goal, qualified, pending, remaining, freeMonthsEarned, maxFreeMonths, claim } = data;
  const percentage = Math.min(100, goal > 0 ? Math.round((qualified / goal) * 100) : 0);
  const capReached = maxFreeMonths > 0 && freeMonthsEarned >= maxFreeMonths;
  const breakdown = `${qualified} validados · ${pending} pendientes · ${remaining} faltan`;

  if (compact) {
    return (
      <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/30 via-black to-zinc-950 border border-[#B68F4E]/30 space-y-2 text-left shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-[#B68F4E]" />
            <span className="text-xs font-bold text-white tracking-wide">
              Programa de Crecimiento FADE
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold text-[#B68F4E]">
            {qualified} / {goal} validados
          </span>
        </div>

        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-[#C2AE91] via-[#D9C9B0] to-[#B68F4E] rounded-full shadow-[0_0_10px_rgba(182,143,78,0.5)]"
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-[#D9C9B0]/70 font-mono">
          <span>{breakdown}</span>
          <span className="text-[#B68F4E] font-semibold">
            {claim?.status === 'PENDING' ? 'En revisión' : 'Meta: 1 Mes Gratis'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-[#1C160C]/60 via-black to-zinc-950 border border-[#B68F4E]/40 backdrop-blur-xl space-y-5 text-left relative overflow-hidden shadow-2xl">
      <div
        className="absolute w-72 h-72 rounded-full blur-[100px] pointer-events-none opacity-20 -top-10 -right-10 bg-[#B68F4E]"
        aria-hidden="true"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#B68F4E] flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              <span>Incentivo de Activación FADE</span>
            </span>
            {freeMonthsEarned > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#B68F4E]/20 text-[#D9C9B0] border border-[#B68F4E]/40">
                {freeMonthsEarned} {freeMonthsEarned === 1 ? 'Mes Gratis Aprobado' : 'Meses Gratis Aprobados'}
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
            Programa de Crecimiento & Recompensas
          </h2>
        </div>

        <div className="text-right shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs font-semibold">
            <Gift className="w-3.5 h-3.5 text-[#B68F4E]" />
            <span>Premio: 1 Mes Gratis</span>
          </div>
        </div>
      </div>

      <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 flex items-start gap-3 text-xs text-[#D9C9B0]/80 relative z-10">
        <QrCode className="w-5 h-5 text-[#B68F4E] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium text-white leading-snug">
            ¿Cuándo cuenta un cliente?
          </p>
          <p className="text-[11px] text-[#D9C9B0]/70 leading-relaxed font-light">
            Un cliente queda <strong>pendiente</strong> cuando escanea tu QR en el sillón, y pasa a <strong>validado</strong> cuando verifica su email y usa la app otro día. Solo los validados cuentan para la meta.
          </p>
        </div>
      </div>

      <div className="space-y-3 relative z-10 pt-1">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#D9C9B0] font-semibold">
            Progreso hacia la meta ({percentage}%):
          </span>
          <span className="text-[#B68F4E] font-bold text-sm">
            {qualified} / {goal} Validados
          </span>
        </div>

        <div
          className="relative w-full h-4 rounded-full bg-white/10 overflow-hidden p-0.5 border border-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={goal}
          aria-valuenow={qualified}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-[#B68F4E] via-[#D9C9B0] to-[#F5EBDD] rounded-full shadow-[0_0_15px_rgba(182,143,78,0.7)]"
          />
        </div>

        <p className="text-[11px] font-mono text-[#D9C9B0]/80">{breakdown}</p>
      </div>

      <div className="pt-2 relative z-10 space-y-3">
        {claim?.status === 'PENDING' ? (
          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/40 flex items-start gap-3 text-xs">
            <Clock className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-amber-200 block">Pendiente de aprobación</span>
              <p className="text-[11px] text-amber-100/70">
                Un administrador revisará tu solicitud. El mes gratis se acredita solo cuando sea aprobada.
              </p>
            </div>
          </div>
        ) : claim?.status === 'APPROVED' ? (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex items-start gap-3 text-xs">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-emerald-300 block">Recompensa aprobada</span>
              <p className="text-[11px] text-emerald-200/70">
                Tu mes gratis fue aprobado y acreditado a tu suscripción.
              </p>
            </div>
          </div>
        ) : claim?.status === 'REJECTED' ? (
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/15 flex items-start gap-3 text-xs">
            <AlertCircle className="w-5 h-5 text-[#D9C9B0] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-white block">Solicitud no aprobada</span>
              <p className="text-[11px] text-[#D9C9B0]/70">
                No pudimos aprobar esta recompensa. Si tienes dudas, contacta a soporte.
              </p>
            </div>
          </div>
        ) : claim?.status === 'REVERSED' ? (
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/15 flex items-start gap-3 text-xs">
            <AlertCircle className="w-5 h-5 text-[#D9C9B0] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-white block">Recompensa revertida</span>
              <p className="text-[11px] text-[#D9C9B0]/70">
                Esta recompensa fue revertida tras una revisión. Contacta a soporte para más información.
              </p>
            </div>
          </div>
        ) : data.goalReached && capReached ? (
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/15 flex items-start gap-3 text-xs">
            <Sparkles className="w-5 h-5 text-[#B68F4E] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#D9C9B0]/80">
              Alcanzaste el máximo de {maxFreeMonths} meses gratis disponibles en el programa.
            </p>
          </div>
        ) : data.goalReached ? (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="space-y-0.5 text-center sm:text-left">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 justify-center sm:justify-start">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Alcanzaste la meta de {goal} clientes validados</span>
              </span>
              <p className="text-[11px] text-emerald-200/70">
                Envía tu solicitud. Un administrador la revisará antes de acreditar el mes gratis.
              </p>
            </div>

            <motion.button
              type="button"
              disabled={claiming}
              onClick={handleClaim}
              whileTap={{ scale: 0.96 }}
              transition={SPRING_TOUCH}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-xs tracking-wider uppercase shadow-lg hover:brightness-105 transition-all cursor-pointer whitespace-nowrap disabled:opacity-60"
            >
              {claiming ? 'Enviando...' : 'Reclamar recompensa'}
            </motion.button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/10 text-xs">
            <span className="text-white/60">
              Te faltan <strong className="text-white font-mono">{remaining} clientes validados</strong> para desbloquear tu mes gratis.
            </span>
            <span className="text-[#B68F4E] font-mono font-semibold flex items-center gap-1 shrink-0">
              <span>Sigue escaneando</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        )}

        {claimError && (
          <p role="alert" className="text-[11px] text-red-300 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{claimError}</span>
          </p>
        )}
      </div>

      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="p-3 rounded-xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs font-semibold flex items-center justify-center gap-2 shadow-xl text-center"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
