import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, QrCode, Sparkles, Camera } from 'lucide-react';
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

export const QrScannerModal: FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
}) => {
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsScanning(false);
    }
  }, [isOpen]);

  const handleSimulateScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      onScanSuccess({
        barberId: 'barber-juan',
        barberName: 'Juan Perez',
        shopName: 'Estudio 16',
        avatarUrl: '/assets/images/1.png',
      });
    }, 1200);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl select-none overflow-hidden">
        {/* Background Vintage Barber Chair Blur */}
        <div className="absolute inset-0 z-0">
          <img
            src="/assets/images/4.png"
            alt="Barber Studio"
            className="w-full h-full object-cover filter brightness-[0.25] blur-sm scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/90" />
        </div>

        {/* Content Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={SPRING_MODAL}
          className="relative z-10 w-full max-w-md h-full flex flex-col justify-between p-6 sm:p-8"
        >
          {/* Header */}
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
              Escanear código
            </h1>

            <div className="w-10" />
          </header>

          {/* Central Viewfinder */}
          <div className="my-auto flex flex-col items-center justify-center space-y-6">
            <div className="relative w-72 h-72 sm:w-80 sm:h-80 flex items-center justify-center">
              {/* Golden Corner Brackets */}
              <div className="absolute -top-1 -left-1 w-10 h-10 border-t-4 border-l-4 border-[#B68F4E] rounded-tl-2xl shadow-[0_0_15px_rgba(182,143,78,0.5)]" />
              <div className="absolute -top-1 -right-1 w-10 h-10 border-t-4 border-r-4 border-[#B68F4E] rounded-tr-2xl shadow-[0_0_15px_rgba(182,143,78,0.5)]" />
              <div className="absolute -bottom-1 -left-1 w-10 h-10 border-b-4 border-l-4 border-[#B68F4E] rounded-bl-2xl shadow-[0_0_15px_rgba(182,143,78,0.5)]" />
              <div className="absolute -bottom-1 -right-1 w-10 h-10 border-b-4 border-r-4 border-[#B68F4E] rounded-br-2xl shadow-[0_0_15px_rgba(182,143,78,0.5)]" />

              {/* Viewfinder Target */}
              <div className="relative w-64 h-64 rounded-3xl bg-black/40 border border-white/10 flex items-center justify-center overflow-hidden backdrop-blur-xs">
                {/* Simulated QR Pattern */}
                <div className="p-6 bg-white/90 rounded-2xl shadow-2xl flex items-center justify-center group-hover:scale-105 transition-transform">
                  <QrCode className="w-36 h-36 text-black" />
                </div>

                {/* Animated Laser Scan Bar */}
                <motion.div
                  animate={{
                    top: ['5%', '90%', '5%'],
                  }}
                  transition={{
                    duration: 2.2,
                    repeat: Infinity,
                    ease: 'easeInOut',
                  }}
                  className="absolute left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-[#B68F4E] to-transparent shadow-[0_0_12px_#B68F4E]"
                />
              </div>
            </div>

            <p className="text-sm text-center text-[#D9C9B0]/90 max-w-xs font-light leading-relaxed">
              Escanea el código de tu barbero para iniciar un corte.
            </p>
          </div>

          {/* Bottom Action Button */}
          <div className="pb-4 space-y-3">
            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              onClick={handleSimulateScan}
              disabled={isScanning}
              className="w-full py-4 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-sm tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_4px_20px_rgba(217,201,176,0.35)] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin text-black" />
                  <span>Enlazando con barbero...</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 text-black" />
                  <span>Escanear código</span>
                </>
              )}
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default QrScannerModal;
