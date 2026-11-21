import { useState, useEffect, useCallback } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  TrendingUp,
  Clock,
  Scissors,
  Users,
  MessageCircle,
  Mail,
  Sparkles,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import type { UserProfile } from '../../services/auth.service';
import { SPRING_SLIDE } from '../../constants/springs';
import { AnimatedNumber } from '../common/AnimatedNumber';
import {
  fetchFidelityStats,
  fetchDueForCutClients,
  sendDueForCutReminder,
  type FidelityStats,
  type ClientDueForCut,
  type DueForCutResponse,
} from '../../services/fidelity.service';

interface BarberFidelityCardProps {
  barber: UserProfile | null;
  onUpgradeRequested?: () => void;
}

export const BarberFidelityCard: FC<BarberFidelityCardProps> = ({
  barber,
  onUpgradeRequested,
}) => {
  const isPro = barber?.plan === 'PRO';
  const reduceMotion = useReducedMotion();
  const entrance = reduceMotion
    ? { initial: false as const }
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: SPRING_SLIDE,
      };

  const [loading, setLoading] = useState(isPro);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<FidelityStats | null>(null);
  const [dueData, setDueData] = useState<DueForCutResponse | null>(null);
  const [sendingClientId, setSendingClientId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    if (!isPro) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [statsRes, dueRes] = await Promise.all([
        fetchFidelityStats(),
        fetchDueForCutClients(),
      ]);

      if (statsRes.stats) {
        setStats(statsRes.stats);
      }
      setDueData(dueRes);
    } catch (err) {
      console.error('Error loading fidelity data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isPro]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4500);
  };

  const handleSendEmailReminder = async (client: ClientDueForCut) => {
    if (!client.email) {
      showToast('error', `El cliente ${client.clientName} no tiene correo registrado. Usa WhatsApp.`);
      return;
    }

    setSendingClientId(client.clientId);
    try {
      const result = await sendDueForCutReminder(client.clientId);
      if (result.success) {
        showToast('success', result.message || 'Recordatorio enviado por correo.');
        // Refresh quota count
        if (dueData && result.remaining !== undefined) {
          setDueData({
            ...dueData,
            emailQuota: {
              ...dueData.emailQuota,
              remaining: result.remaining,
              sentThisMonth: dueData.emailQuota.monthlyLimit - result.remaining,
            },
          });
        }
      } else {
        showToast('error', result.message || 'No se pudo enviar el correo.');
      }
    } catch {
      showToast('error', 'Error al procesar el recordatorio por email.');
    } finally {
      setSendingClientId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // VISTA 1: PAYWALL TEASER PARA PLAN GRATIS
  // ---------------------------------------------------------------------------
  if (!isPro) {
    return (
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-950/20 via-black to-[#0d0d0d] border border-[#B68F4E]/30 p-6 sm:p-8 backdrop-blur-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#B68F4E]/15 border border-[#B68F4E]/40 flex items-center justify-center text-[#B68F4E]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-[#B68F4E]">Exclusivo Plan Pro</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#B68F4E]/20 text-[#F5EBDD] border border-[#B68F4E]/40 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[#B68F4E]" />
                  ROI Real
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-white">
                Motor de Fidelización & Reactivación
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onUpgradeRequested}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-xs shadow-lg hover:brightness-105 active:scale-95 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            <Sparkles className="w-4 h-4 text-amber-700" />
            <span>Pasar a Plan Pro (Bs 49/mes)</span>
          </button>
        </div>

        <p className="text-xs sm:text-sm text-[#D9C9B0]/80 leading-relaxed">
          Recupera clientes sin perseguirlos manualmente y haz crecer tu facturación mensual con estadísticas reales de recurrencia.
        </p>

        {/* Grid de Beneficios Bloqueados */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <TrendingUp className="w-4 h-4 text-[#B68F4E]" />
              <span>Tasa de Retención de Clientes</span>
            </div>
            <p className="text-[11px] text-[#D9C9B0]/60 leading-normal">
              Descubre cuántos clientes vuelven a tu sillón y cada cuántos días en promedio regresan.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Clock className="w-4 h-4 text-[#B68F4E]" />
              <span>Lista "Ya Toca Corte"</span>
            </div>
            <p className="text-[11px] text-[#D9C9B0]/60 leading-normal">
              Detecta automáticamente qué clientes ya cumplieron su ciclo habitual o llevan más de 21 días sin renovar su corte.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <MessageCircle className="w-4 h-4 text-[#B68F4E]" />
              <span>Reactivación WhatsApp en 1 Clic</span>
            </div>
            <p className="text-[11px] text-[#D9C9B0]/60 leading-normal">
              Mensajes prearmados y respetuosos listos para enviar al WhatsApp del cliente con un solo toque.
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-white">
              <Mail className="w-4 h-4 text-[#B68F4E]" />
              <span>Recordatorios Automáticos por Email</span>
            </div>
            <p className="text-[11px] text-[#D9C9B0]/60 leading-normal">
              Hasta 12 correos mensuales automáticos con diseño Dark Luxury de FADE y tu nombre para reactivar citas.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // VISTA 2: PANEL ACTIVO PRO
  // ---------------------------------------------------------------------------
  const dueClients = dueData?.dueClients || [];
  const quota = dueData?.emailQuota || { sentThisMonth: 0, monthlyLimit: 12, remaining: 12 };

  return (
    <motion.div
      {...entrance}
      className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-[#B68F4E]/30 backdrop-blur-xl space-y-7 relative shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1),0_24px_48px_-16px_rgba(0,0,0,0.9)]"
    >
      {/* Toast Feedback */}
      <AnimatePresence>
        {feedbackMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 border ${
              feedbackMsg.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-red-500/10 text-red-300 border-red-500/30'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            )}
            <span>{feedbackMsg.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-[#B68F4E]">Plan Pro · Fidelización</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#B68F4E]/20 text-[#F5EBDD] border border-[#B68F4E]/40 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#B68F4E]" />
              Motor Activo
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-white mt-0.5">
            Métricas de Fidelidad & Reactivación
          </h2>
          <p className="text-xs text-[#D9C9B0]/70 mt-0.5">
            Monitorea el retorno de tus clientes y reactívalos cuando se cumpla su ciclo habitual de corte.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={refreshing || loading}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 text-xs font-medium transition-all cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#B68F4E]' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 flex flex-col items-center justify-center gap-3 text-white/50">
          <Loader2 className="w-6 h-6 animate-spin text-[#B68F4E]" />
          <span className="text-xs">Cargando métricas de fidelidad...</span>
        </div>
      ) : (
        <>
          {/* 1. KPIs Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* KPI 1: Tasa de Retención */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#D9C9B0]/70 uppercase tracking-wider">
                  Tasa de Retención
                </span>
                <Users className="w-4 h-4 text-[#B68F4E]" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-bold text-white">
                  <AnimatedNumber value={stats?.recurrenceRate ?? 0} suffix="%" />
                </span>
              </div>
              <p className="text-[11px] text-[#D9C9B0]/60">
                <AnimatedNumber value={stats?.recurringClients ?? 0} /> de <AnimatedNumber value={stats?.uniqueClients ?? 0} /> clientes volvieron más de una vez.
              </p>
            </div>

            {/* KPI 2: Ciclo Promedio */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#D9C9B0]/70 uppercase tracking-wider">
                  Ciclo Promedio
                </span>
                <Clock className="w-4 h-4 text-[#B68F4E]" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-mono font-bold text-white">
                  {stats?.averageCycleDays !== null ? (
                    <AnimatedNumber value={stats?.averageCycleDays} suffix=" días" />
                  ) : (
                    '21 días'
                  )}
                </span>
                {stats?.averageCycleDays === null && (
                  <span className="text-[10px] text-white/40">(Estándar)</span>
                )}
              </div>
              <p className="text-[11px] text-[#D9C9B0]/60">
                Frecuencia habitual entre cortes de tus clientes habituales.
              </p>
            </div>

            {/* KPI 3: Cortes Más Solicitados */}
            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#D9C9B0]/70 uppercase tracking-wider">
                  Estilos Frecuentes
                </span>
                <Scissors className="w-4 h-4 text-[#B68F4E]" />
              </div>
              <div className="space-y-1.5 pt-1">
                {stats?.topStyles && stats.topStyles.length > 0 ? (
                  stats.topStyles.map((style, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-white/80 truncate max-w-[140px]">{style.name}</span>
                      <span className="font-mono text-[#B68F4E] font-bold text-[11px]">
                        <AnimatedNumber value={style.count} /> cortes
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-white/40 italic">Registrando datos...</span>
                )}
              </div>
            </div>
          </div>

          {/* 2. Sección de Reactivación: Clientes que ya deberían cortarse */}
          <div className="space-y-4 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-serif font-bold text-white flex items-center gap-2">
                  <span>Clientes que ya deberían cortarse</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#B68F4E]/20 text-[#F5EBDD] border border-[#B68F4E]/40">
                    <AnimatedNumber value={dueClients.length} />
                  </span>
                </h3>
              </div>

              {/* Contador de Cuota de Correos */}
              <div className="text-xs text-[#D9C9B0]/70 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#B68F4E]" />
                <span>
                  Correos disponibles:{' '}
                  <strong className="text-white font-mono">
                    <AnimatedNumber value={quota.remaining} />
                  </strong>{' '}
                  / <AnimatedNumber value={quota.monthlyLimit} /> este mes
                </span>
              </div>
            </div>

            {dueClients.length === 0 ? (
              <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 text-center space-y-2">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h4 className="text-sm font-bold text-white">¡Todos tus clientes están al día!</h4>
                <p className="text-xs text-[#D9C9B0]/60 max-w-md mx-auto">
                  Ninguno de tus clientes ha superado aún su ciclo estimado de corte. En cuanto cumplan sus días habituales (o pasen más de 21 días sin visita), aparecerán aquí para reactivarlos.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {dueClients.map((client) => {
                  const isSendingThis = sendingClientId === client.clientId;

                  return (
                    <div
                      key={client.clientId}
                      className="p-4 rounded-2xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/10 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      {/* Información del Cliente */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-white">{client.clientName}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            {client.daysOverdue > 0
                              ? `+${client.daysOverdue} días de retraso`
                              : 'Toca renovar hoy'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#D9C9B0]/60">
                          <span>
                            Último corte: hace <strong className="text-[#F5EBDD]">{client.daysSinceLastCut} días</strong>
                          </span>
                          <span>·</span>
                          <span>
                            Ciclo habitual: <strong className="text-[#F5EBDD]">{client.averageCycleDays} días</strong>
                          </span>
                          {client.phone && (
                            <>
                              <span>·</span>
                              <span className="font-mono">{client.phone}</span>
                            </>
                          )}
                          {client.email && (
                            <>
                              <span>·</span>
                              <span className="text-[#D9C9B0]/40">{client.email}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Botones de Acción */}
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        {/* Botón WhatsApp */}
                        {client.whatsappUrl ? (
                          <a
                            href={client.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                            <ExternalLink className="w-3 h-3 opacity-70" />
                          </a>
                        ) : (
                          <span className="px-3 py-2 rounded-xl bg-white/5 text-white/40 text-xs">
                            Sin teléfono
                          </span>
                        )}

                        {/* Botón Email */}
                        <button
                          type="button"
                          onClick={() => handleSendEmailReminder(client)}
                          disabled={isSendingThis || !client.email || quota.remaining <= 0}
                          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                            !client.email || quota.remaining <= 0
                              ? 'bg-white/5 border-white/5 text-white/30 cursor-not-allowed'
                              : 'bg-white/10 hover:bg-white/15 text-white border-white/20 hover:border-white/40'
                          }`}
                          title={
                            !client.email
                              ? 'El cliente no tiene correo registrado'
                              : quota.remaining <= 0
                              ? 'Límite mensual de correos alcanzado'
                              : 'Enviar recordatorio elegante por correo electrónico'
                          }
                        >
                          {isSendingThis ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#B68F4E]" />
                          ) : (
                            <Mail className="w-3.5 h-3.5 text-[#B68F4E]" />
                          )}
                          <span>Email</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
};
