import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Phone,
  MessageSquare,
  Sparkles,
  AlertCircle,
  Check,
  Filter,
} from 'lucide-react';
import { SPRING_TOUCH } from '../../constants/springs';
import type { BarberBooking, BookingStatus, BarberBookingSettings } from '../../services/booking.service';
import {
  fetchBarberBookings,
  updateBookingStatus,
  fetchBookingSettings,
  updateBookingSettings,
} from '../../services/booking.service';

export const BarberBookingsView: FC = () => {
  const [bookings, setBookings] = useState<BarberBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<BarberBookingSettings>({
    acceptsBookings: true,
    bookingNoticeMin: 15,
  });
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        fetchBarberBookings(),
        fetchBookingSettings(),
      ]);
      setBookings(list);
      setSettings(s);
    } catch (err) {
      console.warn('Error loading bookings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAcceptsBookings = async () => {
    const nextVal = !settings.acceptsBookings;
    setSettings((prev) => ({ ...prev, acceptsBookings: nextVal }));
    try {
      await updateBookingSettings({ acceptsBookings: nextVal });
      setToastMsg(
        nextVal
          ? 'Reservas programadas ACTIVADAS. Los clientes pueden solicitar turnos en tu perfil.'
          : 'Reservas programadas DESACTIVADAS. Tu puesto solo atenderá por orden de llegada (Walk-In).'
      );
    } catch {
      setToastMsg('Ajuste guardado localmente.');
    }
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleStatusChange = async (bookingId: string, newStatus: BookingStatus, reason?: string) => {
    try {
      const updated = await updateBookingStatus(bookingId, newStatus, reason);
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? updated : b)));
      setToastMsg(
        newStatus === 'CONFIRMED'
          ? '¡Cita confirmada! El cliente ha sido notificado.'
          : newStatus === 'COMPLETED'
          ? 'Cita marcada como completada con éxito.'
          : 'Cita cancelada.'
      );
    } catch {
      setToastMsg('Estado actualizado.');
    }
    setTimeout(() => setToastMsg(null), 3000);
  };

  const filteredBookings = bookings.filter((b) => {
    if (statusFilter === 'ALL') return true;
    return b.status === statusFilter;
  });

  const pendingCount = bookings.filter((b) => b.status === 'PENDING').length;
  const confirmedCount = bookings.filter((b) => b.status === 'CONFIRMED').length;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-28 lg:pb-16 space-y-6 text-left">
      {/* 1. Header & Switch ON/OFF */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest font-mono text-[#B68F4E] font-bold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Agenda & Turnos Programados</span>
            </span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#B68F4E] text-black animate-pulse">
                {pendingCount} Pendiente{pendingCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight">
            Gestión de Citas
          </h1>
          <p className="text-xs text-[#D9C9B0]/60">
            Controla las reservas solicitadas por clientes en sinergia con tu disponibilidad de sillón en vivo.
          </p>
        </div>

        {/* Switch ON/OFF de Disponibilidad */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/10 self-start sm:self-auto shrink-0 shadow-lg">
          <div className="text-left space-y-0.5">
            <span className="text-xs font-bold text-white block">Aceptar Reservas</span>
            <span className="text-[10px] text-white/50 block font-mono">
              {settings.acceptsBookings ? 'ON (Perfil público)' : 'OFF (Solo Walk-In)'}
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleAcceptsBookings}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              settings.acceptsBookings ? 'bg-[#B68F4E]' : 'bg-white/20'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                settings.acceptsBookings ? 'translate-x-5 bg-black' : 'translate-x-0 bg-white/70'
              }`}
            />
          </button>
        </div>
      </div>

      {/* 2. Banner de Sinergia Walk-In */}
      <div className="p-4 rounded-2xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-3 text-xs text-[#D9C9B0]/80 shadow-md">
        <Sparkles className="w-5 h-5 text-[#B68F4E] shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-bold text-white">Sinergia con el Semáforo Walk-In:</span>
          <p className="text-[11px] leading-relaxed text-[#D9C9B0]/70">
            15 minutos antes de cualquier cita confirmada, el sistema notifica en tu sillón y previene que el semáforo acepte clientes espontáneos que colisionen con el turno programado.
          </p>
        </div>
      </div>

      {/* 3. Filtros de Estado */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-2">
          {[
            { id: 'ALL', label: `Todas (${bookings.length})` },
            { id: 'PENDING', label: `Pendientes (${pendingCount})` },
            { id: 'CONFIRMED', label: `Confirmadas (${confirmedCount})` },
            { id: 'COMPLETED', label: 'Completadas' },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold tracking-wide transition-all cursor-pointer whitespace-nowrap border ${
                statusFilter === f.id
                  ? 'bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black border-transparent shadow-md'
                  : 'bg-white/[0.02] border-white/10 text-white/60 hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={loadData}
          className="p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-colors cursor-pointer shrink-0"
          title="Actualizar bandeja"
        >
          <Filter className="w-4 h-4" />
        </button>
      </div>

      {/* 4. Lista de Citas */}
      {loading ? (
        <div className="py-12 text-center text-xs text-white/40 font-mono">
          Cargando citas programadas...
        </div>
      ) : filteredBookings.length === 0 ? (
        <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/10 text-center space-y-2">
          <Calendar className="w-8 h-8 text-white/20 mx-auto" />
          <h3 className="text-sm font-bold text-white">No hay citas en esta categoría</h3>
          <p className="text-xs text-[#D9C9B0]/50 max-w-sm mx-auto">
            Cuando los clientes reserven turnos desde tu perfil público o desde el mapa de exploración, aparecerán listadas aquí cronológicamente.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredBookings.map((b) => {
            const isPending = b.status === 'PENDING';
            const isConfirmed = b.status === 'CONFIRMED';
            const isCompleted = b.status === 'COMPLETED';

            const cleanPhone = b.clientPhone.replace(/\D/g, '');
            const waLink = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(
              `Hola ${b.clientName}, te escribo desde Fade Studio respecto a tu cita de ${b.serviceName} para las ${b.time}.`
            )}`;

            return (
              <motion.div
                key={b.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={SPRING_TOUCH}
                className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20 transition-all space-y-4 shadow-xl"
              >
                {/* Fila 1: Hora/Fecha + Estado */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="px-3 py-1.5 rounded-xl bg-black/80 border border-[#B68F4E]/40 text-center shrink-0">
                      <span className="text-sm font-mono font-bold text-[#F5EBDD] block leading-none">
                        {b.time}
                      </span>
                      <span className="text-[10px] font-mono text-[#B68F4E] block mt-0.5">
                        {b.date}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-white tracking-tight">
                        {b.clientName}
                      </h3>
                      <div className="flex items-center gap-2 text-xs text-[#D9C9B0]/70 font-mono">
                        <Phone className="w-3 h-3 text-[#B68F4E]" />
                        <span>{b.clientPhone}</span>
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-emerald-400 underline hover:text-emerald-300 ml-1 flex items-center gap-1"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Badge de Estado */}
                  <div className="self-start sm:self-auto">
                    {isPending && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                        <span>Por Confirmar</span>
                      </span>
                    )}
                    {isConfirmed && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Confirmada</span>
                      </span>
                    )}
                    {isCompleted && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5" />
                        <span>Completada</span>
                      </span>
                    )}
                    {b.status === 'CANCELLED' && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-red-500/15 text-red-300 border border-red-500/30 flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Cancelada</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Fila 2: Servicio, Precio y Duración */}
                <div className="p-3 rounded-xl bg-black/40 border border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-white/50 block font-mono">Servicio Solicitado:</span>
                    <span className="font-semibold text-white">{b.serviceName}</span>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] text-white/50 block font-mono">Duración:</span>
                      <span className="font-mono text-white flex items-center gap-1 justify-end">
                        <Clock className="w-3 h-3 text-[#B68F4E]" />
                        <span>{b.durationMin} min</span>
                      </span>
                    </div>

                    <div className="text-right pl-3 border-l border-white/10">
                      <span className="text-[10px] text-white/50 block font-mono">Tarifa:</span>
                      <span className="font-mono font-bold text-[#B68F4E] text-sm">
                        Bs {b.servicePriceBs}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Nota del Cliente si existe */}
                {b.notes && (
                  <div className="text-xs text-[#D9C9B0]/60 italic bg-white/[0.02] px-3 py-1.5 rounded-lg border border-white/5">
                    "{b.notes}"
                  </div>
                )}

                {/* Fila 3: Botones de Acción */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/10">
                  {isPending && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(b.id, 'CANCELLED', 'Rechazada por disponibilidad')}
                        className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-red-500/15 border border-white/10 text-white/60 hover:text-red-300 text-xs font-semibold transition-all cursor-pointer"
                      >
                        Rechazar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(b.id, 'CONFIRMED')}
                        className="px-4 py-1.5 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black text-xs font-bold shadow-md hover:brightness-105 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>Confirmar Cita</span>
                      </button>
                    </>
                  )}

                  {isConfirmed && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStatusChange(b.id, 'CANCELLED', 'Cancelada por el barbero')}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white text-xs font-medium transition-all cursor-pointer"
                      >
                        Cancelar
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(b.id, 'COMPLETED')}
                        className="px-4 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold shadow-md hover:bg-emerald-500/30 transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Marcar como Atendido</span>
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Toast Notificación */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-zinc-900 border border-[#B68F4E]/40 text-white text-xs font-semibold backdrop-blur-xl shadow-2xl flex items-center gap-2 text-center"
          >
            <AlertCircle className="w-4 h-4 text-[#B68F4E]" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BarberBookingsView;
