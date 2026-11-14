import type { FC } from 'react';
import { ShieldCheck, ArrowLeft, Lock, FileText } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

interface LegalViewProps {
  type: 'privacidad' | 'terminos';
  onBack: () => void;
}

export const LegalView: FC<LegalViewProps> = ({ type, onBack }) => {
  const isPrivacy = type === 'privacidad';

  return (
    <div className="min-h-screen w-full bg-[#0D0D10] text-[#F5EBDD] flex flex-col items-center p-4 sm:p-8 select-text">
      <header className="w-full max-w-3xl flex items-center justify-between py-4 border-b border-white/10">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-[#D9C9B0] transition-colors cursor-pointer text-xs font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a FADE</span>
        </button>

        <BrandLogo variant="full" size="sm" />
      </header>

      <main className="w-full max-w-3xl py-8 space-y-6 text-left leading-relaxed">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B68F4E]/10 border border-[#B68F4E]/20 text-[#B68F4E] text-[11px] font-mono">
            {isPrivacy ? <ShieldCheck className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
            <span>DOCUMENTO OFICIAL · DARKO SYNC</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white font-serif tracking-tight">
            {isPrivacy ? 'Política de Privacidad y Protección de Datos' : 'Condiciones del Servicio'}
          </h1>
          <p className="text-xs text-[#D9C9B0]/60">
            Última actualización: Noviembre 2026 · Plataforma FADE (fade.darkosync.com)
          </p>
        </div>

        {isPrivacy ? (
          <div className="space-y-6 text-xs sm:text-sm text-[#D9C9B0]/90">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#B68F4E]" />
                1. Compromiso con tu Privacidad
              </h2>
              <p>
                En FADE (desarrollado por DarkoSync), la privacidad de tu información capilar, fotografías y datos personales es nuestra prioridad absoluta. Esta política explica cómo recopilamos, usamos y protegemos tus datos cuando usas nuestra plataforma móvil y web.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-white">2. Datos Recopilados</h2>
              <ul className="list-disc pl-5 space-y-1 text-[#D9C9B0]/80">
                <li><strong>Identidad y Contacto:</strong> Nombre, dirección de correo electrónico y teléfono de contacto.</li>
                <li><strong>Autenticación con Google:</strong> Cuando inicias sesión con Google, recibimos tu nombre, correo y foto de perfil autorizados a través de Google Identity Services. Nunca tenemos acceso a tu contraseña de Google.</li>
                <li><strong>Ficha Biocutánea y Cortes:</strong> Registro de preferencias de degradado, máquina, tijera, notas de corte y fotografías del servicio.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-white">3. Bóveda de Consentimiento Fotográfico</h2>
              <p>
                Toda fotografía capturada durante un corte de cabello se almacena de forma <strong>estrictamente privada</strong> en tu historial personal por defecto. Solo si otorgas tu consentimiento explícito (ya sea en el sillón o desde tu perfil), la foto podrá figurar en el portafolio público del barbero. Puedes revocar este permiso en cualquier momento desde tu cuenta.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-white">4. Almacenamiento y Seguridad</h2>
              <p>
                Tus datos se transmiten mediante cifrado TLS/HTTPS de grado bancario y se almacenan en infraestructura segura en la nube (PostgreSQL cifrado y almacenamiento Cloudflare R2 con firmas temporales). No vendemos ni compartimos tu información con anunciantes ni terceros.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-white">5. Contacto</h2>
              <p>
                Para cualquier consulta, rectificación o eliminación de tus datos personales, puedes escribirnos a <strong className="text-white">soporte@darkosync.com</strong> o <strong className="text-white">darkosync@gmail.com</strong>.
              </p>
            </section>
          </div>
        ) : (
          <div className="space-y-6 text-xs sm:text-sm text-[#D9C9B0]/90">
            <section className="space-y-2">
              <h2 className="text-base font-bold text-white">1. Aceptación de los Términos</h2>
              <p>
                Al acceder y utilizar la plataforma FADE (fade.darkosync.com), aceptas quedar vinculado por las presentes Condiciones del Servicio entre tú y DarkoSync.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-white">2. Servicios para Clientes y Barberos</h2>
              <p>
                FADE proporciona herramientas de gestión de citas, ficha técnica de estilo, geolocalización de barberías asociadas y vinculación presencial en sillón mediante códigos QR y códigos de presencia.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-white">3. Conducta y Reservas</h2>
              <p>
                Los usuarios se comprometen a respetar los horarios de las citas programadas y a suministrar información verídica al agendar sus turnos. Los barberos autónomos operan como profesionales independientes asociados a la red FADE.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-base font-bold text-white">4. Propiedad Intelectual</h2>
              <p>
                Todos los derechos de software, diseño de interfaces, marcas registradas y algoritmos de FADE y DarkoSync están protegidos por las leyes de propiedad intelectual internacionales y del Estado Plurinacional de Bolivia.
              </p>
            </section>
          </div>
        )}
      </main>
    </div>
  );
};
