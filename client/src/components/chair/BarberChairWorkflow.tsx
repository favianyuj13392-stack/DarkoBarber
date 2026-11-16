import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { BarberChairStandbyView } from './BarberChairStandbyView';
import { BarberClientHistoryView } from './BarberClientHistoryView';
import { RepeatCutConfigModal } from './RepeatCutConfigModal';
import { PhotoConsentModal } from './PhotoConsentModal';
import { LoungeWaitingModal } from './LoungeWaitingModal';
import { BarberQrModal } from './BarberQrModal';
import { IncomingClientChairModal } from './IncomingClientChairModal';
import {
  presenceService,
  type BarberPresenceStatus,
  type IncomingClientHandshake,
} from '../../services/presence.service';
import { pollPendingChairSession, respondChairRequest } from '../../services/chair.service';
import { useBackoffPolling } from '../../hooks/useBackoffPolling';
import type { ClientHistoryResponse } from '../../services/cuts.service';
import { getStoredUser } from '../../services/auth.service';

interface BarberChairWorkflowProps {
  onExit?: () => void;
}

export const BarberChairWorkflow: FC<BarberChairWorkflowProps> = ({ onExit }) => {
  const [activeClientPhone, setActiveClientPhone] = useState<string | null>(null);
  const [activeClient, setActiveClient] = useState<IncomingClientHandshake | null>(null);
  const [incomingClient, setIncomingClient] = useState<IncomingClientHandshake | null>(null);
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

  // 1. Presence status (WebSocket) for the status pill.
  useEffect(() => {
    presenceService.connect();
    const unsubPresence = presenceService.subscribe((status) => {
      setPresenceStatus(status);
    });
    return () => {
      unsubPresence();
    };
  }, []);

  // 2. Incoming clients come from the server (works across devices). The poll backs off
  // while idle, pauses on hidden tabs and stops once a client is seated or on unmount.
  useBackoffPolling(
    async () => {
      const client = await pollPendingChairSession();
      if (!client) return false;
      setIncomingClient(client);
      // Lets the standby view show the first-scan celebration.
      presenceService.notifyHandshake(client);
      return true;
    },
    { enabled: !activeClientPhone && !incomingClient, baseMs: 2000, maxMs: 8000 }
  );

  const handleConnectClient = (phone: string, clientInfo?: IncomingClientHandshake) => {
    setActiveClientPhone(phone);
    if (clientInfo) {
      setActiveClient(clientInfo);
    } else {
      setActiveClient({
        displayName: 'Ernesto Salinas',
        phone,
        avatarUrl: '/assets/images/1.png',
      });
    }
    presenceService.setStatus('RED');
  };

  const handleDisconnectClient = () => {
    setActiveClientPhone(null);
    setActiveClient(null);
    presenceService.setStatus('GREEN');
  };

  const handleAcceptIncomingClient = (client: IncomingClientHandshake) => {
    setIncomingClient(null);
    if (client.requestId) void respondChairRequest(client.requestId, 'accept');
    handleConnectClient(client.phone, client);
  };

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
    handleDisconnectClient();
    console.log(`Corte registrado. Espera en sala actualizada: ${waitingCount} clientes.`);
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
      {/* 1. Si no hay cliente activo en el sillón: Pantalla de Standby / Espera */}
      {!activeClientPhone ? (
        <BarberChairStandbyView
          barber={currentUser}
          onConnectClient={handleConnectClient}
          onOpenQrModal={() => setIsQrModalOpen(true)}
          onExit={onExit}
        />
      ) : (
        /* 2. Si hay cliente vinculado: Vista de Historial del Cliente en Sillón */
        <>
          {/* Botón Superior Izquierdo: Liberar Sillón */}
          <div className="fixed top-4 left-4 z-40 flex items-center gap-2 select-none">
            <button
              type="button"
              onClick={handleDisconnectClient}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/80 hover:bg-black border border-white/20 hover:border-white/40 backdrop-blur-md shadow-lg text-[#F5EBDD] text-xs font-semibold cursor-pointer transition-all hover:scale-105 active:scale-95"
              aria-label="Liberar sillón"
            >
              <span>← Liberar sillón</span>
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

          {/* Ficha e Historial del Cliente Conectado */}
          <BarberClientHistoryView
            clientPhone={activeClient?.phone || activeClientPhone || ''}
            clientName={activeClient?.displayName || 'New client'}
            clientAvatar={activeClient?.avatarUrl || '/assets/images/1.png'}
            onClose={handleDisconnectClient}
            onRepeatCut={handleRepeatCut}
          />
        </>
      )}

      {/* Modal Notificación: ¡Nuevo Cliente en Sillón! (Pop-up con Audio/Haptic) */}
      <IncomingClientChairModal
        client={incomingClient}
        onAccept={handleAcceptIncomingClient}
        onDismiss={() => {
          if (incomingClient?.requestId) void respondChairRequest(incomingClient.requestId, 'decline');
          setIncomingClient(null);
        }}
      />

      {/* Modal de Configuración de Chips y Fotos del Corte */}
      <RepeatCutConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onCutFinalized={handleCutFinalized}
        onCapturePhoto={handleCapturePhoto}
        barberName={barberName}
        barberId={barberId}
        clientId={activeClient?.id}
        clientPhone={activeClient?.phone || activeClientPhone || ''}
        clientName={activeClient?.displayName || ''}
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
