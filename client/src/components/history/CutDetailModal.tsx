import { useState } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Bookmark, MoreVertical, Clock, Banknote, FileText, Repeat, Check, ShieldCheck, Scissors } from 'lucide-react';
import type { HaircutItem } from '../../types/history';
import { SPRING_TOUCH, SPRING_MODAL } from '../../constants/springs';

interface CutDetailModalProps {
  cut: HaircutItem;
  isOpen: boolean;
  onClose: () => void;
  onRepeatCut: (cut: HaircutItem) => void;
}

export const CutDetailModal: FC<CutDetailModalProps> = ({
  cut,
  isOpen,
  onClose,
  onRepeatCut,
}) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [isBookmarked, setIsBookmarked] = useState(cut.isFavorite ?? false);
  const [showTechnicalSheet, setShowTechnicalSheet] = useState(false);
  const [repeatSuccessToast, setRepeatSuccessToast] = useState(false);

  if (!isOpen) return null;

  const currentPhoto = cut.photos[selectedPhotoIndex] || {
    url: cut.coverPhoto,
    angle: 'Frontal',
  };

  const handleRepeat = () => {
    setRepeatSuccessToast(true);
    onRepeatCut(cut);
    setTimeout(() => {
      setRepeatSuccessToast(false);
    }, 2500);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md">
        {/* Backdrop click to close */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={SPRING_MODAL}
          className="fade-surface-elevated relative z-10 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 space-y-6 text-left select-none border border-white/10"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-[#D9C9B0] transition-colors cursor-pointer"
              aria-label="Cerrar detalle"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsBookmarked(!isBookmarked)}
                className={`p-2 rounded-full border transition-all cursor-pointer ${
                  isBookmarked
                    ? 'bg-[#B68F4E]/20 border-[#B68F4E]/60 text-[#B68F4E]'
                    : 'bg-white/5 border-white/10 text-[#D9C9B0]/60 hover:text-white'
                }`}
                aria-label="Guardar en favoritos"
              >
                <Bookmark className={`w-4 h-4 ${isBookmarked ? 'fill-current' : ''}`} />
              </button>

              <button
                type="button"
                className="p-2 rounded-full bg-white/5 border border-white/10 text-[#D9C9B0]/60 hover:text-white transition-colors cursor-pointer"
                aria-label="Más opciones"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Hero Photo Viewer */}
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10 shadow-[0_12px_36px_rgba(0,0,0,0.8)]">
            <img
              src={currentPhoto.url}
              alt={`${cut.styleName} - ${currentPhoto.angle}`}
              className="w-full h-full object-cover object-center filter brightness-95"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />

            {/* Angle Badge */}
            <span className="absolute bottom-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-black/70 text-[#F5EBDD] border border-white/10 backdrop-blur-md">
              Ángulo: {currentPhoto.angle}
            </span>

            {cut.isVerified && (
              <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 backdrop-blur-md">
                <ShieldCheck className="w-3 h-3" /> Verificado por Barbero
              </span>
            )}
          </div>

          {/* Title & Metadata */}
          <div className="space-y-1">
            <span className="text-xs text-[#D9C9B0]/70 font-mono tracking-wider">
              {cut.date}
            </span>
            <h2 className="text-2xl font-bold tracking-tight text-white font-serif">
              {cut.styleName}
            </h2>
            <p className="text-xs text-[#B68F4E] font-medium tracking-wide">
              {cut.shopName} · {cut.barberName}
            </p>
          </div>

          {/* Photo Thumbnails Carousel */}
          {cut.photos.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#D9C9B0]/60">
                Ángulos registrados ({cut.photos.length})
              </span>
              <div className="grid grid-cols-4 gap-2">
                {cut.photos.map((photo, idx) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setSelectedPhotoIndex(idx)}
                    className={`relative aspect-square rounded-xl overflow-hidden border transition-all cursor-pointer ${
                      selectedPhotoIndex === idx
                        ? 'border-[#B68F4E] shadow-[0_0_12px_rgba(182,143,78,0.5)] scale-102'
                        : 'border-white/10 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={photo.url}
                      alt={photo.angle}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Duration & Price Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-black/50 border border-white/5">
              <Clock className="w-4 h-4 text-[#B68F4E] shrink-0" />
              <div>
                <span className="text-[10px] text-[#D9C9B0]/60 uppercase tracking-wider block">
                  Duración
                </span>
                <span className="text-xs font-semibold text-white">
                  {cut.durationMinutes} min
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-black/50 border border-white/5">
              <Banknote className="w-4 h-4 text-[#B68F4E] shrink-0" />
              <div>
                <span className="text-[10px] text-[#D9C9B0]/60 uppercase tracking-wider block">
                  Precio
                </span>
                <span className="text-xs font-bold text-white">
                  {cut.priceBs} Bs
                </span>
              </div>
            </div>
          </div>

          {/* Barber Notes */}
          <div className="p-4 rounded-2xl bg-black/60 border border-white/5 space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#D9C9B0] block">
              Notas del Barbero
            </span>
            <p className="text-xs leading-relaxed text-[#D9C9B0]/80 font-light">
              "{cut.barberNotes}"
            </p>
          </div>

          {/* Technical Sheet Collapsible / Popover */}
          <AnimatePresence>
            {showTechnicalSheet && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-2xl bg-[#B68F4E]/10 border border-[#B68F4E]/25 space-y-3"
              >
                <div className="flex items-center justify-between border-b border-[#B68F4E]/20 pb-2">
                  <span className="text-xs font-bold text-[#F5EBDD] flex items-center gap-2">
                    <Scissors className="w-3.5 h-3.5 text-[#B68F4E]" />
                    Parámetros Técnicos del Sillón
                  </span>
                  <span className="text-[10px] font-mono text-[#B68F4E]">
                    Ficha #{cut.id}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] text-[#D9C9B0]/70 block">Degradado Base</span>
                    <span className="font-semibold text-white">{cut.specs.degradedNumber}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#D9C9B0]/70 block">Tipo de Fade</span>
                    <span className="font-semibold text-white">{cut.specs.fadeType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#D9C9B0]/70 block">Parte Superior</span>
                    <span className="font-semibold text-white">{cut.specs.upperTreatment}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#D9C9B0]/70 block">Arreglo de Barba</span>
                    <span className="font-semibold text-white">{cut.specs.beardTreatment}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Toast Notification for Repetir Corte */}
          <AnimatePresence>
            {repeatSuccessToast && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="p-3 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 shadow-xl"
              >
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  ¡Corte seleccionado para repetir! Se enviará la ficha técnica a tu próxima reserva.
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action CTAs */}
          <div className="space-y-3 pt-2">
            <button
              type="button"
              onClick={() => setShowTechnicalSheet(!showTechnicalSheet)}
              className="fade-btn-secondary w-full py-3 px-4 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold tracking-wider uppercase cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>{showTechnicalSheet ? 'Ocultar ficha técnica' : 'Ver ficha técnica'}</span>
            </button>

            <motion.button
              type="button"
              onClick={handleRepeat}
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              className="fade-btn-primary w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-xs md:text-sm tracking-[0.12em] font-black cursor-pointer shadow-[0_8px_24px_-4px_rgba(217,201,176,0.35)]"
            >
              <Repeat className="w-4 h-4" />
              <span>Repetir este corte</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
