import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Phone,
  ShieldCheck,
  ChevronRight,
  Scissors,
  MapPin,
  Clock,
  FileText,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { SPRING_TOUCH } from '../../constants/springs';
import { getClientHistory, type ClientHistoryResponse } from '../../services/cuts.service';

interface BarberClientHistoryViewProps {
  clientPhone?: string;
  onClose?: () => void;
  onRepeatCut: (selectedCut: ClientHistoryResponse['cuts'][0]) => void;
}

type TabType = 'cortes' | 'notas' | 'preferencias';

export const BarberClientHistoryView: FC<BarberClientHistoryViewProps> = ({
  clientPhone = '+591 712 34567',
  onClose,
  onRepeatCut,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('cortes');
  const [historyData, setHistoryData] = useState<ClientHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const data = await getClientHistory(clientPhone);
      setHistoryData(data);
      setLoading(false);
    }
    loadData();
  }, [clientPhone]);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#B68F4E] animate-spin" />
      </div>
    );
  }

  const client = historyData?.client;
  const cuts = historyData?.cuts || [];
  const latestCut = cuts[0];

  return (
    <div className="relative min-h-screen w-full bg-black text-[#F5EBDD] flex flex-col justify-between select-none overflow-x-hidden pb-24">
      {/* Subtle Ambient Glow */}
      <div 
        className="absolute w-[450px] h-[450px] rounded-full blur-[140px] pointer-events-none opacity-10 -top-20 -right-20 bg-[#B68F4E]"
        aria-hidden="true"
      />

      <div className="max-w-md mx-auto w-full px-4 sm:px-6 pt-6 space-y-6 relative z-10">
        {/* =========================================================================
            HEADER: BrandLogo FADE + Botón Cerrar (X)
            ========================================================================= */}
        <header className="flex items-center justify-between pt-2">
          <BrandLogo variant="full" size="md" />

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
              aria-label="Cerrar vista"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </header>

        {/* Título de Sección */}
        <div className="text-left space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-serif">
            Historial del cliente
          </h1>
        </div>

        {/* =========================================================================
            TARJETA DE CLIENTE VERIFICADO (Avatar, Teléfono, Badge)
            ========================================================================= */}
        {client && (
          <div className="fade-surface rounded-3xl p-5 border border-white/10 flex items-center gap-4 text-left shadow-xl">
            <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden border border-white/10 shrink-0 shadow-lg">
              <img
                src={client.avatarUrl || '/assets/images/1.png'}
                alt={client.displayName}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="space-y-1.5 flex-1 min-w-0">
              <h2 className="text-lg font-bold text-white tracking-tight truncate">
                {client.displayName}
              </h2>

              <div className="flex items-center gap-1.5 text-xs text-[#D9C9B0]/70 font-mono">
                <Phone className="w-3.5 h-3.5 text-[#B68F4E]" />
                <span>{client.phone}</span>
              </div>

              {client.isVerified && (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-[#D9C9B0]">
                  <ShieldCheck className="w-3 h-3 text-[#B68F4E]" />
                  <span>Cliente verificado</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TABS: [Cortes | Notas | Preferencias]
            ========================================================================= */}
        <div className="flex border-b border-white/10">
          {(
            [
              { id: 'cortes', label: 'Cortes' },
              { id: 'notas', label: 'Notas' },
              { id: 'preferencias', label: 'Preferencias' },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex-1 pb-3 text-sm font-semibold tracking-wide transition-colors cursor-pointer ${
                  isActive ? 'text-white' : 'text-[#D9C9B0]/60 hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeHistoryTabUnderline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#D9C9B0] shadow-[0_0_8px_rgba(217,201,176,0.6)]"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* =========================================================================
            CONTENIDO SEGÚN TAB ACTIVO
            ========================================================================= */}
        {activeTab === 'cortes' && (
          <div className="space-y-3 text-left">
            {cuts.map((cut) => (
              <motion.div
                key={cut.id}
                whileTap={{ scale: 0.98 }}
                transition={SPRING_TOUCH}
                onClick={() => onRepeatCut(cut)}
                className="fade-surface rounded-2xl p-3.5 sm:p-4 flex items-center gap-4 cursor-pointer border border-white/10 hover:border-[#B68F4E]/40 transition-all group"
              >
                {/* Thumbnail */}
                <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden border border-white/10 shrink-0">
                  <img
                    src={cut.coverPhoto}
                    alt={cut.styleName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white tracking-tight">
                      {cut.date}
                    </span>
                    {cut.isVerified && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono text-[#D9C9B0]/80 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                        <ShieldCheck className="w-2.5 h-2.5 text-emerald-400" />
                        Verificado
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#D9C9B0]/80 font-medium truncate">
                    {cut.fadeType}
                  </p>

                  <div className="flex items-center gap-2 text-[10px] text-white/50 truncate">
                    <span className="inline-flex items-center gap-1">
                      <Scissors className="w-2.5 h-2.5 text-[#B68F4E]" />
                      {cut.shopName}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5 text-white/40" />
                      {cut.location}
                    </span>
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-white/30 group-hover:text-[#B68F4E] group-hover:translate-x-1 transition-all shrink-0" />
              </motion.div>
            ))}
          </div>
        )}

        {activeTab === 'notas' && (
          <div className="fade-surface rounded-3xl p-5 border border-white/10 text-left space-y-4">
            <div className="flex items-center gap-2 text-[#B68F4E]">
              <FileText className="w-4 h-4" />
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono">
                Notas del cliente y fórmulas previas
              </h3>
            </div>
            <p className="text-sm text-[#D9C9B0] leading-relaxed font-light">
              {client?.notes || 'Sin notas especiales registradas para este cliente.'}
            </p>
          </div>
        )}

        {activeTab === 'preferencias' && (
          <div className="fade-surface rounded-3xl p-5 border border-white/10 text-left space-y-4">
            <div className="flex items-center gap-2 text-[#B68F4E]">
              <Sparkles className="w-4 h-4" />
              <h3 className="text-sm font-bold uppercase tracking-wider font-mono">
                Preferencias Técnicas
              </h3>
            </div>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/60">Terminación de nuca:</span>
                <span className="text-white font-medium">{client?.preferences?.neckline || 'Cuadrada natural'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/60">Textura superior:</span>
                <span className="text-white font-medium">{client?.preferences?.topTexture || 'Texturizado mate'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-white/60">Producto habitual:</span>
                <span className="text-white font-medium">{client?.preferences?.product || 'Polvo de volumen'}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-white/60">Afeitado a navaja:</span>
                <span className="text-white font-medium">{client?.preferences?.razorShave ? 'Autorizado' : 'Solo clipper'}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          BOTÓN FLOTANTE INFERIOR: "Repetir último corte"
          ========================================================================= */}
      {latestCut && (
        <div className="fixed bottom-0 left-0 right-0 z-30 p-4 bg-gradient-to-t from-black via-black/90 to-transparent">
          <div className="max-w-md mx-auto">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              onClick={() => onRepeatCut(latestCut)}
              className="w-full py-4 rounded-full bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-sm tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_6px_25px_rgba(217,201,176,0.35)] cursor-pointer flex items-center justify-center gap-3"
            >
              <Clock className="w-4 h-4 stroke-[2.5]" />
              <span className="h-4 w-[1px] bg-black/20" />
              <span>Repetir último corte</span>
            </motion.button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarberClientHistoryView;
