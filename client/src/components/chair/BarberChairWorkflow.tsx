import { useState } from 'react';
import type { FC } from 'react';
import { BarberClientHistoryView } from './BarberClientHistoryView';
import { RepeatCutConfigModal } from './RepeatCutConfigModal';
import { PhotoConsentModal } from './PhotoConsentModal';
import { LoungeWaitingModal } from './LoungeWaitingModal';
import { presenceService, type BarberPresenceStatus } from '../../services/presence.service';
import type { ClientHistoryResponse } from '../../services/cuts.service';

interface BarberChairWorkflowProps {
  onExit?: () => void;
}

export const BarberChairWorkflow: FC<BarberChairWorkflowProps> = ({ onExit }) => {
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isPhotoConsentOpen, setIsPhotoConsentOpen] = useState(false);
  const [isLoungeWaitingOpen, setIsLoungeWaitingOpen] = useState(false);
  const [selectedCut, setSelectedCut] = useState<ClientHistoryResponse['cuts'][0] | null>(null);
  const [presenceStatus, setPresenceStatus] = useState<BarberPresenceStatus>('GREEN');

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
    </div>
  );
};

export default BarberChairWorkflow;
