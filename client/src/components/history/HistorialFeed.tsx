import { useState, useEffect, useRef } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  SlidersHorizontal,
  FileEdit,
  Bell,
  ChevronRight,
  ShieldCheck,
  Star,
  Scissors,
  Calendar,
  Sparkles,
  Layers,
} from 'lucide-react';
import { ClientNavBar, type ClientNavTab } from '../common/ClientNavBar';
import { CutDetailModal } from './CutDetailModal';
import { HistorialFilterModal } from './HistorialFilterModal';
import { ClientNotesModal } from './ClientNotesModal';
import { CutReminderModal } from './CutReminderModal';
import { QrScannerModal, type ScannedBarberInfo } from '../chair/QrScannerModal';
import { ShareHistoryModal } from '../chair/ShareHistoryModal';
import { ClientPhotoConsentModal } from '../chair/ClientPhotoConsentModal';
import {
  sendChairHandshake,
  respondPhotoConsent,
  pollPhotoConsentRequest,
  CHAIR_SYNC_CHANNEL_NAME,
  PHOTO_CONSENT_REQUEST_STORAGE_KEY,
  type PhotoConsentRequestPayload,
} from '../../services/chair.service';
import { MOCK_HAIRCUTS, INITIAL_PREFERENCES } from '../../data/mockHistory';
import type { HaircutItem, ClientPreferences } from '../../types/history';
import { SPRING_TOUCH } from '../../constants/springs';
import { getStoredUser, type UserProfile } from '../../services/auth.service';
import { ExploreCoordinator } from '../explore/ExploreCoordinator';
import { ClientProfileView } from '../profile/ClientProfileView';

interface HistorialFeedProps {
  onNavigateTab?: (tab: ClientNavTab) => void;
  onLogout?: () => void;
  initialScannedBarber?: ScannedBarberInfo | null;
}

type CategoryFilter = 'todos' | 'cortes' | 'barba' | 'favoritos';

