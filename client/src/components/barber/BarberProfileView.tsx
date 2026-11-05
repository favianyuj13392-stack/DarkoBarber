import { useState } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scissors,
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
} from 'lucide-react';
import type { UserProfile } from '../../services/auth.service';
import { updateBarberProfile } from '../../services/auth.service';

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

const DEFAULT_SERVICES = [
  { id: '1', name: 'Corte Clásico / Fade', priceBs: 60, durationMin: 35, category: 'Fade técnico con máquina y tijera' },
  { id: '2', name: 'Combo Corte + Barba Perfilada', priceBs: 90, durationMin: 50, category: 'Corte completo + toalla caliente' },
  { id: '3', name: 'Perfilado de Barba & Spa', priceBs: 40, durationMin: 25, category: 'Navaja, vapor y aceites esenciales' },
  { id: '4', name: 'Diseños y Líneas con Navaja', priceBs: 25, durationMin: 15, category: 'Personalización de corte y simetría' },
];

export const BarberProfileView: FC<BarberProfileViewProps> = ({ barber, onProfileUpdated }) => {
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [activeTab, setActiveTab] = useState<'portafolio' | 'servicios' | 'sobre-mi'>('portafolio');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Form State
  const [displayName, setDisplayName] = useState(barber?.displayName || 'Brian López');
  const [phone, setPhone] = useState(barber?.phone || '+591 712 34567');
  const [bio, setBio] = useState(barber?.bio || 'Master Barber especializado en fades de alta precisión, visagismo y perfilado de barba con navaja clásica.');
  const [instagram, setInstagram] = useState(barber?.instagram || 'https://instagram.com');
  const [linkedin, setLinkedin] = useState(barber?.linkedin || 'https://linkedin.com');
  const [avatarUrl, setAvatarUrl] = useState(barber?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80');
  const [specialties, setSpecialties] = useState<string[]>(
    barber?.specialties && barber.specialties.length > 0
      ? barber.specialties
      : ['Mid Fade', 'Skin Fade / Shaver', 'Perfilado de Barba', 'Tijera & Texturizado']
  );
  const [experienceYears, setExperienceYears] = useState(4);

  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const portfolio = barber?.portfolio && barber.portfolio.length > 0
    ? barber.portfolio
    : [
        'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=900&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=900&auto=format&fit=crop&q=80',
        'https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=900&auto=format&fit=crop&q=80',
      ];

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
        linkedin,
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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-28 lg:pb-16 space-y-6">
      {/* 1. Header con Selector de Modo (Vista Previa vs Editar) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>Mi Perfil & Portafolio</span>
            <Sparkles className="w-5 h-5 text-[#B68F4E]" />
          </h1>
          <p className="text-xs text-[#D9C9B0]/60 mt-1">
            Tu carta de presentación profesional, portafolio de trabajos verificados y redes.
          </p>
        </div>

        <div className="flex items-center gap-2 p-1 rounded-2xl bg-white/[0.04] border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              mode === 'preview'
                ? 'bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Vista Pública</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              mode === 'edit'
                ? 'bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editar Perfil</span>
          </button>
        </div>
      </div>

      {/* 2. MODO EDICIÓN */}
      {mode === 'edit' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 bg-white/[0.02] border border-white/10 rounded-3xl p-5 sm:p-7 backdrop-blur-xl"
        >
          {/* Avatar & Foto */}
          <div className="flex items-center gap-5 pb-5 border-b border-white/5">
            <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-[#B68F4E]/40 shrink-0">
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
            </div>
            <div className="space-y-1.5 flex-1">
              <label className="text-xs font-semibold text-white/80 block">URL de Foto de Perfil</label>
              <input
                type="text"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
              />
            </div>
          </div>

          {/* Datos Personales */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80">Nombre Artístico / Profesional</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80">Teléfono / WhatsApp de Contacto</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
              />
            </div>

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

          {/* Redes Sociales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80">Perfil de Instagram</label>
              <input
                type="text"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="https://instagram.com/usuario"
                className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-white/80">Perfil de LinkedIn / Web</label>
              <input
                type="text"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                placeholder="https://linkedin.com/in/usuario"
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

          {/* Botón Guardar */}
          <div className="pt-4 border-t border-white/10 flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-xs shadow-lg hover:brightness-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* 3. MODO VISTA PREVIA (Estilo LinkedIn / Cómo lo ve el cliente) */}
      {mode === 'preview' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
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
                <span>{barber?.shopName || 'Fade Studio — Sopocachi'} · {barber?.shopZone || 'Sopocachi'}</span>
              </div>

              {/* Status pill */}
              <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                <span className="text-xs font-semibold text-emerald-400">Disponible ahora</span>
              </div>

              {/* Specialties pills */}
              <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 pt-2">
                {specialties.map((spec) => (
                  <span
                    key={spec}
                    className="text-[11px] px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-white/80"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Métricas Destacadas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-center space-y-1">
              <Scissors className="w-4 h-4 text-[#B68F4E] mx-auto opacity-80" />
              <div className="text-lg font-mono font-bold text-white">{portfolio.length}+</div>
              <div className="text-[10px] text-white/50 uppercase tracking-wider">Cortes en portafolio</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-center space-y-1">
              <Clock className="w-4 h-4 text-[#B68F4E] mx-auto opacity-80" />
              <div className="text-lg font-mono font-bold text-white">{experienceYears} años</div>
              <div className="text-[10px] text-white/50 uppercase tracking-wider">Experiencia</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-center space-y-1">
              <Award className="w-4 h-4 text-[#B68F4E] mx-auto opacity-80" />
              <div className="text-lg font-mono font-bold text-white">Master</div>
              <div className="text-[10px] text-white/50 uppercase tracking-wider">Especialidad</div>
            </div>
          </div>

          {/* Selector de Pestañas */}
          <div className="border-b border-white/10">
            <div className="flex gap-6">
              <button
                type="button"
                onClick={() => setActiveTab('portafolio')}
                className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer relative ${
                  activeTab === 'portafolio' ? 'text-[#F5EBDD]' : 'text-white/40 hover:text-white/70'
                }`}
              >
                Portafolio ({portfolio.length})
                {activeTab === 'portafolio' && (
                  <motion.div layoutId="barberTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B68F4E]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('servicios')}
                className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer relative ${
                  activeTab === 'servicios' ? 'text-[#F5EBDD]' : 'text-white/40 hover:text-white/70'
                }`}
              >
                Servicios & Tarifas
                {activeTab === 'servicios' && (
                  <motion.div layoutId="barberTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B68F4E]" />
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('sobre-mi')}
                className={`pb-3 text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer relative ${
                  activeTab === 'sobre-mi' ? 'text-[#F5EBDD]' : 'text-white/40 hover:text-white/70'
                }`}
              >
                Sobre mí & Redes
                {activeTab === 'sobre-mi' && (
                  <motion.div layoutId="barberTabIndicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B68F4E]" />
                )}
              </button>
            </div>
          </div>

          {/* Contenido de Pestañas */}
          <div>
            {/* TAB PORTAFOLIO */}
            {activeTab === 'portafolio' && (
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <span className="text-xs text-white font-medium">Ver en detalle</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB SERVICIOS (Sin citas, con precios transparentes) */}
            {activeTab === 'servicios' && (
              <div className="space-y-2.5">
                {DEFAULT_SERVICES.map((srv) => (
                  <div
                    key={srv.id}
                    className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-white">{srv.name}</div>
                      <div className="text-xs text-[#D9C9B0]/60">{srv.category} · {srv.durationMin} min</div>
                    </div>
                    <div className="text-base font-mono font-bold text-[#B68F4E]">
                      Bs {srv.priceBs}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB SOBRE MÍ */}
            {activeTab === 'sobre-mi' && (
              <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 space-y-5 text-sm">
                <div className="space-y-1.5">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/50">Biografía</div>
                  <p className="text-white/90 leading-relaxed">{bio}</p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-white/50">Contacto y Redes</div>
                  <div className="flex flex-wrap gap-3">
                    <a
                      href={`https://wa.me/${phone.replace(/\D/g, '')}?text=Hola%20${encodeURIComponent(displayName)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp Directo</span>
                    </a>

                    {instagram && (
                      <a
                        href={instagram.startsWith('http') ? instagram : `https://${instagram}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold hover:bg-white/10 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 text-[#B68F4E]" />
                        <span>Instagram</span>
                      </a>
                    )}

                    {linkedin && (
                      <a
                        href={linkedin.startsWith('http') ? linkedin : `https://${linkedin}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold hover:bg-white/10 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 text-[#B68F4E]" />
                        <span>LinkedIn</span>
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
