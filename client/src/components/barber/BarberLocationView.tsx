import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Store,
  MapPin,
  CheckCircle2,
  Navigation,
  Save,
  Check,
  Building,
  Compass,
} from 'lucide-react';
import type { UserProfile, ShopInfo } from '../../services/auth.service';
import { fetchShops, updateBarberLocation } from '../../services/auth.service';
import { InteractiveLocationPicker } from './InteractiveLocationPicker';

interface BarberLocationViewProps {
  barber: UserProfile | null;
  onLocationUpdated?: (updated: UserProfile) => void;
}



export const BarberLocationView: FC<BarberLocationViewProps> = ({
  barber,
  onLocationUpdated,
}) => {
  const [shops, setShops] = useState<ShopInfo[]>([]);
  const [mode, setMode] = useState<'affiliated' | 'independent'>(
    barber?.shopId && !barber.shopId.startsWith('custom-') ? 'affiliated' : 'independent'
  );

  const [selectedShopId, setSelectedShopId] = useState<string>(
    barber?.shopId || 'shop-sopocachi-darko'
  );

  // Custom shop state
  const [customName, setCustomName] = useState(barber?.shopName || 'Estudio Brian López');
  const [customAddress, setCustomAddress] = useState(barber?.shopAddress || 'Av. 20 de Octubre #2140');
  const [customZone, setCustomZone] = useState(barber?.shopZone || 'Sopocachi');
  const [latitude, setLatitude] = useState<number>(-16.5113);
  const [longitude, setLongitude] = useState<number>(-68.1287);

  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchShops().then((list) => {
      setShops(list);
      if (barber?.shopId) {
        const found = list.find((s) => s.id === barber.shopId);
        if (found) {
          setSelectedShopId(found.id);
          if (found.latitude) setLatitude(found.latitude);
          if (found.longitude) setLongitude(found.longitude);
        }
      }
    });
  }, [barber]);

  const handleSelectShop = (shop: ShopInfo) => {
    setSelectedShopId(shop.id);
    if (shop.latitude) setLatitude(shop.latitude);
    if (shop.longitude) setLongitude(shop.longitude);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let updated: UserProfile;
      if (mode === 'affiliated') {
        updated = await updateBarberLocation({
          shopId: selectedShopId,
        });
      } else {
        updated = await updateBarberLocation({
          customShop: {
            name: customName,
            address: customAddress,
            zone: customZone,
            latitude,
            longitude,
          },
        });
      }

      if (onLocationUpdated) onLocationUpdated(updated);
      setToastMsg('¡Ubicación y sede actualizadas con éxito!');
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      console.error('Error guardando ubicación:', err);
      setToastMsg('Error al guardar la ubicación.');
      setTimeout(() => setToastMsg(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const currentSelectedShop = shops.find((s) => s.id === selectedShopId);
  const displayShopName = mode === 'affiliated' ? currentSelectedShop?.name || 'Fade Studio' : customName;
  const displayAddress = mode === 'affiliated' ? currentSelectedShop?.address || 'Av. 20 de Octubre' : customAddress;
  const displayZone = mode === 'affiliated' ? currentSelectedShop?.zone || 'Sopocachi' : customZone;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-28 lg:pb-16 space-y-6">
      {/* 1. Header & Selector de Modalidad */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-white tracking-tight flex items-center gap-2.5">
            <span>Mi Barbería & Ubicación</span>
            <Store className="w-5 h-5 text-[#B68F4E]" />
          </h1>
          <p className="text-xs text-[#D9C9B0]/60 mt-1">
            Define la barbería donde atiendes o configura tu propio estudio para aparecer con precisión en el mapa de clientes.
          </p>
        </div>

        <div className="flex items-center gap-2 p-1 rounded-2xl bg-white/[0.04] border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setMode('affiliated')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              mode === 'affiliated'
                ? 'bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Building className="w-3.5 h-3.5" />
            <span>Afiliado a Salón</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('independent')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              mode === 'independent'
                ? 'bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Estudio Propio</span>
          </button>
        </div>
      </div>

      {/* 2. CONTENIDO SEGÚN MODO */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* MODO A: AFILIADO A SALÓN EXISTENTE */}
          {mode === 'affiliated' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="text-xs font-bold uppercase tracking-wider text-white/60">
                Selecciona la Barbería Oficial
              </div>

              <div className="grid grid-cols-1 gap-3">
                {shops.map((shop) => {
                  const isSelected = selectedShopId === shop.id;
                  return (
                    <div
                      key={shop.id}
                      onClick={() => handleSelectShop(shop)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                        isSelected
                          ? 'bg-[#B68F4E]/10 border-[#B68F4E] shadow-[0_0_20px_rgba(182,143,78,0.15)]'
                          : 'bg-white/[0.02] border-white/10 hover:border-white/25 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-sm">{shop.name}</span>
                            {isSelected && (
                              <CheckCircle2 className="w-4 h-4 text-[#B68F4E] shrink-0" />
                            )}
                          </div>
                          <div className="text-xs text-[#D9C9B0]/70 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-[#B68F4E] shrink-0" />
                            <span>{shop.address || 'La Paz, Bolivia'}</span>
                          </div>
                          <div className="text-[11px] font-mono text-[#B68F4E] pt-1">
                            Zona: {shop.zone || 'La Paz'}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isSelected
                                ? 'bg-[#B68F4E] text-black'
                                : 'bg-white/5 text-white/50'
                            }`}
                          >
                            {isSelected ? 'Sede Activa' : 'Seleccionar'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* MODO B: ESTUDIO PROPIO / INDEPENDIENTE */}
          {mode === 'independent' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5 bg-white/[0.02] border border-white/10 rounded-3xl p-5 sm:p-7 backdrop-blur-xl"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/80">Nombre de tu Estudio / Barbería</label>
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="Ej. Estudio Brian López"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-white/80">Dirección Detallada (Calle, Número, Edificio)</label>
                <input
                  type="text"
                  value={customAddress}
                  onChange={(e) => setCustomAddress(e.target.value)}
                  placeholder="Ej. Av. 20 de Octubre #2140, Edif. Barcelona, Mezzanine"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-[#B68F4E]"
                />
              </div>

              {/* Selector Interactivo con Mapa Leaflet */}
              <InteractiveLocationPicker
                latitude={latitude}
                longitude={longitude}
                onChange={(lat, lng) => {
                  setLatitude(lat);
                  setLongitude(lng);
                }}
                zone={customZone}
                onZoneSelect={(zoneName, lat, lng) => {
                  setCustomZone(zoneName);
                  setLatitude(lat);
                  setLongitude(lng);
                }}
              />
            </motion.div>
          )}

          {/* Botón Guardar Cambios */}
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black font-bold text-xs shadow-xl hover:brightness-105 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Guardando ubicación...' : 'Guardar y Fijar en el Mapa'}</span>
          </button>
        </div>

        {/* 3. COLUMNA DERECHA: VISTA PREVIA DEL PIN EN EL MAPA PÚBLICO */}
        <div className="space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-white/60">
            Vista Previa en el Mapa Público
          </div>

          <div className="p-5 rounded-3xl bg-white/[0.03] border border-white/15 backdrop-blur-xl space-y-4">
            <div className="relative h-32 rounded-2xl overflow-hidden bg-zinc-900 border border-white/10 flex items-center justify-center">
              {/* Estilo mapa de fondo oscuro */}
              <div className="absolute inset-0 opacity-40 bg-[radial-gradient(#B68F4E_1px,transparent_1px)] [background-size:16px_16px]" />
              
              {/* Pin animado en el centro */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#B68F4E] shadow-2xl">
                    <img
                      src={barber?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&auto=format&fit=crop&q=80'}
                      alt="Barbero"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-black" />
                </div>
                <div className="w-2 h-2 rounded-full bg-[#B68F4E] mt-1 shadow-md animate-ping" />
              </div>

              <div className="absolute bottom-2 left-3 right-3 text-[10px] font-mono text-white/60 text-center truncate">
                {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </div>
            </div>

            {/* Ficha que ve el cliente al tocar el pin */}
            <div className="space-y-1.5 pt-1 border-t border-white/10">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white truncate">{barber?.displayName || 'Brian López'}</span>
                <span className="text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10">
                  Libre
                </span>
              </div>
              <div className="text-[11px] text-[#B68F4E] font-medium truncate">
                {displayShopName}
              </div>
              <div className="text-[11px] text-white/60 flex items-center gap-1 truncate">
                <Navigation className="w-3 h-3 text-[#B68F4E] shrink-0" />
                <span>{displayAddress} · {displayZone}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notificación */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-amber-950/90 border border-amber-500/40 text-amber-200 text-xs font-semibold backdrop-blur-xl shadow-2xl flex items-center gap-2 text-center"
          >
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
