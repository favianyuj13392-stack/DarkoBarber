import { useState, useRef } from 'react';
import type { FC, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Camera,
  Plus,
  Trash2,
  Sparkles,
  Scissors,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { SPRING_MODAL } from '../../constants/springs';
import { startCut, finalizeCut } from '../../services/cuts.service';
import { presenceService } from '../../services/presence.service';
import { CHAIR_SYNC_CHANNEL_NAME } from '../../services/chair.service';

interface RepeatCutConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCutFinalized: () => void;
  onCapturePhoto?: () => void;
  barberName?: string;
  barberId?: string;
  clientId?: string;
  clientPhone?: string;
  clientName?: string;
}

/**
 * Comprime imágenes en el cliente mediante canvas para evitar sobrepasar límites de payload y almacenamiento.
 * Convierte fotos tomadas en cámaras móviles (8-15MB) a ~70KB con excelente nitidez.
 */
function compressImage(file: File, maxDimension = 960, quality = 0.8): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        } else {
          resolve((e.target?.result as string) || '');
        }
      };
      img.onerror = () => resolve((e.target?.result as string) || '');
      img.src = (e.target?.result as string) || '';
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

const MAX_PHOTOS = 5;

export const RepeatCutConfigModal: FC<RepeatCutConfigModalProps> = ({
  isOpen,
  onClose,
  onCutFinalized,
  clientId,
  clientPhone = '',
  clientName = '',
}) => {
  // Photos state: Array of base64 images (up to 5)
  // Initially we display slots for Foto 1, Foto 2, Foto 3 + [+] button
  const [photos, setPhotos] = useState<string[]>([]);
  const [activeSlotIndex, setActiveSlotIndex] = useState<number>(0);

  // Intent flag & Notes
  const [sameAsLastTime, setSameAsLastTime] = useState<boolean>(false);
  const [cutNotes, setCutNotes] = useState<string>('');

  // Execution state
  const [activeCutId, setActiveCutId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cutError, setCutError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleOpenPhotoPicker = (slotIndex: number) => {
    setActiveSlotIndex(slotIndex);
    fileInputRef.current?.click();
  };

  const handleAddPhotoClick = () => {
    if (photos.length >= MAX_PHOTOS) return;
    setActiveSlotIndex(photos.length);
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const compressedDataUrl = await compressImage(file, 960, 0.8);
      if (!compressedDataUrl) return;

      setPhotos((prev) => {
        const next = [...prev];
        if (activeSlotIndex < next.length) {
          next[activeSlotIndex] = compressedDataUrl;
        } else {
          next.push(compressedDataUrl);
        }
        return next.slice(0, MAX_PHOTOS);
      });
    } catch (err) {
      console.warn('Error compressing photo:', err);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFinalizeCut = async () => {
    setLoading(true);
    setCutError(null);

    const uploadedPhotos = photos
      .filter(Boolean)
      .map((img, idx) => ({
        url: img,
        angle: `Foto ${idx + 1}`,
      }));

    try {
      let cutIdToFinalize = activeCutId;
      if (!cutIdToFinalize) {
        const startRes = await startCut({ clientId, clientPhone, clientName });
        cutIdToFinalize = startRes.cut.id;
        setActiveCutId(cutIdToFinalize);
        presenceService.setStatus('RED');
      }

      await finalizeCut(cutIdToFinalize, {
        sameAsLastTime,
        notes: cutNotes.trim() || undefined,
        photos: uploadedPhotos,
        isPublic: false,
      });

      // Notificar a otras vistas/pestañas de la finalización del corte
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel(CHAIR_SYNC_CHANNEL_NAME);
          bc.postMessage({ type: 'CUT_FINALIZED', cutId: cutIdToFinalize });
          bc.close();
        }
      } catch (err) {
        console.warn('Could not broadcast finalized cut:', err);
      }

      onCutFinalized();
    } catch (err) {
      setCutError(err instanceof Error ? err.message : 'No se pudo finalizar el corte');
    } finally {
      setLoading(false);
    }
  };

  // Determine how many initial slots to render: at least 3, or more if photos > 3
  const visibleSlotCount = Math.max(3, Math.min(photos.length + 1, MAX_PHOTOS));
  const slotIndices = Array.from({ length: Math.min(visibleSlotCount, 3) }, (_, i) => i);
  // Any extra photos beyond the first 3
  const extraPhotos = photos.slice(3);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-xl select-none overflow-y-auto">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileInputChange}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={SPRING_MODAL}
          className="relative z-10 w-full max-w-md max-h-[92vh] rounded-3xl p-5 sm:p-6 space-y-5 text-left flex flex-col justify-between overflow-y-auto bg-[#0E0D0B] border border-[#B68F4E]/30 shadow-2xl"
        >
          {/* HEADER */}
          <header className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <BrandLogo variant="full" size="sm" />
              {clientName && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#B68F4E]/20 text-[#D9C9B0] border border-[#B68F4E]/30 truncate max-w-[150px]">
                  {clientName}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="space-y-5">
            {/* Título de la acción */}
            <div>
              <h2 className="text-xl font-serif font-bold text-white tracking-tight flex items-center gap-2">
                <span>Registrar Corte</span>
                <Scissors className="w-4 h-4 text-[#B68F4E]" />
              </h2>
              <p className="text-xs text-[#D9C9B0]/60 mt-0.5">
                Sube fotos del resultado y agrega notas técnicas si lo deseas.
              </p>
            </div>

            {/* SECCIÓN 1: FOTOS DEL CORTE (Foto 1, Foto 2, Foto 3 + [+] hasta 5) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-bold uppercase tracking-wider text-white/80">
                  Fotos del corte ({photos.length}/{MAX_PHOTOS})
                </span>
                <span className="text-[11px] text-[#D9C9B0]/60">
                  {photos.length === 0 ? 'Opcional pero recomendado' : 'Nitidez optimizada'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {/* 3 Espacios Iniciales: Foto 1, Foto 2, Foto 3 */}
                {slotIndices.map((idx) => {
                  const photoUrl = photos[idx];
                  return (
                    <div
                      key={`slot-${idx}`}
                      className="relative aspect-square rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden flex flex-col items-center justify-center group transition-all"
                    >
                      {photoUrl ? (
                        <>
                          <img
                            src={photoUrl}
                            alt={`Foto ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemovePhoto(idx);
                            }}
                            className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/75 hover:bg-red-500/80 text-white transition-colors cursor-pointer"
                            title="Eliminar foto"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/70 text-white/90">
                            Foto {idx + 1}
                          </span>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenPhotoPicker(idx)}
                          className="w-full h-full flex flex-col items-center justify-center gap-1.5 text-white/50 hover:text-[#D9C9B0] hover:bg-white/[0.06] transition-all cursor-pointer p-2"
                        >
                          <Camera className="w-5 h-5 text-[#B68F4E]/80" />
                          <span className="text-[11px] font-mono font-semibold">Foto {idx + 1}</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Fotos adicionales (4 y 5) si existen, más el botón [+] */}
              {(extraPhotos.length > 0 || (photos.length >= 3 && photos.length < MAX_PHOTOS)) && (
                <div className="flex items-center gap-2.5 pt-1 overflow-x-auto pb-1">
                  {extraPhotos.map((photoUrl, extraIdx) => {
                    const actualIdx = 3 + extraIdx;
                    return (
                      <div
                        key={`extra-${actualIdx}`}
                        className="relative w-24 h-24 shrink-0 rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden group"
                      >
                        <img
                          src={photoUrl}
                          alt={`Foto ${actualIdx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(actualIdx)}
                          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/75 hover:bg-red-500/80 text-white transition-colors cursor-pointer"
                          title="Eliminar foto"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-black/70 text-white/90">
                          Foto {actualIdx + 1}
                        </span>
                      </div>
                    );
                  })}

                  {/* Cuadradito de agregar foto [+] con límite de 5 */}
                  {photos.length < MAX_PHOTOS && (
                    <button
                      type="button"
                      onClick={handleAddPhotoClick}
                      className="w-24 h-24 shrink-0 rounded-2xl border border-dashed border-[#B68F4E]/40 hover:border-[#B68F4E] bg-[#B68F4E]/5 hover:bg-[#B68F4E]/10 flex flex-col items-center justify-center gap-1 text-[#D9C9B0] transition-all cursor-pointer"
                    >
                      <Plus className="w-5 h-5 text-[#B68F4E]" />
                      <span className="text-[10px] font-mono font-bold">Agregar +</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* SECCIÓN 2: BOTÓN GRANDE “MISMO ESTILO QUE LA ÚLTIMA VEZ” */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setSameAsLastTime((prev) => !prev)}
                className={`w-full p-4 rounded-2xl border transition-all text-left flex items-center justify-between cursor-pointer ${
                  sameAsLastTime
                    ? 'bg-gradient-to-r from-[#B68F4E]/25 to-[#D9C9B0]/20 border-[#B68F4E] shadow-[0_0_20px_rgba(182,143,78,0.25)]'
                    : 'bg-white/[0.03] border-white/10 hover:border-white/20 hover:bg-white/[0.05]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      sameAsLastTime
                        ? 'bg-[#B68F4E] text-black shadow-md'
                        : 'bg-white/5 border border-white/10 text-[#D9C9B0]'
                    }`}
                  >
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white tracking-wide">
                      Mismo estilo que la última vez
                    </h3>
                    <p className="text-[11px] text-[#D9C9B0]/70 mt-0.5">
                      {sameAsLastTime
                        ? '✓ Se registrará como repetición de su corte habitual'
                        : 'Toca aquí si el cliente se realizó su corte de siempre'}
                    </p>
                  </div>
                </div>

                <div
                  className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                    sameAsLastTime
                      ? 'border-[#B68F4E] bg-[#B68F4E] text-black'
                      : 'border-white/20 bg-transparent text-transparent'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 fill-current" />
                </div>
              </button>
            </div>

            {/* SECCIÓN 3: UN SOLO CAMPO DE COMENTARIO OPCIONAL MUY CORTO */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label
                  htmlFor="cutNotesInput"
                  className="font-mono font-bold uppercase tracking-wider text-white/80"
                >
                  Comentario o nota técnica <span className="text-white/40 font-normal">(opcional)</span>
                </label>
                <span className="text-[10px] font-mono text-white/40">
                  {cutNotes.length}/280
                </span>
              </div>
              <textarea
                id="cutNotesInput"
                rows={2}
                maxLength={280}
                value={cutNotes}
                onChange={(e) => setCutNotes(e.target.value)}
                placeholder="Ej: Tijera en coronilla, pulido con shaver, patillas en punta..."
                className="w-full px-3.5 py-2.5 rounded-2xl bg-white/[0.03] border border-white/10 text-white placeholder-white/30 text-xs focus:outline-none focus:border-[#B68F4E] transition-colors resize-none"
              />
            </div>

            {/* Mensaje de error si falla */}
            {cutError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs flex items-center gap-2">
                <X className="w-4 h-4 text-red-400 shrink-0" />
                <span>{cutError}</span>
              </div>
            )}
          </div>

          {/* ACCIÓN PRINCIPAL: FINALIZAR CORTE */}
          <div className="pt-2 border-t border-white/10">
            <button
              type="button"
              disabled={loading}
              onClick={handleFinalizeCut}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-xs uppercase tracking-wider shadow-xl hover:brightness-105 active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Guardando corte...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-black" />
                  <span>Finalizar y Guardar Corte</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default RepeatCutConfigModal;
