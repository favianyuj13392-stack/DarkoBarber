import { useEffect, useRef, useState, useMemo, type FC } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import {
  List,
  Navigation,
  Star,
  CheckCircle2,
  X,
  Compass,
  Scissors,
  Users,
} from 'lucide-react';
import type { ExploreBarber } from '../../types/explore';

interface DarkMapExplorerProps {
  barbers: ExploreBarber[];
  onSelectBarber: (barber: ExploreBarber) => void;
  onQuickBook?: (barber: ExploreBarber) => void;
  onBackToList: () => void;
}

interface ShopCluster {
  id: string;
  shopName: string;
  zone: string;
  address: string;
  lat: number;
  lng: number;
  barbers: ExploreBarber[];
  bestStatus: 'GREEN' | 'YELLOW' | 'RED' | 'GRAY';
}

// Google Maps Ultra-Luxury OLED Dark Theme
const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#0d0d10' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d0d10' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8e8e93' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d9c9b0' }],
  },
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#b68f4e' }],
  },
  {
    featureType: 'poi',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#686870' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#111713' }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#4a6250' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#1c1c22' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#131316' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#9e9ea6' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#272730' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#16161b' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#d9c9b0' }],
  },
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#1a1a22' }],
  },
  {
    featureType: 'transit.line',
    elementType: 'geometry',
    stylers: [{ color: '#b68f4e' }, { lightness: -40 }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#b68f4e' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#070a0e' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#384656' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#070a0e' }],
  },
];

let isGoogleMapsConfigured = false;

