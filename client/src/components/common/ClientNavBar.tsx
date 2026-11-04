import type { FC } from 'react';
import { motion } from 'framer-motion';
import { Home, Compass, QrCode, BookOpen, User, Bell, LogOut } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { SPRING_TOUCH } from '../../constants/springs';

export type ClientNavTab = 'inicio' | 'explorar' | 'escanear' | 'historial' | 'perfil';

interface ClientNavBarProps {
  activeTab: ClientNavTab;
  onTabChange: (tab: ClientNavTab) => void;
  onLogout?: () => void;
  userName?: string;
}

export const ClientNavBar: FC<ClientNavBarProps> = ({
  activeTab,
  onTabChange,
  onLogout,
  userName = 'Ernesto Salinas',
}) => {
  const tabs = [
    { id: 'inicio' as ClientNavTab, label: 'Inicio', icon: Home },
    { id: 'explorar' as ClientNavTab, label: 'Explorar', icon: Compass },
    { id: 'escanear' as ClientNavTab, label: 'Escanear QR', icon: QrCode },
    { id: 'historial' as ClientNavTab, label: 'Historial', icon: BookOpen },
    { id: 'perfil' as ClientNavTab, label: 'Perfil', icon: User },
  ];

  return (
    <>
      {/* =========================================================================
          DESKTOP TOP NAVIGATION BAR (Visible on screens >= lg)
          ========================================================================= */}
      <header className="hidden lg:block sticky top-0 left-0 right-0 z-40 bg-black/80 border-b border-white/10 backdrop-blur-2xl shadow-[inset_0_-1px_0_rgba(255,255,255,0.08),0_10px_30px_rgba(0,0,0,0.8)]">
        <div className="max-w-7xl mx-auto px-6 xl:px-8 h-20 flex items-center justify-between">
          {/* Logo y Branding */}
          <div className="flex items-center gap-6">
            <BrandLogo variant="full" size="md" />
            <span className="hidden xl:inline-block h-4 w-[1px] bg-white/15" />
            <span className="hidden xl:inline-block text-[11px] uppercase tracking-[0.2em] font-semibold text-[#D9C9B0]/60">
              Portal del Cliente
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
                      layoutId="activeDesktopNavPill"
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

          {/* Perfil & Acciones Rápidas */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="p-2.5 rounded-full bg-white/5 border border-white/10 text-[#D9C9B0]/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Notificaciones"
            >
              <Bell className="w-4 h-4 text-[#B68F4E]" />
            </button>

            <div className="flex items-center gap-3 pl-2 border-l border-white/10">
              <div className="w-9 h-9 rounded-full overflow-hidden border border-[#B68F4E]/40 p-0.5">
                <img
                  src="/assets/images/1.png"
                  alt={userName}
                  className="w-full h-full object-cover rounded-full"
                />
              </div>
              <div className="text-left hidden sm:block">
                <span className="text-xs font-bold text-white block leading-tight">
                  {userName}
                </span>
                <span className="text-[10px] text-[#B68F4E] font-medium block">
                  Cliente FADE
                </span>
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  title="Cerrar sesión"
                  className="ml-2 p-2 rounded-full hover:bg-white/10 text-[#D9C9B0]/60 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* =========================================================================
          MOBILE BOTTOM NAVIGATION BAR (Visible on screens < lg)
          ========================================================================= */}
      <nav 
        aria-label="Navegación móvil del cliente"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/85 border-t border-white/10 backdrop-blur-2xl shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_-10px_30px_rgba(0,0,0,0.8)] pb-safe"
      >
        <div className="max-w-md mx-auto flex items-center justify-around px-2 py-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className="relative flex flex-col items-center justify-center py-1.5 px-3 rounded-2xl transition-all cursor-pointer group"
              >
                {isActive && (
                  <motion.div
                    layoutId="activeMobileNavPill"
                    transition={SPRING_TOUCH}
                    className="absolute -top-1 w-8 h-1 rounded-full bg-gradient-to-r from-[#F3E9DC] to-[#B68F4E] shadow-[0_0_10px_rgba(182,143,78,0.8)]"
                  />
                )}

                <Icon
                  className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                    isActive
                      ? 'text-[#B68F4E] drop-shadow-[0_0_8px_rgba(182,143,78,0.5)]'
                      : 'text-[#D9C9B0]/50 group-hover:text-white'
                  }`}
                />

                <span
                  className={`text-[10px] tracking-wider mt-1 transition-colors ${
                    isActive
                      ? 'font-bold text-[#F5EBDD]'
                      : 'font-normal text-[#D9C9B0]/50 group-hover:text-white/80'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