export const HistorialFeed: FC<HistorialFeedProps> = ({
  onNavigateTab,
  onLogout,
  initialScannedBarber,
}) => {
  const [activeNavTab, setActiveNavTab] = useState<ClientNavTab>('historial');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('todos');
  const [selectedBarberId, setSelectedBarberId] = useState<string>('all');
  const [preferences, setPreferences] = useState<ClientPreferences>(INITIAL_PREFERENCES);

  // Modals state
  const [activeCutDetail, setActiveCutDetail] = useState<HaircutItem | null>(null);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [scannedBarber, setScannedBarber] = useState<ScannedBarberInfo | null>(() => {
    if (initialScannedBarber) return initialScannedBarber;
    try {
      const stored = sessionStorage.getItem('fade_last_scanned_barber');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [isShareHistoryOpen, setIsShareHistoryOpen] = useState(Boolean(initialScannedBarber));
  const [shareSuccessToast, setShareSuccessToast] = useState(false);
  const [incomingConsentReq, setIncomingConsentReq] = useState<PhotoConsentRequestPayload | null>(null);
  const [consentToastMsg, setConsentToastMsg] = useState<string | null>(null);

  useEffect(() => {
    if (initialScannedBarber) {
      setScannedBarber(initialScannedBarber);
      try {
        sessionStorage.setItem('fade_last_scanned_barber', JSON.stringify(initialScannedBarber));
      } catch {}
      setIsShareHistoryOpen(true);
    }
  }, [initialScannedBarber]);

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getStoredUser());
  const userName = currentUser?.displayName || 'Ernesto Salinas';

  // Evitar re-aperturas en bucle de solicitudes ya respondidas
  const answeredRequestsRef = useRef<Set<string>>(new Set());

  const isRequestAnswered = (req: PhotoConsentRequestPayload | null | undefined): boolean => {
    if (!req) return false;
    const reqId = `${req.barberId}_${req.timestamp}`;
    return answeredRequestsRef.current.has(reqId);
  };

  useEffect(() => {
    // 1. Escuchar solicitudes de consentimiento vía BroadcastChannel
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(CHAIR_SYNC_CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (event.data?.type === 'PHOTO_CONSENT_REQUEST') {
          if (!isRequestAnswered(event.data)) {
            setIncomingConsentReq(event.data);
          }
        }
      };
      return () => bc.close();
    }
  }, []);

  useEffect(() => {
    // 2. Escuchar solicitudes vía Storage Event (Cross-window)
    const onStorage = (e: StorageEvent) => {
      if (e.key === PHOTO_CONSENT_REQUEST_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (!isRequestAnswered(parsed)) {
            setIncomingConsentReq(parsed);
          }
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    // 3. Polling rápido cada 1s al backend por si el barbero mandó desde otro dispositivo
    const phone = currentUser?.phone || '+591 712 34567';
    const barberId = scannedBarber?.barberId;
    const barberName = scannedBarber?.barberName;

    const interval = setInterval(async () => {
      const req = await pollPhotoConsentRequest(phone, barberId, barberName, userName);
      if (req && !isRequestAnswered(req)) {
        setIncomingConsentReq(req);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [currentUser, scannedBarber, userName]);

  const handleClientConsent = async (isPublic: boolean) => {
    if (incomingConsentReq) {
      const req = incomingConsentReq;
      const reqId = `${req.barberId}_${req.timestamp}`;
      answeredRequestsRef.current.add(reqId);
      setIncomingConsentReq(null);

      // Limpiar de localStorage para evitar re-aperturas locales
      try {
        localStorage.removeItem(PHOTO_CONSENT_REQUEST_STORAGE_KEY);
      } catch {}

      await respondPhotoConsent(
        req.barberId,
        req.clientPhone,
        isPublic,
        scannedBarber?.barberName || req.barberName,
        userName
      );
      loadCutsFromDb();
      setConsentToastMsg(
        isPublic
          ? '¡Corte autorizado con éxito para el portafolio público de tu barbero!'
          : 'Corte guardado con éxito en tu historial privado.'
      );
      setTimeout(() => setConsentToastMsg(null), 4000);
    }
  };

  const [cutsList, setCutsList] = useState<HaircutItem[]>(() => {
    try {
      const stored = localStorage.getItem('fade_completed_cuts');
      const local = stored ? JSON.parse(stored) : [];
      return [...local, ...MOCK_HAIRCUTS];
    } catch {
      return MOCK_HAIRCUTS;
    }
  });

  const loadCutsFromDb = async () => {
    try {
      const phone = currentUser?.phone || '+591 712 34567';
      const cleanPhone = phone.replace(/\D/g, '');
      const email = currentUser?.email || '';
      const name = currentUser?.displayName || userName || '';
      const params = new URLSearchParams();
      if (email) params.set('email', email);
      if (name) params.set('name', name);

      const url = `/api/clients/${cleanPhone}/history?${params.toString()}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.cuts && Array.isArray(data.cuts) && data.cuts.length > 0) {
          setCutsList((prev) => {
            const dbIds = new Set(data.cuts.map((c: HaircutItem) => c.id));
            const remaining = prev.filter((c) => !dbIds.has(c.id));
            return [...data.cuts, ...remaining];
          });
        }
      }
    } catch (err) {
      console.warn('Could not fetch cuts from DB:', err);
    }
  };

  useEffect(() => {
    loadCutsFromDb();

    // Escuchar cortes finalizados en tiempo real
    if (typeof BroadcastChannel !== 'undefined') {
      const bc = new BroadcastChannel(CHAIR_SYNC_CHANNEL_NAME);
      const onMsg = (event: MessageEvent) => {
        if (event.data?.type === 'CUT_FINALIZED' && event.data.cut) {
          setCutsList((prev) => [event.data.cut, ...prev.filter((c) => c.id !== event.data.cut.id)]);
        }
      };
      bc.addEventListener('message', onMsg);
      return () => {
        bc.removeEventListener('message', onMsg);
        bc.close();
      };
    }
  }, [currentUser, userName]);

  // Filtering cuts
  const filteredCuts = cutsList.filter((cut) => {
    // Category filter
    if (categoryFilter === 'cortes' && cut.category !== 'corte') return false;
    if (categoryFilter === 'barba' && cut.category !== 'barba' && cut.category !== 'combo') return false;
    if (categoryFilter === 'favoritos' && !cut.isFavorite) return false;

    // Barber filter
    if (selectedBarberId === 'brian' && !cut.barberName.toLowerCase().includes('brian')) return false;
    if (selectedBarberId === 'matias' && !cut.barberName.toLowerCase().includes('matias')) return false;
    if (selectedBarberId === 'diego' && !cut.barberName.toLowerCase().includes('diego')) return false;
    if (selectedBarberId === 'luis' && !cut.barberName.toLowerCase().includes('luis')) return false;

    return true;
  });

  const latestCut = filteredCuts[0] || cutsList[0] || MOCK_HAIRCUTS[0];

  // Grouping remaining cuts by month
  const monthGroups = Array.from(new Set(filteredCuts.map((c) => c.monthGroup)));

  const handleTabChange = (tab: ClientNavTab) => {
    setActiveNavTab(tab);
    if (tab === 'escanear') {
      setIsQrScannerOpen(true);
    }
    if (onNavigateTab) onNavigateTab(tab);
  };

  return (
    <div className="relative min-h-screen w-full bg-black text-[#F5EBDD] pb-28 lg:pb-16 select-none overflow-x-hidden">
      {/* Background Subtle Ambient Lighting */}
      <div 
        className="absolute w-[500px] h-[500px] rounded-full blur-[160px] pointer-events-none opacity-10 -top-20 -right-20 bg-[#B68F4E]"
        aria-hidden="true"
      />
      <div 
        className="absolute w-[400px] h-[400px] rounded-full blur-[140px] pointer-events-none opacity-5 top-1/2 -left-20 bg-[#D9C9B0]"
        aria-hidden="true"
      />

      {/* Barra de Navegación del Cliente (Top bar en Desktop, Bottom bar en Móvil) */}
      <ClientNavBar
        activeTab={activeNavTab}
        onTabChange={handleTabChange}
        onLogout={onLogout}
        userName={userName}
      />

      {/* VISTAS MODULARES SEGÚN TAB ACTIVO */}
      {activeNavTab === 'inicio' && (
        <div className="pt-2 lg:pt-4">
          <ExploreCoordinator initialView="feed" />
        </div>
      )}

      {activeNavTab === 'explorar' && (
        <div className="pt-2 lg:pt-4">
          <ExploreCoordinator initialView="list" />
        </div>
      )}

      {activeNavTab === 'perfil' && (
        <div className="pt-2 lg:pt-4">
          <ClientProfileView
            currentUser={currentUser}
            cuts={cutsList}
            onLogout={onLogout}
            onProfileUpdated={(updated) => setCurrentUser(updated)}
          />
        </div>
      )}

      {activeNavTab === 'historial' && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 lg:pt-8 space-y-8 relative z-10">
        {/* =========================================================================
            HEADER: Título, Subtítulo y Acciones de Control
            ========================================================================= */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-white/5">
          <div className="space-y-1 text-left">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-serif">
                Mi historial
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-white/5 border border-white/10 text-[#B68F4E]">
                {filteredCuts.length} {filteredCuts.length === 1 ? 'corte' : 'cortes'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-[#D9C9B0]/60 hidden sm:block">
              Registro biométrico de cortes, evolución técnica y fórmulas de degradado.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto flex-wrap">
            {/* Botón Recordatorio Inteligente */}
            <button
              type="button"
              onClick={() => setIsReminderModalOpen(true)}
              className="relative flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-[#D9C9B0]/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs"
              aria-label="Ver recordatorios"
            >
              <Bell className="w-4 h-4 text-[#B68F4E]" />
              <span className="hidden sm:inline font-medium">Recordatorio</span>
              <span className="w-2 h-2 rounded-full bg-[#B68F4E] animate-pulse" />
            </button>

            {/* Botón Mis Notas y Preferencias */}
            <button
              type="button"
              onClick={() => setIsNotesModalOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-[#D9C9B0]/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs"
              aria-label="Mis notas y preferencias"
            >
              <FileEdit className="w-4 h-4 text-[#D9C9B0]" />
              <span className="hidden sm:inline font-medium">Mis notas</span>
            </button>

            {/* Botón Filtro por Barbero */}
            <button
              type="button"
              onClick={() => setIsFilterModalOpen(true)}
              className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all cursor-pointer text-xs ${
                selectedBarberId !== 'all'
                  ? 'bg-[#B68F4E]/20 border-[#B68F4E] text-[#B68F4E]'
                  : 'bg-white/5 border-white/10 text-[#D9C9B0]/80 hover:text-white'
              }`}
              aria-label="Filtrar por barbero"
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline font-medium">
                {selectedBarberId !== 'all' ? 'Filtrado' : 'Barbero'}
              </span>
            </button>

            {/* Botón Agregar Corte (+) */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.92 }}
              transition={SPRING_TOUCH}
              onClick={() => setActiveCutDetail(latestCut)}
              className="h-9 px-3.5 sm:px-4 rounded-full bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black flex items-center gap-1.5 font-bold text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_12px_rgba(217,201,176,0.4)] cursor-pointer"
              aria-label="Registrar nuevo corte"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="hidden sm:inline">Nuevo corte</span>
            </motion.button>
          </div>
        </header>

        {/* =========================================================================
            TABS DE FILTRO: [Todos | Cortes | Barba | Favoritos]
            ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-black/60 border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] max-w-md w-full">
            {(
              [
                { id: 'todos', label: 'Todos' },
                { id: 'cortes', label: 'Cortes' },
                { id: 'barba', label: 'Barba' },
                { id: 'favoritos', label: 'Favoritos' },
              ] as const
            ).map((tab) => {
              const isActive = categoryFilter === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setCategoryFilter(tab.id)}
                  className={`relative flex-1 py-2 text-xs font-semibold tracking-wider rounded-xl transition-colors cursor-pointer select-none ${
                    isActive ? 'text-black font-bold' : 'text-[#D9C9B0]/70 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="historyCategoryPill"
                      transition={SPRING_TOUCH}
                      className="absolute inset-0 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_2px_8px_rgba(217,201,176,0.3)]"
                    />
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-1">
                    {tab.id === 'favoritos' && <Star className="w-3 h-3 fill-current" />}
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-[#D9C9B0]/50 font-mono">
            <Layers className="w-3.5 h-3.5 text-[#B68F4E]" />
            <span>Colección privada de {userName}</span>
          </div>
        </div>

        {/* =========================================================================
            DESKTOP HERO SECTION (2 Columnas en lg: Card Último Corte + Widgets Rápidos)
            ========================================================================= */}
        {latestCut && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Columna Izquierda: Card Principal del Último Corte */}
            <div className="lg:col-span-7 xl:col-span-8">
              <motion.div
                whileHover={{ y: -2 }}
                transition={SPRING_TOUCH}
                onClick={() => setActiveCutDetail(latestCut)}
                className="fade-surface h-full rounded-3xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6 cursor-pointer group hover:border-[#B68F4E]/40 transition-all border border-white/10"
              >
                {/* Foto Destacada con Bisel */}
                <div className="relative w-full sm:w-44 md:w-48 aspect-video sm:aspect-square rounded-2xl overflow-hidden border border-white/10 shrink-0 shadow-2xl">
                  <img
                    src={latestCut.coverPhoto}
                    alt={latestCut.styleName}
                    className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent sm:hidden" />
                  <span className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider bg-black/80 text-[#B68F4E] border border-white/15 backdrop-blur-md">
                    Último corte
                  </span>
                </div>

                {/* Detalles y Ficha Técnica del Último Corte */}
                <div className="flex-1 min-w-0 space-y-2.5 text-left w-full">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono tracking-wider text-[#B68F4E] uppercase">
                      {latestCut.date}
                    </span>
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verificado FADE
                    </span>
                  </div>

                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight group-hover:text-[#B68F4E] transition-colors">
                      {latestCut.styleName}
                    </h2>
                    <p className="text-xs text-[#D9C9B0]/70">
                      {latestCut.shopName} · <span className="text-white font-medium">{latestCut.barberName}</span>
                    </p>
                  </div>

                  {/* Chips Técnicos de Degradado */}
                  <div className="pt-1 grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 text-[11px]">
                    <div className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-white/80 flex items-center gap-1.5">
                      <Scissors className="w-3 h-3 text-[#B68F4E]" />
                      <span>{latestCut.specs.fadeType}</span>
                    </div>
                    <div className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-white/80">
                      Guía: <span className="text-[#B68F4E] font-mono">{latestCut.specs.degradedNumber}</span>
                    </div>
                    <div className="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-white/80">
                      Peinado: <span className="text-white">{latestCut.specs.upperTreatment}</span>
                    </div>
                    <div className="px-2.5 py-1 rounded-xl bg-[#B68F4E]/10 border border-[#B68F4E]/30 text-[#B68F4E] font-bold font-mono">
                      {latestCut.priceBs} Bs
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs text-[#B68F4E] group-hover:translate-x-1 transition-transform">
                    <span className="font-semibold">Ver ficha técnica y ángulos biométricos</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Columna Derecha: Widgets Rápidos de Mantenimiento y Notas (Visible en Desktop) */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-4">
              {/* Widget 1: Ciclo de Mantenimiento */}
              <div className="fade-surface rounded-3xl p-5 border border-white/10 flex-1 flex flex-col justify-between text-left">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-[#B68F4E] flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Ciclo óptimo
                    </span>
                    <span className="text-xs font-mono text-emerald-400 font-bold">
                      Día 16 / 21
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white">
                    Próximo mantenimiento sugerido
                  </h3>
                  <p className="text-xs text-[#D9C9B0]/70 leading-relaxed">
                    Tu degradado mantiene definición limpia, pero alcanza su punto de refresco este fin de semana.
                  </p>
                </div>

                <div className="pt-3">
                  <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden mb-3">
                    <div className="bg-gradient-to-r from-[#B68F4E] to-[#E6CA9E] h-full w-[76%] rounded-full" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsReminderModalOpen(true)}
                    className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#D9C9B0] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Bell className="w-3.5 h-3.5 text-[#B68F4E]" />
                    Configurar aviso con Brian
                  </button>
                </div>
              </div>

              {/* Widget 2: Preferencias Técnicas Activas */}
              <div className="fade-surface rounded-3xl p-5 border border-white/10 flex-1 flex flex-col justify-between text-left">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-[#B68F4E] flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Preferencias
                    </span>
                    <span className="text-[10px] text-white/50">
                      Sincronizadas
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white">
                    Fórmula de Estilo Personal
                  </h3>
                  <p className="text-xs text-[#D9C9B0]/70 truncate">
                    {preferences.likes.length > 0
                      ? preferences.likes.slice(0, 2).join(' · ')
                      : 'Degradado limpio y natural'}
                  </p>
                  <p className="text-[11px] text-white/50 truncate">
                    Nota: {preferences.generalNotes || 'Sin notas especiales'}
                  </p>
                </div>

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={() => setIsNotesModalOpen(true)}
                    className="w-full py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-[#D9C9B0] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <FileEdit className="w-3.5 h-3.5 text-[#B68F4E]" />
                    Ajustar notas para el barbero
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            GALERÍA MENSUAL AGRUPADA (Cuadrículas Responsivas: 3 cols móvil, 4-6 en desktop)
            ========================================================================= */}
        <div className="space-y-8 text-left">
          {monthGroups.map((month) => {
            const cutsInMonth = filteredCuts.filter((c) => c.monthGroup === month);

            return (
              <section key={month} className="space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm sm:text-base font-bold tracking-wide text-white font-serif">
                      {month}
                    </h2>
                    <span className="text-[10px] sm:text-xs font-mono text-[#B68F4E] bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                      {cutsInMonth.length} {cutsInMonth.length === 1 ? 'corte' : 'cortes'}
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-xs font-mono text-white/40">
                    Historial fotográfico
                  </span>
                </div>

                {/* Grid Responsivo Multi-Dispositivo */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
                  {cutsInMonth.map((cut) => (
                    <motion.div
                      key={cut.id}
                      whileHover={{ y: -3, scale: 1.02 }}
                      whileTap={{ scale: 0.96 }}
                      transition={SPRING_TOUCH}
                      onClick={() => setActiveCutDetail(cut)}
                      className="group relative aspect-[3/4] sm:aspect-square rounded-2xl overflow-hidden border border-white/10 bg-[#161616] cursor-pointer shadow-lg hover:border-[#B68F4E]/60 hover:shadow-[0_8px_24px_rgba(182,143,78,0.2)] transition-all"
                    >
                      <img
                        src={cut.coverPhoto}
                        alt={cut.styleName}
                        className="w-full h-full object-cover object-center group-hover:scale-108 transition-transform duration-500 filter brightness-95 group-hover:brightness-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent opacity-85 group-hover:opacity-95 transition-opacity" />

                      {/* Pill con nombre del corte y barbero */}
                      <div className="absolute bottom-2 left-2 right-2 truncate space-y-0.5">
                        <span className="text-[10px] sm:text-xs font-bold text-white drop-shadow block truncate">
                          {cut.styleName}
                        </span>
                        <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-[#B68F4E] font-mono">
                          <span className="truncate">{cut.barberName}</span>
                          <span className="text-white/60">{cut.priceBs} Bs</span>
                        </div>
                      </div>

                      {/* Badges superiores */}
                      <div className="absolute top-2 left-2 right-2 flex items-center justify-between">
                        <span className="px-1.5 py-0.5 rounded-full text-[8px] font-mono bg-black/70 text-white/80 border border-white/10 backdrop-blur-sm">
                          {cut.date.split(' ')[0]}
                        </span>
                        {cut.isVerified && (
                          <div className="bg-black/60 p-1 rounded-full backdrop-blur-sm border border-white/10">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 drop-shadow" />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    )}

      {/* =========================================================================
          MODALES DE DETALLE, FILTROS, NOTAS Y RECORDATORIO
          ========================================================================= */}
      {activeCutDetail && (
        <CutDetailModal
          cut={activeCutDetail}
          isOpen={Boolean(activeCutDetail)}
          onClose={() => setActiveCutDetail(null)}
          onRepeatCut={(cut) => {
            console.log('Repetir corte seleccionado:', cut.id);
          }}
        />
      )}

      <HistorialFilterModal
        isOpen={isFilterModalOpen}
        selectedBarberId={selectedBarberId}
        onSelectBarber={setSelectedBarberId}
        onClose={() => setIsFilterModalOpen(false)}
      />

      <ClientNotesModal
        isOpen={isNotesModalOpen}
        preferences={preferences}
        onSavePreferences={setPreferences}
        onClose={() => setIsNotesModalOpen(false)}
      />

      <CutReminderModal
        isOpen={isReminderModalOpen}
        onClose={() => setIsReminderModalOpen(false)}
        onExploreBarbers={() => {
          handleTabChange('explorar');
        }}
      />

      {/* Handshake en Sillón: Escáner QR de Cliente */}
      <QrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => {
          setIsQrScannerOpen(false);
          setActiveNavTab('historial');
        }}
        onScanSuccess={(barber) => {
          setIsQrScannerOpen(false);
          setScannedBarber(barber);
          try {
            sessionStorage.setItem('fade_last_scanned_barber', JSON.stringify(barber));
          } catch {}
          setIsShareHistoryOpen(true);
        }}
      />

      {/* Handshake en Sillón: Modal de Confirmación para Compartir Historial */}
      <ShareHistoryModal
        isOpen={isShareHistoryOpen}
        barber={scannedBarber}
        onClose={() => {
          setIsShareHistoryOpen(false);
          setActiveNavTab('historial');
        }}
        onConfirmShare={() => {
          if (scannedBarber) {
            sendChairHandshake(
              scannedBarber.barberId,
              scannedBarber.barberName,
              {
                displayName: userName,
                phone: currentUser?.phone || '+591 712 34567',
                avatarUrl: '/assets/images/1.png',
              }
            );
          }
          setIsShareHistoryOpen(false);
          setShareSuccessToast(true);
          setTimeout(() => setShareSuccessToast(false), 3500);
          setActiveNavTab('historial');
        }}
      />

      {/* Toast de Éxito de Enlace */}
      <AnimatePresence>
        {shareSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-emerald-950/90 border border-emerald-500/40 text-emerald-200 text-xs font-semibold backdrop-blur-xl shadow-2xl flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Historial compartido con éxito. El barbero ya tiene tu ficha técnica en sillón.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Solicitud de Consentimiento de Fotos de Portafolio del Barbero */}
      <ClientPhotoConsentModal
        request={incomingConsentReq}
        onConsent={handleClientConsent}
      />

      {/* Toast de Consentimiento Registrado */}
      <AnimatePresence>
        {consentToastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-amber-950/90 border border-amber-500/40 text-amber-200 text-xs font-semibold backdrop-blur-xl shadow-2xl flex items-center gap-2 max-w-sm text-center"
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <span>{consentToastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default HistorialFeed;
