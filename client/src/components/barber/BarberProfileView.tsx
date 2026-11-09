import { useState, useEffect, useRef } from 'react';
import type { FC, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  Award,
  CheckCircle2,
  Star,
  MapPin,
  Eye,
  Edit3,
  Save,
  MessageCircle,
  ExternalLink,
  Sparkles,
  Check,
  Plus,
  Trash2,
  Music,
  Upload,
  Users,
} from 'lucide-react';
import type { UserProfile, BarberServiceItem } from '../../services/auth.service';
import {
  updateBarberProfile,
  fetchBarberServices,
  createBarberService,
  deleteBarberService,
  addBarberPortfolioPhoto,
  deleteBarberPortfolioPhoto,
  fetchBarberFollowStatus,
  toggleFollowBarber,
} from '../../services/auth.service';

interface BarberProfileViewProps {
  barber: UserProfile | null;
  onProfileUpdated?: (updated: UserProfile) => void;
}

const ALL_SPECIALTIES = [
  'Mid Fade',
  'Low Fade',
  'High Fade',
  'Skin Fade / Shaver',
  'Tijera & Texturizado',
  'Perfilado de Barba',
  'Barba Spa & Toalla',
  'Diseño / Líneas Navaja',
  'Colorimetría & Platinado',
  'Corte Clásico Ejecutivo',
];

