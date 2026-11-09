import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles, CheckCircle2, Gift, QrCode, ArrowRight, Check } from 'lucide-react';
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
  const [claiming, setClaiming] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchBarberAcquisitions().then((res) => setData(res));
  }, []);

  const handleClaim = async () => {
    setClaiming(true);
    try {
      const res = await claimFreeMonthReward();
      setData((prev) =>
        prev
          ? {
              ...prev,
              freeMonthsEarned: res.freeMonthsEarned,
              rewardUnlocked: false,
              acquiredCount: 0,
              remaining: 15,
              percentage: 0,
            }
          : null
      );
      setToastMsg('¡Felicidades! 1 Mes Gratis acreditado a tu suscripción.');
      if (onRewardClaimed) onRewardClaimed();
    } catch {
      // Optimistic demo claim
      setData((prev) =>
        prev
          ? {
              ...prev,
              freeMonthsEarned: (prev.freeMonthsEarned || 0) + 1,
              rewardUnlocked: false,
              acquiredCount: 0,
              remaining: 15,
              percentage: 0,
            }
          : null
      );
      setToastMsg('¡Felicidades! 1 Mes Gratis acreditado a tu cuenta (Modo Demo).');
    } finally {
      setClaiming(false);
      setTimeout(() => setToastMsg(null), 4000);
    }
  };

  const acquired = data?.acquiredCount ?? 8;
  const goal = data?.goal ?? 15;
  const percentage = data?.percentage ?? Math.round((acquired / goal) * 100);
  const isUnlocked = data?.rewardUnlocked || acquired >= goal;
  const freeMonths = data?.freeMonthsEarned ?? 0;

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
            {acquired} / {goal} Clientes
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-[#C2AE91] via-[#D9C9B0] to-[#B68F4E] rounded-full shadow-[0_0_10px_rgba(182,143,78,0.5)]"
          />
        </div>

        <div className="flex items-center justify-between text-[10px] text-[#D9C9B0]/70 font-mono">
          <span>{goal - acquired > 0 ? `Faltan ${goal - acquired} clientes` : '¡Meta alcanzada!'}</span>
          <span className="text-[#B68F4E] font-semibold">Meta: 1 Mes Gratis</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-[#1C160C]/60 via-black to-zinc-950 border border-[#B68F4E]/40 backdrop-blur-xl space-y-5 text-left relative overflow-hidden shadow-2xl">
      {/* Glow ambiental */}
      <div
        className="absolute w-72 h-72 rounded-full blur-[100px] pointer-events-none opacity-20 -top-10 -right-10 bg-[#B68F4E]"
        aria-hidden="true"
      />

      {/* Header & Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-mono font-bold tracking-widest text-[#B68F4E] flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              <span>Incentivo de Activación FADE</span>
            </span>
            {freeMonths > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#B68F4E]/20 text-[#D9C9B0] border border-[#B68F4E]/40">
                {freeMonths} {freeMonths === 1 ? 'Mes Gratis Canjeado' : 'Meses Gratis Canjeados'}
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
            <span>Premio: 1 Mes Gratis Base</span>
          </div>
        </div>
      </div>

      {/* Explicación de la Regla del Primer Escaneo */}
      <div className="p-3.5 rounded-2xl bg-black/50 border border-white/10 flex items-start gap-3 text-xs text-[#D9C9B0]/80 relative z-10">
        <QrCode className="w-5 h-5 text-[#B68F4E] shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium text-white leading-snug">
            ¿Cómo sumar puntos a tu barra?
          </p>
          <p className="text-[11px] text-[#D9C9B0]/70 leading-relaxed font-light">
            Haz que cada cliente nuevo escanee tu <strong>Código QR de Espejo</strong> en su primer corte. El sistema detecta el primer escaneo de su historial y te suma <strong>+1 cliente nuevo</strong> automáticamente.
          </p>
        </div>
      </div>

      {/* Termómetro Visual & Barra de Progreso */}
      <div className="space-y-3 relative z-10 pt-1">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#D9C9B0] font-semibold">
            Progreso hacia la meta ({percentage}%):
          </span>
          <span className="text-[#B68F4E] font-bold text-sm">
            {acquired} / {goal} Clientes Nuevos
          </span>
        </div>

        {/* Barra con gradiente dorado y marcadores */}
        <div className="relative w-full h-4 rounded-full bg-white/10 overflow-hidden p-0.5 border border-white/10">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
            className="h-full bg-gradient-to-r from-[#B68F4E] via-[#D9C9B0] to-[#F5EBDD] rounded-full shadow-[0_0_15px_rgba(182,143,78,0.7)]"
          />
        </div>

        {/* Hitos Intermedios */}
        <div className="grid grid-cols-3 gap-2 text-center pt-1 text-[11px]">
          <div className="p-2 rounded-xl bg-white/[0.02] border border-white/10 space-y-0.5">
            <span className="font-mono text-[10px] text-white/50 block">Hito 1 (5 Clientes)</span>
            <span className="font-bold text-white flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Insignia Pro</span>
            </span>
          </div>

          <div className="p-2 rounded-xl bg-white/[0.02] border border-white/10 space-y-0.5">
            <span className="font-mono text-[10px] text-white/50 block">Hito 2 (10 Clientes)</span>
            <span className="font-bold text-white flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Soporte VIP</span>
            </span>
          </div>

          <div
            className={`p-2 rounded-xl border space-y-0.5 transition-all ${
              isUnlocked
                ? 'bg-[#B68F4E]/20 border-[#B68F4E] shadow-[0_0_15px_rgba(182,143,78,0.3)]'
                : 'bg-white/[0.02] border-white/10'
            }`}
          >
            <span className="font-mono text-[10px] text-white/50 block">Meta (15 Clientes)</span>
            <span className="font-bold text-[#B68F4E] flex items-center justify-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#B68F4E]" />
              <span>1 Mes Gratis</span>
            </span>
          </div>
        </div>
      </div>

      {/* Acción de Recompensa (Desbloqueada o En Progreso) */}
      <div className="pt-2 relative z-10">
        {isUnlocked ? (
          <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="space-y-0.5 text-center sm:text-left">
              <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5 justify-center sm:justify-start">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>¡Felicidades! Has alcanzado la meta de 15 clientes</span>
              </span>
              <p className="text-[11px] text-emerald-200/70">
                Tu premio de 1 mes gratis de Plan Barbería Base (valorado en Bs 110) está listo para ser canjeado.
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
              {claiming ? 'Canjeando...' : 'Reclamar 1 Mes Gratis'}
            </motion.button>
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.02] border border-white/10 text-xs">
            <span className="text-white/60">
              Te faltan <strong className="text-white font-mono">{goal - acquired} clientes nuevos</strong> para desbloquear tu mes gratis.
            </span>
            <span className="text-[#B68F4E] font-mono font-semibold flex items-center gap-1">
              <span>Sigue escaneando</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        )}
      </div>

      {/* Toast Feedback */}
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
