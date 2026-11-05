import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  QrCode as QrIcon,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Check,
  FileText,
  Copy,
  Download,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import type { UserProfile, SubscriptionInfo } from '../../services/auth.service';
import {
  fetchBarberSubscription,
  updateBarberPlan,
} from '../../services/auth.service';

interface BarberSubscriptionViewProps {
  barber: UserProfile | null;
  onPlanChanged?: (newPlan: string) => void;
}

const AVAILABLE_PLANS = [
  {
    id: 'AUTONOMO' as const,
    name: 'Plan Autónomo',
    priceBs: 45,
    tagline: 'Para barberos independientes y comisionistas',
    features: [
      '1 sillón activo en el mapa',
      'Hasta 60 cortes al mes',
      'Semáforo en tiempo real (Verde / Rojo / Amarillo)',
      'Portafolio profesional verificado con chips',
      'QR de espejo imprimible en alta resolución',
      'Ficha técnica de clientes en menos de 20s',
    ],
  },
  {
    id: 'BARBERIA_BASE' as const,
    name: 'Plan Barbería Base',
    priceBs: 110,
    tagline: 'Para locales medianos en crecimiento',
    popular: true,
    features: [
      'Hasta 3 sillones activos',
      'Hasta 200 cortes al mes',
      'Semáforo individual por sillón',
      'Gestión de barberos del salón',
      'Notificaciones y alertas de sala',
      'Reporte de horas muertas y afluencia',
    ],
  },
  {
    id: 'ALTO_FLUJO' as const,
    name: 'Plan Alto Flujo',
    priceBs: 190,
    tagline: 'Para estudios premium y cadenas de alto tráfico',
    features: [
      'Sillones ilimitados',
      'Cortes mensuales ilimitados',
      'Semáforo y métricas avanzadas',
      'Soporte técnico prioritario 24/7',
      'Posicionamiento preferente en el mapa',
      'Facturación corporativa unificada',
    ],
  },
];

