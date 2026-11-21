import { useState, useEffect, useMemo, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Clock,
  Check,
  CheckCircle2,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import type { ExploreBarber, BookingDay, BookingSlot } from '../../types/explore';
import { AnimatedNumber } from '../common/AnimatedNumber';
import { SPRING_TOUCH, SPRING_MODAL, SPRING_SLIDE } from '../../constants/springs';
import { usePrefersReducedMotion } from '../../hooks/usePrefersReducedMotion';
import {
  fetchBarberAvailability,
  createClientBooking,
  bookingErrorMessage,
  BookingApiError,
  MAX_SERVICES_PER_BOOKING,
  requestLoginForBooking,
  type BarberAvailabilityResponse,
} from '../../services/booking.service';
import { getLaPazDays } from '../../utils/la-paz-date';
import { getStoredToken, getStoredUser } from '../../services/auth.service';

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
  const reduceMotion = usePrefersReducedMotion();
  const hoverMotion = reduceMotion ? undefined : { scale: 1.02 };
  const tapMotion = reduceMotion ? undefined : { scale: 0.97 };
  // Staggered entrance on a wrapper that only plays on mount, so the stagger
  // delay never leaks into hover/tap animations of the interactive child.
  const stagger = (index: number, cap = 8, step = 0.04) => ({
    initial: reduceMotion ? (false as const) : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: reduceMotion
      ? { duration: 0 }
      : { ...SPRING_SLIDE, delay: Math.min(index, cap) * step },
  });
  const currentUser = getStoredUser();
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [selectedDay, setSelectedDay] = useState<BookingDay | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [onlyAvailableSlots, setOnlyAvailableSlots] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Bumped to force a fresh availability fetch (e.g. after a 409 SLOT_TAKEN).
  const [availabilityRefresh, setAvailabilityRefresh] = useState(0);

  // Booking needs a signed-in client account: name and phone come from the profile.
  const hasSession = Boolean(currentUser) && Boolean(getStoredToken());
  const isClientSession = currentUser?.role === 'cliente' && hasSession;
  // A signed-in barber (or other non-client role) must never be logged out by this flow.
  const isNonClientSession = hasSession && !isClientSession;

  // Dynamic availability state
  const [availability, setAvailability] = useState<BarberAvailabilityResponse | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // Stable dependency for the availability effect (the array identity changes every render).
  const selectedServiceIdsKey = selectedServiceIds.join(',');

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
    getLaPazDays(7).forEach((d, i) => {
      list.push({
        id: `day-${i}`,
        dayName: dayNames[d.weekday],
        dayNumber: d.day,
        monthName: monthNames[d.month - 1],
        fullDate: d.fullDate,
        isToday: i === 0,
      });
    });
    return list;
  }, []);

  // Without any session, send the user to login and come back to this barber afterwards.
  useEffect(() => {
    if (isOpen && barber && !hasSession) {
      requestLoginForBooking(barber.id);
    }
  }, [isOpen, barber, hasSession]);

  // Initialize day & services
  useEffect(() => {
    if (barber && isOpen) {
      if (barber.services && barber.services.length > 0) {
        setSelectedServiceIds([barber.services[0].id]);
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

    fetchBarberAvailability(
      barber.id,
      selectedDay.fullDate,
      selectedServiceIds.length > 0 ? selectedServiceIds : undefined
    )
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
  }, [barber, selectedDay, isOpen, selectedServiceIdsKey, availabilityRefresh]);

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

  const toggleService = (id: string) => {
    setSelectedServiceIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_SERVICES_PER_BOOKING) return prev;
      return [...prev, id];
    });
    setErrorMsg(null);
  };

  // Totals shown here are informative: the server recomputes price and duration from serviceIds.
  const selectedServices = barber.services.filter((s) => selectedServiceIds.includes(s.id));
  const totalBs = selectedServices.reduce((sum, s) => sum + s.priceBs, 0);
  const totalDurationMin = selectedServices.reduce((sum, s) => sum + s.durationMin, 0);

  const morningSlots = displayedSlots.filter((s) => s.period === 'manana');
  const afternoonSlots = displayedSlots.filter((s) => s.period === 'tarde');
  const eveningSlots = displayedSlots.filter((s) => s.period === 'noche');

  // Server error codes that mean "the chosen slot is no longer valid": refresh the grid.
  const STALE_SLOT_CODES = [
    'SLOT_TAKEN',
    'OUTSIDE_WORKING_HOURS',
    'BOOKING_IN_PAST',
    'BOOKING_TOO_SOON',
    'BARBER_NOT_WORKING',
  ];

  const handleConfirm = async () => {
    if (!selectedTime || selectedServices.length === 0 || submitting) return;
    if (isNonClientSession) return;
    if (!isClientSession) {
      requestLoginForBooking(barber.id);
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    try {
      await createClientBooking({
        barberId: barber.id,
        serviceIds: selectedServices.map((s) => s.id),
        date: selectedDay.fullDate,
        time: selectedTime,
      });
    } catch (err) {
      if (err instanceof BookingApiError && err.status === 401) {
        requestLoginForBooking(barber.id);
        setSubmitting(false);
        return;
      }
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
        serviceNames: selectedServices.map((s) => s.name),
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
          initial={reduceMotion ? { opacity: 0 } : { y: '100%', opacity: 0.5 }}
          animate={reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { y: '100%', opacity: 0 }}
          transition={reduceMotion ? { duration: 0 } : SPRING_MODAL}
          className="fade-surface-elevated relative w-full max-w-lg max-h-[92vh] rounded-t-3xl sm:rounded-3xl flex flex-col z-10 overflow-hidden"
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
                  Reserva con{' '}
                  <span className="font-editorial text-base text-gold-gradient">{barber.name}</span>
                </h2>
                <p className="text-[11px] text-[#D9C9B0]/80">{barber.shopName}</p>
              </div>
            </div>

            <motion.button
              type="button"
              onClick={onClose}
              whileHover={hoverMotion}
              whileTap={tapMotion}
              transition={SPRING_TOUCH}
              className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </motion.button>
          </div>

          {/* Success Screen state */}
          <AnimatePresence mode="wait" initial={false}>
          {isConfirmed ? (
            <motion.div
              key="confirmed"
              initial={reduceMotion ? { opacity: 0 } : { scale: 0.9, opacity: 0 }}
              animate={reduceMotion ? { opacity: 1 } : { scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : SPRING_MODAL}
              className="py-16 px-6 text-center space-y-4"
            >
              <div className="w-16 h-16 rounded-full bg-[#B68F4E]/20 border border-[#B68F4E] mx-auto flex items-center justify-center text-[#B68F4E] shadow-[0_0_24px_rgba(182,143,78,0.5)]">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-editorial text-2xl text-gold-gradient">¡Reserva solicitada con éxito!</h3>
              <p className="text-xs text-white/60 max-w-xs mx-auto">
                {selectedDay.dayName} {selectedDay.dayNumber} {selectedDay.monthName} a las{' '}
                {selectedTime} con {barber.name}. Queda pendiente hasta que el barbero la confirme.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : SPRING_SLIDE}
              className="flex flex-col flex-1 min-h-0"
            >
              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
                {/* 1. Selección de Servicios */}
                <div className="space-y-2.5">
                  <span className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
                    1. Selecciona tus servicios
                  </span>
                  <div className="space-y-2">
                    {barber.services.map((srv, srvIndex) => {
                      const isSelected = selectedServiceIds.includes(srv.id);
                      return (
                        <motion.div key={srv.id} {...stagger(srvIndex)}>
                        <motion.div
                          onClick={() => toggleService(srv.id)}
                          whileHover={hoverMotion}
                          whileTap={tapMotion}
                          transition={SPRING_TOUCH}
                          className={`p-3 rounded-2xl border transition-colors cursor-pointer flex items-center justify-between ${
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
                        </motion.div>
                        </motion.div>
                      );
                    })}
                    {barber.services.length === 0 && (
                      <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30 text-center space-y-1">
                        <AlertCircle className="w-5 h-5 text-amber-400 mx-auto" />
                        <p className="text-xs font-semibold text-amber-200">
                          Este barbero aún no tiene servicios disponibles para reservar
                        </p>
                        <p className="text-[11px] text-amber-300/70">
                          El profesional debe configurar servicios y precios en su perfil antes de poder recibir citas online.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Calendario Horizontal */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
                      2. Elige el día
                    </span>
                    <motion.button
                      type="button"
                      onClick={() => setOnlyAvailableSlots(!onlyAvailableSlots)}
                      whileTap={tapMotion}
                      transition={SPRING_TOUCH}
                      className="text-[11px] text-[#D9C9B0]/70 hover:text-white transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <span
                        className={`w-2 h-2 rounded-full transition-colors ${
                          onlyAvailableSlots ? 'bg-emerald-400' : 'bg-white/30'
                        }`}
                      />
                      <span>Solo libres</span>
                    </motion.button>
                  </div>

                  <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1">
                    {realDays.map((day, dayIndex) => {
                      const isSelected = selectedDay.id === day.id;
                      return (
                        <motion.div key={day.id} className="flex-shrink-0" {...stagger(dayIndex, 7, 0.03)}>
                        <motion.button
                          type="button"
                          onClick={() => setSelectedDay(day)}
                          whileHover={hoverMotion}
                          whileTap={tapMotion}
                          transition={SPRING_TOUCH}
                          className={`relative w-16 py-3 rounded-2xl flex flex-col items-center justify-center gap-1 border transition-colors cursor-pointer ${
                            isSelected
                              ? 'text-black border-[#F3E9DC] font-bold'
                              : 'bg-white/5 text-white/70 border-white/10 hover:border-white/25 hover:text-white'
                          }`}
                        >
                          {isSelected && (
                            <motion.span
                              layoutId="booking-day-pill"
                              transition={reduceMotion ? { duration: 0 } : SPRING_TOUCH}
                              className="absolute inset-0 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] shadow-[0_4px_14px_rgba(217,201,176,0.3)]"
                              aria-hidden="true"
                            />
                          )}
                          <span className="relative text-[10px] font-mono tracking-wider">
                            {day.dayName}
                          </span>
                          <span className="relative text-base font-extrabold">{day.dayNumber}</span>
                          <span className="relative text-[9px] uppercase opacity-75">{day.monthName}</span>
                        </motion.button>
                        </motion.div>
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
                            {morningSlots.map((slot, slotIndex) => {
                              const isSelected = selectedTime === slot.time;
                              return (
                                <motion.div key={slot.time} {...stagger(slotIndex, 12, 0.02)}>
                                <motion.button
                                  type="button"
                                  disabled={!slot.available}
                                  onClick={() => setSelectedTime(slot.time)}
                                  whileHover={slot.available ? hoverMotion : undefined}
                                  whileTap={slot.available ? tapMotion : undefined}
                                  transition={SPRING_TOUCH}
                                  className={`w-full py-2 rounded-xl text-xs font-mono font-bold border transition-colors cursor-pointer ${
                                    !slot.available
                                      ? 'opacity-30 border-white/5 bg-white/[0.02] cursor-not-allowed line-through'
                                      : isSelected
                                      ? 'bg-[#B68F4E] text-black border-[#B68F4E] shadow-[0_0_12px_rgba(182,143,78,0.4)]'
                                      : 'bg-white/5 text-white/80 border-white/10 hover:border-white/20'
                                  }`}
                                >
                                  {slot.time}
                                </motion.button>
                                </motion.div>
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
                            {afternoonSlots.map((slot, slotIndex) => {
                              const isSelected = selectedTime === slot.time;
                              return (
                                <motion.div key={slot.time} {...stagger(slotIndex, 12, 0.02)}>
                                <motion.button
                                  type="button"
                                  disabled={!slot.available}
                                  onClick={() => setSelectedTime(slot.time)}
                                  whileHover={slot.available ? hoverMotion : undefined}
                                  whileTap={slot.available ? tapMotion : undefined}
                                  transition={SPRING_TOUCH}
                                  className={`w-full py-2 rounded-xl text-xs font-mono font-bold border transition-colors cursor-pointer ${
                                    !slot.available
                                      ? 'opacity-30 border-white/5 bg-white/[0.02] cursor-not-allowed line-through'
                                      : isSelected
                                      ? 'bg-[#B68F4E] text-black border-[#B68F4E] shadow-[0_0_12px_rgba(182,143,78,0.4)]'
                                      : 'bg-white/5 text-white/80 border-white/10 hover:border-white/20'
                                  }`}
                                >
                                  {slot.time}
                                </motion.button>
                                </motion.div>
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
                            {eveningSlots.map((slot, slotIndex) => {
                              const isSelected = selectedTime === slot.time;
                              return (
                                <motion.div key={slot.time} {...stagger(slotIndex, 12, 0.02)}>
                                <motion.button
                                  type="button"
                                  disabled={!slot.available}
                                  onClick={() => setSelectedTime(slot.time)}
                                  whileHover={slot.available ? hoverMotion : undefined}
                                  whileTap={slot.available ? tapMotion : undefined}
                                  transition={SPRING_TOUCH}
                                  className={`w-full py-2 rounded-xl text-xs font-mono font-bold border transition-colors cursor-pointer ${
                                    !slot.available
                                      ? 'opacity-30 border-white/5 bg-white/[0.02] cursor-not-allowed line-through'
                                      : isSelected
                                      ? 'bg-[#B68F4E] text-black border-[#B68F4E] shadow-[0_0_12px_rgba(182,143,78,0.4)]'
                                      : 'bg-white/5 text-white/80 border-white/10 hover:border-white/20'
                                  }`}
                                >
                                  {slot.time}
                                </motion.button>
                                </motion.div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Resumen */}
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-white/50 block">Fecha y turno</span>
                    <strong className="text-white">
                      {selectedDay.dayName} {selectedDay.dayNumber} {selectedDay.monthName} ·{' '}
                      {selectedTime || 'Selecciona horario'} (~{totalDurationMin} min)
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-white/50 block">Total estimado</span>
                    <strong className="font-editorial text-2xl text-[#B68F4E] leading-none">
                      <AnimatedNumber value={totalBs} suffix=" Bs" />
                    </strong>
                  </div>
                </div>
              </div>

              {/* Sticky Submit Button */}
              <div className="p-4 bg-black/80 border-t border-white/10 backdrop-blur-xl space-y-2">
                {(errorMsg || isNonClientSession) && (
                  <motion.div
                    role="alert"
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={reduceMotion ? { duration: 0 } : SPRING_TOUCH}
                    className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 border-l-2 border-l-[#E85A44] flex items-start gap-2 text-[11px] text-red-100"
                  >
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-px" />
                    <span>
                      {isNonClientSession
                        ? 'Solo las cuentas de cliente pueden reservar. Cierra sesión e ingresa como cliente.'
                        : errorMsg}
                    </span>
                  </motion.div>
                )}
                <motion.button
                  type="button"
                  whileHover={hoverMotion}
                  whileTap={tapMotion}
                  transition={SPRING_TOUCH}
                  disabled={
                    submitting ||
                    isNonClientSession ||
                    barber.services.length === 0 ||
                    !selectedTime ||
                    selectedServices.length === 0 ||
                    Boolean(availability && (!availability.acceptsBookings || !availability.isWorkingDay))
                  }
                  onClick={handleConfirm}
                  className={`w-full py-3.5 rounded-2xl font-extrabold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${
                    barber.services.length === 0
                      ? 'bg-white/10 text-white/40 border border-white/10 cursor-not-allowed'
                      : 'bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black shadow-[0_8px_24px_rgba(217,201,176,0.35),inset_0_1px_0_rgba(255,255,255,0.8)] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
                  }`}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {barber.services.length === 0
                      ? 'Sin servicios disponibles'
                      : submitting
                      ? 'Enviando...'
                      : selectedServices.length === 0
                      ? 'Selecciona al menos un servicio'
                      : !selectedTime
                      ? 'Elige un horario'
                      : `Confirmar reserva (${totalBs} Bs)`}
                  </span>
                </motion.button>
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
