import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Check,
  MessageCircle,
  Sparkles,
} from 'lucide-react';
import type { UserProfile, SubscriptionInfo } from '../../services/auth.service';
import { fetchBarberSubscription } from '../../services/auth.service';
import { BarberGrowthCard } from './BarberGrowthCard';

interface BarberSubscriptionViewProps {
  barber: UserProfile | null;
  onPlanChanged?: (newPlan: string) => void;
}

const AVAILABLE_PLANS = [
  {
    id: 'GRATIS' as const,
    name: 'Plan Gratis',
    priceBs: 0,
    tagline: 'Prueba el historial y la ficha rápida sin pagar nada',
    features: [
      'QR de espejo personal para tu sillón',
      'Registro de fichas técnicas de clientes',
      'Hasta 30 cortes al mes',
      'Historial privado del cliente (con autorización)',
      'Función “Repetir último corte”',
      'Portafolio privado (solo tú lo ves)',
    ],
  },
  {
    id: 'PRO' as const,
    name: 'Plan Pro',
    priceBs: 49,
    tagline: 'Aparece más, recupera clientes y construye tu marca personal',
    popular: true,
    features: [
      'Aparición en el mapa público y búsquedas',
      'Semáforo en tiempo real visible a clientes',
      'Badge “Pro” + aro distintivo en perfil y mapa',
      'Prioridad en el algoritmo de búsqueda',
      'Notificaciones “Ya toca corte” a clientes',
      'Lista de clientes que ya deberían cortarse',
      'Estadísticas de fidelidad y recurrencia',
      'Portafolio público verificado',
      'Cortes mensuales ilimitados',
      'Hasta 2 fotos destacadas en tu perfil',
    ],
  },
];