export const BarberSubscriptionView: FC<BarberSubscriptionViewProps> = ({
  barber,
  onPlanChanged,
}) => {
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Billing form state
  const [billingName, setBillingName] = useState(barber?.displayName || 'Brian López');
  const [billingDoc, setBillingDoc] = useState('10909536');
  const [updatingPlan, setUpdatingPlan] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchBarberSubscription().then((data) => setSub(data));
  }, [barber]);

  const activePlanId = sub?.plan || barber?.plan || 'AUTONOMO';
  const currentPlanMeta =
    AVAILABLE_PLANS.find((p) => p.id === activePlanId) || AVAILABLE_PLANS[0];

  const qrPayload = `FADE-BOLIVIA|SUBSCRIPTION|PLAN:${activePlanId}|AMOUNT:${currentPlanMeta.priceBs}BS|BARBER:${barber?.id || 'barber-brian'}|TIMESTAMP:${Date.now()}`;

  useEffect(() => {
    if (isQrModalOpen) {
      QRCode.toDataURL(qrPayload, {
        width: 480,
        margin: 2,
        color: {
          dark: '#050505',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'H',
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('Error QR pago:', err));
    }
  }, [isQrModalOpen, qrPayload]);

  const handleSelectPlan = async (planId: 'AUTONOMO' | 'BARBERIA_BASE' | 'ALTO_FLUJO') => {
    if (planId === activePlanId) return;
    setUpdatingPlan(true);
    try {
      const updated = await updateBarberPlan(planId);
      if (updated) setSub(updated);
      if (onPlanChanged) onPlanChanged(planId);
      setToastMsg(`¡Plan actualizado con éxito a ${planId}!`);
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      console.error('Error al actualizar plan:', err);
      setToastMsg('Error al actualizar el plan.');
      setTimeout(() => setToastMsg(null), 3000);
    } finally {
      setUpdatingPlan(false);
    }
  };

  const handleConfirmPayment = () => {
    setIsQrModalOpen(false);
    setToastMsg(`¡Pago de Bs ${currentPlanMeta.priceBs} registrado correctamente! Factura emitida a C.I. ${billingDoc}.`);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const handleCopyQrPayload = async () => {
    try {
      await navigator.clipboard.writeText(qrPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `pago-fade-plan-${activePlanId.toLowerCase()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const cutsCount = sub?.monthlyCutsCount || 1;
  const maxCuts: number =
    sub?.maxCuts ??
    (currentPlanMeta.id === 'BARBERIA_BASE'
      ? 200
      : currentPlanMeta.id === 'ALTO_FLUJO'
      ? 9999
      : 60);
  const percentage = sub?.percentage || Math.min(100, Math.round((cutsCount / maxCuts) * 100));

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-28 lg:pb-16 space-y-6">
      {/* 1. Header */}
      <div className="pb-4 border-b border-white/10">
        <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight flex items-center gap-2.5">
          <span>Suscripción & Cuota Mensual</span>
          <Award className="w-5 h-5 text-[#B68F4E]" />
        </h1>
        <p className="text-xs text-[#D9C9B0]/60 mt-1">
          Gestiona tu plan activo, monitorea los cortes del mes y renueva mediante pago QR bancario en bolivianos.
        </p>
      </div>

      {/* 2. Tarjeta Hero de Estado Activo y Consumo */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/15 backdrop-blur-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-[#B68F4E]">Plan Actual</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Al día · 5 días de gracia
              </span>
            </div>
            <h2 className="text-2xl font-serif font-bold text-white">{currentPlanMeta.name}</h2>
            <p className="text-xs text-[#D9C9B0]/70">{currentPlanMeta.tagline}</p>
          </div>

          <div className="text-left sm:text-right space-y-1">
            <div className="text-3xl font-mono font-bold text-[#F5EBDD]">
              Bs {currentPlanMeta.priceBs}
              <span className="text-xs font-sans text-white/50 font-normal"> / mes</span>
            </div>
            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-xs shadow-lg hover:brightness-105 active:scale-95 transition-all cursor-pointer"
            >
              <QrIcon className="w-4 h-4" />
              <span>Pagar con QR Bancario</span>
            </button>
          </div>
        </div>

        {/* Termómetro de Cortes del Mes */}
        <div className="space-y-2.5 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white/80">Cortes realizados este mes:</span>
              <span className="font-mono font-bold text-white text-sm">
                {cutsCount} <span className="text-white/50 text-xs">/ {maxCuts >= 9999 ? 'Ilimitados' : `${maxCuts} máx`}</span>
              </span>
            </div>
            <span className="font-mono text-[#B68F4E] font-bold">{percentage}% consumido</span>
          </div>

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

          {percentage >= 80 && maxCuts < 9999 && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Estás cerca del límite mensual de tu plan. Considera hacer upgrade a <strong>Plan Barbería Base</strong> para no bloquear nuevas fichas en el sillón (Regla RN-03).
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Comparativa y Selector de Planes (Upgrade / Downgrade) */}
      <div className="space-y-4 pt-2">
        <div className="text-xs font-bold uppercase tracking-wider text-white/60">
          Planes Disponibles para tu Cuenta
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {AVAILABLE_PLANS.map((plan) => {
            const isCurrent = plan.id === activePlanId;

            return (
              <div
                key={plan.id}
                className={`p-5 rounded-3xl border flex flex-col justify-between transition-all relative ${
                  isCurrent
                    ? 'bg-[#B68F4E]/10 border-[#B68F4E] shadow-[0_0_24px_rgba(182,143,78,0.15)]'
                    : 'bg-white/[0.02] border-white/10 hover:border-white/20 hover:bg-white/[0.03]'
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#B68F4E] text-black shadow-md">
                    Más Popular
                  </span>
                )}

                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-serif font-bold text-white">{plan.name}</h3>
                    <p className="text-[11px] text-[#D9C9B0]/60 leading-snug">{plan.tagline}</p>
                  </div>

                  <div className="text-2xl font-mono font-bold text-[#F5EBDD]">
                    Bs {plan.priceBs}
                    <span className="text-xs font-sans text-white/50 font-normal"> / mes</span>
                  </div>

                  <ul className="space-y-2 pt-2 border-t border-white/10 text-xs text-white/80">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-[#B68F4E] shrink-0 mt-0.5" />
                        <span className="text-[11px] leading-tight">{feat}</span>
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
                  ) : (
                    <button
                      type="button"
                      disabled={updatingPlan}
                      onClick={() => handleSelectPlan(plan.id)}
                      className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/15 border border-white/15 text-white font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>Cambiar a este Plan</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. MODAL DE PAGO QR BOLIVIANO */}
      <AnimatePresence>
        {isQrModalOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 backdrop-blur-xl"
            onClick={() => setIsQrModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-md w-full rounded-3xl bg-zinc-950 border border-white/20 p-6 space-y-5 relative shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="text-center space-y-1">
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#B68F4E]">
                  PAGO QR BOLIVIANO (SIMPLE)
                </span>
                <h3 className="text-xl font-serif font-bold text-white">Renovación de Suscripción</h3>
                <p className="text-xs text-[#D9C9B0]/60">
                  {currentPlanMeta.name} · Monto total: <strong className="text-white">Bs {currentPlanMeta.priceBs}.00</strong>
                </p>
              </div>

              {/* QR Container */}
              <div className="p-4 rounded-2xl bg-white flex flex-col items-center justify-center space-y-2 shadow-inner">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Código QR de Pago" className="w-52 h-52 object-contain" />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center text-zinc-400 text-xs">
                    Generando QR...
                  </div>
                )}
                <span className="text-[10px] font-mono font-bold text-zinc-800">
                  Válido para cualquier app bancaria boliviana
                </span>
              </div>

              {/* Acciones de QR */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleDownloadQr}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Guardar PNG</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyQrPayload}
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar datos'}</span>
                </button>
              </div>

              {/* Datos de Facturación */}
              <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2.5 text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-white/80">
                  <FileText className="w-3.5 h-3.5 text-[#B68F4E]" />
                  <span>Datos para Factura Electrónica</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={billingName}
                    onChange={(e) => setBillingName(e.target.value)}
                    placeholder="Razón Social / Nombre"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-[11px] focus:outline-none focus:border-[#B68F4E]"
                  />
                  <input
                    type="text"
                    value={billingDoc}
                    onChange={(e) => setBillingDoc(e.target.value)}
                    placeholder="C.I. / NIT"
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-[11px] focus:outline-none focus:border-[#B68F4E]"
                  />
                </div>
              </div>

              {/* Botón de Confirmación */}
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="w-full py-3 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-xs shadow-xl hover:brightness-105 active:scale-95 transition-all cursor-pointer"
              >
                Confirmar y Registrar Pago (Bs {currentPlanMeta.priceBs}.00)
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notificación */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-amber-950/90 border border-amber-500/40 text-amber-200 text-xs font-semibold backdrop-blur-xl shadow-2xl flex items-center gap-2 text-center"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
