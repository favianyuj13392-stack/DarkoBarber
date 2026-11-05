import { useState, useEffect, useRef } from 'react';
import type { FC, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play,
  CheckCircle2,
  X,
  Camera,
  Globe,
  Lock,
  Scissors,
  Loader2,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';
import { SPRING_TOUCH, SPRING_MODAL } from '../../constants/springs';
import { startCut, finalizeCut, type CutChips } from '../../services/cuts.service';
import { presenceService } from '../../services/presence.service';
import {
  requestPhotoConsent,
  pollPhotoConsentResponse,
  CHAIR_SYNC_CHANNEL_NAME,
  PHOTO_CONSENT_RESPONSE_STORAGE_KEY,
} from '../../services/chair.service';

interface RepeatCutConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCutFinalized: () => void;
  onCapturePhoto?: () => void;
  barberName?: string;
  barberId?: string;
  clientPhone?: string;
  clientName?: string;
}

type ModalStep = 'config' | 'recording';

const DEMO_NEW_PHOTOS = [
  { angle: 'Frontal', img: '/assets/images/1.png' },
  { angle: 'Lado izquierdo', img: '/assets/images/2.png' },
  { angle: 'Lado derecho', img: '/assets/images/3.png' },
  { angle: 'Posterior', img: '/assets/images/4.png' },
];

