import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SplashScreen } from './components/presentation/SplashScreen';
import { OnboardingCarousel } from './components/presentation/OnboardingCarousel';
import { LoginView } from './components/auth/LoginView';
import { ClientRegisterWizard } from './components/register/ClientRegisterWizard';
import { BarberRegisterWizard } from './components/register/BarberRegisterWizard';
import { BarberChairWorkflow } from './components/chair/BarberChairWorkflow';
import { AuthenticatedView } from './components/dashboard/AuthenticatedView';
import { HistorialFeed } from './components/history/HistorialFeed';
import { ExploreCoordinator } from './components/explore/ExploreCoordinator';
import { ClientNavBar } from './components/common/ClientNavBar';
import type { ScannedBarberInfo } from './components/chair/QrScannerModal';
import {
  getStoredToken,
  getStoredUser,
  clearAuthSession,
  type LoginResponse,
} from './services/auth.service';

type AppScreen =
  | 'splash'
  | 'onboarding'
  | 'login'
  | 'register'
  | 'register-barber'
  | 'historial'
  | 'barber-chair'
  | 'explore'
  | 'authenticated';

export function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>('login');
  const [authData, setAuthData] = useState<LoginResponse | null>(null);
  const [clientRegisterStep, setClientRegisterStep] = useState(1);
  const [barberRegisterStep, setBarberRegisterStep] = useState(1);
  const [pendingChairScan, setPendingChairScan] = useState<ScannedBarberInfo | null>(null);

  useEffect(() => {
    // Si la URL contiene ?chair= o ?scan=, se enlaza directamente la sesión del sillón
    const params = new URLSearchParams(window.location.search);
    const chairBarberId = params.get('chair') || params.get('scan');
    if (chairBarberId) {
      const barberName = params.get('name') || 'Diego Armando';
      const shopName = params.get('shop') || 'Fade Studio — Sopocachi';
      setPendingChairScan({
        barberId: chairBarberId,
        barberName,
        shopName,
        avatarUrl: '/assets/images/1.png',
      });
      setCurrentScreen('historial');
      return;
    }

    const token = getStoredToken();
    const user = getStoredUser();
    if (token && user) {
      setAuthData({ token, user });
      if (user.role === 'cliente') {
        setCurrentScreen('historial');
      } else {
        setCurrentScreen('barber-chair');
      }
    }
  }, []);

  const handleLoginSuccess = (data: LoginResponse) => {
    setAuthData(data);
    if (data.user.role === 'cliente') {
      setCurrentScreen('historial');
    } else {
      setCurrentScreen('barber-chair');
    }
  };

  const handleLogout = () => {
    clearAuthSession();
    setAuthData(null);
    setCurrentScreen('login');
  };

  const isDevMode = typeof window !== 'undefined' && window.location.search.includes('dev=1');
  const [isDevSwitcherOpen, setIsDevSwitcherOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-black text-[#F5EBDD] font-sans antialiased overflow-x-hidden">
      {/* Selector Flotante de Vistas de Desarrollo (Oculto por defecto para Producción, accesible con ?dev=1) */}
      {isDevMode && (
        <div className="fixed bottom-24 lg:bottom-6 left-4 lg:left-6 z-50 select-none">
        <AnimatePresence>
          {isDevSwitcherOpen && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="mb-2 p-2 rounded-2xl bg-black/90 border border-white/15 backdrop-blur-2xl shadow-[0_10px_30px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.15)] flex flex-col gap-1 min-w-[190px]"
            >
              <div className="flex items-center justify-between px-2 py-1 border-b border-white/10 mb-1">
                <span className="text-[10px] uppercase tracking-wider font-mono text-[#B68F4E]">
                  Vistas FADE
                </span>
                <button
                  type="button"
                  onClick={() => setIsDevSwitcherOpen(false)}
                  className="text-white/40 hover:text-white text-xs cursor-pointer px-1"
                >
                  ✕
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCurrentScreen('splash');
                  setIsDevSwitcherOpen(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wider text-left transition-all cursor-pointer ${
                  currentScreen === 'splash'
                    ? 'bg-[#B68F4E] text-black shadow-[0_0_12px_rgba(182,143,78,0.5)]'
                    : 'text-[#D9C9B0]/70 hover:text-white hover:bg-white/5'
                }`}
              >
                1. Splash
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentScreen('onboarding');
                  setIsDevSwitcherOpen(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wider text-left transition-all cursor-pointer ${
                  currentScreen === 'onboarding'
                    ? 'bg-[#B68F4E] text-black shadow-[0_0_12px_rgba(182,143,78,0.5)]'
                    : 'text-[#D9C9B0]/70 hover:text-white hover:bg-white/5'
                }`}
              >
                2. Onboarding
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentScreen('login');
                  setIsDevSwitcherOpen(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wider text-left transition-all cursor-pointer ${
                  currentScreen === 'login'
                    ? 'bg-[#B68F4E] text-black shadow-[0_0_12px_rgba(182,143,78,0.5)]'
                    : 'text-[#D9C9B0]/70 hover:text-white hover:bg-white/5'
                }`}
              >
                3. Login
              </button>
              <button
                type="button"
                onClick={() => {
                  setClientRegisterStep(1);
                  setCurrentScreen('register');
                  setIsDevSwitcherOpen(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wider text-left transition-all cursor-pointer ${
                  currentScreen === 'register'
                    ? 'bg-[#B68F4E] text-black shadow-[0_0_12px_rgba(182,143,78,0.5)]'
                    : 'text-[#D9C9B0]/70 hover:text-white hover:bg-white/5'
                }`}
              >
                4. Registro Cliente
              </button>
              <button
                type="button"
                onClick={() => {
                  setBarberRegisterStep(1);
                  setCurrentScreen('register-barber');
                  setIsDevSwitcherOpen(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wider text-left transition-all cursor-pointer ${
                  currentScreen === 'register-barber'
                    ? 'bg-[#B68F4E] text-black shadow-[0_0_12px_rgba(182,143,78,0.5)]'
                    : 'text-[#D9C9B0]/70 hover:text-white hover:bg-white/5'
                }`}
              >
                5. Registro Barbero
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentScreen('historial');
                  setIsDevSwitcherOpen(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wider text-left transition-all cursor-pointer ${
                  currentScreen === 'historial'
                    ? 'bg-[#B68F4E] text-black shadow-[0_0_12px_rgba(182,143,78,0.5)]'
                    : 'text-[#D9C9B0]/70 hover:text-white hover:bg-white/5'
                }`}
              >
                6. Historial Capilar (Cliente)
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentScreen('barber-chair');
                  setIsDevSwitcherOpen(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wider text-left transition-all cursor-pointer ${
                  currentScreen === 'barber-chair'
                    ? 'bg-[#B68F4E] text-black shadow-[0_0_12px_rgba(182,143,78,0.5)]'
                    : 'text-[#D9C9B0]/70 hover:text-white hover:bg-white/5'
                }`}
              >
                7. Modo Sillón (Barbero)
              </button>
              <button
                type="button"
                onClick={() => {
                  setCurrentScreen('explore');
                  setIsDevSwitcherOpen(false);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wider text-left transition-all cursor-pointer ${
                  currentScreen === 'explore'
                    ? 'bg-[#B68F4E] text-black shadow-[0_0_12px_rgba(182,143,78,0.5)]'
                    : 'text-[#D9C9B0]/70 hover:text-white hover:bg-white/5'
                }`}
              >
                8. Exploración & Mapa (Cliente)
              </button>
              {authData && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentScreen(authData.user.role === 'cliente' ? 'historial' : 'authenticated');
                    setIsDevSwitcherOpen(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wider text-left transition-all cursor-pointer ${
                    currentScreen === 'authenticated'
                      ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                      : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
                  }`}
                >
                  9. Sesión Activa ({authData.user.displayName})
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => setIsDevSwitcherOpen((prev) => !prev)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-black/80 border border-white/15 backdrop-blur-xl shadow-2xl text-xs font-mono text-[#D9C9B0] hover:text-[#B68F4E] hover:border-[#B68F4E]/40 transition-all cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-[#B68F4E] animate-pulse" />
          <span className="text-[11px] font-semibold tracking-wide">
            {isDevSwitcherOpen ? 'Cerrar menú' : '⚙️ Vistas'}
          </span>
        </button>
      </div>
      )}

      {/* Transiciones Suaves entre Pantallas */}
      <AnimatePresence mode="wait">
        {currentScreen === 'splash' && (
          <motion.div
            key="splash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full min-h-screen"
          >
            <SplashScreen
              onStart={() => setCurrentScreen('onboarding')}
              onDirectLogin={() => setCurrentScreen('login')}
            />
          </motion.div>
        )}

        {currentScreen === 'onboarding' && (
          <motion.div
            key="onboarding"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full min-h-screen"
          >
            <OnboardingCarousel onComplete={() => setCurrentScreen('login')} />
          </motion.div>
        )}

        {currentScreen === 'login' && (
          <motion.div
            key="login"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full min-h-screen"
          >
            <LoginView
              onLoginSuccess={handleLoginSuccess}
              onShowOnboarding={() => setCurrentScreen('onboarding')}
              onShowRegister={() => {
                setClientRegisterStep(1);
                setCurrentScreen('register');
              }}
            />
          </motion.div>
        )}

        {currentScreen === 'register' && (
          <motion.div
            key="register"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full min-h-screen"
          >
            <ClientRegisterWizard
              initialStep={clientRegisterStep}
              onCancel={() => setCurrentScreen('login')}
              onSwitchToBarber={() => {
                setBarberRegisterStep(2);
                setCurrentScreen('register-barber');
              }}
              onRegisterSuccess={handleLoginSuccess}
            />
          </motion.div>
        )}

        {currentScreen === 'register-barber' && (
          <motion.div
            key="register-barber"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full min-h-screen"
          >
            <BarberRegisterWizard
              initialStep={barberRegisterStep}
              onCancel={() => setCurrentScreen('login')}
              onSwitchToClient={() => {
                setClientRegisterStep(2);
                setCurrentScreen('register');
              }}
              onRegisterSuccess={handleLoginSuccess}
            />
          </motion.div>
        )}

        {currentScreen === 'historial' && (
          <motion.div
            key="historial"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full min-h-screen"
          >
            <HistorialFeed
              initialScannedBarber={pendingChairScan}
              onNavigateTab={(tab) => {
                if (tab === 'perfil') {
                  setCurrentScreen('authenticated');
                }
              }}
              onLogout={handleLogout}
            />
          </motion.div>
        )}

        {currentScreen === 'barber-chair' && (
          <motion.div
            key="barber-chair"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full min-h-screen"
          >
            <BarberChairWorkflow onExit={() => setCurrentScreen('authenticated')} />
          </motion.div>
        )}

        {currentScreen === 'explore' && (
          <motion.div
            key="explore"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full min-h-screen pb-20 lg:pb-0"
          >
            <ExploreCoordinator initialView="feed" />
            <ClientNavBar
              activeTab="explorar"
              onTabChange={(tab) => {
                if (tab === 'historial') setCurrentScreen('historial');
                if (tab === 'escanear') setCurrentScreen('historial');
                if (tab === 'perfil') {
                  if (authData) setCurrentScreen('authenticated');
                }
              }}
              onLogout={handleLogout}
              userName={authData?.user.displayName || 'Ernesto Salinas'}
            />
          </motion.div>
        )}

        {currentScreen === 'authenticated' && authData && (
          <motion.div
            key="authenticated"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full min-h-screen"
          >
            <AuthenticatedView
              authData={authData}
              onLogout={handleLogout}
              onNavigateHome={() =>
                setCurrentScreen(authData.user.role === 'cliente' ? 'historial' : 'barber-chair')
              }
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
