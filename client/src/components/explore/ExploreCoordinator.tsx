import { useState, useEffect, type FC } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ClientHomeFeed } from './ClientHomeFeed';
import { BarberListView } from './BarberListView';
import { DarkMapExplorer } from './DarkMapExplorer';
import { ShopDetailView } from './ShopDetailView';
import { BarberDetailView } from './BarberDetailView';
import { FilterDrawerModal } from './FilterDrawerModal';
import { BookingFlowModal } from './BookingFlowModal';
import { fetchExploreData } from '../../services/explore.service';
import type {
  ExploreBarber,
  ShopItem,
  ActiveBooking,
  FilterOptions,
} from '../../types/explore';

export type ExploreViewType = 'feed' | 'list' | 'map' | 'shop-detail' | 'barber-detail';

interface ExploreCoordinatorProps {
  initialView?: ExploreViewType;
  onOpenScan?: () => void;
}

export const ExploreCoordinator: FC<ExploreCoordinatorProps> = ({
  initialView = 'feed',
}) => {
  const [view, setView] = useState<ExploreViewType>(initialView);
  const [barbers, setBarbers] = useState<ExploreBarber[]>([]);
  const [shops, setShops] = useState<ShopItem[]>([]);
  const [activeBooking, setActiveBooking] = useState<ActiveBooking | null>(null);

  const [selectedBarber, setSelectedBarber] = useState<ExploreBarber | null>(null);
  const [selectedShop, setSelectedShop] = useState<ShopItem | null>(null);

  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [bookingBarber, setBookingBarber] = useState<ExploreBarber | null>(null);

  const [filters, setFilters] = useState<FilterOptions>({
    searchQuery: '',
    onlyAvailableNow: false,
    onlyThisWeek: false,
    maxDistanceKm: 10,
    selectedZones: [],
    priceRanges: [],
    selectedServices: [],
    minRating: 0,
    subTab: 'todos',
  });

  // Load exploration data from backend / map endpoint
  useEffect(() => {
    let isMounted = true;
    fetchExploreData().then((data) => {
      if (isMounted) {
        setBarbers(data.barbers);
        setShops(data.shops);
        setActiveBooking(data.activeBooking);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Update initial view when prop changes (e.g. from navbar tabs)
  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const handleSelectBarber = (barber: ExploreBarber) => {
    setSelectedBarber(barber);
    setView('barber-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectShop = (shop: ShopItem) => {
    setSelectedShop(shop);
    setView('shop-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleQuickBook = (barber: ExploreBarber) => {
    setBookingBarber(barber);
    setIsBookingModalOpen(true);
  };

  const handleToggleFavoriteBarber = (barberId: string) => {
    setBarbers((prev) =>
      prev.map((b) => (b.id === barberId ? { ...b, isFavorite: !b.isFavorite } : b))
    );
    if (selectedBarber && selectedBarber.id === barberId) {
      setSelectedBarber((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : null));
    }
  };

  const handleToggleFavoriteShop = (shopId: string) => {
    setShops((prev) =>
      prev.map((s) => (s.id === shopId ? { ...s, isFavorite: !s.isFavorite } : s))
    );
    if (selectedShop && selectedShop.id === shopId) {
      setSelectedShop((prev) => (prev ? { ...prev, isFavorite: !prev.isFavorite } : null));
    }
  };

  const handleConfirmBooking = (bookingData: {
    barberId: string;
    date: string;
    time: string;
    totalBs: number;
    serviceNames: string[];
  }) => {
    const bookedBarber = barbers.find((b) => b.id === bookingData.barberId) || bookingBarber;
    if (bookedBarber) {
      setActiveBooking({
        id: `booking-${Date.now()}`,
        dateBadge: bookingData.date,
        timeRange: `${bookingData.time} - ${bookingData.time}`,
        shopName: bookedBarber.shopName,
        barberName: bookedBarber.name,
        barberAvatar: bookedBarber.avatar,
        serviceName: bookingData.serviceNames.join(', '),
        status: 'confirmada',
      });
    }
  };

  return (
    <div className="relative w-full min-h-screen bg-black text-[#F5EBDD] overflow-x-hidden">
      <AnimatePresence mode="wait">
        {/* VIEW 1: Home Feed (1.png) */}
        {view === 'feed' && (
          <motion.div
            key="feed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <ClientHomeFeed
              barbers={barbers}
              shops={shops}
              activeBooking={activeBooking}
              onSelectBarber={handleSelectBarber}
              onSelectShop={handleSelectShop}
              onOpenMap={() => setView('map')}
              onOpenSearch={() => setView('list')}
              onFilterAvailableNow={() => {
                setFilters((prev) => ({ ...prev, onlyAvailableNow: true }));
                setView('list');
              }}
              onFilterNearMe={() => {
                setFilters((prev) => ({ ...prev, maxDistanceKm: 3 }));
                setView('list');
              }}
              onQuickBook={handleQuickBook}
            />
          </motion.div>
        )}

        {/* VIEW 2: List Explorer (2.png) */}
        {view === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <BarberListView
              barbers={barbers}
              shops={shops}
              filters={filters}
              onChangeFilters={setFilters}
              onOpenFiltersModal={() => setIsFilterModalOpen(true)}
              onSwitchToMap={() => setView('map')}
              onSelectBarber={handleSelectBarber}
              onSelectShop={handleSelectShop}
              onQuickBook={handleQuickBook}
              onToggleFavoriteBarber={handleToggleFavoriteBarber}
              onToggleFavoriteShop={handleToggleFavoriteShop}
            />
          </motion.div>
        )}

        {/* VIEW 4: Interactive Dark Map (4.png) */}
        {view === 'map' && (
          <motion.div
            key="map"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <DarkMapExplorer
              barbers={barbers}
              onSelectBarber={handleSelectBarber}
              onQuickBook={handleQuickBook}
              onBackToList={() => setView('list')}
            />
          </motion.div>
        )}

        {/* VIEW 5: Shop Detail View (5.png) */}
        {view === 'shop-detail' && selectedShop && (
          <motion.div
            key="shop-detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <ShopDetailView
              shop={selectedShop}
              barbers={barbers}
              onBack={() => setView('list')}
              onSelectBarber={handleSelectBarber}
              onQuickBookBarber={handleQuickBook}
              onToggleFavorite={handleToggleFavoriteShop}
            />
          </motion.div>
        )}

        {/* VIEW 6: Barber Detail View (6.png) */}
        {view === 'barber-detail' && selectedBarber && (
          <motion.div
            key="barber-detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <BarberDetailView
              barber={selectedBarber}
              onBack={() => setView('list')}
              onOpenBooking={(b) => handleQuickBook(b)}
              onToggleFavorite={handleToggleFavoriteBarber}
              onOpenShop={(shopId) => {
                const s = shops.find((x) => x.id === shopId);
                if (s) handleSelectShop(s);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* VIEW 3: Filter Bottom Sheet Modal (3.png) */}
      <FilterDrawerModal
        isOpen={isFilterModalOpen}
        onClose={() => setIsFilterModalOpen(false)}
        filters={filters}
        onChangeFilters={setFilters}
        totalResultsCount={barbers.length + shops.length}
      />

      {/* VIEW 7: Booking Flow Modal (7.png) */}
      <BookingFlowModal
        isOpen={isBookingModalOpen}
        barber={bookingBarber}
        onClose={() => {
          setIsBookingModalOpen(false);
          setBookingBarber(null);
        }}
        onConfirmBooking={handleConfirmBooking}
      />
    </div>
  );
};