export const RepeatCutConfigModal: FC<RepeatCutConfigModalProps> = ({
  isOpen,
  onClose,
  onCutFinalized,
  barberName = 'Brian López',
  barberId = 'barber-brian',
  clientPhone = '+591 712 34567',
  clientName = 'Ernesto Salinas',
}) => {
  const [step, setStep] = useState<ModalStep>('config');

  // Selected chips (fórmula)
  const [baseLateral, setBaseLateral] = useState<string>('#0.5');
  const [tipoDegradado, setTipoDegradado] = useState<string>('Mid Fade');
  const [parteSuperior, setParteSuperior] = useState<string>('Texturizado');
  const [barbaOption, setBarbaOption] = useState<string>('No');
  const [cutNotes, setCutNotes] = useState<string>('Texturizado con tijera en coronilla y pulido de patillas con shaver.');

  // Cut Execution State
  const [isCutActive, setIsCutActive] = useState(false);
  const [activeCutId, setActiveCutId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // New Cut Photos State
  const [newPhotos, setNewPhotos] = useState<Array<{ angle: string; img: string }>>([
    { angle: 'Frontal', img: '' },
    { angle: 'Lado izquierdo', img: '' },
    { angle: 'Lado derecho', img: '' },
    { angle: 'Posterior', img: '' },
  ]);

  // Portfolio Consent Request State
  const [requestPortfolio, setRequestPortfolio] = useState(true);
  const [isWaitingConsent, setIsWaitingConsent] = useState(false);
  const [consentReceived, setConsentReceived] = useState<{ isPublic: boolean } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeAngleSlotRef = useRef<number>(0);

  // Escuchar respuestas de consentimiento del cliente
  useEffect(() => {
    if (!isOpen || !isWaitingConsent) return;

    // 1. WebSocket listener
    const unsubWs = presenceService.onPhotoConsentResponse((resp) => {
      setIsWaitingConsent(false);
      setConsentReceived({ isPublic: resp.isPublic });
    });

    // 2. BroadcastChannel
    let bc: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      bc = new BroadcastChannel(CHAIR_SYNC_CHANNEL_NAME);
      bc.onmessage = (event) => {
        if (event.data?.type === 'PHOTO_CONSENT_RESPONSE') {
          setIsWaitingConsent(false);
          setConsentReceived({ isPublic: Boolean(event.data.isPublic) });
        }
      };
    }

    // 3. Storage event
    const onStorage = (e: StorageEvent) => {
      if (e.key === PHOTO_CONSENT_RESPONSE_STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          setIsWaitingConsent(false);
          setConsentReceived({ isPublic: Boolean(parsed.isPublic) });
        } catch {}
      }
    };
    window.addEventListener('storage', onStorage);

    // 4. Polling rápido cada 1s con barberId, barberName y clientPhone
    const pollInterval = setInterval(async () => {
      const resp = await pollPhotoConsentResponse(barberId, barberName, clientPhone);
      if (resp) {
        setIsWaitingConsent(false);
        setConsentReceived({ isPublic: resp.isPublic });
      }
    }, 1000);

    return () => {
      unsubWs();
      if (bc) bc.close();
      window.removeEventListener('storage', onStorage);
      clearInterval(pollInterval);
    };
  }, [isOpen, isWaitingConsent, barberId, barberName, clientPhone]);

  if (!isOpen) return null;

  const handleStartCut = async () => {
    setLoading(true);
    try {
      const res = await startCut('client-active');
      setActiveCutId(res.cut.id);
      setIsCutActive(true);
      presenceService.setStatus('RED');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToRecording = () => {
    // Pasar al paso de registro de fotos y detalles del nuevo corte
    setStep('recording');
  };

  const handlePhotoUploadClick = (index: number) => {
    activeAngleSlotRef.current = index;
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setNewPhotos((prev) => {
        const next = [...prev];
        next[activeAngleSlotRef.current] = {
          ...next[activeAngleSlotRef.current],
          img: result,
        };
        return next;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleLoadDemoPhotos = () => {
    setNewPhotos(DEMO_NEW_PHOTOS);
  };

  const handleSendConsentRequest = async () => {
    const mainPhoto = newPhotos.find((p) => p.img)?.img || '/assets/images/1.png';

    setIsWaitingConsent(true);
    setConsentReceived(null);
    try {
      localStorage.removeItem(PHOTO_CONSENT_RESPONSE_STORAGE_KEY);
    } catch {}

    await requestPhotoConsent({
      barberId,
      barberName,
      clientPhone,
      photoUrl: mainPhoto,
      styleName: `${tipoDegradado} · ${parteSuperior}`,
      chips: {
        baseLateral,
        tipoDegradado,
        parteSuperior,
        barba: barbaOption,
      },
      notes: cutNotes,
    });
  };

  const handleCompleteAndFinalize = async () => {
    setLoading(true);
    const chips: CutChips = {
      baseLateral,
      tipoDegradado,
      parteSuperior,
      barba: {
        included: barbaOption !== 'No',
        alturaMejilla: barbaOption !== 'No' ? barbaOption : undefined,
      },
      notasEspeciales: cutNotes ? [cutNotes] : [],
    };

    const validPhotos = newPhotos
      .filter((p) => p.img)
      .map((p) => ({ url: p.img, angle: p.angle }));

    const isPublic = Boolean(consentReceived?.isPublic);

    try {
      if (activeCutId) {
        await finalizeCut(activeCutId, chips, validPhotos, isPublic);
      }

      // Sincronizar corte terminado para que el feed del cliente lo muestre de inmediato
      const newCutItem = {
        id: activeCutId || `cut-${Date.now()}`,
        date: 'Hoy',
        rawDate: new Date().toISOString(),
        monthGroup: 'Noviembre 2026',
        styleName: `${tipoDegradado} · ${parteSuperior}`,
        barberName,
        shopName: 'Fade Studio — Sopocachi',
        durationMinutes: 35,
        priceBs: 60,
        barberNotes: cutNotes || 'Corte finalizado en sillón.',
        photos: validPhotos.map((p, idx) => ({
          id: `photo-${idx}`,
          url: p.url,
          angle: (p.angle as any) || 'Frontal',
          isPublic,
        })),
        coverPhoto: validPhotos[0]?.url || '/assets/images/1.png',
        category: (barbaOption !== 'No' ? 'combo' : 'corte') as any,
        isVerified: true,
        specs: {
          degradedNumber: baseLateral,
          fadeType: tipoDegradado,
          upperTreatment: parteSuperior,
          beardTreatment: barbaOption !== 'No' ? barbaOption : 'Sin barba',
        },
      };

      try {
        const stored = localStorage.getItem('fade_completed_cuts');
        const list = stored ? JSON.parse(stored) : [];
        list.unshift(newCutItem);
        localStorage.setItem('fade_completed_cuts', JSON.stringify(list));

        if (typeof BroadcastChannel !== 'undefined') {
          const bc = new BroadcastChannel(CHAIR_SYNC_CHANNEL_NAME);
          bc.postMessage({ type: 'CUT_FINALIZED', cut: newCutItem });
          bc.close();
        }
      } catch (err) {
        console.warn('Error saving local completed cut:', err);
      }

      setIsCutActive(false);
      setStep('config');
      onCutFinalized();
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/95 backdrop-blur-2xl select-none overflow-y-auto">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileInputChange}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={SPRING_MODAL}
          className="relative z-10 w-full max-w-md min-h-screen sm:min-h-0 sm:max-h-[92vh] sm:rounded-3xl p-6 sm:p-7 space-y-6 text-left flex flex-col justify-between overflow-y-auto bg-[#0E0D0B] border border-[#B68F4E]/30"
        >
          {/* =========================================================================
              HEADER
              ========================================================================= */}
          <header className="flex items-center justify-between">
            <BrandLogo variant="full" size="md" />

            <div className="flex items-center gap-2">
              {step === 'recording' && (
                <button
                  type="button"
                  onClick={() => setStep('config')}
                  className="p-2 rounded-full bg-white/5 border border-white/10 text-white/80 hover:text-white transition-colors cursor-pointer"
                  title="Volver a parámetros"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>

          {/* =========================================================================
              ETAPA 1: CONFIGURACIÓN Y PARÁMETROS DEL CORTE ANTERIOR
              ========================================================================= */}
          {step === 'config' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-serif">
                  Repetir último corte
                </h1>
                <p className="text-xs text-[#D9C9B0]/70 font-light leading-relaxed">
                  Estos son los parámetros del último corte de {clientName}. Puedes modificarlos o iniciar directamente.
                </p>
              </div>

              {/* Banner de Corte Activo */}
              {isCutActive && (
                <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/40 flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_10px_#ef4444]" />
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                        Corte en sillón en curso
                      </h4>
                      <span className="text-[10px] text-red-300 font-mono">
                        Presencia: Ocupado (RED)
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Selectores de Chips */}
              <div className="space-y-4">
                {/* Degradado */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/90 uppercase tracking-wider font-mono">
                    Degradado
                  </label>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {['#0', '#0.5', '#1', '#1.5', '#2'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setBaseLateral(val)}
                        className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer ${
                          baseLateral === val
                            ? 'bg-[#D9C9B0] text-black shadow-md font-bold'
                            : 'bg-white/5 border border-white/10 text-white/70 hover:text-white'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tipo */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/90 uppercase tracking-wider font-mono">
                    Tipo
                  </label>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {['Low Fade', 'Mid Fade', 'High Fade'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setTipoDegradado(val)}
                        className={`px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                          tipoDegradado === val
                            ? 'bg-[#D9C9B0] text-black shadow-md font-bold'
                            : 'bg-white/5 border border-white/10 text-white/70 hover:text-white'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Parte superior */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/90 uppercase tracking-wider font-mono">
                    Parte superior
                  </label>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {['Texturizado', 'Recto', 'Degradado'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setParteSuperior(val)}
                        className={`px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                          parteSuperior === val
                            ? 'bg-[#D9C9B0] text-black shadow-md font-bold'
                            : 'bg-white/5 border border-white/10 text-white/70 hover:text-white'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Barba */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-white/90 uppercase tracking-wider font-mono">
                    Barba
                  </label>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {['No', 'Sí', 'Alta', 'Media', 'Baja'].map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setBarbaOption(val)}
                        className={`px-4 py-2 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                          barbaOption === val
                            ? 'bg-[#D9C9B0] text-black shadow-md font-bold'
                            : 'bg-white/5 border border-white/10 text-white/70 hover:text-white'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Fotos del Corte Anterior (Referencia) */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    Fotos del corte anterior (Referencia)
                  </h3>
                  <span className="text-xs text-[#D9C9B0]/70">4 fotos</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { angle: 'Frontal', img: '/assets/images/1.png' },
                    { angle: 'Lado izquierdo', img: '/assets/images/2.png' },
                    { angle: 'Lado derecho', img: '/assets/images/3.png' },
                    { angle: 'Posterior', img: '/assets/images/4.png' },
                  ].map((item) => (
                    <div
                      key={item.angle}
                      className="relative aspect-4/3 rounded-2xl overflow-hidden border border-white/10 bg-[#161616]"
                    >
                      <img
                        src={item.img}
                        alt={item.angle}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                      <div className="absolute bottom-1.5 left-2 text-[10px] text-white/90 font-mono">
                        {item.angle}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Botón de Iniciar o Finalizar */}
              <div className="pt-2">
                {!isCutActive ? (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    transition={SPRING_TOUCH}
                    onClick={handleStartCut}
                    disabled={loading}
                    className="w-full py-4 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-sm tracking-wide shadow-lg cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Iniciar corte</span>
                  </motion.button>
                ) : (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    transition={SPRING_TOUCH}
                    onClick={handleGoToRecording}
                    className="w-full py-4 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-sm tracking-wide shadow-lg cursor-pointer flex items-center justify-center gap-2 hover:brightness-105"
                  >
                    <Scissors className="w-4 h-4" />
                    <span>Finalizar corte y registrar nuevo trabajo →</span>
                  </motion.button>
                )}
              </div>
            </div>
          )}

          {/* =========================================================================
              ETAPA 2: REGISTRO DE FOTOS DEL NUEVO CORTE & CONSENTIMIENTO
              ========================================================================= */}
          {step === 'recording' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[#B68F4E] text-[10px] font-mono tracking-widest uppercase">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Nuevo corte terminado</span>
                </div>
                <h2 className="text-2xl font-bold text-white tracking-tight font-serif">
                  Registrar fotos y evidencia
                </h2>
                <p className="text-xs text-[#D9C9B0]/80 font-light leading-relaxed">
                  Captura las fotos del corte de hoy de {clientName} para guardarlo en su historial y solicitar publicación.
                </p>
              </div>

              {/* Slots de Fotos del Nuevo Corte */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                    Fotos del corte de hoy (1-4)
                  </label>
                  <button
                    type="button"
                    onClick={handleLoadDemoPhotos}
                    className="text-[11px] text-[#B68F4E] hover:underline cursor-pointer font-mono"
                  >
                    ⚡ Cargar fotos de prueba
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {newPhotos.map((slot, index) => (
                    <div
                      key={slot.angle}
                      onClick={() => handlePhotoUploadClick(index)}
                      className={`relative aspect-4/3 rounded-2xl overflow-hidden border transition-all cursor-pointer flex flex-col items-center justify-center text-center p-2 group ${
                        slot.img
                          ? 'border-[#B68F4E]/60 bg-black'
                          : 'border-dashed border-white/20 bg-white/[0.02] hover:border-[#B68F4E]/40 hover:bg-white/[0.05]'
                      }`}
                    >
                      {slot.img ? (
                        <>
                          <img
                            src={slot.img}
                            alt={slot.angle}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Camera className="w-6 h-6 text-white" />
                          </div>
                          <span className="absolute bottom-1.5 left-2 px-2 py-0.5 rounded-full bg-black/80 text-[10px] font-mono text-[#D9C9B0]">
                            {slot.angle}
                          </span>
                        </>
                      ) : (
                        <div className="space-y-1">
                          <Camera className="w-5 h-5 text-[#B68F4E] mx-auto" />
                          <span className="text-[10px] text-white/80 font-medium block">
                            {slot.angle}
                          </span>
                          <span className="text-[9px] text-[#D9C9B0]/50 block">
                            Toca para tomar/subir
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Notas Técnicas del Nuevo Corte */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                  Notas técnicas del barbero
                </label>
                <textarea
                  value={cutNotes}
                  onChange={(e) => setCutNotes(e.target.value)}
                  placeholder="Detalles de máquina, navaja o morfología..."
                  rows={2}
                  className="w-full p-3 rounded-xl bg-black/60 border border-white/10 text-xs text-white placeholder-white/30 focus:outline-none focus:border-[#B68F4E] transition-colors resize-none font-sans"
                />
              </div>

              {/* Tarjeta de Publicación en Portafolio */}
              <div className="fade-surface rounded-2xl p-4 border border-[#B68F4E]/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-[#B68F4E]" />
                    <span className="text-xs font-bold text-white">
                      Publicar en tu portafolio FADE
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={requestPortfolio}
                    onChange={(e) => setRequestPortfolio(e.target.checked)}
                    className="w-4 h-4 accent-[#B68F4E] cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-[#D9C9B0]/70 font-light leading-relaxed">
                  Al activarlo, se enviará una notificación al celular de {clientName} para que autorice mostrar este trabajo públicamente.
                </p>

                {/* Estado de Espera / Confirmación del Cliente */}
                {isWaitingConsent && (
                  <div className="p-3.5 rounded-xl bg-[#B68F4E]/10 border border-[#B68F4E]/40 space-y-2.5">
                    <div className="flex items-center gap-2.5 text-xs text-[#D9C9B0]">
                      <Loader2 className="w-4 h-4 text-[#B68F4E] animate-spin shrink-0" />
                      <span>Esperando que el cliente autorice en su celular...</span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-[#B68F4E]/20">
                      <button
                        type="button"
                        onClick={() => {
                          setIsWaitingConsent(false);
                          setConsentReceived({ isPublic: true });
                        }}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-[#B68F4E]/20 hover:bg-[#B68F4E]/30 text-[10px] font-mono text-[#D9C9B0] transition-colors cursor-pointer text-center"
                      >
                        ⚡ Simular aprobación (Demo)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsWaitingConsent(false);
                          setConsentReceived({ isPublic: false });
                        }}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-mono text-white/60 hover:text-white transition-colors cursor-pointer text-center"
                      >
                        Continuar privado
                      </button>
                    </div>
                  </div>
                )}

                {consentReceived && (
                  <div
                    className={`p-3 rounded-xl border flex items-center gap-2.5 text-xs font-medium ${
                      consentReceived.isPublic
                        ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                        : 'bg-white/5 border-white/10 text-[#D9C9B0]'
                    }`}
                  >
                    {consentReceived.isPublic ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>¡{clientName} autorizó publicar en portafolio público!</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 text-[#B68F4E] shrink-0" />
                        <span>{clientName} prefirió mantener el corte como privado.</span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Acciones de la Etapa 2 */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                {requestPortfolio && !consentReceived && !isWaitingConsent ? (
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    transition={SPRING_TOUCH}
                    onClick={handleSendConsentRequest}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-xs tracking-wide shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Globe className="w-4 h-4 text-black" />
                    <span>Solicitar autorización de portafolio al cliente</span>
                  </motion.button>
                ) : null}

                {/* Botón para finalizar y pasar al micro-tap de sala de espera */}
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  transition={SPRING_TOUCH}
                  onClick={handleCompleteAndFinalize}
                  disabled={loading}
                  className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs tracking-wide shadow-lg cursor-pointer flex items-center justify-center gap-2 transition-all ${
                    consentReceived?.isPublic
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-950/40'
                      : 'bg-[#B68F4E] hover:bg-[#B68F4E]/90 text-black'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 text-black" />
                  <span>
                    {consentReceived || !requestPortfolio
                      ? 'Finalizar y registrar corte en sala de espera →'
                      : isWaitingConsent
                      ? 'Continuar sin esperar (Guardar como privado) →'
                      : 'Saltar solicitud y finalizar corte →'}
                  </span>
                </motion.button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default RepeatCutConfigModal;
