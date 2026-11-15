import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { SplashScreen } from './components/presentation/SplashScreen';
import { OnboardingCarousel } from './components/presentation/OnboardingCarousel';
import { LoginView } from './components/auth/LoginView';
import { VerifyEmailView } from './components/auth/VerifyEmailView';
import { ClientRegisterWizard } from './components/register/ClientRegisterWizard';
import { BarberRegisterWizard } from './components/register/BarberRegisterWizard';
import { BarberHubCoordinator } from './components/barber/BarberHubCoordinator';
import { AuthenticatedView } from './components/dashboard/AuthenticatedView';
import { HistorialFeed } from './components/history/HistorialFeed';
import { ExploreCoordinator } from './components/explore/ExploreCoordinator';
import { ClientNavBar } from './components/common/ClientNavBar';
import { LegalView } from './components/common/LegalView';
import type { ScannedBarberInfo } from './components/chair/QrScannerModal';
import {
  getStoredToken,
  getStoredUser,
  clearAuthSession,
  type LoginResponse,
} from './services/auth.service';
import { savePendingChairBind, consumePendingChairBind } from './services/chair.service';
import { LOGIN_REQUIRED_EVENT, consumePendingBookingBarberId } from './services/booking.service';

type AppScreen =
  | 'splash'
  | 'onboarding'
  | 'login'
  | 'register'
  | 'register-barber'
  | 'historial'
  | 'barber-chair'
  | 'explore'
  | 'authenticated'
  | 'verify-email'
  | 'legal-privacidad'
  | 'legal-terminos';

const HAS_SEEN_ONBOARDING_KEY = 'fade_has_seen_onboarding';
const VERIFY_EMAIL_PATH = '/verify-email';

/**
 * Reads the email verification token once at module load and removes it from
 * the address bar so it is not kept in history or shared by accident.
 */
const IS_VERIFY_EMAIL_ROUTE =
  typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '') === VERIFY_EMAIL_PATH;
const VERIFY_EMAIL_TOKEN: string | null = (() => {
  if (!IS_VERIFY_EMAIL_ROUTE) return null;
  const token = new URLSearchParams(window.location.search).get('token');
  try {
    window.history.replaceState(null, '', VERIFY_EMAIL_PATH);
  } catch {
    // history API unavailable: the token stays in the URL
  }
  return token;
})();

