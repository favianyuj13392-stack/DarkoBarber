import { useState, type FC } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Share2,
  Heart,
  Star,
  CheckCircle2,
  Clock,
  Scissors,
  Award,
  MessageCircle,
  MapPin,
  Sparkles,
} from 'lucide-react';
import type { ExploreBarber } from '../../types/explore';

interface BarberDetailViewProps {
  barber: ExploreBarber;
  onBack: () => void;
  onOpenBooking: (barber: ExploreBarber) => void;
  onToggleFavorite: (barberId: string) => void;
  onOpenShop: (shopId: string) => void;
}

export const BarberDetailView: FC<BarberDetailViewProps> = ({
  barber,
  onBack,
  onOpenBooking,
  onToggleFavorite,
  onOpenShop,
}) => {
  const [activeTab, setActiveTab] = useState<'portafolio' | 'servicios' | 'resenas' | 'info'>('portafolio');
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const statusConfig = {
    GREEN: {
      label: 'Disponible ahora para corte',
      dotClass: 'bg-emerald-400 animate-pulse',
      textColor: 'text-emerald-400',
    },
    YELLOW: {
      label: `1 persona en espera (~20 min)`,
      dotClass: 'bg-amber-400',
      textColor: 'text-amber-400',
    },
    RED: {
      label: 'Ocupado actualmente en sillón',
      dotClass: 'bg-rose-500',
      textColor: 'text-rose-400',
    },
    GRAY: {
      label: 'Fuera de turno',
      dotClass: 'bg-white/40',
      textColor: 'text-white/40',
    },
  }[barber.status];

  return (
    <div className="w-full pb-32 pt-2 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto space-y-6">
      {/* 1. Top Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onToggleFavorite(barber.id)}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-red-400 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Heart
              className={`w-4 h-4 ${barber.isFavorite ? 'fill-red-500 text-red-500' : ''}`}
            />
          </button>
          <button
            type="button"
            onClick={() => {
              if (navigator.share) {
                navigator.share({
                  title: `${barber.name} - FADE`,
                  text: `Reserva con ${barber.name} en ${barber.shopName}`,
                  url: window.location.href,
                }).catch(() => {});
              }
            }}
            className="p-2 rounded-xl bg-white/5 border border-white/10 text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Hero Profile Card */}
      <div className="relative p-6 rounded-3xl bg-gradient-to-b from-[#1C1C1C] via-[#141414] to-[#0A0A0A] border border-white/15 shadow-[0_20px_45px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.18)] flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
        {/* Avatar with gold border & status diamond */}
        <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden border-2 border-[#B68F4E] shadow-[0_0_20px_rgba(182,143,78,0.3)] flex-shrink-0">
          <img
            src={barber.avatar}
            alt={barber.name}
            className="w-full h-full object-cover object-top"
          />
          <div
            className={`absolute bottom-2 right-2 w-4 h-4 rounded-full border-2 border-black ${statusConfig.dotClass}`}
          />
        </div>

        {/* Profile Info */}
        <div className="flex-1 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h1 className="text-2xl font-serif font-bold text-white tracking-tight">
                {barber.name}
              </h1>
              <CheckCircle2 className="w-5 h-5 text-[#B68F4E]" />
            </div>
            <div className="flex items-center justify-center sm:justify-end gap-1 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white">
              <Star className="w-3.5 h-3.5 text-[#B68F4E] fill-current" />
              <span>{barber.rating}</span>
              <span className="text-white/50">({barber.reviewCount})</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenShop(barber.shopId)}
            className="text-xs text-[#D9C9B0] hover:underline flex items-center justify-center sm:justify-start gap-1 font-medium cursor-pointer"
          >
            <MapPin className="w-3.5 h-3.5 text-[#B68F4E]" />
            <span>
              {barber.shopName} · {barber.zone}
            </span>
          </button>

          {/* Status pill */}
          <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
            <span className={`w-2 h-2 rounded-full ${statusConfig.dotClass}`} />
            <span className={`text-xs font-semibold ${statusConfig.textColor}`}>
              {statusConfig.label}
            </span>
          </div>

          {/* Specialties pills */}
          <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 pt-2">
            {barber.specialties.map((spec) => (
              <span
                key={spec}
                className="text-[11px] px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-white/80"
              >
                {spec}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Stat Cards (3 Métricas Destacadas) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-center space-y-1">
          <Scissors className="w-4 h-4 text-[#B68F4E] mx-auto opacity-80" />
          <div className="text-lg font-mono font-bold text-white">{barber.totalCuts}+</div>
          <div className="text-[10px] text-white/50 uppercase tracking-wider">Cortes hechos</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-center space-y-1">
          <Clock className="w-4 h-4 text-[#B68F4E] mx-auto opacity-80" />
          <div className="text-lg font-mono font-bold text-white">{barber.experienceYears} años</div>
          <div className="text-[10px] text-white/50 uppercase tracking-wider">Experiencia</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-center space-y-1">
          <Award className="w-4 h-4 text-[#B68F4E] mx-auto opacity-80" />
          <div className="text-lg font-mono font-bold text-white">Master</div>
          <div className="text-[10px] text-white/50 uppercase tracking-wider">Especialidad</div>
        </div>
      </div>

      {/* 4. Tabs Navigation */}
      <div className="border-b border-white/10">
        <div className="flex gap-6 overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'portafolio', label: `Portafolio (${barber.portfolio.length})` },
              { id: 'servicios', label: `Servicios (${barber.services.length})` },
              { id: 'resenas', label: `Reseñas (${barber.reviewCount})` },
              { id: 'info', label: 'Sobre mí' },
            ] as const
          ).map((t) => {
            const isActive = activeTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`pb-3 text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer relative select-none ${
                  isActive ? 'text-[#B68F4E] font-bold' : 'text-white/50 hover:text-white'
                }`}
              >
                {t.label}
                {isActive && (
                  <motion.div
                    layoutId="activeBarberTabIndicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#B68F4E]"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Tab Content */}
      <div className="space-y-4">
        {/* TAB PORTAFOLIO */}
        {activeTab === 'portafolio' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {barber.portfolio.map((imgUrl, i) => (
              <div
                key={i}
                onClick={() => setSelectedPhoto(imgUrl)}
                className="relative h-44 rounded-2xl overflow-hidden border border-white/15 cursor-pointer group"
              >
                <img
                  src={imgUrl}
                  alt={`Corte ${i + 1}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                  <span className="text-xs text-white font-medium">Ver en detalle</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB SERVICIOS */}
        {activeTab === 'servicios' && (
          <div className="space-y-2.5">
            {barber.services.map((srv) => (
              <div
                key={srv.id}
                className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between"
              >
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">{srv.name}</h4>
                  <p className="text-xs text-white/60 max-w-md">{srv.description}</p>
                  <span className="text-[11px] text-[#D9C9B0]/70 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {srv.durationMin} min
                  </span>
                </div>
                <div className="text-right flex-shrink-0 pl-4">
                  <span className="text-sm font-mono font-bold text-[#B68F4E]">
                    {srv.priceBs} Bs
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TAB RESEÑAS */}
        {activeTab === 'resenas' && (
          <div className="space-y-3">
            {[
              {
                author: 'Ernesto Salinas',
                rating: 5,
                date: 'Hace 3 días',
                comment: 'Excelente degradado, muy meticuloso con los detalles y la navaja. Recomendadísimo.',
              },
              {
                author: 'Gabriel Mendoza',
                rating: 5,
                date: 'Hace 1 semana',
                comment: 'Puntual, el local impecable y el perfilado de barba quedó perfecto.',
              },
              {
                author: 'Carlos Paz',
                rating: 4.8,
                date: 'Hace 2 semanas',
                comment: 'Muy buen asesoramiento para el tipo de rostro. Volveré sin duda.',
              },
            ].map((rev, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{rev.author}</span>
                  <span className="text-[10px] text-white/40">{rev.date}</span>
                </div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 text-[#B68F4E] fill-current" />
                  ))}
                </div>
                <p className="text-xs text-white/80">{rev.comment}</p>
              </div>
            ))}
          </div>
        )}

        {/* TAB INFO */}
        {activeTab === 'info' && (
          <div className="space-y-4 text-xs text-white/80">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
                Biografía
              </h4>
              <p className="leading-relaxed">{barber.bio}</p>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-2">
              <h4 className="text-xs font-mono uppercase tracking-wider text-[#B68F4E] font-semibold">
                Presencia Digital
              </h4>
              <div className="flex gap-3">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors"
                >
                  <svg className="w-4 h-4 text-[#B68F4E]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                  </svg>
                  <span>Instagram</span>
                </a>
                <a
                  href="https://linkedin.com"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-colors"
                >
                  <svg className="w-4 h-4 text-[#B68F4E]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                  <span>LinkedIn</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/90 border-t border-white/10 backdrop-blur-2xl z-30">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              window.open(`https://wa.me/59177212345?text=Hola%20${encodeURIComponent(barber.name)}`, '_blank');
            }}
            className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 hover:text-white transition-all cursor-pointer"
            title="Enviar mensaje por WhatsApp"
          >
            <MessageCircle className="w-5 h-5 text-[#B68F4E]" />
          </button>

          <button
            type="button"
            onClick={() => onOpenBooking(barber)}
            className="flex-1 py-3.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-extrabold text-xs uppercase tracking-wider shadow-[0_8px_24px_rgba(217,201,176,0.35),inset_0_1px_0_rgba(255,255,255,0.8)] hover:brightness-105 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>Solicitar reserva</span>
          </button>
        </div>
      </div>

      {/* Modal Lightbox for photo */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 cursor-pointer"
        >
          <img
            src={selectedPhoto}
            alt="Corte full"
            className="max-w-full max-h-[85vh] rounded-3xl object-contain border border-white/20"
          />
        </div>
      )}
    </div>
  );
};
