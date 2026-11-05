import { useState, useEffect, useRef } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Download,
  Copy,
  Check,
  QrCode,
  Sparkles,
  Scissors,
  Share2,
} from 'lucide-react';
import QRCode from 'qrcode';
import { SPRING_TOUCH, SPRING_MODAL } from '../../constants/springs';

interface BarberQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  barberId?: string;
  barberName?: string;
  shopName?: string;
}

export const BarberQrModal: FC<BarberQrModalProps> = ({
  isOpen,
  onClose,
  barberId = 'barber-diego',
  barberName = 'Diego Armando',
  shopName = 'Fade Studio — Sopocachi',
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isGeneratingDownload, setIsGeneratingDownload] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const baseUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://fade.darkosync.com';

  const qrLink = `${baseUrl}/?chair=${encodeURIComponent(
    barberId
  )}&name=${encodeURIComponent(barberName)}&shop=${encodeURIComponent(
    shopName
  )}`;

  useEffect(() => {
    if (!isOpen) return;

    QRCode.toDataURL(qrLink, {
      width: 600,
      margin: 2,
      color: {
        dark: '#050505',
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => setQrDataUrl(url))
      .catch((err) => console.error('Error generating QR code:', err));
  }, [isOpen, qrLink]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadCard = async () => {
    if (!qrDataUrl) return;
    setIsGeneratingDownload(true);

    try {
      const canvas = canvasRef.current || document.createElement('canvas');
      canvas.width = 1000;
      canvas.height = 1350;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Fondo Degradado Premium Obsidiana
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 1350);
      bgGrad.addColorStop(0, '#0D0C0A');
      bgGrad.addColorStop(0.5, '#050505');
      bgGrad.addColorStop(1, '#0D0C0A');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1000, 1350);

      // 2. Marco Dorado Exterior Doble
      ctx.strokeStyle = '#B68F4E';
      ctx.lineWidth = 4;
      ctx.strokeRect(40, 40, 920, 1270);

      ctx.strokeStyle = 'rgba(217, 201, 176, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(55, 55, 890, 1240);

      // Esquinas decorativas doradas
      const cornerSize = 40;
      ctx.fillStyle = '#B68F4E';
      // Top-Left
      ctx.fillRect(36, 36, cornerSize, 6);
      ctx.fillRect(36, 36, 6, cornerSize);
      // Top-Right
      ctx.fillRect(964 - cornerSize, 36, cornerSize, 6);
      ctx.fillRect(958, 36, 6, cornerSize);
      // Bottom-Left
      ctx.fillRect(36, 1308 - 6, cornerSize, 6);
      ctx.fillRect(36, 1308 - cornerSize, 6, cornerSize);
      // Bottom-Right
      ctx.fillRect(964 - cornerSize, 1308 - 6, cornerSize, 6);
      ctx.fillRect(958, 1308 - cornerSize, 6, cornerSize);

      // 3. Header de Marca FADE
      ctx.textAlign = 'center';
      ctx.fillStyle = '#B68F4E';
      ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.letterSpacing = '8px';
      ctx.fillText('· F A D E ·', 500, 120);

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 52px serif';
      ctx.letterSpacing = '2px';
      ctx.fillText('SILLÓN OFICIAL', 500, 185);

      ctx.fillStyle = '#D9C9B0';
      ctx.font = '400 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.letterSpacing = '3px';
      ctx.fillText('HISTORIAL CAPILAR · TU ESTILO', 500, 225);

      // Línea divisoria dorada
      const lineGrad = ctx.createLinearGradient(200, 0, 800, 0);
      lineGrad.addColorStop(0, 'rgba(182, 143, 78, 0)');
      lineGrad.addColorStop(0.5, 'rgba(182, 143, 78, 0.8)');
      lineGrad.addColorStop(1, 'rgba(182, 143, 78, 0)');
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(250, 260);
      ctx.lineTo(750, 260);
      ctx.stroke();

      // 4. Barbero y Estudio
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.letterSpacing = '1px';
      ctx.fillText(barberName, 500, 320);

      ctx.fillStyle = '#D9C9B0';
      ctx.font = '500 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.letterSpacing = '1px';
      ctx.fillText(shopName, 500, 360);

      // 5. Cargar e Insertar Imagen del QR
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = qrDataUrl;
      });

      // Contenedor blanco nítido para lectura infalible con flash o poca luz
      const qrBoxSize = 520;
      const qrBoxX = (1000 - qrBoxSize) / 2;
      const qrBoxY = 410;

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 28);
      ctx.fill();

      // Borde del contenedor QR
      ctx.strokeStyle = 'rgba(182, 143, 78, 0.5)';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Dibujar QR adentro con margen
      const qrPadding = 30;
      ctx.drawImage(
        img,
        qrBoxX + qrPadding,
        qrBoxY + qrPadding,
        qrBoxSize - qrPadding * 2,
        qrBoxSize - qrPadding * 2
      );

      // 6. Instrucciones para el Cliente
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 26px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.letterSpacing = '1px';
      ctx.fillText('Escaneá con la cámara de tu celular', 500, 1000);

      ctx.fillStyle = 'rgba(217, 201, 176, 0.85)';
      ctx.font = '400 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.letterSpacing = '0.5px';
      ctx.fillText('1. Abrí la cámara y apuntá al código QR', 500, 1045);
      ctx.fillText('2. Tocá el enlace para conectar tu perfil', 500, 1080);
      ctx.fillText('3. Tu historial capilar aparecerá en mi sillón', 500, 1115);

      // 7. Pie de Tarjeta
      ctx.fillStyle = '#B68F4E';
      ctx.font = '600 18px monospace';
      ctx.letterSpacing = '2px';
      ctx.fillText('fade.darkosync.com', 500, 1220);

      // 8. Disparar Descarga PNG
      const link = document.createElement('a');
      const safeName = barberName.toLowerCase().replace(/[^a-z0-9]/g, '-');
      link.download = `fade-espejo-${safeName}.png`;
      link.href = canvas.toDataURL('image/png', 1.0);
      link.click();
    } catch (err) {
      console.error('Error al generar la tarjeta imprimible del espejo:', err);
    } finally {
      setIsGeneratingDownload(false);
    }
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Sillón de ${barberName} - FADE`,
          text: `Escaneá este código o abrí el enlace para sentarte en el sillón de ${barberName} (${shopName}) en FADE.`,
          url: qrLink,
        });
      } catch {
        // Ignorar cancelaciones del diálogo de share
      }
    } else {
      handleCopyLink();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl select-none overflow-y-auto">
        {/* Canvas oculto para renderizado de alta resolución */}
        <canvas ref={canvasRef} className="hidden" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={SPRING_MODAL}
          className="relative z-10 w-full max-w-md my-auto flex flex-col rounded-3xl bg-[#0D0C0A] border border-[#B68F4E]/40 shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_30px_rgba(182,143,78,0.15)] overflow-hidden"
        >
          {/* Header del Modal */}
          <header className="flex items-center justify-between p-5 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#B68F4E]/15 border border-[#B68F4E]/30 flex items-center justify-center text-[#B68F4E]">
                <QrCode className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h2 className="text-base font-bold text-white tracking-tight font-serif">
                  Código QR del Espejo
                </h2>
                <p className="text-[11px] text-[#D9C9B0]/70 font-mono">
                  Sillón oficial de corte
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          {/* Tarjeta Visual para Espejo (Preview) */}
          <div className="p-6 space-y-5 text-center">
            <div className="relative p-6 rounded-2xl bg-gradient-to-b from-[#181613] to-[#0A0A0A] border-2 border-[#B68F4E]/40 shadow-inner space-y-4">
              {/* Encabezado FADE */}
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-[10px] tracking-[0.25em] font-mono text-[#B68F4E] uppercase">
                  <Scissors className="w-3 h-3 text-[#B68F4E]" />
                  <span>FADE · SILLÓN OFICIAL</span>
                  <Sparkles className="w-3 h-3 text-[#B68F4E]" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight font-serif">
                  {barberName}
                </h3>
                <p className="text-xs text-[#D9C9B0]/80">{shopName}</p>
              </div>

              {/* QR Code Container */}
              <div className="relative mx-auto w-56 h-56 sm:w-60 sm:h-60 p-4 rounded-2xl bg-white shadow-[0_10px_25px_rgba(0,0,0,0.5)] border border-[#B68F4E]/40 flex items-center justify-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR de Sillón de ${barberName}`}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-black/50">
                    <QrCode className="w-12 h-12 animate-pulse" />
                    <span className="text-xs font-mono">Generando QR...</span>
                  </div>
                )}
              </div>

              {/* Instrucción breve */}
              <p className="text-xs text-[#D9C9B0]/90 font-light max-w-xs mx-auto leading-relaxed">
                El cliente escanea este código desde su asiento para conectar su
                historial biométrico contigo al instante.
              </p>
            </div>

            {/* Acciones Principales */}
            <div className="space-y-2.5">
              {/* Botón Descargar Tarjeta PNG */}
              <motion.button
                type="button"
                whileTap={{ scale: 0.98 }}
                transition={SPRING_TOUCH}
                onClick={handleDownloadCard}
                disabled={isGeneratingDownload || !qrDataUrl}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-sm tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_16px_rgba(217,201,176,0.35)] cursor-pointer flex items-center justify-center gap-2 hover:brightness-105 transition-all disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-black" />
                <span>
                  {isGeneratingDownload
                    ? 'Preparando diseño en alta definición...'
                    : 'Descargar para Espejo (PNG Imprimible)'}
                </span>
              </motion.button>

              {/* Fila de Acciones Secundarias: Copiar Enlace y Compartir */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-[#D9C9B0] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">¡Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar enlace</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-[#D9C9B0] hover:text-white transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Compartir</span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default BarberQrModal;
