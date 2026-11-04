import { useState, useEffect, useRef, useCallback } from 'react';
import type { FC, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Camera,
  Image as ImageIcon,
  SwitchCamera,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import jsQR from 'jsqr';
import { SPRING_TOUCH, SPRING_MODAL } from '../../constants/springs';

export interface ScannedBarberInfo {
  barberId: string;
  barberName: string;
  shopName: string;
  avatarUrl: string;
}

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (barber: ScannedBarberInfo) => void;
}

type CameraStatus = 'requesting' | 'active' | 'denied' | 'unsupported' | 'error';

export const QrScannerModal: FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('requesting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scannedFeedback, setScannedFeedback] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isScanningRef = useRef<boolean>(false);

  const stopCameraStream = useCallback(() => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    isScanningRef.current = false;
  }, []);

  const parseQrPayload = (rawText: string): ScannedBarberInfo | null => {
    try {
      // 1. URL con parámetros ?chair= o ?scan=
      if (
        rawText.startsWith('http://') ||
        rawText.startsWith('https://') ||
        rawText.includes('?chair=') ||
        rawText.includes('?scan=')
      ) {
        const urlStr = rawText.startsWith('http')
          ? rawText
          : `https://fade.darkosync.com/${rawText.startsWith('/') ? rawText.slice(1) : rawText}`;
        const url = new URL(urlStr);
        const chair = url.searchParams.get('chair') || url.searchParams.get('scan');
        if (chair) {
          return {
            barberId: chair,
            barberName: decodeURIComponent(url.searchParams.get('name') || 'Barbero Oficial'),
            shopName: decodeURIComponent(url.searchParams.get('shop') || 'Fade Studio — Sopocachi'),
            avatarUrl: '/assets/images/1.png',
          };
        }
      }

      // 2. Formato JSON
      if (rawText.trim().startsWith('{') && rawText.trim().endsWith('}')) {
        const data = JSON.parse(rawText);
        if (data.barberId || data.id) {
          return {
            barberId: data.barberId || data.id,
            barberName: data.barberName || data.name || 'Barbero Oficial',
            shopName: data.shopName || data.shop || 'Fade Studio — Sopocachi',
            avatarUrl: data.avatarUrl || '/assets/images/1.png',
          };
        }
      }

      // 3. Fallback: texto plano como ID
      if (rawText.trim().length > 0) {
        return {
          barberId: rawText.trim(),
          barberName: 'Barbero Oficial',
          shopName: 'Fade Studio — Sopocachi',
          avatarUrl: '/assets/images/1.png',
        };
      }
    } catch (err) {
      console.warn('Error al parsear payload de QR:', err);
    }
    return null;
  };

  const handleDetectedCode = useCallback(
    (rawText: string) => {
      if (!isScanningRef.current) return;
      isScanningRef.current = false;

      const parsed = parseQrPayload(rawText);
      if (!parsed) {
        // Reanudar escaneo si no era un QR válido
        setTimeout(() => {
          isScanningRef.current = true;
        }, 1500);
        return;
      }

      // Feedback háptico y visual
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 60, 100]);
      }
      setScannedFeedback(true);
      stopCameraStream();

      setTimeout(() => {
        setScannedFeedback(false);
        onScanSuccess(parsed);
      }, 700);
    },
    [onScanSuccess, stopCameraStream]
  );

  const scanVideoFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !isScanningRef.current) return;

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          handleDetectedCode(code.data);
          return;
        }
      }
    }

    if (isScanningRef.current) {
      animFrameIdRef.current = requestAnimationFrame(scanVideoFrame);
    }
  }, [handleDetectedCode]);

  const startCamera = useCallback(async () => {
    stopCameraStream();
    setCameraStatus('requesting');
    setErrorMessage(null);

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('unsupported');
      setErrorMessage('Tu navegador o dispositivo no soporta acceso a la cámara web.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
      }

      setCameraStatus('active');
      isScanningRef.current = true;
      animFrameIdRef.current = requestAnimationFrame(scanVideoFrame);
    } catch (err: unknown) {
      console.warn('Error al acceder a la cámara:', err);
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setCameraStatus('denied');
        setErrorMessage('Permiso de cámara denegado. Habilita el acceso en tu navegador.');
      } else {
        setCameraStatus('error');
        setErrorMessage('No se pudo inicializar la cámara. Puedes subir una foto del código.');
      }
    }
  }, [facingMode, scanVideoFrame, stopCameraStream]);

  // Manejar ciclo de vida al abrir/cerrar modal
  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCameraStream();
    }

    return () => {
      stopCameraStream();
    };
  }, [isOpen, startCamera, stopCameraStream]);

  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Escaneo alternativo: subir imagen/captura de pantalla del QR
  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code && code.data) {
          isScanningRef.current = true;
          handleDetectedCode(code.data);
        } else {
          alert('No se detectó ningún código QR legible en la imagen seleccionada.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSimulateScan = () => {
    isScanningRef.current = true;
    handleDetectedCode(
      'https://fade.darkosync.com/?chair=barber-brian&name=Brian%20L%C3%B3pez&shop=Fade%20Studio%20%E2%80%94%20Sopocachi'
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl select-none overflow-hidden">
        {/* Canvas invisible para procesamiento de fotogramas */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Input oculto para carga de fotos de QR */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Contenedor Principal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={SPRING_MODAL}
          className="relative z-10 w-full max-w-md h-full flex flex-col justify-between p-6 sm:p-8"
        >
          {/* Header Superior */}
          <header className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onClose}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-colors cursor-pointer"
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <h1 className="text-lg font-bold text-white tracking-tight font-serif">
              Escanear código de sillón
            </h1>

            <button
              type="button"
              onClick={handleSwitchCamera}
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-colors cursor-pointer"
              title="Cambiar cámara"
              aria-label="Cambiar cámara"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
          </header>

          {/* Visor Central de la Cámara */}
          <div className="my-auto flex flex-col items-center justify-center space-y-6">
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
              {/* Esquinas Doradas Decorativas */}
              <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-[#B68F4E] rounded-tl-2xl shadow-[0_0_15px_rgba(182,143,78,0.5)] z-20 pointer-events-none" />
              <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-[#B68F4E] rounded-tr-2xl shadow-[0_0_15px_rgba(182,143,78,0.5)] z-20 pointer-events-none" />
              <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-[#B68F4E] rounded-bl-2xl shadow-[0_0_15px_rgba(182,143,78,0.5)] z-20 pointer-events-none" />
              <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-[#B68F4E] rounded-br-2xl shadow-[0_0_15px_rgba(182,143,78,0.5)] z-20 pointer-events-none" />

              {/* Viewfinder Target con Video en Vivo */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl bg-black border border-white/15 flex items-center justify-center overflow-hidden shadow-2xl">
                {/* Elemento de Video de la Cámara */}
                <video
                  ref={videoRef}
                  playsInline
                  autoPlay
                  muted
                  className={`w-full h-full object-cover ${
                    facingMode === 'user' ? '-scale-x-100' : ''
                  }`}
                />

                {/* Estado: Solicitando Cámara */}
                {cameraStatus === 'requesting' && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-2 p-4 text-center z-10">
                    <Loader2 className="w-8 h-8 text-[#B68F4E] animate-spin" />
                    <span className="text-xs text-[#D9C9B0] font-mono">
                      Iniciando cámara...
                    </span>
                  </div>
                )}

                {/* Estado: Error o Permiso Denegado */}
                {(cameraStatus === 'denied' ||
                  cameraStatus === 'unsupported' ||
                  cameraStatus === 'error') && (
                  <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center gap-3 p-4 text-center z-10">
                    <AlertCircle className="w-8 h-8 text-amber-400" />
                    <p className="text-xs text-[#D9C9B0]/90 leading-relaxed font-light">
                      {errorMessage || 'No se pudo acceder a la cámara.'}
                    </p>
                    <button
                      type="button"
                      onClick={startCamera}
                      className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs text-white border border-white/20 cursor-pointer"
                    >
                      Reintentar permiso
                    </button>
                  </div>
                )}

                {/* Feedback de Escaneo Exitoso */}
                {scannedFeedback && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 z-30"
                  >
                    <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
                    <span className="text-xs font-bold text-emerald-200">
                      ¡Código detectado!
                    </span>
                  </motion.div>
                )}

                {/* Láser de Escaneo Animado (Activo mientras se busca QR) */}
                {cameraStatus === 'active' && !scannedFeedback && (
                  <motion.div
                    animate={{
                      top: ['10%', '90%', '10%'],
                    }}
                    transition={{
                      duration: 2.2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                    className="absolute left-3 right-3 h-0.5 bg-gradient-to-r from-transparent via-[#B68F4E] to-transparent shadow-[0_0_12px_#B68F4E] z-10"
                  />
                )}
              </div>
            </div>

            <p className="text-xs text-center text-[#D9C9B0]/80 max-w-xs font-light leading-relaxed">
              Apunta tu cámara al código QR ubicado en el espejo de tu barbero.
            </p>
          </div>

          {/* Acciones Inferiores y Alternativas */}
          <div className="pb-4 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              {/* Botón para subir foto/captura de pantalla */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="py-3 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#D9C9B0] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ImageIcon className="w-4 h-4 text-[#B68F4E]" />
                <span>Cargar imagen QR</span>
              </button>

              {/* Botón para reintentar o encender cámara */}
              <button
                type="button"
                onClick={startCamera}
                className="py-3 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#D9C9B0] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Camera className="w-4 h-4 text-[#B68F4E]" />
                <span>Reiniciar cámara</span>
              </button>
            </div>

            {/* Acceso Rápido Demo (Brian López / Barbero Activo) */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              onClick={handleSimulateScan}
              className="w-full py-3 rounded-xl bg-[#B68F4E]/15 hover:bg-[#B68F4E]/25 border border-[#B68F4E]/40 text-[#D9C9B0] hover:text-white text-xs font-semibold tracking-wide cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#B68F4E]" />
              <span>Simular escaneo de prueba (Brian López)</span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default QrScannerModal;
