import { useState, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Clock,
  Check,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import type { ExploreBarber, BookingDay, BookingSlot } from '../../types/explore';

interface BookingFlowModalProps {
  isOpen: boolean;
  barber: ExploreBarber | null;
  onClose: () => void;
  onConfirmBooking: (bookingData: {
    barberId: string;
    date: string;
    time: string;
    totalBs: number;
    serviceNames: string[];
  }) => void;
}

const MOCK_DAYS: BookingDay[] = [
  { id: 'd-1', dayName: 'VIE', dayNumber: 16, monthName: 'OCT', fullDate: '2026-10-16', isToday: true },
  { id: 'd-2', dayName: 'SÁB', dayNumber: 17, monthName: 'OCT', fullDate: '2026-10-17' },
  { id: 'd-3', dayName: 'LUN', dayNumber: 19, monthName: 'OCT', fullDate: '2026-10-19' },
  { id: 'd-4', dayName: 'MAR', dayNumber: 20, monthName: 'OCT', fullDate: '2026-10-20' },
  { id: 'd-5', dayName: 'MIÉ', dayNumber: 21, monthName: 'OCT', fullDate: '2026-10-21' },
  { id: 'd-6', dayName: 'JUE', dayNumber: 22, monthName: 'OCT', fullDate: '2026-10-22' },
];

const MOCK_SLOTS: BookingSlot[] = [
  // Mañana
  { time: '09:30', period: 'manana', available: true },
  { time: '10:30', period: 'manana', available: false },
  { time: '11:30', period: 'manana', available: true },
  // Tarde
  { time: '14:00', period: 'tarde', available: true },
  { time: '15:00', period: 'tarde', available: false },
  { time: '16:00', period: 'tarde', available: true },
  { time: '17:00', period: 'tarde', available: true },
  { time: '17:45', period: 'tarde', available: false },
  // Noche
  { time: '18:30', period: 'noche', available: true },
  { time: '19:30', period: 'noche', available: true },
];

export const BookingFlowModal: FC<BookingFlowModalProps> = ({
  isOpen,
  barber,
  onClose,
  onConfirmBooking,
}) => {
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(['srv-fade-pro']);
  const [selectedDay, setSelectedDay] = useState<BookingDay>(MOCK_DAYS[0]);
  const [selectedTime, setSelectedTime] = useState<string>('16:00');
  const [onlyAvailableSlots, setOnlyAvailableSlots] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  if (!isOpen || !barber) return null;

  const toggleService = (id: string) => {
    if (selectedServiceIds.includes(id)) {
      if (selectedServiceIds.length > 1) {
        setSelectedServiceIds(selectedServiceIds.filter((s) => s !== id));
      }
    } else {
      setSelectedServiceIds([...selectedServiceIds, id]);
    }
  };

  const selectedServices = barber.services.filter((s) => selectedServiceIds.includes(s.id));
  const totalBs = selectedServices.reduce((acc, curr) => acc + curr.priceBs, 0);
  const totalDurationMin = selectedServices.reduce((acc, curr) => acc + curr.durationMin, 0);

  const displayedSlots = onlyAvailableSlots
    ? MOCK_SLOTS.filter((s) => s.available)
    : MOCK_SLOTS;

  const morningSlots = displayedSlots.filter((s) => s.period === 'manana');
  const afternoonSlots = displayedSlots.filter((s) => s.period === 'tarde');
  const eveningSlots = displayedSlots.filter((s) => s.period === 'noche');

  const handleConfirm = () => {
    setIsConfirmed(true);
    setTimeout(() => {
      onConfirmBooking({
        barberId: barber.id,
        date: `${selectedDay.dayName} ${selectedDay.dayNumber} ${selectedDay.monthName}`,
        time: selectedTime,
        totalBs,
        serviceNames: selectedServices.map((s) => s.name),
      });
      setIsConfirmed(false);
      onClose();
    }, 1200);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window Sheet */}
        <motion.div
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 280 }}
          className="relative w-full max-w-lg max-h-[92vh] bg-gradient-to-b from-[#181818] via-[#121212] to-[#0A0A0A] border-t sm:border border-white/15 rounded-t-3xl sm:rounded-3xl shadow-[0_-15px_40px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.18)] flex flex-col z-10 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <img
                src={barber.avatar}
                alt={barber.name}
                className="w-10 h-10 rounded-xl object-cover border border-[#B68F4E]/40"
              />
              <div>
                <h2 className="text-sm font-bold text-white tracking-tight">
                  Reserva con {barber.name}
                </h2>
                <p className="text-[11px] text-[#D9C9B0]/80">{barber.shopName}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Success Screen state */}
          {isConfirmed ? (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="py-16 px-6 text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-[#B68F4E]/20 border border-[#B68F4E] mx-auto flex items-center justify-center text-[#B68F4E] shadow-[0_0_24px_rgba(182,143,78,0.5)]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-white">¡Reserva solicitada con éxito!</h3>
              <p className="text-xs text-white/60 max-w-xs mx-auto">
                {selectedDay.dayName} {selectedDay.dayNumber} {selectedDay.monthName} a las{' '}
                {selectedTime} con {barber.name}.
              </p>
            </motion.div>
          ) : (
            <>
              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {/* 1. Selección de Servicios */}
                <div className="space-y-2.5">
                  <span className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
                    1. Selecciona tus servicios
                  </span>
                  <div className="space-y-2">
                    {barber.services.map((srv) => {
                      const isSelected = selectedServiceIds.includes(srv.id);
                      return (
                        <div
                          key={srv.id}
                          onClick={() => toggleService(srv.id)}
                          className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                            isSelected
                              ? 'bg-[#B68F4E]/15 border-[#B68F4E] shadow-[0_0_12px_rgba(182,143,78,0.2)]'
                              : 'bg-white/5 border-white/10 hover:border-white/20'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                                isSelected
                                  ? 'bg-[#B68F4E] border-[#B68F4E] text-black'
                                  : 'border-white/20 bg-black/40'
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <div>
                              <h4 className="text-xs font-bold text-white">{srv.name}</h4>
                              <span className="text-[10px] text-white/50 flex items-center gap-1">
                                <Clock className="w-2.5 h-2.5" /> {srv.durationMin} min
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-mono font-bold text-[#F5EBDD]">
                            {srv.priceBs} Bs
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Calendario Horizontal */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
                      2. Elige el día
                    </span>
                    <button
                      type="button"
                      onClick={() => setOnlyAvailableSlots(!onlyAvailableSlots)}
                      className="text-[11px] text-[#D9C9B0]/70 hover:text-white flex items-center gap-1.5 cursor-pointer"
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          onlyAvailableSlots ? 'bg-emerald-400' : 'bg-white/30'
                        }`}
                      />
                      <span>Solo libres</span>
                    </button>
                  </div>

                  <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1">
                    {MOCK_DAYS.map((day) => {
                      const isSelected = selectedDay.id === day.id;
                      return (
                        <button
                          key={day.id}
                          type="button"
                          onClick={() => setSelectedDay(day)}
                          className={`flex-shrink-0 w-16 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black border-[#F3E9DC] font-bold shadow-[0_4px_14px_rgba(217,201,176,0.3)]'
                              : 'bg-white/5 text-white/70 border-white/10 hover:border-white/25 hover:text-white'
                          }`}
                        >
                          <span className="text-[10px] font-mono tracking-wider">
                            {day.dayName}
                          </span>
                          <span className="text-base font-extrabold">{day.dayNumber}</span>
                          <span className="text-[9px] uppercase opacity-75">{day.monthName}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Bloques de Horarios por Turnos */}
                <div className="space-y-3.5">
                  <span className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
                    3. Turno & Hora
                  </span>

                  {/* Mañana */}
                  {morningSlots.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-white/50 font-medium">Mañana</span>
                      <div className="grid grid-cols-4 gap-2">
                        {morningSlots.map((slot) => {
                          const isSelected = selectedTime === slot.time;
                          return (
                            <button
                              key={slot.time}
                              type="button"
                              disabled={!slot.available}
                              onClick={() => setSelectedTime(slot.time)}
                              className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                                !slot.available
                                  ? 'opacity-30 border-white/5 bg-white/[0.02] cursor-not-allowed line-through'
                                  : isSelected
                                  ? 'bg-[#B68F4E] text-black border-[#B68F4E] shadow-[0_0_12px_rgba(182,143,78,0.4)]'
                                  : 'bg-white/5 text-white/80 border-white/10 hover:border-white/20'
                              }`}
                            >
                              {slot.time}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Tarde */}
                  {afternoonSlots.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-white/50 font-medium">Tarde</span>
                      <div className="grid grid-cols-4 gap-2">
                        {afternoonSlots.map((slot) => {
                          const isSelected = selectedTime === slot.time;
                          return (
                            <button
                              key={slot.time}
                              type="button"
                              disabled={!slot.available}
                              onClick={() => setSelectedTime(slot.time)}
                              className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                                !slot.available
                                  ? 'opacity-30 border-white/5 bg-white/[0.02] cursor-not-allowed line-through'
                                  : isSelected
                                  ? 'bg-[#B68F4E] text-black border-[#B68F4E] shadow-[0_0_12px_rgba(182,143,78,0.4)]'
                                  : 'bg-white/5 text-white/80 border-white/10 hover:border-white/20'
                              }`}
                            >
                              {slot.time}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Noche */}
                  {eveningSlots.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] text-white/50 font-medium">Noche</span>
                      <div className="grid grid-cols-4 gap-2">
                        {eveningSlots.map((slot) => {
                          const isSelected = selectedTime === slot.time;
                          return (
                            <button
                              key={slot.time}
                              type="button"
                              disabled={!slot.available}
                              onClick={() => setSelectedTime(slot.time)}
                              className={`py-2 rounded-xl text-xs font-mono font-bold border transition-all cursor-pointer ${
                                !slot.available
                                  ? 'opacity-30 border-white/5 bg-white/[0.02] cursor-not-allowed line-through'
                                  : isSelected
                                  ? 'bg-[#B68F4E] text-black border-[#B68F4E] shadow-[0_0_12px_rgba(182,143,78,0.4)]'
                                  : 'bg-white/5 text-white/80 border-white/10 hover:border-white/20'
                              }`}
                            >
                              {slot.time}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Resumen */}
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-white/50 block">Fecha y duración</span>
                    <strong className="text-white">
                      {selectedDay.dayName} {selectedDay.dayNumber} {selectedDay.monthName} ·{' '}
                      {selectedTime} (~{totalDurationMin} min)
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-white/50 block">Total a pagar</span>
                    <strong className="text-[#B68F4E] font-mono text-sm">{totalBs} Bs</strong>
                  </div>
                </div>
              </div>

              {/* Sticky Submit Button */}
              <div className="p-4 bg-black/80 border-t border-white/10 backdrop-blur-xl">
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-extrabold text-xs uppercase tracking-wider shadow-[0_8px_24px_rgba(217,201,176,0.35),inset_0_1px_0_rgba(255,255,255,0.8)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Confirmar reserva ({totalBs} Bs)</span>
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
