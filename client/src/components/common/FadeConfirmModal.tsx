import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { SPRING_TOUCH } from '../../constants/springs';

export interface FadeConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'gold';
  itemCount?: number;
  previewImage?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const FadeConfirmModal: FC<FadeConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmText = 'Eliminar',
  cancelText = 'Cancelar',
  variant = 'danger',
  itemCount,
  previewImage,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onCancel}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={SPRING_TOUCH}
          className="relative w-full max-w-sm rounded-3xl bg-[#0D0D0D] border border-white/15 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(182,143,78,0.15)] space-y-4 text-left overflow-hidden"
        >
          {/* Header Icon + Title */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                  variant === 'danger'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                    : 'bg-[#B68F4E]/10 text-[#B68F4E] border border-[#B68F4E]/30'
                }`}
              >
                {variant === 'danger' ? <Trash2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-tight font-serif">{title}</h3>
                {itemCount !== undefined && itemCount > 1 && (
                  <span className="text-[10px] uppercase font-mono tracking-wider text-[#B68F4E]">
                    {itemCount} elementos seleccionados
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={onCancel}
              className="p-1.5 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Optional Thumbnail Preview */}
          {previewImage && (
            <div className="w-full h-36 rounded-2xl overflow-hidden border border-white/10 bg-black/40">
              <img src={previewImage} alt="Vista previa" className="w-full h-full object-cover" />
            </div>
          )}

          {/* Description */}
          <p className="text-xs text-[#D9C9B0]/75 leading-relaxed">{description}</p>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white/70 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-lg ${
                variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-900/30'
                  : 'bg-[#B68F4E] hover:bg-[#c29c5a] text-black shadow-[#B68F4E]/30'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
