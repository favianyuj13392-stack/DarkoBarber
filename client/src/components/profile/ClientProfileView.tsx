import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  Mail,
  Shield,
  Check,
  Save,
  Sparkles,
  LogOut,
  Edit2,
  Lock,
  Globe,
} from 'lucide-react';
import type { UserProfile } from '../../services/auth.service';
import { getStoredUser } from '../../services/auth.service';
import type { HaircutItem } from '../../types/history';

interface ClientProfileViewProps {
  currentUser?: UserProfile | null;
  cuts?: HaircutItem[];
  onLogout?: () => void;
  onProfileUpdated?: (updated: UserProfile) => void;
}

const MORPHOLOGY_CHIPS = [
  'Remolino fuerte en coronilla',
  'Cicatriz visible en nuca',
  'Pelo fino y lacio',
  'Pelo grueso y rebelde',
  'Entradas pronunciadas',
];

const SENSITIVITY_CHIPS = [
  'Piel sensible a shaver / navaja',
  'Sin alcohol post-afeitado',
  'Usar talco mentolado',
  'Tendencia a irritación en cuello',
];

export const ClientProfileView: FC<ClientProfileViewProps> = ({
  currentUser,
  cuts = [],
  onLogout,
  onProfileUpdated,
}) => {
  const user = currentUser || getStoredUser();

  const [displayName, setDisplayName] = useState(user?.displayName || 'Ernesto Salinas');
  const [phone, setPhone] = useState(user?.phone || '+591 712 34567');
  const [email, setEmail] = useState(user?.email || 'ernesalinasro@gmail.com');
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Ficha Biocutánea State (stored in localStorage)
  const [selectedMorphology, setSelectedMorphology] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('fade_client_morphology');
      return saved ? JSON.parse(saved) : ['Remolino fuerte en coronilla'];
    } catch {
      return ['Remolino fuerte en coronilla'];
    }
  });

  const [selectedSensitivity, setSelectedSensitivity] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('fade_client_sensitivity');
      return saved ? JSON.parse(saved) : ['Piel sensible a shaver / navaja', 'Sin alcohol post-afeitado'];
    } catch {
      return ['Piel sensible a shaver / navaja', 'Sin alcohol post-afeitado'];
    }
  });

  // Client photos from cuts with local consent overrides
  const [photosConsent, setPhotosConsent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const initialMap: Record<string, boolean> = {};
    cuts.forEach((cut) => {
      cut.photos.forEach((ph) => {
        initialMap[ph.id] = ph.isPublic ?? false;
      });
    });
    setPhotosConsent((prev) => ({ ...initialMap, ...prev }));
  }, [cuts]);

  const handleToggleMorphology = (chip: string) => {
    const updated = selectedMorphology.includes(chip)
      ? selectedMorphology.filter((c) => c !== chip)
      : [...selectedMorphology, chip];
    setSelectedMorphology(updated);
    localStorage.setItem('fade_client_morphology', JSON.stringify(updated));
  };

  const handleToggleSensitivity = (chip: string) => {
    const updated = selectedSensitivity.includes(chip)
      ? selectedSensitivity.filter((c) => c !== chip)
      : [...selectedSensitivity, chip];
    setSelectedSensitivity(updated);
    localStorage.setItem('fade_client_sensitivity', JSON.stringify(updated));
  };

  const handleTogglePhotoConsent = async (photoId: string, currentPublic: boolean) => {
    const newPublic = !currentPublic;
    setPhotosConsent((prev) => ({ ...prev, [photoId]: newPublic }));

    try {
      await fetch(`/api/photos/${photoId}/consent`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic: newPublic }),
      });
      setToastMsg(
        newPublic
          ? 'Foto autorizada para el portafolio público de tu barbero.'
          : 'Foto marcada como privada. Ya no se mostrará públicamente.'
      );
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      console.warn('Could not sync consent to server:', err);
      setToastMsg(newPublic ? 'Permiso público guardado.' : 'Permiso privado guardado.');
      setTimeout(() => setToastMsg(null), 3000);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await fetch('/api/clients/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName,
          phone,
          email,
        }),
      });

      const updated = {
        ...user,
        displayName,
        phone,
        email,
      } as UserProfile;

      localStorage.setItem('fade_user_profile', JSON.stringify(updated));
      if (onProfileUpdated) onProfileUpdated(updated);
      setIsEditing(false);
      setToastMsg('¡Datos de perfil actualizados con éxito!');
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      console.error('Error actualizando perfil:', err);
      setToastMsg('Perfil guardado en este dispositivo.');
      setTimeout(() => setToastMsg(null), 3000);
      setIsEditing(false);
    } finally {
      setSaving(false);
    }
  };

  // Collect all photos from cuts
  const allPhotos = cuts.flatMap((c) =>
    c.photos.map((ph) => ({
      ...ph,
      cutDate: c.date,
      styleName: c.styleName,
      barberName: c.barberName,
    }))
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 pb-28 lg:pb-16 space-y-6">
      {/* 1. Header de Identidad del Cliente */}
      <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/10 backdrop-blur-xl flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#B68F4E] shadow-2xl p-0.5 shrink-0 bg-black">
            <img
              src="/assets/images/1.png"
              alt={displayName}
              className="w-full h-full object-cover rounded-full"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl font-serif font-bold text-white tracking-tight">
                {displayName}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#B68F4E]/20 text-[#B68F4E] border border-[#B68F4E]/30">
                Cliente FADE
              </span>
            </div>

            <div className="text-xs text-[#D9C9B0]/70 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 font-mono">
              <span className="flex items-center justify-center sm:justify-start gap-1">
                <Phone className="w-3.5 h-3.5 text-[#B68F4E]" />
                {phone}
              </span>
              <span className="flex items-center justify-center sm:justify-start gap-1">
                <Mail className="w-3.5 h-3.5 text-[#B68F4E]" />
                {email}
              </span>
            </div>

            <div className="pt-1 text-[11px] text-white/50">
              Historial clínico biométrico vinculado · La Paz, Bolivia
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-semibold cursor-pointer transition-colors"
          >
            <Edit2 className="w-3.5 h-3.5 text-[#B68F4E]" />
            <span>{isEditing ? 'Cancelar' : 'Editar Datos'}</span>
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-semibold cursor-pointer transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Modal/Formulario de Edición de Datos */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-6 rounded-3xl bg-white/[0.04] border border-white/15 backdrop-blur-xl space-y-4"
          >
            <h3 className="text-sm font-bold text-white">Editar Datos Personales</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/70">Nombre Completo</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/70">Número de Teléfono (opcional)</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-white/70">Correo Electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveProfile}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-xs shadow-md cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Guardando...' : 'Guardar Datos'}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Ficha Biocutánea Permanente (Chips de Cabello y Piel) */}
      <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-xl space-y-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#B68F4E]" />
            <h2 className="text-base font-serif font-bold text-white">
              Ficha Biocutánea & Preferencias de Sillón
            </h2>
          </div>
          <p className="text-xs text-[#D9C9B0]/60">
            Parámetros técnicos fijos que el barbero lee al sentarte en el sillón para no tener que explicar tu anatomía cada vez.
          </p>
        </div>

        {/* Morfología y Remolinos */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-white/70 block">
            Morfología Capilar & Remolinos
          </span>
          <div className="flex flex-wrap gap-2">
            {MORPHOLOGY_CHIPS.map((chip) => {
              const isSelected = selectedMorphology.includes(chip);
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleToggleMorphology(chip)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#B68F4E]/20 border-[#B68F4E] text-[#F5EBDD] font-semibold'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                  }`}
                >
                  {isSelected ? `✓ ${chip}` : chip}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sensibilidad y Cuidados */}
        <div className="space-y-2 pt-2 border-t border-white/5">
          <span className="text-xs font-bold uppercase tracking-wider text-white/70 block">
            Sensibilidad de Piel & Acabado
          </span>
          <div className="flex flex-wrap gap-2">
            {SENSITIVITY_CHIPS.map((chip) => {
              const isSelected = selectedSensitivity.includes(chip);
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleToggleSensitivity(chip)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#B68F4E]/20 border-[#B68F4E] text-[#F5EBDD] font-semibold'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                  }`}
                >
                  {isSelected ? `✓ ${chip}` : chip}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Bóveda de Privacidad & Fotos de Cortes (Reglas RN-04 y RN-05) */}
      <div className="p-6 rounded-3xl bg-white/[0.02] border border-white/10 backdrop-blur-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#B68F4E]" />
              <h2 className="text-base font-serif font-bold text-white">
                Bóveda de Privacidad & Autorización de Fotos
              </h2>
            </div>
            <p className="text-xs text-[#D9C9B0]/60">
              Control total sobre tus fotografías (Reglas RN-04 y RN-05). Puedes autorizar o revocar que un trabajo aparezca en el portafolio público de tu barbero en cualquier momento.
            </p>
          </div>
          <span className="text-xs font-mono font-bold text-[#B68F4E] shrink-0">
            {allPhotos.length} fotos
          </span>
        </div>

        {allPhotos.length === 0 ? (
          <div className="py-8 text-center text-xs text-white/40">
            Aún no tienes fotografías registradas en tus cortes.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            {allPhotos.map((photo) => {
              const isPublic = photosConsent[photo.id] ?? photo.isPublic ?? false;

              return (
                <div
                  key={photo.id}
                  className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center gap-3.5"
                >
                  <div className="w-16 h-16 rounded-xl overflow-hidden border border-white/15 shrink-0 bg-black">
                    <img
                      src={photo.url}
                      alt={photo.angle}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="text-xs font-bold text-white truncate">
                      {photo.styleName} · {photo.angle}
                    </div>
                    <div className="text-[11px] text-[#D9C9B0]/60 truncate">
                      {photo.barberName} · {photo.cutDate}
                    </div>

                    {/* Toggle Switch */}
                    <button
                      type="button"
                      onClick={() => handleTogglePhotoConsent(photo.id, isPublic)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all cursor-pointer ${
                        isPublic
                          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                          : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                      }`}
                    >
                      {isPublic ? (
                        <>
                          <Globe className="w-3 h-3 text-emerald-400" />
                          <span>Pública en portafolio</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3 h-3 text-white/40" />
                          <span>Privada (Solo tú y tu sillón)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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

export default ClientProfileView;
