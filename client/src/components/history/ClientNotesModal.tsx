import { useState } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, XCircle, Save, Check } from 'lucide-react';
import type { ClientPreferences } from '../../types/history';
import { SPRING_TOUCH, SPRING_MODAL } from '../../constants/springs';

interface ClientNotesModalProps {
  isOpen: boolean;
  preferences: ClientPreferences;
  onSavePreferences: (updated: ClientPreferences) => void;
  onClose: () => void;
}

export const ClientNotesModal: FC<ClientNotesModalProps> = ({
  isOpen,
  preferences,
  onSavePreferences,
  onClose,
}) => {
  const [generalNotes, setGeneralNotes] = useState(preferences.generalNotes);
  const [likes, setLikes] = useState<string[]>(preferences.likes);
  const [dislikes, setDislikes] = useState<string[]>(preferences.dislikes);
  const [showSavedToast, setShowSavedToast] = useState(false);

  if (!isOpen) return null;

  const handleToggleLike = (item: string) => {
    if (likes.includes(item)) {
      setLikes(likes.filter((l) => l !== item));
    } else {
      setLikes([...likes, item]);
    }
  };

  const handleToggleDislike = (item: string) => {
    if (dislikes.includes(item)) {
      setDislikes(dislikes.filter((d) => d !== item));
    } else {
      setDislikes([...dislikes, item]);
    }
  };

  const handleSave = () => {
    onSavePreferences({
      generalNotes,
      likes,
      dislikes,
    });
    setShowSavedToast(true);
    setTimeout(() => {
      setShowSavedToast(false);
      onClose();
    }, 1200);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={SPRING_MODAL}
          className="fade-surface-elevated relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 space-y-6 text-left select-none border border-white/10"
        >
          {/* Header */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-[#D9C9B0] transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                Mis notas y preferencias
              </h3>
              <p className="text-[11px] text-[#D9C9B0]/60">
                Guarda notas personales para tus próximos cortes.
              </p>
            </div>
          </div>

          {/* Preferencias Generales (Textarea) */}
          <div className="space-y-1.5">
            <label
              htmlFor="general-notes-area"
              className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D9C9B0]/80 block"
            >
              Preferencias Generales
            </label>
            <div className="rounded-2xl bg-black/60 border border-white/10 p-3.5 focus-within:border-[#B68F4E]/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <textarea
                id="general-notes-area"
                rows={3}
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="Escribe notas para que tu barbero las tome en cuenta..."
                className="w-full bg-transparent text-sm text-white placeholder-white/20 focus:outline-none resize-none leading-relaxed font-light"
              />
            </div>
          </div>

          {/* Sección Qué me gusta */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D9C9B0]/80 block">
              Qué me gusta
            </span>
            <div className="space-y-2">
              {likes.map((item) => (
                <div
                  key={item}
                  onClick={() => handleToggleLike(item)}
                  className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 hover:border-white/15 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-[#B68F4E] shrink-0" />
                    <span className="text-xs text-[#F5EBDD] font-medium">{item}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sección Qué evitar */}
          <div className="space-y-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#D9C9B0]/80 block">
              Qué evitar
            </span>
            <div className="space-y-2">
              {dislikes.map((item) => (
                <div
                  key={item}
                  onClick={() => handleToggleDislike(item)}
                  className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5 hover:border-white/15 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-2.5">
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-xs text-[#F5EBDD] font-medium">{item}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Toast de Guardado */}
          <AnimatePresence>
            {showSavedToast && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Preferencias guardadas exitosamente</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Botón Guardar Cambios */}
          <motion.button
            type="button"
            onClick={handleSave}
            whileTap={{ scale: 0.98 }}
            transition={SPRING_TOUCH}
            className="fade-btn-primary w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-xs md:text-sm tracking-[0.12em] font-black cursor-pointer shadow-[0_8px_24px_-4px_rgba(217,201,176,0.35)]"
          >
            <Save className="w-4 h-4" />
            <span>Guardar cambios</span>
          </motion.button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
