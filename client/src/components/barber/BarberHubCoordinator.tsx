import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { BarberNavBar, type BarberNavTab } from '../common/BarberNavBar';
import { BarberChairWorkflow } from '../chair/BarberChairWorkflow';
import { BarberProfileView } from './BarberProfileView';
import {
  presenceService,
  type BarberPresenceStatus,
} from '../../services/presence.service';
import {
  getStoredUser,
  fetchBarberProfile,
  type UserProfile,
} from '../../services/auth.service';
import { Store, Award, MapPin } from 'lucide-react';

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

      {/* 1. TAB SILLÓN (Estación Operativa de Trabajo - Preservada 100%) */}
      {activeTab === 'sillon' && (
        <div className="pb-24 lg:pb-0">
          <BarberChairWorkflow onExit={onExit} />
        </div>
      )}

      {/* 2. TAB MI PERFIL & PORTAFOLIO (Estilo LinkedIn Profesional) */}
      {activeTab === 'perfil' && (
        <div className="pt-2 lg:pt-4">
          <BarberProfileView
            barber={barberProfile}
            onProfileUpdated={(updated) => setBarberProfile(updated)}
          />
        </div>
      )}

      {/* 3. TAB MI BARBERÍA (Fase 2 Preview) */}
      {activeTab === 'barberia' && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-12 pb-28 text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
            <Store className="w-8 h-8 text-[#B68F4E]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-serif font-bold text-white">Mi Barbería & Ubicación</h2>
            <p className="text-sm text-[#D9C9B0]/60 max-w-md mx-auto">
              {barberProfile?.shopName || 'Fade Studio — Sopocachi'} · {barberProfile?.shopAddress || 'Av. 20 de Octubre #2140'}
            </p>
          </div>
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 text-left space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#B68F4E]">
              <MapPin className="w-4 h-4" />
              <span>Sede de Atención Activa</span>
            </div>
            <p className="text-xs text-white/80 leading-relaxed">
              Actualmente estás asignado a <strong>{barberProfile?.shopName || 'Fade Studio Sopocachi'}</strong>.
              Tus clientes te ubican en el mapa dentro de la zona <strong>{barberProfile?.shopZone || 'Sopocachi'}</strong>.
            </p>
            <div className="text-[11px] text-white/40 pt-2 border-t border-white/5">
              Próximamente: Selector de cambio de salón o modo estudio independiente.
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB SUSCRIPCIÓN (Fase 3 Preview) */}
      {activeTab === 'suscripcion' && (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-12 pb-28 text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-white/[0.04] border border-white/10 flex items-center justify-center">
            <Award className="w-8 h-8 text-[#B68F4E]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-serif font-bold text-white">Suscripción & Cuota Mensual</h2>
            <p className="text-sm text-[#D9C9B0]/60 max-w-md mx-auto">
              Plan activo: <strong className="text-white uppercase">{barberProfile?.plan || 'AUTÓNOMO'}</strong>
            </p>
          </div>
          <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 text-left space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-white/70">Consumo de Cortes del Mes</span>
              <span className="text-xs font-mono font-bold text-[#B68F4E]">
                {barberProfile?.totalCuts || 1} / {barberProfile?.plan === 'BARBERIA_BASE' ? '200' : '60'} cortes
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#B68F4E] to-[#F3E9DC] rounded-full"
                style={{ width: `${Math.min(100, (((barberProfile?.totalCuts || 1) / (barberProfile?.plan === 'BARBERIA_BASE' ? 200 : 60)) * 100))}%` }}
              />
            </div>
            <div className="text-[11px] text-white/40 pt-2 border-t border-white/5 flex items-center justify-between">
              <span>Cuota mensual: Bs {barberProfile?.plan === 'BARBERIA_BASE' ? '110' : '45'}/mes</span>
              <span className="text-emerald-400 font-semibold">Al día</span>
            </div>
          </div>
        </div>
      )}

      {/* Barra de Navegación del Barbero */}
      <BarberNavBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLogout={onLogout}
        barberName={barberProfile?.displayName || 'Barbero'}
        avatarUrl={barberProfile?.avatarUrl}
        presenceStatus={presenceStatus}
      />
    </div>
  );
};

export default BarberHubCoordinator;
