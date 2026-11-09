import { useEffect, useRef, useState } from 'react';
import type { FC } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Locate, Navigation, MapPin } from 'lucide-react';

interface InteractiveLocationPickerProps {
  latitude: number;
  longitude: number;
  onChange: (lat: number, lng: number) => void;
  zone: string;
  onZoneSelect: (zoneName: string, lat: number, lng: number) => void;
}

const LA_PAZ_ZONES = [
  { name: 'Sopocachi', lat: -16.5113, lng: -68.1287 },
  { name: 'San Miguel', lat: -16.5412, lng: -68.0821 },
  { name: 'Miraflores', lat: -16.4998, lng: -68.1205 },
  { name: 'Centro', lat: -16.4981, lng: -68.1345 },
  { name: 'Calacoto', lat: -16.5385, lng: -68.0862 },
  { name: 'Obrajes', lat: -16.5255, lng: -68.1065 },
];

export const InteractiveLocationPicker: FC<InteractiveLocationPickerProps> = ({
  latitude,
  longitude,
  onChange,
  zone,
  onZoneSelect,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Custom Gold Barber Pin Icon
    const customIcon = L.divIcon({
      className: 'fade-map-marker',
      html: `
        <div style="
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          background: #000;
          border: 2px solid #B68F4E;
          box-shadow: 0 0 15px rgba(182, 143, 78, 0.6);
          cursor: grab;
        ">
          <span style="font-size: 18px;">💈</span>
          <div style="
            position: absolute;
            bottom: -6px;
            width: 8px;
            height: 8px;
            background: #B68F4E;
            transform: rotate(45deg);
          "></div>
        </div>
      `,
      iconSize: [38, 44],
      iconAnchor: [19, 44],
    });

    const map = L.map(mapContainerRef.current, {
      center: [latitude, longitude],
      zoom: 15,
      zoomControl: true,
      attributionControl: false,
    });

    // High-Resolution Dark Tiles (OpenStreetMap with OLED Invert filter - No API key/watermarks)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      className: 'leaflet-dark-tiles',
    }).addTo(map);

    // Draggable Marker
    const marker = L.marker([latitude, longitude], {
      icon: customIcon,
      draggable: true,
    }).addTo(map);

    marker.bindTooltip('Arrastra para fijar la barbería', {
      direction: 'top',
      offset: [0, -40],
      className: 'bg-black text-[#B68F4E] border border-[#B68F4E]/40 text-xs px-2 py-1 rounded-md font-mono',
    });

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onChange(Number(pos.lat.toFixed(5)), Number(pos.lng.toFixed(5)));
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onChange(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5)));
    });

    mapInstanceRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    };
  }, []);

  // Update marker position if external coordinates change
  useEffect(() => {
    if (markerRef.current && mapInstanceRef.current) {
      const currentPos = markerRef.current.getLatLng();
      if (
        Math.abs(currentPos.lat - latitude) > 0.0001 ||
        Math.abs(currentPos.lng - longitude) > 0.0001
      ) {
        markerRef.current.setLatLng([latitude, longitude]);
        mapInstanceRef.current.panTo([latitude, longitude], { animate: true });
      }
    }
  }, [latitude, longitude]);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Tu navegador no soporta geolocalización.');
      return;
    }

    setDetecting(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        setDetecting(false);
        onChange(lat, lng);

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 16, { animate: true, duration: 1.2 });
          markerRef.current.setLatLng([lat, lng]);
        }
      },
      (err) => {
        setDetecting(false);
        console.warn('Geolocation error:', err);
        setGeoError('No se pudo obtener el GPS. Verifica los permisos de tu navegador.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleZoneClick = (z: typeof LA_PAZ_ZONES[0]) => {
    onZoneSelect(z.name, z.lat, z.lng);
    if (mapInstanceRef.current && markerRef.current) {
      mapInstanceRef.current.flyTo([z.lat, z.lng], 15, { animate: true, duration: 1 });
      markerRef.current.setLatLng([z.lat, z.lng]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <label className="text-xs font-semibold text-white/80 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#B68F4E]" />
          <span>Fijar Ubicación en el Mapa (Toca o arrastra el pin)</span>
        </label>

        <button
          type="button"
          onClick={handleDetectLocation}
          disabled={detecting}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#B68F4E]/15 hover:bg-[#B68F4E]/25 border border-[#B68F4E]/30 text-[#D9C9B0] text-xs font-semibold transition-all cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <Locate className={`w-3.5 h-3.5 text-[#B68F4E] ${detecting ? 'animate-spin' : ''}`} />
          <span>{detecting ? 'Detectando GPS...' : 'Detectar mi ubicación actual'}</span>
        </button>
      </div>

      {geoError && (
        <div className="text-[11px] text-amber-300/90 bg-amber-950/40 border border-amber-500/30 rounded-xl px-3 py-1.5">
          {geoError}
        </div>
      )}

      {/* Preset de Zonas */}
      <div className="space-y-1.5">
        <span className="text-[11px] text-white/50 block font-mono">Zonas Rápidas de La Paz:</span>
        <div className="flex flex-wrap gap-1.5">
          {LA_PAZ_ZONES.map((z) => {
            const isSelected = zone.toLowerCase() === z.name.toLowerCase();
            return (
              <button
                key={z.name}
                type="button"
                onClick={() => handleZoneClick(z)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#B68F4E] text-black font-bold border-[#B68F4E] shadow-sm'
                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white'
                }`}
              >
                {z.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Leaflet Map Canvas */}
      <div className="relative rounded-2xl overflow-hidden border border-white/15 shadow-2xl h-64 sm:h-72 w-full bg-zinc-950">
        <div ref={mapContainerRef} className="w-full h-full z-0" />

        {/* Floating Coordinates Badge */}
        <div className="absolute bottom-2 left-2 z-10 px-2.5 py-1 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 text-[10px] font-mono text-[#D9C9B0]/80 flex items-center gap-1.5 shadow-lg">
          <Navigation className="w-3 h-3 text-[#B68F4E]" />
          <span>
            {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </span>
        </div>
      </div>
    </div>
  );
};
