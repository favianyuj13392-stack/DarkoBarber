import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { BarberNavBar, type BarberNavTab } from '../common/BarberNavBar';
import { BarberChairWorkflow } from '../chair/BarberChairWorkflow';
import { BarberProfileView } from './BarberProfileView';
import { BarberLocationView } from './BarberLocationView';
import { BarberSubscriptionView } from './BarberSubscriptionView';
import { BarberBookingsView } from './BarberBookingsView';
import {
  presenceService,
  type BarberPresenceStatus,
} from '../../services/presence.service';
import {
  getStoredUser,
  fetchBarberProfile,
  type UserProfile,
} from '../../services/auth.service';

interface BarberHubCoordinatorProps {
  onExit?: () => void;
  onLogout?: () => void;
}

export const BarberHubCoordinator: FC<BarberHubCoordinatorProps> = ({
  onExit,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<BarberNavTab>('sillon');
  const [barberProfile, setBarberProfile] = useState<UserProfile | null>(getStoredUser());
  const [presenceStatus, setPresenceStatus] = useState<BarberPresenceStatus>('GREEN');

  useEffect(() => {
    fetchBarberProfile().then((profile) => {
      if (profile) setBarberProfile(profile);
    });

    const unsub = presenceService.subscribe((status) => {
      setPresenceStatus(status);
    });

    return () => unsub();
  }, []);

  return (
    <div className="relative min-h-screen w-full bg-black text-[#F5EBDD] select-none overflow-x-hidden">
      {/* Background Subtle Ambient Lighting */}
      <div
        className="absolute w-[500px] h-[500px] rounded-full blur-[160px] pointer-events-none opacity-10 -top-20 -right-20 bg-[#B68F4E]"
        aria-hidden="true"
      />

      {/* Barra de Navegación del Barbero (Desktop Top Bar / Mobile Bottom Bar) */}
      <BarberNavBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={onLogout}
        barberName={barberProfile?.displayName || 'Barbero'}
        avatarUrl={barberProfile?.avatarUrl}
        presenceStatus={presenceStatus}
      />

      {/* 1. TAB SILLÓN (Estación Operativa de Trabajo - Preservada 100%) */}
      {activeTab === 'sillon' && (
        <div className="pb-24 lg:pb-12">
          <BarberChairWorkflow onExit={onExit} />
        </div>
      )}

      {/* 1.5 TAB CITAS & AGENDA PROGRAMADA */}
      {activeTab === 'citas' && (
        <div className="pt-2 lg:pt-4 pb-24 lg:pb-12">
          <BarberBookingsView />
        </div>
      )}

      {/* 2. TAB MI PERFIL & PORTAFOLIO (Estilo LinkedIn Profesional) */}
      {activeTab === 'perfil' && (
        <div className="pt-2 lg:pt-4 pb-24 lg:pb-12">
          <BarberProfileView
            barber={barberProfile}
            onProfileUpdated={(updated) => setBarberProfile(updated)}
          />
        </div>
      )}

      {/* 3. TAB MI BARBERÍA & UBICACIÓN EN MAPA */}
      {activeTab === 'barberia' && (
        <div className="pt-2 lg:pt-4 pb-24 lg:pb-12">
          <BarberLocationView
            barber={barberProfile}
            onLocationUpdated={(updated) => setBarberProfile(updated)}
          />
        </div>
      )}

      {/* 4. TAB SUSCRIPCIÓN & FACTURACIÓN */}
      {activeTab === 'suscripcion' && (
        <div className="pt-2 lg:pt-4 pb-24 lg:pb-12">
          <BarberSubscriptionView
            barber={barberProfile}
            onPlanChanged={(newPlan) => {
              if (barberProfile) {
                setBarberProfile({ ...barberProfile, plan: newPlan });
              }
            }}
          />
        </div>
      )}
    </div>
  );
};

export default BarberHubCoordinator;
