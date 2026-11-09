import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { motion } from 'framer-motion';
import {
  QrCode,
  Download,
  Copy,
  Check,
  Sparkles,
  LogOut,
  Clock,
} from 'lucide-react';
import QRCode from 'qrcode';
import { BrandLogo } from '../common/BrandLogo';
import { SPRING_TOUCH } from '../../constants/springs';
import { presenceService, type BarberPresenceStatus } from '../../services/presence.service';
import type { UserProfile } from '../../services/auth.service';
import { BarberPresenceModal } from './BarberPresenceModal';
import { BarberGrowthCard } from '../barber/BarberGrowthCard';
import { fetchUpcomingBookingAlert, type UpcomingBookingAlert } from '../../services/booking.service';

interface BarberChairStandbyViewProps {
  barber: UserProfile | null;
  onConnectClient: (phone: string) => void;
  onOpenQrModal: () => void;
  onExit?: () => void;
}

export const BarberChairStandbyView: FC<BarberChairStandbyViewProps> = ({
  barber,
  onConnectClient: _onConnectClient,
  onOpenQrModal,
  onExit,
}) => {
  const barberName = barber?.displayName || 'Diego Armando';
  const barberId = barber?.id || 'barber-diego';
  const shopName = 'Fade Studio — Sopocachi';

  const [presenceStatus, setPresenceStatus] = useState<BarberPresenceStatus>('GREEN');
  const [isPresenceModalOpen, setIsPresenceModalOpen] = useState(false);
  const [pendingPresenceStatus, setPendingPresenceStatus] = useState<BarberPresenceStatus | undefined>(undefined);
  const [firstScanCelebration, setFirstScanCelebration] = useState<string | null>(null);
  const [upcomingAlert, setUpcomingAlert] = useState<UpcomingBookingAlert | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://fade.darkosync.com';

  const qrLink = `${baseUrl}/?chair=${encodeURIComponent(
    barberId
  )}&name=${encodeURIComponent(barberName)}&shop=${encodeURIComponent(
    shopName
  )}`;

  useEffect(() => {
    QRCode.toDataURL(qrLink, {
      width: 480,
      margin: 2,
      color: {
        dark: '#050505',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error QR:', err));
  }, [qrLink]);

  useEffect(() => {
    const unsubPresence = presenceService.subscribe((status) => {
      setPresenceStatus(status);
    });

    const unsubHandshake = presenceService.onClientHandshake((client) => {
      if (client.isFirstScan) {
        setFirstScanCelebration(
          `🎉 ¡Nuevo cliente incorporado (${client.displayName || client.phone})! +1 para tu meta de mes gratis.`
        );
        setTimeout(() => setFirstScanCelebration(null), 6000);
      }
    });

    fetchUpcomingBookingAlert().then((res) => setUpcomingAlert(res));

    return () => {
      unsubPresence();
      unsubHandshake();
    };
  }, []);

  const handleStatusChipClick = (newStatus: BarberPresenceStatus) => {
    if (newStatus === 'GREEN') {
      setPresenceStatus('GREEN');
      presenceService.setPresence('GREEN', 0);
    } else {
      setPendingPresenceStatus(newStatus);
      setIsPresenceModalOpen(true);
    }
  };

  const handleOpenPresenceAdjust = () => {
    setPendingPresenceStatus(presenceStatus);
    setIsPresenceModalOpen(true);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-[#F5EBDD] flex flex-col justify-between select-none overflow-x-hidden pb-16">
      {/* Luz Ambiental de Fondo */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full blur-[160px] pointer-events-none opacity-10 -top-20 -right-20 bg-[#B68F4E]"
        aria-hidden="true"
      />
      <div
        className="absolute w-[400px] h-[400px] rounded-full blur-[140px] pointer-events-none opacity-5 top-1/2 -left-20 bg-[#D9C9B0]"
        aria-hidden="true"
      />

      <div className="max-w-md mx-auto w-full px-4 sm:px-6 pt-6 space-y-6 relative z-10">
        {/* =========================================================================
            HEADER: BrandLogo + Perfil del Barbero + Salir
            ========================================================================= */}
        <header className="lg:hidden flex items-center justify-between pt-2">
          <BrandLogo variant="full" size="md" />

          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-xs font-mono transition-colors cursor-pointer"
              aria-label="Salir al perfil"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Mi Cuenta</span>
            </button>
          )}
        </header>

        {/* =========================================================================
            TARJETA DE ESTACIÓN / BARBERO Y SELECTOR DE ESTADO
            ========================================================================= */}
        <div className="fade-surface rounded-3xl p-5 border border-white/10 space-y-4 shadow-xl text-left">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[10px] uppercase tracking-widest font-mono text-[#B68F4E]">
                Estación de Trabajo
              </span>
              <h1 className="text-xl font-bold text-white tracking-tight font-serif">
                {barberName}
              </h1>
              <p className="text-xs text-[#D9C9B0]/70 font-mono">{shopName}</p>
            </div>

            <button
              type="button"
              onClick={handleOpenPresenceAdjust}
              className="flex flex-col items-end gap-1 p-1.5 -mr-1.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
              title="Toca para cambiar estado o fila de espera"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-3 h-3 rounded-full ${
                    presenceStatus === 'GREEN'
                      ? 'bg-emerald-400 shadow-[0_0_12px_#34d399]'
                      : presenceStatus === 'RED'
                      ? 'bg-red-500 shadow-[0_0_12px_#ef4444]'
                      : 'bg-amber-400 shadow-[0_0_12px_#fbbf24]'
                  }`}
                />
                <span className="text-[10px] font-mono uppercase tracking-wider text-[#D9C9B0]/80 group-hover:text-white">
                  {presenceStatus === 'GREEN'
                    ? 'Libre'
                    : presenceStatus === 'RED'
                    ? 'Cortando'
                    : 'En Espera'}
                </span>
              </div>
              <span className="text-[9px] text-[#B68F4E] underline">Ajustar cola</span>
            </button>
          </div>

          {/* Chips de Selección Rápida de Presencia */}
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/60 border border-white/10">
            <button
              type="button"
              onClick={() => handleStatusChipClick('GREEN')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                presenceStatus === 'GREEN'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Disponible</span>
            </button>

            <button
              type="button"
              onClick={() => handleStatusChipClick('YELLOW')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                presenceStatus === 'YELLOW'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>En pausa</span>
            </button>

            <button
              type="button"
              onClick={() => handleStatusChipClick('RED')}
              className={`flex-1 py-1.5 px-2 rounded-xl text-[11px] font-semibold tracking-wide transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                presenceStatus === 'RED'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
              <span>Ocupado</span>
            </button>
          </div>
        </div>

        {/* Banner de Celebración de Primer Escaneo */}
        {firstScanCelebration && (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/80 via-black to-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-bold text-center shadow-[0_0_20px_rgba(52,211,153,0.3)] animate-pulse">
            {firstScanCelebration}
          </div>
        )}

        {/* Alerta de Sinergia Walk-In: Cita Próxima */}
        {upcomingAlert?.hasUpcoming && upcomingAlert.booking && (
          <div className="p-3.5 rounded-2xl bg-amber-950/60 border border-amber-500/50 text-amber-200 text-xs shadow-lg flex items-start gap-2.5 text-left">
            <Clock className="w-4 h-4 text-[#B68F4E] shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold text-white block">
                ⏰ Cita Programada en {upcomingAlert.minutesLeft} min (a las {upcomingAlert.booking.time})
              </span>
              <p className="text-[11px] text-[#D9C9B0]/80 leading-snug">
                Cliente: <strong className="text-white">{upcomingAlert.booking.clientName}</strong> · Servicio:{' '}
                <strong className="text-[#B68F4E]">{upcomingAlert.booking.serviceName}</strong>.
                Tu puesto se reservará preventivamente para no colisionar con clientes espontáneos.
              </p>
            </div>
          </div>
        )}

        {/* Termómetro de Metas: Programa de Crecimiento FADE */}
        <BarberGrowthCard compact />

        {/* =========================================================================
            TARJETA CENTRAL: QR DEL ESPEJO ACTIVO
            ========================================================================= */}
        <div className="fade-surface rounded-3xl p-6 border-2 border-[#B68F4E]/30 text-center space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.8)] relative overflow-hidden">
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-[10px] tracking-[0.2em] font-mono text-[#B68F4E] uppercase">
              <Sparkles className="w-3 h-3 text-[#B68F4E]" />
              <span>Sillón esperando cliente</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight font-serif">
              Tu Código QR de Espejo
            </h2>
            <p className="text-xs text-[#D9C9B0]/80 font-light max-w-xs mx-auto leading-relaxed">
              El cliente debe escanear este código con su celular para transferir su ficha técnica y estilo a tu sillón.
            </p>
          </div>

          {/* Código QR renderizado en vivo */}
          <div className="relative mx-auto w-48 h-48 sm:w-52 sm:h-52 p-3 rounded-2xl bg-white shadow-2xl border-2 border-[#B68F4E]/40 flex items-center justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR de Sillón de ${barberName}`}
                className="w-full h-full object-contain"
              />
            ) : (
              <QrCode className="w-12 h-12 text-black/40 animate-pulse" />
            )}
          </div>

          {/* Acciones del QR */}
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              onClick={onOpenQrModal}
              className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-xs tracking-wide shadow-md cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5 text-black" />
              <span>Descargar para Espejo</span>
            </motion.button>

            <button
              type="button"
              onClick={handleCopyLink}
              className="py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#D9C9B0] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copiar enlace</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <BarberPresenceModal
        isOpen={isPresenceModalOpen}
        onClose={() => {
          setIsPresenceModalOpen(false);
          setPendingPresenceStatus(undefined);
        }}
        barberName={barberName}
        shopName={shopName}
        initialStatus={pendingPresenceStatus}
      />
    </div>
  );
};

export default BarberChairStandbyView;