export const BarberProfileView: FC<BarberProfileViewProps> = ({ barber, onProfileUpdated }) => {
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [activeTab, setActiveTab] = useState<'portafolio' | 'servicios' | 'sobre-mi'>('portafolio');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Form State
  const [displayName, setDisplayName] = useState(barber?.displayName || 'Diego Arce');
  const [phone, setPhone] = useState(barber?.phone || '77212345');
  const [bio, setBio] = useState(
    barber?.bio ||
      'Master Barber & Educador capilar con 8 años de trayectoria en La Paz. Especialista en Low & Mid Fades milimétricos y visagismo facial.'
  );
  const [instagram, setInstagram] = useState(barber?.instagram || '@diego_fade_lapaz');
  const [tiktok, setTiktok] = useState(barber?.tiktok || '@diegofade_bo');
  const [avatarUrl, setAvatarUrl] = useState(
    barber?.avatarUrl ||
      'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=500&auto=format&fit=crop&q=80'
  );
  const [specialties, setSpecialties] = useState<string[]>(
    barber?.specialties && barber.specialties.length > 0
      ? barber.specialties
      : ['Mid Fade', 'Skin Fade / Shaver', 'Perfilado de Barba', 'Tijera & Texturizado']
  );
  const [experienceYears, setExperienceYears] = useState(8);

  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Portfolio State
  const [portfolio, setPortfolio] = useState<string[]>(() => {
    return barber?.portfolio && barber.portfolio.length > 0
      ? barber.portfolio
      : [
          'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=900&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=900&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=900&auto=format&fit=crop&q=80',
        ];
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Services State
  const [services, setServices] = useState<BarberServiceItem[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);

  // New Service Input Form (in edit mode)
  const [newServiceName, setNewServiceName] = useState('');
  const [newServicePrice, setNewServicePrice] = useState('50');
  const [newServiceDuration, setNewServiceDuration] = useState('35');
  const [newServiceCategory, setNewServiceCategory] = useState('corte');
  const [isAddingService, setIsAddingService] = useState(false);

  // Followers State
  const [followerCount, setFollowerCount] = useState<number>(barber?.followerCount || 14);
  const [isFollowing, setIsFollowing] = useState<boolean>(Boolean(barber?.isFollowing));
  const [togglingFollow, setTogglingFollow] = useState(false);

  useEffect(() => {
    if (barber?.id) {
      fetchBarberFollowStatus(barber.id).then((res) => {
        setFollowerCount(res.followerCount);
        setIsFollowing(res.isFollowing);
      });
    }
  }, [barber?.id]);

  useEffect(() => {
    if (barber) {
      if (barber.displayName) setDisplayName(barber.displayName);
      if (barber.phone) setPhone(barber.phone);
      if (barber.bio) setBio(barber.bio);
      if (barber.instagram) setInstagram(barber.instagram);
      if (barber.tiktok) setTiktok(barber.tiktok);
      if (barber.avatarUrl) setAvatarUrl(barber.avatarUrl);
      if (barber.specialties && barber.specialties.length > 0) setSpecialties(barber.specialties);
      if (barber.portfolio && barber.portfolio.length > 0) setPortfolio(barber.portfolio);
    }
  }, [barber]);

  useEffect(() => {
    setLoadingServices(true);
    fetchBarberServices()
      .then((res) => setServices(res))
      .catch((err) => console.warn('Could not load services:', err))
      .finally(() => setLoadingServices(false));
  }, []);

  const handleToggleSpecialty = (item: string) => {
    setSpecialties((prev) =>
      prev.includes(item) ? prev.filter((s) => s !== item) : [...prev, item]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await updateBarberProfile({
        displayName,
        phone,
        bio,
        instagram,
        tiktok,
        avatarUrl,
        specialties,
      });

      if (onProfileUpdated) onProfileUpdated(updated);
      setToastMsg('¡Perfil profesional actualizado con éxito!');
      setTimeout(() => setToastMsg(null), 3000);
      setMode('preview');
    } catch (err) {
      console.error('Error al guardar perfil:', err);
      setToastMsg('Error al guardar los cambios.');
      setTimeout(() => setToastMsg(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  // Portfolio Handlers
  const handlePhotoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Url = reader.result as string;
      setPortfolio((prev) => [base64Url, ...prev]);

      try {
        const updated = await addBarberPortfolioPhoto(base64Url);
        if (updated && onProfileUpdated) onProfileUpdated(updated);
        setToastMsg('¡Foto añadida al portafolio!');
      } catch (err) {
        console.error('Error guardando foto:', err);
        setToastMsg('Foto agregada a tu vista previa.');
      }
      setTimeout(() => setToastMsg(null), 3000);
    };
    reader.readAsDataURL(file);
  };

  const handleDeletePhoto = async (photoUrl: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta foto de tu portafolio?')) return;

    setPortfolio((prev) => prev.filter((p) => p !== photoUrl));
    try {
      const updated = await deleteBarberPortfolioPhoto(photoUrl);
      if (updated && onProfileUpdated) onProfileUpdated(updated);
      setToastMsg('Foto eliminada del portafolio');
    } catch (err) {
      console.error('Error eliminando foto:', err);
    }
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Services Handlers
  const handleCreateService = async () => {
    if (!newServiceName.trim()) return;

    try {
      const created = await createBarberService({
        name: newServiceName.trim(),
        priceBs: Number(newServicePrice) || 45,
        durationMin: Number(newServiceDuration) || 30,
        category: newServiceCategory,
      });

      setServices((prev) => [...prev, created]);
      setNewServiceName('');
      setNewServicePrice('50');
      setIsAddingService(false);
      setToastMsg('¡Servicio agregado con éxito!');
    } catch (err) {
      console.error('Error creando servicio:', err);
      setToastMsg('Servicio guardado localmente.');
    }
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleDeleteService = async (serviceId: string) => {
    if (!confirm('¿Deseas eliminar este servicio de tu lista?')) return;

    setServices((prev) => prev.filter((s) => s.id !== serviceId));
    try {
      await deleteBarberService(serviceId);
      setToastMsg('Servicio eliminado');
    } catch (err) {
      console.error('Error borrando servicio:', err);
    }
    setTimeout(() => setToastMsg(null), 3000);
  };

  const handleToggleFollow = async () => {
    if (!barber?.id) return;
    setTogglingFollow(true);
    try {
      const res = await toggleFollowBarber(barber.id);
      setIsFollowing(res.isFollowing);
      setFollowerCount(res.followerCount);
      setToastMsg(
        res.isFollowing
          ? '¡Ahora sigues a este barbero! Recibirás avisos cuando esté disponible.'
          : 'Dejaste de seguir a este barbero.'
      );
    } catch {
      // Optimistic demo toggle
      const nextFollow = !isFollowing;
      setIsFollowing(nextFollow);
      setFollowerCount((prev) => (nextFollow ? prev + 1 : Math.max(0, prev - 1)));
      setToastMsg(
        nextFollow
          ? '¡Ahora sigues a este barbero!'
          : 'Dejaste de seguir a este barbero.'
      );
    } finally {
      setTogglingFollow(false);
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-28 lg:pb-16 space-y-6">
      {/* Input oculto para subir fotos de portafolio */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handlePhotoUpload}
        accept="image/*"
        className="hidden"
      />

      {/* 1. BARRA SUPERIOR DE ACCIONES (Preview vs Quick Edit) */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="space-y-1">
          <span className="text-[10px] uppercase tracking-widest font-mono text-[#B68F4E]">
            Perfil de Autor & Portafolio
          </span>
          <h1 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
            {mode === 'preview' ? 'Vista Pública de tu Perfil' : 'Editar Datos Profesionales'}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {mode === 'preview' ? (
            <button
              type="button"
              onClick={() => setMode('edit')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#B68F4E]" />
              <span>Editar Perfil & Servicios</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setMode('preview')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <Eye className="w-3.5 h-3.5 text-[#B68F4E]" />
              <span>Ver Vista Pública</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. MODO EDICIÓN RÁPIDA */}
      {mode === 'edit' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="fade-surface rounded-3xl p-6 sm:p-8 space-y-6 border border-white/10 shadow-2xl text-left"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Nombre */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80">Nombre Completo</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
              />
            </div>

            {/* Teléfono / WhatsApp (Opcional) */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-white/80">Teléfono / WhatsApp</label>
                <span className="text-[10px] text-white/40">Opcional</span>
              </div>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. 77212345"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
              />
            </div>

            {/* Años de Experiencia */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80">Años de Experiencia</label>
              <input
                type="number"
                min={1}
                max={30}
                value={experienceYears}
                onChange={(e) => setExperienceYears(Number(e.target.value) || 1)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
              />
            </div>

            {/* Foto de Perfil URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80">URL Foto de Perfil (Avatar)</label>
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://images.unsplash.com/..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
              />
            </div>
          </div>

          {/* Biografía */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-white/80">Biografía Profesional (Máx 250 caracteres)</label>
            <textarea
              rows={3}
              maxLength={250}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E] resize-none"
            />
            <span className="text-[10px] text-white/40 block text-right">{bio.length}/250</span>
          </div>

          {/* Redes Sociales: Instagram y TikTok */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80">Perfil de Instagram</label>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@tu_cuenta o https://instagram.com/..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80">Perfil de TikTok</label>
              <input
                type="text"
                value={tiktok}
                onChange={(e) => setTiktok(e.target.value)}
                placeholder="@tu_cuenta o https://tiktok.com/@..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
              />
            </div>
          </div>

          {/* Selector de Especialidades */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-semibold text-white/80 block">
              Especialidades (Selecciona las que dominas)
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_SPECIALTIES.map((spec) => {
                const isSelected = specialties.includes(spec);
                return (
                  <button
                    key={spec}
                    type="button"
                    onClick={() => handleToggleSpecialty(spec)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#B68F4E]/20 border-[#B68F4E] text-[#F5EBDD] font-semibold'
                        : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                    }`}
                  >
                    {isSelected ? `✓ ${spec}` : spec}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CRUD DE SERVICIOS Y TARIFAS */}
          <div className="space-y-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Servicios & Lista de Precios</h3>
                <p className="text-xs text-[#D9C9B0]/60">Define los cortes que ofreces y sus tarifas en Bolivianos.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingService(!isAddingService)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#B68F4E]/15 border border-[#B68F4E]/40 text-[#B68F4E] hover:bg-[#B68F4E]/25 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAddingService ? 'Cancelar' : 'Nuevo Servicio'}</span>
              </button>
            </div>

            {/* Formulario para agregar servicio */}
            <AnimatePresence>
              {isAddingService && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 rounded-2xl bg-white/[0.04] border border-[#B68F4E]/30 space-y-3"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="space-y-1 sm:col-span-1">
                      <label className="text-[11px] text-white/70">Nombre del Servicio</label>
                      <input
                        type="text"
                        value={newServiceName}
                        onChange={(e) => setNewServiceName(e.target.value)}
                        placeholder="Ej. Taper Fade Texturizado"
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-white/70">Precio (Bs)</label>
                      <input
                        type="number"
                        min={10}
                        max={500}
                        value={newServicePrice}
                        onChange={(e) => setNewServicePrice(e.target.value)}
                        placeholder="Bs 50"
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-white/70">Duración (min)</label>
                      <input
                        type="number"
                        min={10}
                        max={180}
                        value={newServiceDuration}
                        onChange={(e) => setNewServiceDuration(e.target.value)}
                        placeholder="35"
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] text-white/70">Categoría</label>
                      <select
                        value={newServiceCategory}
                        onChange={(e) => setNewServiceCategory(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-black/60 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
                      >
                        <option value="corte">Corte</option>
                        <option value="barba">Barba</option>
                        <option value="combo">Combo</option>
                        <option value="color">Color / Químico</option>
                        <option value="tratamiento">Tratamiento</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleCreateService}
                      className="px-4 py-2 rounded-xl bg-[#B68F4E] text-black font-bold text-xs hover:brightness-105 transition-all cursor-pointer"
                    >
                      Guardar Servicio
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Lista actual de servicios */}
            <div className="space-y-2">
              {services.map((srv) => (
                <div
                  key={srv.id}
                  className="p-3.5 rounded-xl bg-white/[0.02] border border-white/10 flex items-center justify-between hover:border-white/20 transition-colors"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-white">{srv.name}</div>
                    <div className="text-[11px] text-[#D9C9B0]/60">
                      {srv.durationMin} min · Categoría: {srv.category || 'General'}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-mono font-bold text-[#B68F4E]">Bs {srv.priceBs}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteService(srv.id)}
                      className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                      title="Eliminar servicio"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* GESTIÓN DE FOTOS DEL PORTAFOLIO EN MODO EDICIÓN */}
          <div className="space-y-3 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white">Fotos de Portafolio ({portfolio.length})</h3>
                <p className="text-xs text-[#D9C9B0]/60">Sube fotos de tus mejores trabajos o elimina las que ya no quieras mostrar.</p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Subir Foto</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              {portfolio.map((imgUrl, i) => (
                <div key={i} className="relative h-32 rounded-xl overflow-hidden border border-white/15 group">
                  <img src={imgUrl} alt={`Portafolio ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(imgUrl)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/80 text-white/80 hover:text-red-400 hover:bg-black transition-colors cursor-pointer shadow-lg"
                    title="Eliminar foto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Botón Guardar */}
          <div className="pt-4 border-t border-white/10 flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-xs shadow-lg hover:brightness-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Guardando...' : 'Guardar Cambios de Perfil'}</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* 3. MODO VISTA PREVIA (Estilo LinkedIn / Cómo lo ve el cliente) */}
      {mode === 'preview' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Banner y Tarjeta Principal */}
          <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left relative overflow-hidden">
            <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-[#B68F4E] shadow-2xl shrink-0">
              <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-2xl font-serif font-bold text-white tracking-tight">{displayName}</h2>
                  <CheckCircle2 className="w-5 h-5 text-[#B68F4E]" />
                </div>
                <div className="flex items-center justify-center sm:justify-end gap-1 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white">
                  <Star className="w-3.5 h-3.5 text-[#B68F4E] fill-current" />
                  <span>5.0</span>
                  <span className="text-white/50">(Verificado)</span>
                </div>
              </div>

              <div className="text-xs text-[#D9C9B0] flex items-center justify-center sm:justify-start gap-1 font-medium">
                <MapPin className="w-3.5 h-3.5 text-[#B68F4E]" />
                <span>
                  {barber?.shopName || 'Darko Studio — Sopocachi'} · {barber?.shopZone || 'Sopocachi'}
                </span>
              </div>

              {/* Status pill & Follow Button */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                  <span className="text-xs font-semibold text-emerald-400">Disponible ahora</span>
                </div>

                <button
                  type="button"
                  onClick={handleToggleFollow}
                  disabled={togglingFollow}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isFollowing
                      ? 'bg-[#B68F4E]/20 border border-[#B68F4E] text-[#F5EBDD] shadow-sm'
                      : 'bg-white/10 hover:bg-white/20 border border-white/15 text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-[#B68F4E]" />
                  <span>{isFollowing ? '✓ Siguiendo' : 'Seguir Barbero'}</span>
                </button>
              </div>

              {/* Specialties pills */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 pt-2">
                {specialties.map((spec) => (
                  <span
                    key={spec}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/5 border border-white/10 text-[#F5EBDD]"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Métricas Profesionales */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-center space-y-1">
              <Clock className="w-4 h-4 mx-auto text-[#B68F4E]" />
              <div className="text-lg font-bold font-serif text-white">{experienceYears}+ Años</div>
              <div className="text-[10px] text-white/50 uppercase tracking-wider">Experiencia</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-center space-y-1">
              <Award className="w-4 h-4 mx-auto text-[#B68F4E]" />
              <div className="text-lg font-bold font-serif text-white">Master</div>
              <div className="text-[10px] text-white/50 uppercase tracking-wider">Rango FADE</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-center space-y-1">
              <Sparkles className="w-4 h-4 mx-auto text-[#B68F4E]" />
              <div className="text-lg font-bold font-serif text-white">{barber?.totalCuts || 19}</div>
              <div className="text-[10px] text-white/50 uppercase tracking-wider">Cortes Este Mes</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 text-center space-y-1">
              <Users className="w-4 h-4 mx-auto text-[#B68F4E]" />
              <div className="text-lg font-bold font-serif text-white">{followerCount}</div>
              <div className="text-[10px] text-white/50 uppercase tracking-wider">Seguidores</div>
            </div>
          </div>

          {/* Navegación de Pestañas: Portafolio / Servicios / Sobre Mí */}
          <div className="border-b border-white/10">
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => setActiveTab('portafolio')}
                className={`pb-3 text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer border-b-2 ${
                  activeTab === 'portafolio'
                    ? 'border-[#B68F4E] text-[#B68F4E]'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                Portafolio ({portfolio.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('servicios')}
                className={`pb-3 text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer border-b-2 ${
                  activeTab === 'servicios'
                    ? 'border-[#B68F4E] text-[#B68F4E]'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                Servicios & Precios ({services.length})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('sobre-mi')}
                className={`pb-3 text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer border-b-2 ${
                  activeTab === 'sobre-mi'
                    ? 'border-[#B68F4E] text-[#B68F4E]'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                Sobre Mí & Redes
              </button>
            </div>
          </div>

          {/* Contenido de Pestañas */}
          <div>
            {/* TAB PORTAFOLIO */}
            {activeTab === 'portafolio' && (
              <div className="space-y-4">
                {/* Botón rápido para añadir foto directamente en preview */}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-[#B68F4E] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Añadir Foto</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {portfolio.map((imgUrl, i) => (
                    <div
                      key={i}
                      onClick={() => setSelectedPhoto(imgUrl)}
                      className="relative h-44 rounded-2xl overflow-hidden border border-white/15 cursor-pointer group"
                    >
                      <img
                        src={imgUrl}
                        alt={`Corte ${i + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between p-3">
                        <span className="text-xs text-white font-medium">Ver en detalle</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePhoto(imgUrl);
                          }}
                          className="p-1.5 rounded-lg bg-red-950/80 text-red-200 border border-red-500/40 hover:bg-red-900 transition-colors cursor-pointer"
                          title="Eliminar de portafolio"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB SERVICIOS DINÁMICOS */}
            {activeTab === 'servicios' && (
              <div className="space-y-2.5">
                {loadingServices && (
                  <div className="text-center py-6 text-xs text-white/40">Cargando servicios...</div>
                )}
                {!loadingServices && services.length === 0 && (
                  <div className="text-center py-6 text-xs text-white/40">No hay servicios registrados aún.</div>
                )}
                {services.map((srv) => (
                  <div
                    key={srv.id}
                    className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-white">{srv.name}</div>
                      <div className="text-xs text-[#D9C9B0]/60">
                        {srv.durationMin} min · {srv.category || 'Corte profesional'}
                      </div>
                    </div>
                    <div className="text-base font-mono font-bold text-[#B68F4E]">Bs {srv.priceBs}</div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB SOBRE MÍ & REDES SOCIALES (WhatsApp, Instagram, TikTok) */}
            {activeTab === 'sobre-mi' && (
              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-5 text-sm text-left">
                <div className="space-y-1.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/50">Biografía</div>
                  <p className="text-white/90 leading-relaxed">{bio}</p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/50">Contacto & Redes Oficiales</div>
                  <div className="flex flex-wrap gap-3">
                    {phone && (
                      <a
                        href={`https://wa.me/${phone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(displayName)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>WhatsApp Directo</span>
                      </a>
                    )}

                    {instagram && (
                      <a
                        href={instagram.startsWith('http') ? instagram : `https://instagram.com/${instagram.replace(/^@/, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-300 text-xs font-semibold hover:bg-pink-500/20 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 text-pink-400" />
                        <span>Instagram ({instagram})</span>
                      </a>
                    )}

                    {tiktok && (
                      <a
                        href={tiktok.startsWith('http') ? tiktok : `https://tiktok.com/@${tiktok.replace(/^@/, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/20 transition-colors"
                      >
                        <Music className="w-4 h-4 text-cyan-400" />
                        <span>TikTok ({tiktok})</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Modal Foto en Detalle */}
      <AnimatePresence>
        {selectedPhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 backdrop-blur-xl"
            onClick={() => setSelectedPhoto(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-md w-full rounded-3xl overflow-hidden border border-white/20 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <img src={selectedPhoto} alt="Corte en detalle" className="w-full h-auto object-cover max-h-[80vh]" />
              <button
                type="button"
                onClick={() => setSelectedPhoto(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-black/70 text-white border border-white/20 hover:bg-black transition-all cursor-pointer"
              >
                ✕
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notificación */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-amber-950/90 border border-amber-500/40 text-amber-200 text-xs font-semibold backdrop-blur-xl shadow-2xl flex items-center gap-2 text-center"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