export function App() {
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(() => {
    if (typeof window === 'undefined') return 'splash';
    if (IS_VERIFY_EMAIL_ROUTE) return 'verify-email';
    const path = window.location.pathname.toLowerCase();
    if (path.includes('privacidad') || path.includes('privacy')) return 'legal-privacidad';
    if (path.includes('terminos') || path.includes('terms')) return 'legal-terminos';

    const params = new URLSearchParams(window.location.search);
    const token = getStoredToken();
    const user = getStoredUser();
    if (params.get('chair') || params.get('scan')) {
      // Binding to a chair requires a signed-in client; otherwise sign in first.
      return token && user?.role === 'cliente' ? 'historial' : 'login';
    }
    if (token && user) {
      return user.role === 'cliente' ? 'historial' : 'barber-chair';
    }
    const hasSeen = localStorage.getItem(HAS_SEEN_ONBOARDING_KEY);
    return hasSeen ? 'login' : 'splash';
  });
  const [authData, setAuthData] = useState<LoginResponse | null>(null);
  const [clientRegisterStep, setClientRegisterStep] = useState(1);
  const [barberRegisterStep, setBarberRegisterStep] = useState(1);
  const [pendingChairScan, setPendingChairScan] = useState<ScannedBarberInfo | null>(null);
  const [resetToken, setResetToken] = useState<string | undefined>(undefined);
  // Barber whose booking was interrupted by the login redirect; resumed after a client signs in.
  const [resumeBookingBarberId, setResumeBookingBarberId] = useState<string | null>(null);

  useEffect(() => {
    // The email verification link is handled by its own screen (its ?token is not a reset token)
    if (IS_VERIFY_EMAIL_ROUTE) return;

    // Si la URL contiene ?reset_token=, abre directamente el flujo de recuperación
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get('reset_token') || params.get('token');
    if (tokenFromUrl) {
      setResetToken(tokenFromUrl);
      setCurrentScreen('login');
      return;
    }

    // Si la URL contiene ?chair= o ?scan=, se enlaza directamente la sesión del sillón
    const chairBarberId = params.get('chair') || params.get('scan');
    if (chairBarberId) {
      const barberName = params.get('name') || 'Diego Armando';
      const shopName = params.get('shop') || 'Fade Studio — Sopocachi';
      const scan: ScannedBarberInfo = {
        barberId: chairBarberId,
        barberName,
        shopName,
        avatarUrl: '/assets/images/1.png',
      };
      const storedToken = getStoredToken();
      const storedUser = getStoredUser();
      if (storedToken && storedUser?.role === 'cliente') {
        setAuthData({ token: storedToken, user: storedUser });
        setPendingChairScan(scan);
        setCurrentScreen('historial');
      } else {
        // Resume the bind after the client signs in.
        savePendingChairBind(scan);
        setCurrentScreen('login');
      }
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

  // A booking attempt without a client session sends the user here (see requestLoginForBooking).
  useEffect(() => {
    const onLoginRequired = () => {
      clearAuthSession();
      setAuthData(null);
      setCurrentScreen('login');
    };
    window.addEventListener(LOGIN_REQUIRED_EVENT, onLoginRequired);
    return () => window.removeEventListener(LOGIN_REQUIRED_EVENT, onLoginRequired);
  }, []);

  const handleLoginSuccess = (data: LoginResponse) => {
    setAuthData(data);
    if (data.user.role === 'cliente') {
      const pendingBookingBarberId = consumePendingBookingBarberId();
      if (pendingBookingBarberId) {
        setResumeBookingBarberId(pendingBookingBarberId);
        setCurrentScreen('explore');
        return;
      }
      const pending = consumePendingChairBind();
      if (pending) {
        setPendingChairScan({
          barberId: pending.barberId,
          barberName: pending.barberName,
          shopName: pending.shopName ?? '',
          avatarUrl: pending.avatarUrl ?? '/assets/images/1.png',
        });
      }
      setCurrentScreen('historial');
    } else {
      setCurrentScreen('barber-chair');
    }
  };

  const clearResumeBooking = useCallback(() => setResumeBookingBarberId(null), []);

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
        {currentScreen === 'verify-email' && (
          <motion.div
            key="verify-email"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="w-full min-h-screen"
          >
            <VerifyEmailView
              token={VERIFY_EMAIL_TOKEN}
              onContinue={() => {
                const token = getStoredToken();
                const user = getStoredUser();
                if (token && user) {
                  setAuthData({ token, user });
                  setCurrentScreen(user.role === 'cliente' ? 'historial' : 'barber-chair');
                } else {
                  setCurrentScreen('login');
                }
              }}
            />
          </motion.div>
        )}

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
              onDirectLogin={() => {
                localStorage.setItem(HAS_SEEN_ONBOARDING_KEY, 'true');
                setCurrentScreen('login');
              }}
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
            <OnboardingCarousel
              onComplete={() => {
                localStorage.setItem(HAS_SEEN_ONBOARDING_KEY, 'true');
                setCurrentScreen('login');
              }}
            />
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
              initialResetToken={resetToken}
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
            <BarberHubCoordinator
              onExit={() => setCurrentScreen('authenticated')}
              onLogout={handleLogout}
            />
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
            <ExploreCoordinator
              initialView="feed"
              resumeBookingBarberId={resumeBookingBarberId}
              onResumed={clearResumeBooking}
            />
            <ClientNavBar
              activeTab="explorar"
              onTabChange={(tab) => {
                if (tab === 'historial') setCurrentScreen('historial');
                if (tab === 'escanear') setCurrentScreen('historial');
                if (tab === 'perfil') {
                  setCurrentScreen('historial');
                }
              }}
              onLogout={handleLogout}
              userName={authData?.user.displayName || 'Ernesto Salinas'}
            />
          </motion.div>
        )}

        {currentScreen === 'legal-privacidad' && (
          <LegalView
            type="privacidad"
            onBack={() => setCurrentScreen('login')}
          />
        )}

        {currentScreen === 'legal-terminos' && (
          <LegalView
            type="terminos"
            onBack={() => setCurrentScreen('login')}
          />
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
