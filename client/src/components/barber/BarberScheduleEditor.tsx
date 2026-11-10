import { useState, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  CheckCircle2,
  Sparkles,
  Save,
  Coffee,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  BarberWorkingHoursConfig,
} from '../../services/booking.service';
import { getDefaultWorkingHours } from '../../services/booking.service';

interface BarberScheduleEditorProps {
  initialConfig?: BarberWorkingHoursConfig;
  onSave: (config: BarberWorkingHoursConfig) => Promise<void>;
}

const TIME_OPTIONS: string[] = [];
for (let h = 7; h <= 23; h++) {
  const hh = String(h).padStart(2, '0');
  TIME_OPTIONS.push(`${hh}:00`, `${hh}:30`);
}

export const BarberScheduleEditor: FC<BarberScheduleEditorProps> = ({
  initialConfig,
  onSave,
}) => {
  const [config, setConfig] = useState<BarberWorkingHoursConfig>(
    initialConfig || getDefaultWorkingHours()
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleToggleDay = (dayOfWeek: number) => {
    setConfig((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.dayOfWeek === dayOfWeek ? { ...d, enabled: !d.enabled } : d
      ),
    }));
  };

  const handleUpdateTime = (
    dayOfWeek: number,
    field: 'openTime' | 'closeTime' | 'breakStart' | 'breakEnd',
    val: string
  ) => {
    setConfig((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.dayOfWeek === dayOfWeek ? { ...d, [field]: val } : d
      ),
    }));
  };

  const handleToggleBreak = (dayOfWeek: number) => {
    setConfig((prev) => ({
      ...prev,
      days: prev.days.map((d) =>
        d.dayOfWeek === dayOfWeek
          ? {
              ...d,
              hasBreak: !d.hasBreak,
              breakStart: !d.hasBreak ? d.breakStart || '13:00' : d.breakStart,
              breakEnd: !d.hasBreak ? d.breakEnd || '14:00' : d.breakEnd,
            }
          : d
      ),
    }));
  };

  // Quick Presets
  const applyPreset = (preset: 'standard' | 'weekdays' | 'extended') => {
    const base = getDefaultWorkingHours();
    if (preset === 'standard') {
      // Lun a Sáb 9:00 - 20:00 con descanso
      setConfig(base);
    } else if (preset === 'weekdays') {
      // Lun a Vie 10:00 - 19:00, Sáb y Dom cerrados
      setConfig({
        ...base,
        days: base.days.map((d) => {
          const isWeekend = d.dayOfWeek === 0 || d.dayOfWeek === 6;
          return {
            ...d,
            enabled: !isWeekend,
            openTime: '10:00',
            closeTime: '19:00',
            hasBreak: true,
            breakStart: '13:30',
            breakEnd: '14:30',
          };
        }),
      });
    } else if (preset === 'extended') {
      // Lun a Sáb 09:00 - 21:00 continuo
      setConfig({
        ...base,
        days: base.days.map((d) => {
          const isSunday = d.dayOfWeek === 0;
          return {
            ...d,
            enabled: !isSunday,
            openTime: '09:00',
            closeTime: '21:00',
            hasBreak: false,
          };
        }),
      });
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      await onSave(config);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  // Reorder days so Lunes (1) is first and Domingo (0) is last
  const orderedDays = [...config.days].sort((a, b) => {
    const aOrder = a.dayOfWeek === 0 ? 7 : a.dayOfWeek;
    const bOrder = b.dayOfWeek === 0 ? 7 : b.dayOfWeek;
    return aOrder - bOrder;
  });

  return (
    <div className="rounded-3xl bg-white/[0.02] border border-white/10 p-5 sm:p-6 shadow-xl space-y-4">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#B68F4E]" />
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Horarios Semanales de Atención
            </h2>
          </div>
          <p className="text-xs text-[#D9C9B0]/60">
            Define tus días laborales, horas de apertura, cortes de almuerzo y duración de turnos.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-[#D9C9B0] transition-colors cursor-pointer self-start sm:self-auto"
        >
          <span>{isExpanded ? 'Ocultar horarios' : 'Configurar horarios'}</span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-[#B68F4E]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[#B68F4E]" />
          )}
        </button>
      </div>

      {/* Collapsed summary pill */}
      {!isExpanded && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
          {orderedDays.map((d) => (
            <span
              key={d.dayOfWeek}
              className={`text-[11px] px-2.5 py-1 rounded-lg border font-mono ${
                d.enabled
                  ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                  : 'bg-white/[0.02] border-white/5 text-white/30'
              }`}
            >
              {d.dayName.slice(0, 3)}: {d.enabled ? `${d.openTime}-${d.closeTime}` : 'OFF'}
            </span>
          ))}
        </div>
      )}

      {/* Expanded Editor Form */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-6 pt-4 border-t border-white/10 overflow-hidden"
          >
            {/* Presets & Turn Duration */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-black/40 border border-white/5">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono tracking-widest text-[#B68F4E] font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3" />
                  <span>Plantillas Rápidas</span>
                </span>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => applyPreset('standard')}
                    className="px-3 py-1 rounded-lg text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-all cursor-pointer"
                  >
                    Lun a Sáb (9:00 - 20:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('weekdays')}
                    className="px-3 py-1 rounded-lg text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-all cursor-pointer"
                  >
                    Lun a Vie (10:00 - 19:00)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('extended')}
                    className="px-3 py-1 rounded-lg text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 transition-all cursor-pointer"
                  >
                    Continuo (09:00 - 21:00)
                  </button>
                </div>
              </div>

              {/* Slot interval */}
              <div className="shrink-0 space-y-1 text-left sm:text-right">
                <span className="text-[11px] text-white/60 block">Intervalo de turnos:</span>
                <select
                  value={config.slotIntervalMin}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      slotIntervalMin: Number(e.target.value),
                    }))
                  }
                  className="px-3 py-1.5 rounded-xl bg-black border border-white/20 text-xs font-semibold text-white focus:outline-none focus:border-[#B68F4E] cursor-pointer"
                >
                  <option value={30}>Cada 30 minutos</option>
                  <option value={45}>Cada 45 minutos</option>
                  <option value={60}>Cada 60 minutos</option>
                </select>
              </div>
            </div>

            {/* 7 Days List */}
            <div className="space-y-2.5">
              {orderedDays.map((d) => (
                <div
                  key={d.dayOfWeek}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                    d.enabled
                      ? 'bg-white/[0.03] border-white/15'
                      : 'bg-white/[0.01] border-white/5 opacity-60'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Day Toggle */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => handleToggleDay(d.dayOfWeek)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          d.enabled ? 'bg-[#B68F4E]' : 'bg-white/20'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                            d.enabled ? 'translate-x-4 bg-black' : 'translate-x-0 bg-white/70'
                          }`}
                        />
                      </button>

                      <div>
                        <span className="text-sm font-bold text-white block">
                          {d.dayName}
                        </span>
                        <span className="text-[10px] text-white/40 font-mono">
                          {d.enabled ? 'Atendiendo' : 'Día de descanso'}
                        </span>
                      </div>
                    </div>

                    {/* Hours controls if enabled */}
                    {d.enabled ? (
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        {/* Open / Close */}
                        <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1.5 rounded-xl border border-white/10">
                          <span className="text-white/50 text-[11px]">De</span>
                          <select
                            value={d.openTime}
                            onChange={(e) =>
                              handleUpdateTime(d.dayOfWeek, 'openTime', e.target.value)
                            }
                            className="bg-transparent text-white font-mono font-semibold focus:outline-none cursor-pointer"
                          >
                            {TIME_OPTIONS.map((t) => (
                              <option key={t} value={t} className="bg-black text-white">
                                {t}
                              </option>
                            ))}
                          </select>
                          <span className="text-white/50 text-[11px]">a</span>
                          <select
                            value={d.closeTime}
                            onChange={(e) =>
                              handleUpdateTime(d.dayOfWeek, 'closeTime', e.target.value)
                            }
                            className="bg-transparent text-white font-mono font-semibold focus:outline-none cursor-pointer"
                          >
                            {TIME_OPTIONS.map((t) => (
                              <option key={t} value={t} className="bg-black text-white">
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Break toggle & times */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleBreak(d.dayOfWeek)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-[11px] font-semibold transition-all cursor-pointer ${
                              d.hasBreak
                                ? 'bg-amber-950/30 border-amber-500/40 text-amber-300'
                                : 'bg-white/5 border-white/10 text-white/50 hover:text-white'
                            }`}
                          >
                            <Coffee className="w-3.5 h-3.5" />
                            <span>{d.hasBreak ? 'Almuerzo' : '+ Almuerzo'}</span>
                          </button>

                          {d.hasBreak && (
                            <div className="flex items-center gap-1 bg-black/60 px-2.5 py-1.5 rounded-xl border border-white/10 text-[11px]">
                              <select
                                value={d.breakStart || '13:00'}
                                onChange={(e) =>
                                  handleUpdateTime(d.dayOfWeek, 'breakStart', e.target.value)
                                }
                                className="bg-transparent text-white font-mono focus:outline-none cursor-pointer"
                              >
                                {TIME_OPTIONS.map((t) => (
                                  <option key={t} value={t} className="bg-black text-white">
                                    {t}
                                  </option>
                                ))}
                              </select>
                              <span className="text-white/40">-</span>
                              <select
                                value={d.breakEnd || '14:00'}
                                onChange={(e) =>
                                  handleUpdateTime(d.dayOfWeek, 'breakEnd', e.target.value)
                                }
                                className="bg-transparent text-white font-mono focus:outline-none cursor-pointer"
                              >
                                {TIME_OPTIONS.map((t) => (
                                  <option key={t} value={t} className="bg-black text-white">
                                    {t}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-white/30 italic">
                        No se recibirán citas en este día.
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                {savedSuccess && (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>¡Horarios guardados y sincronizados con éxito!</span>
                  </>
                )}
              </span>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black text-xs font-black uppercase tracking-wider shadow-[0_4px_16px_rgba(217,201,176,0.3)] hover:brightness-105 active:scale-95 transition-all cursor-pointer"
              >
                <Save className="w-4 h-4 text-black" />
                <span>{isSaving ? 'Guardando...' : 'Guardar Horarios'}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
