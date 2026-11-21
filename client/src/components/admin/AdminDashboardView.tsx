import { useState, useEffect } from 'react';
import type { FC, FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck,
  Lock,
  Search,
  Sparkles,
  ArrowRight,
  RefreshCw,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Mail,
  Copy,
  Check,
  Users,
  Award,
} from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { AnimatedNumber } from '../common/AnimatedNumber';
import {
  getStoredAdminKey,
  setStoredAdminKey,
  clearStoredAdminKey,
  verifyAdminKey,
  fetchAdminBarbers,
  updateBarberPlanAdmin,
  type AdminBarberItem,
} from '../../services/admin.service';

interface AdminDashboardViewProps {
  onExit: () => void;
}

export const AdminDashboardView: FC<AdminDashboardViewProps> = ({ onExit }) => {
  const [adminKey, setAdminKey] = useState<string>('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Dashboard Data State
  const [barbers, setBarbers] = useState<AdminBarberItem[]>([]);
  const [loadingBarbers, setLoadingBarbers] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [planFilter, setPlanFilter] = useState<'ALL' | 'GRATIS' | 'PRO'>('ALL');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Check stored key on mount
  useEffect(() => {
    const existing = getStoredAdminKey();
    if (existing) {
      verifyAdminKey(existing).then((valid) => {
        if (valid) {
          setIsAuthenticated(true);
        } else {
          clearStoredAdminKey();
        }
        setCheckingAuth(false);
      });
    } else {
      setCheckingAuth(false);
    }
  }, []);

  // Load barbers when authenticated
  const loadBarbers = async () => {
    setLoadingBarbers(true);
    try {
      const data = await fetchAdminBarbers({
        search: searchQuery.trim() || undefined,
        plan: planFilter === 'ALL' ? undefined : planFilter,
      });
      setBarbers(data);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al cargar barberos';
      if (msg.includes('inválida')) {
        setIsAuthenticated(false);
      }
      showToast(msg);
    } finally {
      setLoadingBarbers(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadBarbers();
    }
  }, [isAuthenticated, planFilter]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!adminKey.trim()) return;

    setLoginError(null);
    setCheckingAuth(true);
    const valid = await verifyAdminKey(adminKey);
    setCheckingAuth(false);

    if (valid) {
      setStoredAdminKey(adminKey);
      setIsAuthenticated(true);
    } else {
      setLoginError('Clave de administrador incorrecta o módulo no configurado');
    }
  };

  const handleLogout = () => {
    clearStoredAdminKey();
    setIsAuthenticated(false);
    setAdminKey('');
  };

  const handleTogglePlan = async (barber: AdminBarberItem, targetPlan: 'GRATIS' | 'PRO') => {
    setActionInProgress(barber.id);
    try {
      await updateBarberPlanAdmin(barber.id, targetPlan);
      showToast(`¡Plan de ${barber.displayName} actualizado a ${targetPlan}!`);
      // Update local state directly for immediate feedback
      setBarbers((prev) =>
        prev.map((b) => (b.id === barber.id ? { ...b, plan: targetPlan, maxCuts: targetPlan === 'PRO' ? null : 30 } : b))
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Error al cambiar plan');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback
    }
  };

  // Metrics
  const totalBarbers = barbers.length;
  const proCount = barbers.filter((b) => b.plan === 'PRO').length;
  const gratisCount = barbers.filter((b) => b.plan === 'GRATIS').length;
  const totalCuts = barbers.reduce((acc, b) => acc + (b.cutsCountThisMonth || 0), 0);

  // Show the placeholder (not a misleading 0) until the first load resolves.
  const statsPending = loadingBarbers && barbers.length === 0;
  const stat = (n: number) => (statsPending ? null : n);

  // Filtered in memory for instant typing
  const filteredBarbers = barbers.filter((b) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      b.displayName.toLowerCase().includes(q) ||
      (b.phone && b.phone.includes(q)) ||
      (b.email && b.email.toLowerCase().includes(q)) ||
      b.id.toLowerCase().includes(q)
    );
  });

  // 1. PANTALLA DE ACCESO POR CLAVE MAESTRA
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0A0908] text-white flex flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm rounded-3xl bg-[#12110E] border border-white/10 p-7 space-y-6 shadow-2xl text-center"
        >
          <div className="flex justify-center">
            <BrandLogo variant="full" size="md" />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-center gap-1.5 text-xs font-mono font-bold uppercase tracking-wider text-[#B68F4E]">
              <ShieldCheck className="w-4 h-4" />
              <span>Portal de Super Admin</span>
            </div>
            <h1 className="text-xl font-serif font-bold text-white">Acceso Restringido</h1>
            <p className="text-xs text-[#D9C9B0]/60">
              Ingresa la clave de administración para gestionar pagos manuales y altas en Plan Pro.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input
                type="password"
                required
                autoFocus
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="ADMIN_API_KEY..."
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-xs font-mono focus:outline-none focus:border-[#B68F4E] transition-all"
              />
              <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>

            {loginError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-xs flex items-center gap-2 text-left">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={checkingAuth}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-xs uppercase tracking-wider shadow-lg hover:brightness-105 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>{checkingAuth ? 'Verificando...' : 'Entrar al Panel'}</span>
              <ArrowRight className="w-4 h-4 text-black" />
            </button>
          </form>

          <button
            type="button"
            onClick={onExit}
            className="text-xs text-white/40 hover:text-white transition-colors cursor-pointer"
          >
            ← Volver a la aplicación
          </button>
        </motion.div>
      </div>
    );
  }

  // 2. DASHBOARD ADMINISTRATIVO
  return (
    <div className="min-h-screen bg-[#0A0908] text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#0E0D0B]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BrandLogo variant="full" size="sm" />
          <span className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#B68F4E]/20 text-[#D9C9B0] border border-[#B68F4E]/30">
            <ShieldCheck className="w-3 h-3 text-[#B68F4E]" />
            <span>Super Admin</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadBarbers}
            disabled={loadingBarbers}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loadingBarbers ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-white/70 hover:text-red-300 text-xs font-semibold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {/* Banner de resumen y métricas */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-white/50 text-xs">
              <span>Barberos</span>
              <Users className="w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-mono font-bold text-white"><AnimatedNumber value={stat(totalBarbers)} /></div>
            <div className="text-[10px] text-white/40">Total registrados</div>
          </div>

          <div className="p-4 rounded-2xl bg-[#B68F4E]/10 border border-[#B68F4E]/30 space-y-1">
            <div className="flex items-center justify-between text-[#D9C9B0] text-xs">
              <span className="font-bold">Plan Pro</span>
              <Sparkles className="w-3.5 h-3.5 text-[#B68F4E]" />
            </div>
            <div className="text-2xl font-mono font-bold text-[#F5EBDD]"><AnimatedNumber value={stat(proCount)} /></div>
            <div className="text-[10px] text-[#D9C9B0]/70">
              <AnimatedNumber
                value={stat(totalBarbers ? Math.round((proCount / totalBarbers) * 100) : 0)}
                suffix="%"
              />{' '}
              de penetración
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-white/50 text-xs">
              <span>Plan Gratis</span>
              <Award className="w-3.5 h-3.5" />
            </div>
            <div className="text-2xl font-mono font-bold text-white/90"><AnimatedNumber value={stat(gratisCount)} /></div>
            <div className="text-[10px] text-white/40">Hasta 30 cortes/mes</div>
          </div>

          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-white/50 text-xs">
              <span>Cortes este mes</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-mono font-bold text-white"><AnimatedNumber value={stat(totalCuts)} /></div>
            <div className="text-[10px] text-white/40">Total en la plataforma</div>
          </div>
        </div>

        {/* Buscador y Filtros */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#12110E] p-3 rounded-2xl border border-white/10">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, teléfono o ID..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 text-xs focus:outline-none focus:border-[#B68F4E]"
            />
            <Search className="w-3.5 h-3.5 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            {(['ALL', 'PRO', 'GRATIS'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPlanFilter(mode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
                  planFilter === mode
                    ? 'bg-[#B68F4E] text-black shadow-md font-bold'
                    : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                }`}
              >
                {mode === 'ALL' ? 'Todos' : mode}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla de Barberos */}
        <div className="rounded-3xl bg-[#12110E] border border-white/10 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-white/50 font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4">Barbero</th>
                  <th className="py-3 px-4">Contacto</th>
                  <th className="py-3 px-4">Plan Actual</th>
                  <th className="py-3 px-4">Cortes (Mes)</th>
                  <th className="py-3 px-4">Fecha Registro</th>
                  <th className="py-3 px-4 text-right">Gestión de Plan (Alta Manual)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-white/80">
                {filteredBarbers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-white/40 font-mono">
                      {loadingBarbers ? 'Cargando lista de barberos...' : 'No se encontraron barberos con los filtros actuales.'}
                    </td>
                  </tr>
                ) : (
                  filteredBarbers.map((b) => {
                    const isPro = b.plan === 'PRO';
                    const isUpdating = actionInProgress === b.id;
                    const cleanPhone = (b.phone || '').replace(/\D/g, '');
                    const waLink = cleanPhone
                      ? `https://wa.me/591${cleanPhone.slice(-8)}?text=${encodeURIComponent(
                          `Hola ${b.displayName}, te escribimos de soporte FADE sobre tu cuenta.`
                        )}`
                      : null;

                    return (
                      <tr key={b.id} className="hover:bg-white/[0.02] transition-colors">
                        {/* Barbero */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={b.avatarUrl || '/assets/images/1.png'}
                              alt={b.displayName}
                              className="w-9 h-9 rounded-full object-cover border border-white/10 shrink-0"
                            />
                            <div>
                              <div className="font-bold text-white text-sm flex items-center gap-1.5">
                                <span>{b.displayName}</span>
                                {isPro && <Sparkles className="w-3.5 h-3.5 text-[#B68F4E]" />}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] font-mono text-white/40">
                                <span>ID: {b.id.slice(0, 8)}...</span>
                                <button
                                  type="button"
                                  onClick={() => handleCopy(b.id, b.id)}
                                  className="hover:text-white transition-colors cursor-pointer"
                                  title="Copiar ID completo"
                                >
                                  {copiedId === b.id ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Contacto */}
                        <td className="py-3.5 px-4 space-y-0.5">
                          {b.phone ? (
                            <div className="flex items-center gap-1.5 font-mono text-white/90">
                              <Phone className="w-3 h-3 text-white/40" />
                              <span>{b.phone}</span>
                              {waLink && (
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-emerald-400 hover:underline font-sans ml-1"
                                >
                                  (WhatsApp)
                                </a>
                              )}
                            </div>
                          ) : (
                            <span className="text-white/30 text-[11px]">Sin teléfono</span>
                          )}
                          {b.email && (
                            <div className="flex items-center gap-1.5 text-white/50 text-[11px] truncate max-w-[180px]">
                              <Mail className="w-3 h-3 text-white/30" />
                              <span className="truncate">{b.email}</span>
                            </div>
                          )}
                        </td>

                        {/* Plan Actual */}
                        <td className="py-3.5 px-4">
                          {isPro ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-[#B68F4E]/25 text-[#F5EBDD] border border-[#B68F4E]/40 shadow-[0_0_12px_rgba(182,143,78,0.2)]">
                              <Sparkles className="w-3 h-3 text-[#B68F4E]" />
                              PRO
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-white/10 text-white/60 border border-white/15">
                              GRATIS
                            </span>
                          )}
                        </td>

                        {/* Cortes Mes */}
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-white">
                            <AnimatedNumber value={b.cutsCountThisMonth} />{' '}
                            <span className="text-white/40 text-[10px] font-normal">
                              / {b.maxCuts ? `${b.maxCuts} máx` : 'Ilimitados'}
                            </span>
                          </div>
                        </td>

                        {/* Fecha Registro */}
                        <td className="py-3.5 px-4 font-mono text-[11px] text-white/40">
                          {new Date(b.createdAt).toLocaleDateString('es-BO', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        {/* Acciones de Plan */}
                        <td className="py-3.5 px-4 text-right">
                          {isPro ? (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleTogglePlan(b, 'GRATIS')}
                              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                            >
                              {isUpdating ? 'Actualizando...' : 'Degradar a Gratis'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleTogglePlan(b, 'PRO')}
                              className="px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-xs shadow-md hover:brightness-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ml-auto"
                            >
                              <Sparkles className="w-3 h-3 text-black" />
                              <span>{isUpdating ? 'Activando...' : 'Dar Alta (Activar PRO)'}</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Toast Feedback */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl bg-zinc-900 border border-[#B68F4E]/40 text-[#F5EBDD] text-xs font-semibold backdrop-blur-xl shadow-2xl flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminDashboardView;
