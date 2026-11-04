import { useState } from 'react';
import type { FC } from 'react';
import { QrCode } from 'lucide-react';
import { BarberClientHistoryView } from './BarberClientHistoryView';
import { RepeatCutConfigModal } from './RepeatCutConfigModal';
import { PhotoConsentModal } from './PhotoConsentModal';
import { LoungeWaitingModal } from './LoungeWaitingModal';
import { BarberQrModal } from './BarberQrModal';
import { presenceService, type BarberPresenceStatus } from '../../services/presence.service';
import type { ClientHistoryResponse } from '../../services/cuts.service';
import { getStoredUser } from '../../services/auth.service';

interface BarberChairWorkflowProps {
  onExit?: () => void;
}

export const BarberChairWorkflow: FC<BarberChairWorkflowProps> = ({ onExit }) => {
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isPhotoConsentOpen, setIsPhotoConsentOpen] = useState(false);
  const [isLoungeWaitingOpen, setIsLoungeWaitingOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [selectedCut, setSelectedCut] = useState<ClientHistoryResponse['cuts'][0] | null>(null);
  const [presenceStatus, setPresenceStatus] = useState<BarberPresenceStatus>('GREEN');

  const currentUser = getStoredUser();
  const barberName = currentUser?.displayName || 'Diego Armando';
  const barberId = currentUser?.id || 'barber-diego';
  const shopName = 'Fade Studio — Sopocachi';

  // Suscribirse a cambios de presencia
  useState(() => {
    return presenceService.subscribe((status) => {
      setPresenceStatus(status);
    });
  });

  const handleRepeatCut = (cut: ClientHistoryResponse['cuts'][0]) => {
    setSelectedCut(cut);
    setIsConfigModalOpen(true);
  };

  const handleCutFinalized = () => {
    setIsConfigModalOpen(false);
    // Mostrar modal de sala de espera (Micro-Tap)
    setIsLoungeWaitingOpen(true);
  };

  const handleLoungeComplete = (waitingCount: number) => {
    setIsLoungeWaitingOpen(false);
    console.log(`Espera en sala actualizada: ${waitingCount} clientes.`);
  };

  const handleCapturePhoto = () => {
    setIsPhotoConsentOpen(true);
  };

  const handlePhotoConsent = (isPublic: boolean) => {
    setIsPhotoConsentOpen(false);
    console.log(`Consentimiento de foto registrado: isPublic = ${isPublic}`);
  };

  return (
    <div className="relative min-h-screen w-full bg-black">
      {/* Botón Flotante para QR del Espejo */}
      <div className="fixed top-4 left-4 z-40 flex items-center gap-2 select-none">
        <button
          type="button"
          onClick={() => setIsQrModalOpen(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/80 hover:bg-black border border-[#B68F4E]/50 hover:border-[#B68F4E] backdrop-blur-md shadow-[0_4px_12px_rgba(182,143,78,0.25)] text-[#F5EBDD] text-xs font-semibold cursor-pointer transition-all hover:scale-105 active:scale-95"
          aria-label="Abrir código QR del espejo"
        >
          <QrCode className="w-3.5 h-3.5 text-[#B68F4E]" />
          <span>Mi QR del Espejo</span>
        </button>
      </div>

      {/* Barra de Estado de Presencia Flotante */}
      <div className="fixed top-4 right-4 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 border border-white/10 backdrop-blur-md shadow-lg select-none">
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            presenceStatus === 'GREEN'
              ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
              : presenceStatus === 'RED'
              ? 'bg-red-500 shadow-[0_0_8px_#ef4444]'
              : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
          }`}
        />
        <span className="text-[10px] font-mono tracking-wider text-[#D9C9B0] uppercase">
          {presenceStatus === 'GREEN'
            ? 'Disponible (GREEN)'
            : presenceStatus === 'RED'
            ? 'En Sillón (RED)'
            : 'En Espera (YELLOW)'}
        </span>
      </div>

      {/* Vista Principal del Barbero: Historial del Cliente */}
      <BarberClientHistoryView
        clientPhone="+591 712 34567"
        onClose={onExit}
        onRepeatCut={handleRepeatCut}
      />

      {/* Modal de Configuración de Chips y Fotos del Corte */}
      <RepeatCutConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onCutFinalized={handleCutFinalized}
        onCapturePhoto={handleCapturePhoto}
      />

      {/* Modal de Consentimiento de Privacidad de Foto */}
      <PhotoConsentModal
        isOpen={isPhotoConsentOpen}
        photoUrl={selectedCut?.coverPhoto || '/assets/images/1.png'}
        onConsent={handlePhotoConsent}
        onClose={() => setIsPhotoConsentOpen(false)}
      />

      {/* Modal Micro-Tap de Sala de Espera (5 segundos) */}
      <LoungeWaitingModal
        isOpen={isLoungeWaitingOpen}
        onComplete={handleLoungeComplete}
      />

      {/* Modal del Código QR del Espejo (Descargar & Compartir) */}
      <BarberQrModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        barberId={barberId}
        barberName={barberName}
        shopName={shopName}
      />
    </div>
  );
};

export default BarberChairWorkflow;