export const BarberSubscriptionView: FC<BarberSubscriptionViewProps> = ({
  barber,
}) => {
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchBarberSubscription().then((data) => setSub(data));
  }, [barber]);

  const activePlanId = sub?.plan || (barber?.plan === 'PRO' ? 'PRO' : 'GRATIS');
  const currentPlanMeta =
    AVAILABLE_PLANS.find((p) => p.id === activePlanId) || AVAILABLE_PLANS[0];

  const cutsCount = sub?.monthlyCutsCount || 0;
  const maxCuts: number = sub?.maxCuts ?? (currentPlanMeta.id === 'PRO' ? 9999 : 30);
  const isUnlimited = maxCuts >= 9999;
  const percentage = isUnlimited
    ? 0
    : sub?.percentage || Math.min(100, Math.round((cutsCount / maxCuts) * 100));

  const handleContactForUpgrade = () => {
    const text = encodeURIComponent(
      `Hola, soy el barbero ${barber?.displayName || ''} (ID: ${barber?.id || ''}) y deseo activar mi Plan Pro en FADE.`
    );
    window.open(`https://wa.me/59177212345?text=${text}`, '_blank');
    setToastMsg('Abriendo WhatsApp con soporte para coordinar el alta de tu Plan Pro.');
    setTimeout(() => setToastMsg(null), 4000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-28 lg:pb-16 space-y-6">
      {/* 1. Header */}
      <div className="pb-4 border-b border-white/10">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight flex items-center gap-2.5">
          <span>Suscripción & Cuota Mensual</span>
          <Award className="w-5 h-5 text-[#B68F4E]" />
        </h1>
        <p className="text-xs text-[#D9C9B0]/60 mt-1">
          Monitorea el uso mensual de tu cuenta y gestiona los beneficios de tu plan.
        </p>
      </div>

      {/* 2. Tarjeta Hero de Estado Activo y Consumo */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/15 backdrop-blur-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#B68F4E]">Plan Actual</span>
              {activePlanId === 'PRO' ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#B68F4E]/20 text-[#F5EBDD] border border-[#B68F4E]/40 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#B68F4E]" />
                  Plan Pro Activo · Cortes Ilimitados
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white/70 border border-white/20">
                  Plan Gratis · Hasta 30 cortes/mes
                </span>
              )}
            </div>
            <h2 className="text-2xl font-serif font-bold text-white">{currentPlanMeta.name}</h2>
            <p className="text-xs text-[#D9C9B0]/70">{currentPlanMeta.tagline}</p>
          </div>

          <div className="text-left sm:text-right space-y-1">
            <div className="text-3xl font-mono font-bold text-[#F5EBDD]">
              Bs {currentPlanMeta.priceBs}
              <span className="text-xs font-sans text-white/50 font-normal"> / mes</span>
            </div>
            {activePlanId === 'GRATIS' && (
              <button
                type="button"
                onClick={handleContactForUpgrade}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-xs shadow-lg hover:brightness-105 active:scale-95 transition-all cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Solicitar Plan Pro</span>
              </button>
            )}
          </div>
        </div>

        {/* Termómetro de Cortes del Mes */}
        <div className="space-y-2.5 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white/80">Cortes realizados este mes:</span>
              <span className="font-mono font-bold text-white text-sm">
                {cutsCount} <span className="text-white/50 text-xs">/ {isUnlimited ? 'Ilimitados' : `${maxCuts} máx`}</span>
              </span>
            </div>
            {!isUnlimited && (
              <span className="font-mono text-[#B68F4E] font-bold">{percentage}% consumido</span>
            )}
          </div>

          {!isUnlimited && (
            <div className="w-full h-3 rounded-full bg-white/10 overflow-hidden p-0.5 border border-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${
                  percentage >= 90
                    ? 'bg-gradient-to-r from-red-500 to-amber-500'
                    : 'bg-gradient-to-r from-[#B68F4E] via-[#D9C9B0] to-[#F3E9DC]'
                }`}
              />
            </div>
          )}

          {!isUnlimited && percentage >= 80 && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Estás cerca del límite mensual de 30 cortes de tu Plan Gratis. Pasa a <strong>Plan Pro</strong> para disfrutar de cortes ilimitados y visibilidad en el mapa.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2.5 Programa de Crecimiento FADE & Metas de Adquisición */}
      <BarberGrowthCard />

      {/* 3. Comparativa de Planes */}
      <div className="space-y-4 pt-2">
        <div className="text-xs font-bold uppercase tracking-wider text-white/60">
          Planes Disponibles
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {AVAILABLE_PLANS.map((plan) => {
            const isCurrent = plan.id === activePlanId;

            return (
              <div
                key={plan.id}
                className={`p-6 rounded-3xl border flex flex-col justify-between transition-all relative ${
                  isCurrent
                    ? 'bg-[#B68F4E]/10 border-[#B68F4E] shadow-[0_0_24px_rgba(182,143,78,0.15)]'
                    : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.03]'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#B68F4E] text-black shadow-md">
                    Recomendado
                  </span>
                )}

                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-xl font-serif font-bold text-white">{plan.name}</h3>
                    <p className="text-xs text-[#D9C9B0]/60 leading-snug">{plan.tagline}</p>
                  </div>

                  <div className="text-2xl font-mono font-bold text-[#F5EBDD]">
                    Bs {plan.priceBs}
                    <span className="text-xs font-sans text-white/50 font-normal"> / mes</span>
                  </div>

                  <ul className="space-y-2.5 pt-2 border-t border-white/10 text-xs text-white/80">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-[#B68F4E] shrink-0 mt-0.5" />
                        <span className="text-xs leading-tight">{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6">
                  {isCurrent ? (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 rounded-xl bg-white/10 text-white/60 font-semibold text-xs cursor-default flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Plan Actual</span>
                    </button>
                  ) : plan.id === 'PRO' ? (
                    <button
                      type="button"
                      onClick={handleContactForUpgrade}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-xs shadow-lg hover:brightness-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>Activar Plan Pro</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="w-full py-2.5 rounded-xl bg-white/5 text-white/40 font-semibold text-xs cursor-default flex items-center justify-center gap-1.5"
                    >
                      <span>Incluido</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Toast Notificación */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-zinc-900/95 border border-[#B68F4E]/40 text-[#F5EBDD] text-xs font-semibold backdrop-blur-xl shadow-2xl flex items-center gap-2 text-center"
          >
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