export const DarkMapExplorer: FC<DarkMapExplorerProps> = ({
  barbers,
  onSelectBarber,
  onBackToList,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const overlaysRef = useRef<google.maps.OverlayView[]>([]);
  const [selectedBarber, setSelectedBarber] = useState<ExploreBarber | null>(null);
  const [filterOnlyGreen, setFilterOnlyGreen] = useState(false);
  const [spiderfiedShopId, setSpiderfiedShopId] = useState<string | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  // Group barbers into studio clusters (Silos)
  const clusters = useMemo<ShopCluster[]>(() => {
    const displayed = filterOnlyGreen
      ? barbers.filter((b) => b.status === 'GREEN')
      : barbers;

    const map = new Map<string, ShopCluster>();
    const list: ShopCluster[] = [];

    displayed.forEach((barber) => {
      // Group by shopId or unique coordinates
      const key = barber.shopId || `${barber.lat.toFixed(4)}_${barber.lng.toFixed(4)}`;
      let cluster = map.get(key);
      if (!cluster) {
        cluster = {
          id: key,
          shopName: barber.shopName || 'Barbería Independiente',
          zone: barber.zone,
          address: barber.address,
          lat: barber.lat,
          lng: barber.lng,
          barbers: [],
          bestStatus: 'GRAY',
        };
        map.set(key, cluster);
        list.push(cluster);
      }
      cluster.barbers.push(barber);
    });

    // Calculate smart availability status for cluster
    list.forEach((c) => {
      if (c.barbers.some((b) => b.status === 'GREEN')) c.bestStatus = 'GREEN';
      else if (c.barbers.some((b) => b.status === 'YELLOW')) c.bestStatus = 'YELLOW';
      else if (c.barbers.some((b) => b.status === 'RED')) c.bestStatus = 'RED';
      else c.bestStatus = 'GRAY';
    });

    return list;
  }, [barbers, filterOnlyGreen]);

  // Active cluster corresponding to the selected barber
  const activeCluster = useMemo(() => {
    if (!selectedBarber) return null;
    return (
      clusters.find((c) => c.barbers.some((b) => b.id === selectedBarber.id)) ||
      null
    );
  }, [clusters, selectedBarber]);

  // 1. Initialize Google Maps instance
  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

    if (!isGoogleMapsConfigured) {
      setOptions({
        key: apiKey,
        v: 'weekly',
      });
      isGoogleMapsConfigured = true;
    }

    let isCancelled = false;

    importLibrary('maps')
      .then((mapsLib) => {
        if (isCancelled || !mapContainerRef.current) return;

        // Center on Sopocachi / Centro La Paz
        const map = new mapsLib.Map(mapContainerRef.current, {
          center: { lat: -16.5113, lng: -68.1287 },
          zoom: 14.5,
          disableDefaultUI: true,
          zoomControl: false,
          gestureHandling: 'greedy',
          styles: DARK_MAP_STYLE,
          backgroundColor: '#0d0d10',
        });

        // Click outside on map collapses spiderfy
        map.addListener('click', () => {
          setSpiderfiedShopId(null);
        });

        mapInstanceRef.current = map;
        setIsMapLoaded(true);
      })
      .catch((err: unknown) => {
        console.error('Error loading Google Maps API:', err);
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  // 2. Render Markers, Silos & Spiderfy Overlays
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !isMapLoaded) return;

    // Clear old overlays
    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];

    clusters.forEach((cluster) => {
      const markerPos = new google.maps.LatLng(cluster.lat, cluster.lng);
      const isSpiderfied = spiderfiedShopId === cluster.id;
      const isSingleBarber = cluster.barbers.length === 1;

      // Color helper
      const getStatusHex = (status: string) => {
        switch (status) {
          case 'GREEN':
            return '#34d399';
          case 'YELLOW':
            return '#fbbf24';
          case 'RED':
            return '#ef4444';
          default:
            return '#71717a';
        }
      };

      const container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.cursor = 'pointer';

      // =======================================================================
      // CASE A: SPIDERFY ACTIVE (Expanded radial fan with connecting lines)
      // =======================================================================
      if (isSpiderfied && !isSingleBarber) {
        container.style.transform = 'translate(-50%, -50%)';
        container.style.zIndex = '50';

        const barberCount = cluster.barbers.length;
        const radius = 76; // Distance in px from center anchor

        // Calculate radial positions fanning upward
        // For N=2: -135deg, -45deg. For N=3: -150deg, -90deg, -30deg.
        const angles: number[] = [];
        if (barberCount === 2) {
          angles.push(-135, -45);
        } else if (barberCount === 3) {
          angles.push(-155, -90, -25);
        } else {
          const step = 360 / barberCount;
          for (let i = 0; i < barberCount; i++) {
            angles.push(-90 + i * step);
          }
        }

        // SVG connecting lines
        let svgLines = '';
        const pinsHtml = cluster.barbers
          .map((barber, i) => {
            const angleDeg = angles[i];
            const rad = (angleDeg * Math.PI) / 180;
            const x = Math.round(radius * Math.cos(rad));
            const y = Math.round(radius * Math.sin(rad));
            const sColor = getStatusHex(barber.status);
            const isSelected = selectedBarber?.id === barber.id;

            svgLines += `
              <line x1="0" y1="0" x2="${x}" y2="${y}" stroke="#B68F4E" stroke-width="2" stroke-linecap="round" stroke-dasharray="3,3" opacity="0.9" />
            `;

            return `
              <div class="fade-spider-pin animate-spider-pop" data-barber-id="${barber.id}" style="
                position: absolute;
                left: ${x}px;
                top: ${y}px;
                transform: translate(-50%, -50%);
                display: flex;
                flex-direction: column;
                align-items: center;
                animation-delay: ${i * 45}ms;
                z-index: 30;
                filter: drop-shadow(0 6px 14px rgba(0,0,0,0.95));
              ">
                <div style="
                  width: 44px;
                  height: 44px;
                  border-radius: 50%;
                  border: ${isSelected ? '3px solid #F5EBDD' : '2.5px solid #B68F4E'};
                  background: #000;
                  overflow: hidden;
                  position: relative;
                  box-shadow: ${isSelected ? '0 0 18px #B68F4E' : '0 0 12px rgba(182, 143, 78, 0.4)'};
                  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                ">
                  <img src="${barber.avatar}" style="width: 100%; height: 100%; object-fit: cover;" alt="${barber.name}" />
                </div>
                <!-- Diamond Status Indicator -->
                <div style="
                  position: absolute;
                  bottom: 12px;
                  right: 2px;
                  width: 12px;
                  height: 12px;
                  transform: rotate(45deg);
                  background: ${sColor};
                  border: 2px solid #000;
                  box-shadow: 0 0 8px ${sColor};
                "></div>
                <!-- First Name Badge -->
                <div style="
                  margin-top: 2px;
                  padding: 2px 7px;
                  background: rgba(10, 10, 10, 0.95);
                  border: 1px solid rgba(255, 255, 255, 0.2);
                  border-radius: 6px;
                  font-size: 10px;
                  font-weight: 800;
                  color: #F5EBDD;
                  white-space: nowrap;
                  letter-spacing: 0.02em;
                ">
                  ${barber.name.split(' ')[0]}
                </div>
              </div>
            `;
          })
          .join('');

        container.innerHTML = `
          <div style="position: relative; width: 0; height: 0;">
            <!-- Connector Lines SVG -->
            <svg width="240" height="240" viewBox="-120 -120 240 240" style="position: absolute; left: -120px; top: -120px; pointer-events: none; z-index: 10;">
              ${svgLines}
            </svg>

            <!-- Center Hub / Studio Anchor Button -->
            <div id="spider-center-hub" style="
              position: absolute;
              transform: translate(-50%, -50%);
              width: 34px;
              height: 34px;
              border-radius: 50%;
              background: #141414;
              border: 2px solid #B68F4E;
              color: #F5EBDD;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 13px;
              font-weight: bold;
              box-shadow: 0 0 16px rgba(182, 143, 78, 0.6);
              z-index: 40;
              transition: transform 0.2s;
            ">
              ✕
            </div>

            <!-- Fanned Barber Pins -->
            ${pinsHtml}
          </div>
        `;

        // Event delegation for center close and barber pins
        const hub = container.querySelector('#spider-center-hub');
        hub?.addEventListener('click', (e) => {
          e.stopPropagation();
          setSpiderfiedShopId(null);
        });

        const pinElements = container.querySelectorAll('.fade-spider-pin');
        pinElements.forEach((el) => {
          el.addEventListener('click', (e) => {
            e.stopPropagation();
            const bId = el.getAttribute('data-barber-id');
            const found = cluster.barbers.find((b) => b.id === bId);
            if (found) {
              setSelectedBarber(found);
            }
          });
        });
      }

      // =======================================================================
      // CASE B: STUDIO CLUSTER (Silo con múltiples barberos colapsados)
      // =======================================================================
      else if (!isSingleBarber) {
        container.style.transform = 'translate(-50%, -100%)';
        container.style.zIndex = '20';
        container.style.filter = 'drop-shadow(0 8px 18px rgba(0,0,0,0.95))';

        const sColor = getStatusHex(cluster.bestStatus);
        const topBarber = cluster.barbers[0];
        const secondBarber = cluster.barbers[1];

        container.innerHTML = `
          <div style="position: relative; width: 54px; height: 60px; display: flex; flex-direction: column; align-items: center; transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
            <!-- Secondary Stacked Avatar behind -->
            <div style="
              position: absolute;
              top: 0;
              left: 0;
              width: 38px;
              height: 38px;
              border-radius: 50%;
              border: 1.5px solid rgba(182, 143, 78, 0.6);
              background: #111;
              overflow: hidden;
              opacity: 0.7;
              transform: scale(0.9) translate(-4px, -2px);
            ">
              <img src="${secondBarber?.avatar || topBarber.avatar}" style="width: 100%; height: 100%; object-fit: cover;" alt="Studio" />
            </div>

            <!-- Primary Front Avatar -->
            <div style="
              position: relative;
              width: 44px;
              height: 44px;
              border-radius: 50%;
              border: 2.5px solid #B68F4E;
              background: #000;
              overflow: hidden;
              box-shadow: 0 0 16px rgba(182, 143, 78, 0.5);
              z-index: 5;
            ">
              <img src="${topBarber.avatar}" style="width: 100%; height: 100%; object-fit: cover;" alt="${topBarber.name}" />
            </div>

            <!-- Silo Count Pill Badge (Top Right) -->
            <div style="
              position: absolute;
              top: -6px;
              right: -6px;
              background: #B68F4E;
              color: #000;
              font-size: 10px;
              font-weight: 900;
              padding: 1.5px 6px;
              border-radius: 999px;
              border: 1.5px solid #000;
              box-shadow: 0 2px 8px rgba(0,0,0,0.8);
              z-index: 10;
              letter-spacing: 0.04em;
            ">
              ${cluster.barbers.length}
            </div>

            <!-- Best Presence Diamond Badge -->
            <div style="
              position: absolute;
              bottom: 12px;
              right: 2px;
              width: 13px;
              height: 13px;
              transform: rotate(45deg);
              background: ${sColor};
              border: 2px solid #000;
              box-shadow: 0 0 10px ${sColor};
              z-index: 10;
            "></div>

            <!-- Pin Pointer -->
            <div style="
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 8px solid #B68F4E;
              margin-top: -1px;
              z-index: 5;
            "></div>

            <!-- Studio Label Pill below with expand chevron -->
            <div style="
              margin-top: 3px;
              padding: 2.5px 8px;
              background: rgba(10, 10, 10, 0.92);
              border: 1px solid rgba(182, 143, 78, 0.4);
              border-radius: 8px;
              font-size: 10px;
              font-weight: 800;
              color: #F5EBDD;
              white-space: nowrap;
              display: flex;
              align-items: center;
              gap: 4px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.9);
            ">
              <span>${cluster.shopName}</span>
              <span style="color: #B68F4E; font-size: 9px;">▾</span>
            </div>
          </div>
        `;

        container.addEventListener('mouseenter', () => {
          container.style.transform = 'translate(-50%, -105%) scale(1.08)';
          container.style.zIndex = '35';
        });
        container.addEventListener('mouseleave', () => {
          container.style.transform = 'translate(-50%, -100%) scale(1)';
          container.style.zIndex = '20';
        });

        // Click on Silo opens Spiderfy and selects first barber
        container.addEventListener('click', (e) => {
          e.stopPropagation();
          setSpiderfiedShopId(cluster.id);
          setSelectedBarber(cluster.barbers[0]);
          map.panTo(markerPos);
        });
      }

      // =======================================================================
      // CASE C: SINGLE BARBER PIN
      // =======================================================================
      else {
        container.style.transform = 'translate(-50%, -100%)';
        container.style.zIndex = '15';
        container.style.filter = 'drop-shadow(0 8px 16px rgba(0,0,0,0.9))';

        const barber = cluster.barbers[0];
        const sColor = getStatusHex(barber.status);
        const isSelected = selectedBarber?.id === barber.id;

        container.innerHTML = `
          <div style="position: relative; width: 48px; height: 56px; display: flex; flex-direction: column; align-items: center; transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
            <div style="
              width: 44px;
              height: 44px;
              border-radius: 50%;
              border: ${isSelected ? '3px solid #F5EBDD' : '2.5px solid #B68F4E'};
              background: #000;
              overflow: hidden;
              position: relative;
              box-shadow: ${isSelected ? '0 0 18px #B68F4E' : '0 0 14px rgba(182, 143, 78, 0.45)'};
            ">
              <img src="${barber.avatar}" style="width: 100%; height: 100%; object-fit: cover;" alt="${barber.name}" />
            </div>
            <!-- Diamond Status Indicator -->
            <div style="
              position: absolute;
              bottom: 10px;
              right: 2px;
              width: 13px;
              height: 13px;
              transform: rotate(45deg);
              background: ${sColor};
              border: 2px solid #000;
              box-shadow: 0 0 10px ${sColor};
            "></div>
            <!-- Pin Pointer -->
            <div style="
              width: 0;
              height: 0;
              border-left: 6px solid transparent;
              border-right: 6px solid transparent;
              border-top: 8px solid #B68F4E;
              margin-top: -1px;
            "></div>
          </div>
        `;

        container.addEventListener('mouseenter', () => {
          container.style.transform = 'translate(-50%, -106%) scale(1.1)';
          container.style.zIndex = '35';
        });
        container.addEventListener('mouseleave', () => {
          container.style.transform = 'translate(-50%, -100%) scale(1)';
          container.style.zIndex = '15';
        });

        container.addEventListener('click', (e) => {
          e.stopPropagation();
          setSpiderfiedShopId(null);
          setSelectedBarber(barber);
          map.panTo(markerPos);
        });
      }

      // Mount via Google Maps OverlayView
      const overlay = new google.maps.OverlayView();
      overlay.onAdd = function () {
        this.getPanes()?.overlayMouseTarget.appendChild(container);
      };
      overlay.draw = function () {
        const projection = this.getProjection();
        if (!projection) return;
        const pixel = projection.fromLatLngToDivPixel(markerPos);
        if (pixel) {
          container.style.left = `${pixel.x}px`;
          container.style.top = `${pixel.y}px`;
        }
      };
      overlay.onRemove = function () {
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      };

      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    });

    // Auto-select first barber if none selected
    if (!selectedBarber && clusters.length > 0 && clusters[0].barbers.length > 0) {
      setSelectedBarber(clusters[0].barbers[0]);
    }
  }, [clusters, spiderfiedShopId, selectedBarber, isMapLoaded]);

  const handleOpenGoogleMaps = (barber: ExploreBarber) => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${barber.lat},${barber.lng}`,
      '_blank'
    );
  };

  return (
    <div className="relative w-full h-[calc(100vh-5rem)] min-h-[500px] bg-[#0d0d10] overflow-hidden select-none">
      {/* 1. Google Maps Canvas Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* 2. Floating Top Header Controls */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        {/* Toggle back to list */}
        <button
          type="button"
          onClick={onBackToList}
          className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/15 text-[#D9C9B0] hover:text-white text-xs font-semibold shadow-[0_10px_25px_rgba(0,0,0,0.85)] transition-all cursor-pointer"
        >
          <List className="w-4 h-4 text-[#B68F4E]" />
          <span>Ver lista</span>
        </button>

        {/* Quick Filter Pill */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFilterOnlyGreen(!filterOnlyGreen);
              setSpiderfiedShopId(null);
            }}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-2xl text-xs font-semibold backdrop-blur-xl border transition-all cursor-pointer shadow-[0_10px_25px_rgba(0,0,0,0.85)] ${
              filterOnlyGreen
                ? 'bg-[#B68F4E] text-black border-[#B68F4E]'
                : 'bg-black/85 text-white border-white/15 hover:border-white/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                filterOnlyGreen ? 'bg-black' : 'bg-emerald-400 animate-pulse'
              }`}
            />
            <span>Solo libres</span>
          </button>
        </div>
      </div>

      {/* 3. Floating Bottom Sheet Sincronizado */}
      <AnimatePresence>
        {selectedBarber && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute bottom-20 lg:bottom-6 left-4 right-4 max-w-lg mx-auto z-20"
          >
            <div className="relative p-4 rounded-3xl bg-gradient-to-b from-[#1C1C1C] via-[#141414] to-[#0A0A0A] border border-white/15 shadow-[0_18px_45px_rgba(0,0,0,0.98),inset_0_1px_0_rgba(255,255,255,0.18)]">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => {
                  setSelectedBarber(null);
                  setSpiderfiedShopId(null);
                }}
                className="absolute top-3 right-3 p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3.5">
                {/* Avatar */}
                <div className="relative w-16 h-16 rounded-2xl overflow-hidden border border-[#B68F4E]/40 flex-shrink-0">
                  <img
                    src={selectedBarber.avatar}
                    alt={selectedBarber.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-1 left-1 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-md text-[10px] text-white font-bold">
                    <Star className="w-2.5 h-2.5 text-[#B68F4E] fill-current" />
                    <span>{selectedBarber.rating}</span>
                  </div>
                </div>

                {/* Barber Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-bold text-white tracking-tight truncate">
                      {selectedBarber.name}
                    </h3>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#B68F4E] flex-shrink-0" />
                  </div>
                  <p className="text-xs text-[#D9C9B0] font-medium truncate">
                    {selectedBarber.shopName}
                  </p>
                  <p className="text-[11px] text-white/50 truncate mt-0.5">
                    {selectedBarber.address} · {selectedBarber.zone}
                  </p>

                  <div className="flex items-center gap-2 mt-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedBarber.status === 'GREEN'
                          ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]'
                          : selectedBarber.status === 'YELLOW'
                          ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                          : 'bg-rose-500 shadow-[0_0_8px_#ef4444]'
                      }`}
                    />
                    <span className="text-[11px] font-semibold text-white/90">
                      {selectedBarber.status === 'GREEN'
                        ? 'Sillón libre (Llegar ahora)'
                        : selectedBarber.status === 'YELLOW'
                        ? '1 en espera en sala (~20 min)'
                        : 'Ocupado en sillón'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Multi-Barber Studio Switcher Bar (Capa 3: Sincronización de Salón) */}
              {activeCluster && activeCluster.barbers.length > 1 && (
                <div className="mt-3 pt-2.5 border-t border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#B68F4E]">
                      <Users className="w-3 h-3 text-[#B68F4E]" />
                      <span>
                        Equipo en este local ({activeCluster.barbers.length})
                      </span>
                    </div>

                    {spiderfiedShopId === activeCluster.id ? (
                      <button
                        type="button"
                        onClick={() => setSpiderfiedShopId(null)}
                        className="text-[10px] font-semibold text-white/60 hover:text-white cursor-pointer"
                      >
                        Cerrar abanico ✕
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSpiderfiedShopId(activeCluster.id)}
                        className="text-[10px] font-bold text-[#B68F4E] hover:underline cursor-pointer"
                      >
                        Abrir abanico ▾
                      </button>
                    )}
                  </div>

                  {/* Horizontal Barbers Pills */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {activeCluster.barbers.map((b) => {
                      const isCur = selectedBarber.id === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBarber(b)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-all cursor-pointer flex-shrink-0 ${
                            isCur
                              ? 'bg-[#B68F4E]/25 border-[#B68F4E] text-[#F5EBDD] font-bold shadow-[0_0_12px_rgba(182,143,78,0.3)]'
                              : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              b.status === 'GREEN'
                                ? 'bg-emerald-400'
                                : b.status === 'YELLOW'
                                ? 'bg-amber-400'
                                : 'bg-rose-500'
                            }`}
                          />
                          <span>{b.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons: Walk-in oriented */}
              <div className="flex items-center gap-2 mt-3.5 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => handleOpenGoogleMaps(selectedBarber)}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 border border-white/10 text-xs font-semibold transition-all cursor-pointer"
                  title="Cómo llegar con Google Maps"
                >
                  <Navigation className="w-3.5 h-3.5 text-[#B68F4E]" />
                  <span>Cómo llegar</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectBarber(selectedBarber)}
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-b from-[#F3E9DC] via-[#D9C9B0] to-[#C2AE91] text-black text-xs font-black uppercase tracking-wider shadow-[0_4px_16px_rgba(217,201,176,0.3)] hover:brightness-105 active:scale-95 transition-all cursor-pointer text-center flex items-center justify-center gap-1.5"
                >
                  <Scissors className="w-3.5 h-3.5 text-black" />
                  <span>Ver Barbero & Cortes</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recenter button */}
      <button
        type="button"
        onClick={() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.panTo({ lat: -16.5113, lng: -68.1287 });
            mapInstanceRef.current.setZoom(14.5);
          }
        }}
        className="absolute bottom-44 lg:bottom-28 right-4 z-10 p-3 rounded-2xl bg-black/85 backdrop-blur-xl border border-white/15 text-[#B68F4E] hover:text-white shadow-lg cursor-pointer"
        title="Centrar en La Paz"
      >
        <Compass className="w-5 h-5" />
      </button>
    </div>
  );
};
