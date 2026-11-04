import type { FC } from 'react';
import { motion } from 'framer-motion';
import { BrandLogo } from '../common/BrandLogo';
import { LogOut, CheckCircle2, Shield, Scissors, User, Sparkles } from 'lucide-react';
import type { LoginResponse } from '../../services/auth.service';
import { SPRING_TOUCH } from '../../constants/springs';

interface AuthenticatedViewProps {
  authData: LoginResponse;
  onLogout: () => void;
  onNavigateHome?: () => void;
}

export const AuthenticatedView: FC<AuthenticatedViewProps> = ({
  authData,
  onLogout,
  onNavigateHome,
}) => {
  const { user, token } = authData;
  const isBarber = user.role === 'barbero';

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center p-6 bg-black text-[#F5EBDD] overflow-hidden select-none">
      {/* Background Glow */}
      <div 
        className="absolute w-[600px] h-[600px] rounded-full blur-[160px] pointer-events-none opacity-15 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#B68F4E]"
        aria-hidden="true"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={SPRING_TOUCH}
        className="fade-surface relative z-10 w-full max-w-lg rounded-3xl p-8 space-y-7 border border-white/10"
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between border-b border-white/10 pb-5">
          <BrandLogo variant="full" size="sm" />
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Online-First Conectado</span>
          </div>
        </div>

        {/* Success Banner */}
        <div className="flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-r from-[#B68F4E]/15 to-transparent border border-[#B68F4E]/30">
          <CheckCircle2 className="w-6 h-6 text-[#B68F4E] shrink-0 mt-0.5" />
          <div className="space-y-1 text-left">
            <h3 className="font-bold text-base text-white">
              Sesión Iniciada con Éxito
            </h3>
            <p className="text-xs text-[#D9C9B0]/80">
              {isBarber
                ? 'Bienvenido de vuelta a tu estación de trabajo digital en FADE.'
                : 'Bienvenido de vuelta a tu historial y agenda de cortes en FADE.'}
            </p>
          </div>
        </div>

        {/* Profile Card */}
        <div className="space-y-4 text-left">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B68F4E] flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            {isBarber ? 'Perfil Profesional Verificado' : 'Perfil de Cliente'}
          </span>

          <div className="rounded-2xl bg-black/50 p-4 border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-lg font-bold text-white block">
                  {user.displayName}
                </span>
                <span className="text-xs text-[#D9C9B0]/70 flex items-center gap-1.5 mt-0.5">
                  {isBarber ? (
                    <>
                      <Scissors className="w-3 h-3 text-[#B68F4E]" />
                      <span>Barbero Oficial {user.plan ? `· Plan ${user.plan}` : ''}</span>
                    </>
                  ) : (
                    <>
                      <User className="w-3 h-3 text-[#B68F4E]" />
                      <span>Cliente FADE</span>
                    </>
                  )}
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono text-[#B68F4E] block">
                  {user.email || user.phone || 'Cuenta Estándar'}
                </span>
                <span className="text-[10px] text-white/40 block mt-0.5">
                  Rol: {user.role.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono text-white/50">
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-400" /> Token JWT Activo
              </span>
              <span className="truncate max-w-[200px]" title={token}>
                {token.slice(0, 24)}...
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col gap-3">
          {onNavigateHome && (
            <motion.button
              type="button"
              onClick={onNavigateHome}
              whileTap={{ scale: 0.98 }}
              transition={SPRING_TOUCH}
              className="fade-btn-primary w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs font-black tracking-wider uppercase cursor-pointer"
            >
              {isBarber ? (
                <>
                  <Scissors className="w-4 h-4 text-black" />
                  <span>Entrar al Modo Sillón</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-black" />
                  <span>Volver a Inicio & Historial</span>
                </>
              )}
            </motion.button>
          )}

          <motion.button
            type="button"
            onClick={onLogout}
            whileTap={{ scale: 0.98 }}
            transition={SPRING_TOUCH}
            className="fade-btn-secondary w-full py-3.5 rounded-2xl flex items-center justify-center gap-2 text-xs font-bold tracking-wider uppercase cursor-pointer text-white/80 hover:text-white"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};
