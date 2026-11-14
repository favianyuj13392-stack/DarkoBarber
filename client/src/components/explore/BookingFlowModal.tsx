import { useState, useEffect, useMemo, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Clock,
  Check,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Phone,
  User as UserIcon,
} from 'lucide-react';
import type { ExploreBarber, BookingDay, BookingSlot } from '../../types/explore';
import {
  fetchBarberAvailability,
  createClientBooking,
  bookingErrorMessage,
  BookingApiError,
  type BarberAvailabilityResponse,
} from '../../services/booking.service';
import { getStoredUser } from '../../services/auth.service';

/** Data of a booking that the server already accepted (it is PENDING until the barber confirms). */
export interface BookingConfirmData {
  barberId: string;
  date: string;
  dateBadge: string;
  time: string;
  totalBs: number;
  serviceNames: string[];
  durationMin: number;
}

interface BookingFlowModalProps {
  isOpen: boolean;
  barber: ExploreBarber | null;
  onClose: () => void;
  onConfirmBooking: (bookingData: BookingConfirmData) => void;
}

export const BookingFlowModal: FC<BookingFlowModalProps> = ({
  isOpen,
  barber,
  onClose,
  onConfirmBooking,
}) => {
  const currentUser = getStoredUser();
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [selectedDay, setSelectedDay] = useState<BookingDay | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [onlyAvailableSlots, setOnlyAvailableSlots] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Bumped to force a fresh availability fetch (e.g. after a 409 SLOT_TAKEN).
  const [availabilityRefresh, setAvailabilityRefresh] = useState(0);

  // Client info state (only asked for when not signed in as a client)
  const isClientSession = currentUser?.role === 'cliente';
  const [clientName, setClientName] = useState(currentUser?.displayName || '');
  const [clientPhone, setClientPhone] = useState(currentUser?.phone || '');

  // Dynamic availability state
  const [availability, setAvailability] = useState<BarberAvailabilityResponse | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Real 7 days window starting from today
  const realDays = useMemo<BookingDay[]>(() => {
    const list: BookingDay[] = [];
    const dayNames = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
    const monthNames = [
      'ENE',
      'FEB',
      'MAR',
      'ABR',
      'MAY',
      'JUN',
      'JUL',
      'AGO',
      'SEP',
      'OCT',
      'NOV',
      'DIC',
    ];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const fullDate = `${yyyy}-${mm}-${dd}`;
      list.push({
        id: `day-${i}`,
        dayName: dayNames[d.getDay()],
        dayNumber: d.getDate(),
        monthName: monthNames[d.getMonth()],
        fullDate,
        isToday: i === 0,
      });
    }
    return list;
  }, []);

  // Initialize day & services
  useEffect(() => {
    if (barber && isOpen) {
      if (barber.services && barber.services.length > 0) {
        setSelectedServiceId(barber.services[0].id);
      }
      setErrorMsg(null);
      const initialDay = realDays[0];
      setSelectedDay(initialDay);
    }
  }, [barber, isOpen, realDays]);

  // Fetch real availability whenever selectedDay or barber changes
  useEffect(() => {
    if (!barber || !selectedDay || !isOpen) return;

    let isMounted = true;
    setLoadingSlots(true);

    fetchBarberAvailability(barber.id, selectedDay.fullDate, selectedServiceId || undefined)
      .then((res) => {
        if (!isMounted) return;
        setAvailability(res);
        // Auto-select first available slot if current selected is invalid
        if (res.availableSlots.length > 0) {
          if (!res.availableSlots.includes(selectedTime)) {
            setSelectedTime(res.availableSlots[0]);
          }
        } else {
          setSelectedTime('');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setAvailability(null);
        setSelectedTime('');
        setErrorMsg(bookingErrorMessage(err));
      })
      .finally(() => {
        if (isMounted) setLoadingSlots(false);
      });

    return () => {
      isMounted = false;
    };
    // selectedTime is intentionally not a dependency: it only validates the current choice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barber, selectedDay, isOpen, selectedServiceId, availabilityRefresh]);

  const displayedSlots: BookingSlot[] = useMemo(() => {
    if (!availability || !availability.allSlots) return [];
    const mapped: BookingSlot[] = availability.allSlots.map((s) => ({
      time: s.time,
      period: s.period,
      available: s.available,
    }));
    return onlyAvailableSlots ? mapped.filter((s) => s.available) : mapped;
  }, [availability, onlyAvailableSlots]);

  if (!isOpen || !barber || !selectedDay) return null;

  const selectService = (id: string) => {
    setSelectedServiceId(id);
    setErrorMsg(null);
  };

  // Price and duration shown here are informative: the server recomputes both from serviceId.
  const selectedService = barber.services.find((s) => s.id === selectedServiceId);
  const totalBs = selectedService?.priceBs ?? 0;
  const totalDurationMin = selectedService?.durationMin ?? 0;

  const morningSlots = displayedSlots.filter((s) => s.period === 'manana');
  const afternoonSlots = displayedSlots.filter((s) => s.period === 'tarde');
  const eveningSlots = displayedSlots.filter((s) => s.period === 'noche');

  // Server error codes that mean "the chosen slot is no longer valid": refresh the grid.
  const STALE_SLOT_CODES = [
    'SLOT_TAKEN',
    'INVALID_SLOT',
    'OUTSIDE_WORKING_HOURS',
    'BOOKING_IN_PAST',
    'BOOKING_TOO_SOON',
    'BARBER_NOT_WORKING',
  ];

  const handleConfirm = async () => {
    if (!selectedTime || !selectedService || submitting) return;
    if (!isClientSession && (!clientName.trim() || !clientPhone.trim())) {
      setErrorMsg('Ingresa tu nombre y teléfono para reservar.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await createClientBooking({
        barberId: barber.id,
        serviceId: selectedService.id,
        date: selectedDay.fullDate,
        time: selectedTime,
        ...(isClientSession
          ? {}
          : { clientName: clientName.trim(), clientPhone: clientPhone.trim() }),
      });
    } catch (err) {
      setErrorMsg(bookingErrorMessage(err));
      if (err instanceof BookingApiError && STALE_SLOT_CODES.includes(err.code)) {
        setSelectedTime('');
        setAvailabilityRefresh((n) => n + 1);
      }
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    setIsConfirmed(true);
    setTimeout(() => {
      onConfirmBooking({
        barberId: barber.id,
        date: selectedDay.fullDate,
        dateBadge: `${selectedDay.dayName} ${selectedDay.dayNumber} ${selectedDay.monthName}`,
        time: selectedTime,
        totalBs,
        serviceNames: [selectedService.name],
        durationMin: totalDurationMin,
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
                {selectedTime} con {barber.name}. Queda pendiente hasta que el barbero la confirme.
              </p>
            </motion.div>
          ) : (
            <>
              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {/* 1. Selección de Servicios */}
                <div className="space-y-2.5">
                  <span className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
                    1. Selecciona tu servicio
                  </span>
                  <div className="space-y-2">
                    {barber.services.map((srv) => {
                      const isSelected = selectedServiceId === srv.id;
                      return (
                        <div
                          key={srv.id}
                          onClick={() => selectService(srv.id)}
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
                    {realDays.map((day) => {
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

                {/* 3. Bloques de Horarios Dinámicos */}
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
                      3. Turno & Hora
                    </span>
                    {availability?.workingHoursSummary && (
                      <span className="text-[11px] text-white/40 font-mono">
                        {availability.workingHoursSummary}
                      </span>
                    )}
                  </div>

                  {/* Validaciones de barbero que no atiende citas o día libre */}
                  {loadingSlots ? (
                    <div className="py-8 text-center text-xs text-white/40 font-mono animate-pulse">
                      Consultando disponibilidad del barbero...
                    </div>
                  ) : availability && !availability.acceptsBookings ? (
                    <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-3 text-xs text-[#D9C9B0]/80">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-white block">Atención Solo Walk-In:</strong>
                        <p className="text-[11px] text-white/60 mt-0.5">
                          Este barbero no está aceptando reservas programadas en este momento. Te espera directamente en su sillón por orden de llegada.
                        </p>
                      </div>
                    </div>
                  ) : availability && !availability.isWorkingDay ? (
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 text-center space-y-1">
                      <p className="text-xs font-bold text-white">Día de descanso</p>
                      <p className="text-[11px] text-white/40">
                        {barber.name} no atiende los {selectedDay.dayName}. Elige otro día de la semana.
                      </p>
                    </div>
                  ) : displayedSlots.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 text-center text-xs text-white/40">
                      No quedan turnos disponibles para este día.
                    </div>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>

                {/* 4. Datos del Cliente (solo si no inició sesión como cliente) */}
                {!isClientSession && (
                <div className="space-y-2.5 pt-2 border-t border-white/10">
                  <span className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
                    4. Tus datos para la cita
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="relative">
                      <UserIcon className="w-4 h-4 text-white/40 absolute left-3 top-3" />
                      <input
                        type="text"
                        placeholder="Tu nombre"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder-white/35 focus:outline-none focus:border-[#B68F4E]"
                      />
                    </div>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-white/40 absolute left-3 top-3" />
                      <input
                        type="tel"
                        placeholder="WhatsApp / Teléfono"
                        value={clientPhone}
                        onChange={(e) => setClientPhone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-black/60 border border-white/15 text-xs text-white placeholder-white/35 focus:outline-none focus:border-[#B68F4E]"
                      />
                    </div>
                  </div>
                </div>
                )}

                {/* Resumen */}
                <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-white/50 block">Fecha y turno</span>
                    <strong className="text-white">
                      {selectedDay.dayName} {selectedDay.dayNumber} {selectedDay.monthName} ·{' '}
                      {selectedTime || 'Selecciona horario'} (~{totalDurationMin} min)
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-white/50 block">Total estimado</span>
                    <strong className="text-[#B68F4E] font-mono text-sm">{totalBs} Bs</strong>
                  </div>
                </div>
              </div>

              {/* Sticky Submit Button */}
              <div className="p-4 bg-black/80 border-t border-white/10 backdrop-blur-xl space-y-2">
                {errorMsg && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start gap-2 text-[11px] text-red-200"
                  >
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-px" />
                    <span>{errorMsg}</span>
                  </div>
                )}
                <button
                  type="button"
                  disabled={
                    submitting ||
                    !selectedTime ||
                    Boolean(availability && (!availability.acceptsBookings || !availability.isWorkingDay))
                  }
                  onClick={handleConfirm}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-extrabold text-xs uppercase tracking-wider shadow-[0_8px_24px_rgba(217,201,176,0.35),inset_0_1px_0_rgba(255,255,255,0.8)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {submitting
                      ? 'Enviando...'
                      : !selectedTime
                      ? 'Elige un horario'
                      : `Confirmar reserva (${totalBs} Bs)`}
                  </span>
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
