import type { FC } from 'react';
import { motion } from 'framer-motion';
import { Scissors, User, Store, Award, LogOut } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { SPRING_TOUCH } from '../../constants/springs';
import type { BarberPresenceStatus } from '../../services/presence.service';

export type BarberNavTab = 'sillon' | 'perfil' | 'barberia' | 'suscripcion';

interface BarberNavBarProps {
  activeTab: BarberNavTab;
  onTabChange: (tab: BarberNavTab) => void;
  onLogout?: () => void;
  barberName?: string;
  avatarUrl?: string;
  presenceStatus?: BarberPresenceStatus;
}

export const BarberNavBar: FC<BarberNavBarProps> = ({
  activeTab,
  onTabChange,
  onLogout,
  barberName = 'Barbero',
  avatarUrl,
  presenceStatus = 'GREEN',
}) => {
  const tabs = [
    { id: 'sillon' as BarberNavTab, label: 'Sillón', icon: Scissors },
    { id: 'perfil' as BarberNavTab, label: 'Mi Perfil', icon: User },
    { id: 'barberia' as BarberNavTab, label: 'Mi Barbería', icon: Store },
    { id: 'suscripcion' as BarberNavTab, label: 'Suscripción', icon: Award },
  ];

  return (
    <>
      {/* =========================================================================
          DESKTOP TOP NAVIGATION BAR (Visible on screens >= lg)
          ========================================================================= */}
      <header className="hidden lg:block sticky top-0 left-0 right-0 z-40 bg-black/85 border-b border-white/10 backdrop-blur-2xl shadow-[inset_0_-1px_0_rgba(255,255,255,0.08),0_10px_30px_rgba(0,0,0,0.8)]">
        <div className="max-w-7xl mx-auto px-6 xl:px-8 h-20 flex items-center justify-between">
          {/* Logo y Branding */}
          <div className="flex items-center gap-6">
            <BrandLogo variant="full" size="md" />
            <span className="hidden xl:inline-block h-4 w-[1px] bg-white/15" />
            <span className="hidden xl:inline-block text-[11px] uppercase tracking-[0.2em] font-semibold text-[#D9C9B0]/60">
              Barber Hub
            </span>
          </div>

          {/* Enlaces de Navegación Centrales */}
          <nav className="flex items-center gap-1 p-1 rounded-2xl bg-black/60 border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={`relative flex items-center gap-2 py-2 px-5 rounded-xl text-xs font-semibold tracking-wider transition-colors cursor-pointer select-none ${
                    isActive
                      ? 'text-black font-bold'
                      : 'text-[#D9C9B0]/70 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeBarberDesktopNavPill"
                      transition={SPRING_TOUCH}
                      className="absolute inset-0 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(217,201,176,0.3)]"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Indicador de Presencia & Perfil */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <span
                className={`w-2 h-2 rounded-full ${
                  presenceStatus === 'GREEN'
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                    : presenceStatus === 'RED'
                    ? 'bg-red-500 shadow-[0_0_8px_#ef4444]'
                    : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                }`}
              />
              <span className="text-[10px] font-mono tracking-wider text-[#D9C9B0] uppercase">
                {presenceStatus === 'GREEN'
                  ? 'Libre'
                  : presenceStatus === 'RED'
                  ? 'Cortando'
                  : 'En Espera'}
              </span>
            </div>

            <div className="flex items-center gap-3 pl-2 border-l border-white/10">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-[#B68F4E]/40 p-0.5">
                <img
                  src={
                    avatarUrl ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80'
                  }
                  alt={barberName}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div className="text-left hidden sm:block">
                <span className="text-xs font-bold text-white block leading-tight">
                  {barberName}
                </span>
                <span className="text-[10px] text-[#B68F4E] block">Estación Activa</span>
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="p-2 rounded-full text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-colors ml-1 cursor-pointer"
                  title="Cerrar sesión"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================================
          MOBILE DOCKED BOTTOM NAVIGATION (Visible on screens < lg)
          ========================================================================= */}
      <nav
        aria-label="Navegación del barbero"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/90 border-t border-white/10 backdrop-blur-2xl px-3 py-2 shadow-[0_-8px_32px_rgba(0,0,0,0.85)]"
      >
        <div className="flex items-center justify-around max-w-md mx-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all cursor-pointer select-none ${
                  isActive ? 'text-[#F5EBDD]' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeBarberMobileNavPill"
                    transition={SPRING_TOUCH}
                    className="absolute inset-0 rounded-2xl bg-white/[0.08] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]"
                  />
                )}
                <span className="relative z-10 flex flex-col items-center gap-1">
                  <Icon
                    className={`w-5 h-5 transition-transform duration-200 ${
                      isActive ? 'text-[#B68F4E] scale-110' : ''
                    }`}
                  />
                  <span
                    className={`text-[10px] tracking-tight ${
                      isActive ? 'font-bold text-white' : 'font-medium'
                    }`}
                  >
                    {tab.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
