// ============================================
// HOME SCREEN - Production Ready
// ============================================

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLocation } from '../../utils/useLocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
// Helper: คำนวณระยะทางระหว่าง 2 จุด (Haversine)
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ScrollView,
  Alert,
  Dimensions,
  Animated,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { JobCard } from '../../components/job/JobCard';
import { Loading, EmptyState, ModalContainer, Chip, KittenButton as Button, Avatar, FAB } from '../../components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import {
  ALL_PROVINCES,
  POPULAR_PROVINCES,
  PROVINCES_BY_REGION,
  REGIONS,
  getDistrictsForProvince,
} from '../../constants/locations';
import {
  STAFF_TYPES,
  LOCATION_TYPES,
  ALL_DEPARTMENTS,
  HOME_CARE_TYPES,
  PAYMENT_TYPES,
  getStaffTypeLabel,
  getLocationTypeLabel,
} from '../../constants/jobOptions';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useTheme } from '../../context/ThemeContext';
import { getJobs, searchJobs, subscribeToJobs, getUserPosts } from '../../services/jobService';
import { subscribeToNotifications } from '../../services/notificationsService';
import { subscribeToFavorites, toggleFavorite, Favorite } from '../../services/favoritesService';
import { JobPost, MainTabParamList, JobFilters } from '../../types';
import { debounce } from '../../utils/helpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PROVINCE_COORDS: Record<string, { lat: number; lng: number }> = {
  'กรุงเทพมหานคร': { lat: 13.7563, lng: 100.5018 },
  'นนทบุรี': { lat: 13.8621, lng: 100.5134 },
  'ปทุมธานี': { lat: 14.0208, lng: 100.5250 },
  'สมุทรปราการ': { lat: 13.5990, lng: 100.5998 },
  'เชียงใหม่': { lat: 18.7883, lng: 98.9853 },
  'ขอนแก่น': { lat: 16.4419, lng: 102.8359 },
  'นครราชสีมา': { lat: 14.9799, lng: 102.0978 },
  'อุดรธานี': { lat: 17.4156, lng: 102.7870 },
  'สงขลา': { lat: 7.1897, lng: 100.5953 },
  'ภูเก็ต': { lat: 7.8804, lng: 98.3923 },
  'ชลบุรี': { lat: 13.3611, lng: 100.9847 },
  'ระยอง': { lat: 12.6814, lng: 101.2816 },
};

function getJobCoords(job: JobPost): { lat: number; lng: number } | null {
  const lat = (job as any).lat ?? job.location?.lat ?? (job.location as any)?.coordinates?.lat;
  const lng = (job as any).lng ?? job.location?.lng ?? (job.location as any)?.coordinates?.lng;
  if (lat != null && lng != null) return { lat, lng };

  const province = job.location?.province || (job as any).province || '';
  return PROVINCE_COORDS[province] ?? null;
}

// ─── Category Tabs ──────────────────────────────────────────────────
const CATEGORY_TABS = [
  { key: 'all',      label: 'ทั้งหมด',      icon: 'apps-outline'             as const, color: '#0EA5E9' },
  { key: 'shift',    label: 'แทนเวร',       icon: 'swap-horizontal-outline'  as const, color: '#8B5CF6' },
  { key: 'job',      label: 'รับสมัคร',    icon: 'briefcase-outline'        as const, color: '#F59E0B' },
  { key: 'homecare', label: 'ดูแลผู้ป่วย', icon: 'home-outline'             as const, color: '#10B981' },
] as const;
type CategoryKey = typeof CATEGORY_TABS[number]['key'];

// ============================================
// Types
// ============================================
type HomeScreenNavigationProp = NativeStackNavigationProp<MainTabParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

// ============================================
// URGENT JOBS BANNER COMPONENT
// ============================================
interface UrgentBannerProps {
  urgentJobs: JobPost[];
  onPress: (job: JobPost) => void;
}

function UrgentJobsBanner({ urgentJobs, onPress }: UrgentBannerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Auto-scroll every 4 seconds
  useEffect(() => {
    if (urgentJobs.length <= 1) return;

    const supportsNativeDriver = Platform.OS !== 'web';

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const nextIndex = (prev + 1) % urgentJobs.length;
        
        // Animate fade
        Animated.sequence([
          Animated.timing(fadeAnim, {
            toValue: 0.3,
            duration: 150,
            useNativeDriver: supportsNativeDriver,
          }),
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 150,
            useNativeDriver: supportsNativeDriver,
          }),
        ]).start();

        // Scroll to next item
        scrollRef.current?.scrollTo({
          x: nextIndex * (SCREEN_WIDTH - 32),
          animated: true,
        });

        return nextIndex;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [urgentJobs.length, fadeAnim]);

  if (urgentJobs.length === 0) return null;

  const formatShortDate = (date: any) => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date.toDate?.() || date;
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
  };

  return (
    <View style={urgentStyles.container}>
      <View style={urgentStyles.header}>
        <View style={urgentStyles.headerLeft}>
          <Ionicons name="flash" size={18} color="#FF6B6B" />
          <Text style={urgentStyles.headerTitle}>งานด่วน!</Text>
          <View style={urgentStyles.badge}>
            <Text style={urgentStyles.badgeText}>PREMIUM</Text>
          </View>
        </View>
        <View style={urgentStyles.dots}>
          {urgentJobs.map((_, index) => (
            <View
              key={index}
              style={[
                urgentStyles.dot,
                index === currentIndex && urgentStyles.dotActive,
              ]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={SCREEN_WIDTH - 32}
        contentContainerStyle={urgentStyles.scrollContent}
        onMomentumScrollEnd={(e) => {
          const newIndex = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - 32));
          setCurrentIndex(newIndex);
        }}
      >
        {urgentJobs.map((job, index) => (
          <Animated.View
            key={job.id}
            style={[
              urgentStyles.card,
              { opacity: index === currentIndex ? fadeAnim : 0.7 },
            ]}
          >
            <TouchableOpacity
              style={urgentStyles.cardInner}
              onPress={() => onPress(job)}
              activeOpacity={0.8}
            >
              <View style={urgentStyles.cardLeft}>
                <Text style={urgentStyles.cardTitle} numberOfLines={1}>
                  {job.title || job.department}
                </Text>
                <Text style={urgentStyles.cardLocation} numberOfLines={1}>
                  📍 {job.location?.hospital || job.location?.district}
                </Text>
                <View style={urgentStyles.cardMeta}>
                  <Text style={urgentStyles.cardDate}>
                    📅 {formatShortDate(job.shiftDate)}
                  </Text>
                  <Text style={urgentStyles.cardTime}>
                    ⏰ {job.shiftTime}
                  </Text>
                </View>
              </View>
              <View style={urgentStyles.cardRight}>
                <Text style={urgentStyles.cardPrice}>
                  ฿{job.shiftRate?.toLocaleString()}
                </Text>
                <Text style={urgentStyles.cardPriceUnit}>/{job.rateType || 'เวร'}</Text>
                <View style={urgentStyles.urgentBadge}>
                  <Ionicons name="flash" size={12} color="#FFF" />
                  <Text style={urgentStyles.urgentBadgeText}>ด่วน</Text>
                </View>
              </View>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </ScrollView>
    </View>
  );
}

const urgentStyles = StyleSheet.create({
  container: {
    marginBottom: SPACING.md,
    backgroundColor: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: '#FF6B6B',
  },
  badge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#000',
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: '#0EA5E9',
    width: 18,
  },
  scrollContent: {
    gap: SPACING.sm,
  },
  card: {
    width: SCREEN_WIDTH - 32,
  },
  cardInner: {
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    ...SHADOWS.sm,
  },
  cardLeft: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: '#FFF',
  },
  cardLocation: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.7)',
  },
  cardMeta: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: 4,
  },
  cardDate: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.6)',
  },
  cardTime: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.6)',
  },
  cardRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  cardPrice: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    color: '#4ADE80',
  },
  cardPriceUnit: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.5)',
    marginTop: -4,
  },
  urgentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
    marginTop: SPACING.xs,
  },
  urgentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
  },
});

// ============================================
// Component
// ============================================
export default function HomeScreen({ navigation }: Props) {
    // Nearby location
    const { location, loading: locationLoading, error: locationError, getLocation } = useLocation();
    const [nearbyMode, setNearbyMode] = useState(false); // true = ใกล้ฉัน
  // Auth context
  const { user, requireAuth, isInitialized } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  // State
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const lastDocRef = useRef<any>(null);
  const hasMoreRef = useRef(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [showExpiryPopup, setShowExpiryPopup] = useState(false);
  const [expiringPosts, setExpiringPosts] = useState<JobPost[]>([]);
  const [showNearbyPromo, setShowNearbyPromo] = useState(false);
  const [filters, setFilters] = useState<JobFilters>({
    province: '',
    district: '',
    department: '',
    urgentOnly: false,
    verifiedOnly: false,
    sortBy: 'latest',
    staffType: undefined,
    locationType: undefined,
    homeCareOnly: false,
    paymentType: undefined,
  });

  // Set default tab based on role when user first loads
  // user (คนทั่วไป) → homecare tab, hospital → job tab, nurse → all (default)
  const roleDefaultAppliedRef = useRef(false);
  useEffect(() => {
    if (!user?.uid || roleDefaultAppliedRef.current) return;
    roleDefaultAppliedRef.current = true;
    if (user.role === 'user') {
      setFilters(prev => ({ ...prev, postType: 'homecare' }));
    } else if (user.role === 'hospital') {
      setFilters(prev => ({ ...prev, postType: 'job' }));
    }
  }, [user?.uid, user?.role]);

  // Get urgent jobs for banner (paid premium placement)
  const urgentJobs = useMemo(() => {
    return jobs.filter(job => job.status === 'urgent').slice(0, 5);
  }, [jobs]);

  // Fetch location silently on mount — enables distance badges on all job cards
  useEffect(() => {
    if (!location) {
      getLocation().catch(() => {}); // silent fail — if denied, distances just won't show
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch jobs (infinite scroll + nearby)
  const fetchJobs = useCallback(async (showRefresh = false, loadMore = false) => {
    if (loadMore && !hasMoreRef.current) return;
    if (loadMore) setIsLoadingMore(true);
    else if (showRefresh) { setIsRefreshing(true); lastDocRef.current = null; hasMoreRef.current = true; }
    else { setIsLoading(true); lastDocRef.current = null; hasMoreRef.current = true; }

    try {
      let fetchedJobs: JobPost[];

      if (nearbyMode && location) {
        const { getJobsNearby } = await import('../../services/jobService');
        fetchedJobs = await getJobsNearby(location.latitude, location.longitude, 20);
        if (filters.postType) {
          fetchedJobs = fetchedJobs.filter(j => j.postType === filters.postType);
        }
        lastDocRef.current = null;
        hasMoreRef.current = false;
        setJobs(fetchedJobs);
      } else {
        const cursor = loadMore ? lastDocRef.current : null;
        const result = await getJobs(filters, cursor);
        fetchedJobs = result.jobs;
        if (filters.postType) {
          fetchedJobs = fetchedJobs.filter(j => j.postType === filters.postType);
        }
        lastDocRef.current = result.lastDoc;
        hasMoreRef.current = result.lastDoc !== null && fetchedJobs.length > 0;

        if (loadMore) {
          setJobs(prev => {
            const ids = new Set(prev.map(j => j.id));
            return [...prev, ...fetchedJobs.filter(j => !ids.has(j.id))];
          });
        } else {
          setJobs(fetchedJobs);
        }
      }
    } catch (error: any) {
      // ไม่แสดง Alert ถ้า permission-denied (ยังไม่ login) หรือ loadMore
      if (error?.code !== 'permission-denied' && !loadMore) {
        console.warn('Error fetching jobs:', error);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  }, [filters, nearbyMode, location]);

  // Initial load — only for nearbyMode (normal mode uses subscription below)
  useEffect(() => {
    if (nearbyMode) fetchJobs();
  }, [fetchJobs, nearbyMode]);

  // Real-time notification subscription
  useEffect(() => {
    if (!user?.uid || !isInitialized) {
      setNotificationCount(0);
      return;
    }

    // Subscribe to notifications - real-time updates
    const unsubscribe = subscribeToNotifications(user.uid, (notifications) => {
      const unreadCount = notifications.filter(n => !n.isRead).length;
      setNotificationCount(unreadCount);
    });

    return () => unsubscribe();
  }, [user?.uid, isInitialized]);

  // Real-time favorites subscription
  useEffect(() => {
    if (!user?.uid || !isInitialized) {
      setFavoriteIds([]);
      return;
    }

    const unsubscribe = subscribeToFavorites(user.uid, (favorites: Favorite[]) => {
      setFavoriteIds(favorites.map(f => f.jobId));
    });

    return () => unsubscribe();
  }, [user?.uid, isInitialized]);

  // Check for expiring posts on app load
  useEffect(() => {
    // Show nearby job alert promo popup once per install (only for logged-in users)
    const checkNearbyPromo = async () => {
      if (!user?.uid) return;
      // If already set up, never show
      if (user.nearbyJobAlert?.enabled) return;
      try {
        const shown = await AsyncStorage.getItem(`nearby_promo_shown_${user.uid}`);
        if (!shown) {
          setTimeout(() => setShowNearbyPromo(true), 1800);
        }
      } catch (_) {}
    };
    checkNearbyPromo();
  // ใช้ nearbyJobAlert?.enabled เป็น dep ด้วย เพื่อซ่อน banner ทันทีที่ user save ตั้งค่า
  }, [user?.uid, user?.nearbyJobAlert?.enabled]);

  const dismissNearbyPromo = useCallback(async (navigate = false) => {
    setShowNearbyPromo(false);
    if (user?.uid) {
      await AsyncStorage.setItem(`nearby_promo_shown_${user.uid}`, '1');
    }
    if (navigate) {
      (navigation as any).navigate('NearbyJobAlert');
    }
  }, [user?.uid, navigation]);

  // Check for expiring posts on app load
  useEffect(() => {
    const checkExpiringPosts = async () => {
      if (!user?.uid) return;
      
      try {
        const userPosts = await getUserPosts(user.uid);
        const now = new Date();
        
        // Filter posts that are expiring within 1 day (changed from 3 days)
        const expiring = userPosts.filter(post => {
          if (post.status === 'closed') return false;
          if (!post.expiresAt) return false;
          
          const expiryDate = (post.expiresAt as any)?.toDate?.() || post.expiresAt;
          const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return daysLeft <= 1 && daysLeft > 0; // Only show when 1 day or less remaining
        });
        
        if (expiring.length > 0) {
          setExpiringPosts(expiring);
          setShowExpiryPopup(true);
        }
      } catch (error) {
        console.log('Error checking expiring posts:', error);
      }
    };

    // Only check once per session
    const timer = setTimeout(checkExpiringPosts, 2000);
    return () => clearTimeout(timer);
  }, [user?.uid]);

  // Real-time jobs subscription
  useEffect(() => {
    setIsLoading(true);
    
    // Subscribe to jobs updates
    const unsubscribe = subscribeToJobs((newJobs) => {
      // ถ้าไม่มี filters ให้แสดงงานทั้งหมด
      let filteredJobs = newJobs.filter(job => job.status === 'active' || job.status === 'urgent');
      
      // Apply filters only if they have values
      if (filters.province && filters.province.length > 0) {
        filteredJobs = filteredJobs.filter(job => job.location?.province === filters.province);
      }
      if (filters.district && filters.district.length > 0) {
        filteredJobs = filteredJobs.filter(job => job.location?.district === filters.district);
      }
      if (filters.department && filters.department.length > 0) {
        filteredJobs = filteredJobs.filter(job => job.department === filters.department);
      }
      if (filters.urgentOnly === true) {
        filteredJobs = filteredJobs.filter(job => job.status === 'urgent');
      }
      if (filters.verifiedOnly === true) {
        filteredJobs = filteredJobs.filter(job => job.posterVerified === true);
      }
      if (filters.minRate && filters.minRate > 0) {
        filteredJobs = filteredJobs.filter(job => job.shiftRate >= filters.minRate!);
      }
      if (filters.maxRate && filters.maxRate > 0) {
        filteredJobs = filteredJobs.filter(job => job.shiftRate <= filters.maxRate!);
      }
      
      // NEW: Filter by staff type
      if (filters.staffType) {
        filteredJobs = filteredJobs.filter(job => job.staffType === filters.staffType);
      }
      
      // NEW: Filter by location type
      if (filters.locationType) {
        filteredJobs = filteredJobs.filter(job => job.locationType === filters.locationType);
      }
      
      // NEW: Filter by payment type
      if (filters.paymentType) {
        filteredJobs = filteredJobs.filter(job => job.paymentType === filters.paymentType);
      }
      
      // NEW: Filter home care only
      if (filters.homeCareOnly) {
        filteredJobs = filteredJobs.filter(job => job.locationType === 'HOME');
      }

      // Filter by postType (category tab)
      if (filters.postType) {
        filteredJobs = filteredJobs.filter(job => job.postType === filters.postType);
      }
      
      // Filter by shift time (morning/night) - only if explicitly selected
      if (filters.sortBy === 'morning') {
        filteredJobs = filteredJobs.filter(job => {
          const startHour = parseInt(job.shiftTime?.split(':')[0] || '8');
          return startHour >= 5 && startHour < 12;
        });
      } else if (filters.sortBy === 'night') {
        filteredJobs = filteredJobs.filter(job => {
          const startHour = parseInt(job.shiftTime?.split(':')[0] || '8');
          return startHour >= 18 || startHour < 5;
        });
      }
      
      // Sort
      if (filters.sortBy === 'highestPay') {
        filteredJobs = filteredJobs.sort((a, b) => (b.shiftRate || 0) - (a.shiftRate || 0));
      }
      
      console.log(`Jobs loaded: ${newJobs.length} total, ${filteredJobs.length} after filter`);
      setJobs(filteredJobs);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [filters]);

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce(async (query: string) => {
      if (!query.trim()) {
        fetchJobs();
        return;
      }
      
      setIsLoading(true);
      try {
        const results = await searchJobs(query);
        setJobs(results);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    }, 500),
    [fetchJobs]
  );

  // Handle search
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    debouncedSearch(text);
  };

  // Handle job press
  const handleJobPress = (job: JobPost) => {
    const serializedJob = {
      ...job,
      shiftDate: job.shiftDate ? (job.shiftDate instanceof Date ? job.shiftDate.toISOString() : job.shiftDate) : undefined,
      shiftDateEnd: (job as any).shiftDateEnd ? ((job as any).shiftDateEnd instanceof Date ? (job as any).shiftDateEnd.toISOString() : (job as any).shiftDateEnd) : undefined,
    } as any;
    (navigation as any).navigate('JobDetail', { job: serializedJob });
  };

  // Handle save job (toggle favorite)
  const handleSaveJob = async (job: JobPost) => {
    requireAuth(async () => {
      if (!user?.uid) return;
      
      try {
        const isNowFavorite = await toggleFavorite(user.uid, job.id);
        if (isNowFavorite) {
          toast.success(`เพิ่ม "${job.title}" ไปยังรายการโปรดแล้ว`, '❤️ บันทึกแล้ว');
        } else {
          toast.info(`ลบ "${job.title}" ออกจากรายการโปรดแล้ว`, '💔 ลบออกแล้ว');
        }
      } catch (error) {
        toast.error('ไม่สามารถบันทึกงานได้');
      }
    });
  };

  // Apply filters
  const applyFilters = () => {
    setShowFilters(false);
    fetchJobs();
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      province: '',
      district: '',
      department: '',
      urgentOnly: false,
      verifiedOnly: false,
      sortBy: 'latest',
      minRate: undefined,
      maxRate: undefined,
      staffType: undefined,
      locationType: undefined,
      homeCareOnly: false,
      paymentType: undefined,
      postType: undefined,
    });
  };

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.province) count++;
    if (filters.district) count++;
    if (filters.department) count++;
    if (filters.urgentOnly) count++;
    if (filters.verifiedOnly) count++;
    if (filters.minRate || filters.maxRate) count++;
    if (filters.staffType) count++;
    if (filters.locationType) count++;
    if (filters.homeCareOnly) count++;
    if (filters.paymentType) count++;
    return count;
  }, [filters]);

  // Compute distance for each job (if user location is available)
  const jobsWithDistance = useMemo(() => {
    const baseLat = location?.latitude ?? user?.nearbyJobAlert?.lat;
    const baseLng = location?.longitude ?? user?.nearbyJobAlert?.lng;
    if (baseLat == null || baseLng == null) return jobs;

    return jobs.map(job => {
      const coords = getJobCoords(job);
      if (!coords) return job;
      const dist = getDistanceKm(baseLat, baseLng, coords.lat, coords.lng);
      return { ...job, _distanceKm: Math.round(dist * 10) / 10 } as JobPost;
    });
  }, [jobs, location, user?.nearbyJobAlert?.lat, user?.nearbyJobAlert?.lng]);

  // Render job item
  const renderJobItem = ({ item }: { item: JobPost }) => (
    <JobCard
      job={item}
      onPress={() => handleJobPress(item)}
      onSave={() => handleSaveJob(item)}
      isSaved={favoriteIds.includes(item.id)}
    />
  );

  // Render header
  const renderHeader = () => {
    // Role-aware onboarding banner text
    const onboardingTitle = user?.role === 'hospital'
      ? 'ตั้งค่าองค์กรของคุณ'
      : user?.role === 'user'
      ? 'บอกเราว่าคุณต้องการอะไร'
      : 'ตั้งค่าโปรไฟล์ของคุณ';
    const onboardingSub = user?.role === 'hospital'
      ? 'ระบุประเภทองค์กรและบุคลากรที่ต้องการ เพื่อให้การโพสต์งานง่ายขึ้น'
      : user?.role === 'user'
      ? 'บอกเราประเภทการดูแลที่ต้องการ เราจะแสดงผู้ดูแลที่ตรงกับคุณ'
      : 'บอกเราสักเล็กน้อย เราจะแนะนำงานที่ตรงกับคุณยิ่งขึ้น';

    return (
    <View style={styles.listHeader}>
      {/* Onboarding Banner — แสดงตอนเข้าแอปครั้งแรก */}
      {user && !user.onboardingCompleted && (
        <TouchableOpacity
          style={styles.onboardingBanner}
          onPress={() => (navigation as any).navigate('OnboardingSurvey')}
          activeOpacity={0.88}
        >
          {/* Left accent stripe */}
          <View style={styles.onboardingBannerStripe} />

          {/* Content */}
          <View style={styles.onboardingBannerContent}>
            <View style={styles.onboardingBannerRow}>
              <View style={styles.onboardingBannerIcon}>
                <Ionicons name="sparkles" size={16} color="#FFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.onboardingBannerTag}>เริ่มต้นใช้งาน</Text>
                <Text style={styles.onboardingBannerTitle}>{onboardingTitle}</Text>
                <Text style={styles.onboardingBannerSub}>{onboardingSub}</Text>
              </View>
            </View>
            {/* Progress dots + CTA row */}
            <View style={styles.onboardingBannerFooter}>
              <View style={styles.onboardingDots}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={[styles.onboardingDot, i === 0 && styles.onboardingDotActive]} />
                ))}
              </View>
              <View style={styles.onboardingBannerCTA}>
                <Text style={styles.onboardingBannerCTAText}>เริ่มเลย</Text>
                <Ionicons name="arrow-forward" size={13} color="#FFF" />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      )}

      {/* Nearby Job Alert Banner — always visible until user sets up */}
      {user && !user.nearbyJobAlert?.enabled && (
        <TouchableOpacity
          style={styles.nearbyBanner}
          onPress={() => (navigation as any).navigate('NearbyJobAlert')}
          activeOpacity={0.85}
        >
          <View style={styles.nearbyBannerLeft}>
            <View style={styles.nearbyBannerIcon}>
              <Ionicons name="location" size={20} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nearbyBannerTitle}>งานใกล้ฉัน</Text>
              <Text style={styles.nearbyBannerSub}>
                เปิดรับแจ้งเตือนเมื่อมีงานในรัศมีของคุณ
              </Text>
            </View>
          </View>
          <View style={styles.nearbyBannerCTA}>
            <Text style={styles.nearbyBannerCTAText}>ตั้งค่า</Text>
            <Ionicons name="chevron-forward" size={14} color="#0EA5E9" />
          </View>
        </TouchableOpacity>
      )}
      {/* Urgent Jobs Banner - Premium Placement */}
      {urgentJobs.length > 0 && (
        <View style={{ paddingHorizontal: SPACING.md }}>
          <UrgentJobsBanner 
            urgentJobs={urgentJobs} 
            onPress={handleJobPress} 
          />
        </View>
      )}

      {/* Quick Filters */}
      <ScrollView 
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.quickFilters}
      >
        <Chip
          label="ทั้งหมด"
          selected={!filters.urgentOnly && !filters.staffType && !filters.locationType && filters.sortBy === 'latest'}
          onPress={() => setFilters({ ...filters, urgentOnly: false, staffType: undefined, locationType: undefined, sortBy: 'latest' })}
        />
        <Chip
          label="🔥 ด่วน"
          selected={filters.urgentOnly}
          onPress={() => setFilters({ ...filters, urgentOnly: !filters.urgentOnly })}
        />
        <Chip
          label="✓ ยืนยันตัวตน"
          selected={filters.verifiedOnly}
          onPress={() => setFilters({ ...filters, verifiedOnly: !filters.verifiedOnly })}
        />
        <Chip
          label="📍 ใกล้ฉัน"
          selected={nearbyMode}
          onPress={async () => {
            if (!nearbyMode) {
              await getLocation();
              setNearbyMode(true);
            } else {
              setNearbyMode(false);
            }
          }}
        />
        <Chip
          label="🏠 ดูแลที่บ้าน"
          selected={filters.locationType === 'HOME'}
          onPress={() => setFilters({ ...filters, locationType: filters.locationType === 'HOME' ? undefined : 'HOME' })}
        />
        <Chip
          label="🏥 รพ."
          selected={filters.locationType === 'HOSPITAL'}
          onPress={() => setFilters({ ...filters, locationType: filters.locationType === 'HOSPITAL' ? undefined : 'HOSPITAL' })}
        />
        <Chip
          label="💰 NET"
          selected={filters.paymentType === 'NET'}
          onPress={() => setFilters({ ...filters, paymentType: filters.paymentType === 'NET' ? undefined : 'NET' })}
        />
        <Chip
          label="🌙 เวรดึก"
          selected={filters.sortBy === 'night'}
          onPress={() => setFilters({ ...filters, sortBy: filters.sortBy === 'night' ? 'latest' : 'night' })}
        />
        <Chip
          label="💵 ค่าสูง"
          selected={filters.sortBy === 'highestPay'}
          onPress={() => setFilters({ ...filters, sortBy: filters.sortBy === 'highestPay' ? 'latest' : 'highestPay' })}
        />
      </ScrollView>

      {/* Results count */}
      <View style={styles.resultsRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons
            name={(CATEGORY_TABS.find(t => t.key === (filters.postType ?? 'all'))?.icon || 'apps-outline') as any}
            size={14}
            color="#475569"
            style={{ marginRight: 4 }}
          />
          <Text style={styles.resultsText}>
            พบ <Text style={styles.resultsCount}>{jobs.length}</Text>{' '}
            {CATEGORY_TABS.find(t => t.key === (filters.postType ?? 'all'))?.label ?? 'งาน'}
          </Text>
        </View>
        {activeFilterCount > 0 && (
          <TouchableOpacity onPress={clearFilters}>
            <Text style={styles.clearFilters}>ล้างตัวกรอง</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
  }; // end renderHeader

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#0EA5E9' }]} edges={['top']}>
      <StatusBar backgroundColor="#0EA5E9" barStyle="light-content" translucent={false} />
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#0EA5E9' }]}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>
              {user ? `สวัสดี, ${user.displayName?.split(' ')[0] || 'คุณ'}` : 'บอร์ดหาคนแทน'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {user ? 'หางานหรือหาคนแทน' : 'เข้าสู่ระบบเพื่อประกาศ'}
            </Text>
          </View>
          <View style={styles.headerActions}>
            {/* Notification Icon */}
            <TouchableOpacity 
              style={styles.notificationButton}
              onPress={() => (navigation as any).navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color="#FFFFFF" />
              {notificationCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            
            {/* Profile */}
            <TouchableOpacity 
              style={styles.profileButton}
              onPress={() => (navigation as any).navigate('Profile')}
            >
              <Avatar 
                uri={user?.photoURL} 
                name={user?.displayName || 'Guest'} 
                size={44} 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={20} color={'#94A3B8'} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: '#0F172A' }]}
              placeholder="ค้นหาเวร, แผนก, สถานที่..."
              placeholderTextColor={'#94A3B8'}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <Ionicons name="close-circle" size={20} color={'#94A3B8'} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive]}
            onPress={() => setShowFilters(true)}
          >
            <Ionicons name="options-outline" size={22} color={activeFilterCount > 0 ? '#FFFFFF' : '#0EA5E9'} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Category Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ backgroundColor: '#0EA5E9' }}
          contentContainerStyle={styles.categoryTabs}
        >
          {CATEGORY_TABS.map((tab) => {
            const isActive = (filters.postType ?? 'all') === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[
                  styles.categoryTab,
                  isActive && { backgroundColor: '#FFFFFF' },
                ]}
                onPress={() =>
                  setFilters((prev) => ({
                    ...prev,
                    postType: tab.key === 'all' ? undefined : (tab.key as 'shift' | 'job' | 'homecare'),
                  }))
                }
                activeOpacity={0.7}
              >
                <Ionicons
                  name={tab.icon}
                  size={16}
                  color={isActive ? tab.color : 'rgba(255,255,255,0.9)'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.categoryTabLabel,
                    isActive && { color: tab.color, fontWeight: '700' as const },
                  ]}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Job List */}
      <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
      {isLoading ? (
        <Loading text="กำลังโหลดงาน..." />
      ) : (
        <FlatList
          data={jobsWithDistance}
          renderItem={renderJobItem}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <EmptyState
              icon="😢"
              title="ไม่พบเวรที่ตรงกับเงื่อนไข"
              description="ลองเปลี่ยนตัวกรองหรือคำค้นหาดูนะ"
              actionText="ล้างตัวกรอง"
              onAction={clearFilters}
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchJobs(true)}
              colors={['#0EA5E9']}
              tintColor={'#0EA5E9'}
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={() => fetchJobs(false, true)}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color="#0EA5E9" />
                <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 6 }}>โหลดเพิ่มเติม...</Text>
              </View>
            ) : jobs.length > 0 && !hasMoreRef.current ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Text style={{ color: '#CBD5E1', fontSize: 12 }}>— แสดงทั้งหมด {jobs.length} รายการ —</Text>
              </View>
            ) : null
          }
        />
      )}

      </View>

      {/* Filter Modal */}
      <FilterModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        filters={filters}
        setFilters={setFilters}
        onApply={applyFilters}
        onClear={clearFilters}
        nearbyMode={nearbyMode}
        setNearbyMode={setNearbyMode}
      />

      {/* ── Nearby Job Alert Promo Popup ─────────────────────── */}
      <ModalContainer
        visible={showNearbyPromo}
        onClose={() => dismissNearbyPromo(false)}
        title=""
      >
        <View style={styles.promoWrap}>
          {/* Icon */}
          <View style={styles.promoIconCircle}>
            <Ionicons name="location" size={44} color="#0EA5E9" />
          </View>

          <Text style={styles.promoTitle}>รู้ก่อนใคร! งานใกล้คุณ</Text>
          <Text style={styles.promoDesc}>
            เมื่อมีคนโพสต์งานในรัศมีที่คุณกำหนด{`\n`}
            แอปจะส่ง Push Notification ให้คุณทันที
          </Text>

          {/* Feature list */}
          {[
            { icon: 'notifications', text: 'แจ้งเตือนแบบ Real-time ทันทีที่มีงานใหม่' },
            { icon: 'resize', text: 'กำหนดรัศมีเองได้ 1–50 กม.' },
            { icon: 'location-outline', text: 'ตั้งตำแหน่งจาก GPS ของมือถือ' },
          ].map((f) => (
            <View key={f.icon} style={styles.promoFeatureRow}>
              <View style={styles.promoFeatureDot}>
                <Ionicons name={f.icon as any} size={15} color="#0EA5E9" />
              </View>
              <Text style={styles.promoFeatureText}>{f.text}</Text>
            </View>
          ))}

          {/* CTA */}
          <TouchableOpacity
            style={styles.promoCTA}
            onPress={() => dismissNearbyPromo(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="location" size={18} color="#FFF" />
            <Text style={styles.promoCTAText}>เปิดการแจ้งเตือนงานใกล้ฉัน</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.promoDismiss}
            onPress={() => dismissNearbyPromo(false)}
          >
            <Text style={styles.promoDismissText}>ไว้ทีหลัง</Text>
          </TouchableOpacity>
        </View>
      </ModalContainer>

      {/* Expiring Posts Popup */}
      <ModalContainer
        visible={showExpiryPopup}
        onClose={() => setShowExpiryPopup(false)}
        title="⏰ ประกาศใกล้หมดอายุ"
      >
        <View style={{ padding: SPACING.md }}>
          <Text style={{ fontSize: FONT_SIZES.md, color: '#64748B', marginBottom: SPACING.md, textAlign: 'center' }}>
            คุณมี {expiringPosts.length} ประกาศที่ใกล้หมดอายุ
          </Text>
          
          {expiringPosts.slice(0, 3).map((post) => {
            const now = new Date();
            const expiryDate = (post.expiresAt as any)?.toDate?.() || post.expiresAt;
            const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            
            return (
              <View key={post.id} style={{ 
                backgroundColor: daysLeft <= 1 ? '#FFEBEE' : '#FFF3E0', 
                padding: SPACING.md, 
                borderRadius: BORDER_RADIUS.md,
                marginBottom: SPACING.sm,
                borderLeftWidth: 4,
                borderLeftColor: colors.error,
              }}>
                <Text style={{ fontWeight: '600', color: '#0F172A' }} numberOfLines={1}>
                  {post.title}
                </Text>
                <Text style={{ fontSize: FONT_SIZES.sm, color: colors.error, marginTop: 4 }}>
                  ⚠️ จะหมดอายุภายใน 24 ชั่วโมง!
                </Text>
              </View>
            );
          })}
          
          <View style={{ 
            backgroundColor: '#E3F2FD', 
            padding: SPACING.md, 
            borderRadius: BORDER_RADIUS.md,
            marginTop: SPACING.sm,
          }}>
            <Text style={{ fontSize: FONT_SIZES.sm, color: '#0EA5E9', textAlign: 'center' }}>
              💡 ต่ออายุประกาศได้ในราคา 19 บาท/วัน
            </Text>
          </View>
          
          <View style={{ flexDirection: 'row', gap: SPACING.md, marginTop: SPACING.md }}>
            <Button
                variant="outline"
                onPress={() => setShowExpiryPopup(false)}
                style={{ flex: 1 }}
              >ปิด</Button>
              <Button
                onPress={() => {
                  setShowExpiryPopup(false);
                  (navigation as any).navigate('MyPosts');
                }}
                style={{ flex: 1 }}
              >จัดการประกาศ</Button>
          </View>
        </View>
      </ModalContainer>

      {/* FAB - Quick Actions */}
      <FAB
        mainIcon="add"
        size={64}
        actions={[
          {
            icon: 'create-outline',
            label: 'โพสต์งาน',
            onPress: () => navigation.navigate('PostJob' as any),
            color: '#0EA5E9',
          },
          {
            icon: 'navigate-outline',
            label: 'งานใกล้ฉัน',
            onPress: () => (navigation as any).navigate('NearbyJobAlert'),
            color: '#14B8A6',
          },
          {
            icon: 'map-outline',
            label: 'ดูแผนที่',
            onPress: () => (navigation as any).getParent()?.navigate('MapJobs'),
            color: '#6366F1',
          },
          {
            icon: 'heart-outline',
            label: 'รายการโปรด',
            onPress: () => (navigation as any).getParent()?.navigate('Favorites'),
            color: '#EC4899',
          },
        ]}
      />
    </SafeAreaView>
  );
}

// ============================================
// FILTER MODAL COMPONENT
// ============================================
interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  filters: JobFilters;
  setFilters: React.Dispatch<React.SetStateAction<JobFilters>>;
  onApply: () => void;
  onClear: () => void;
  nearbyMode: boolean;
  setNearbyMode: (val: boolean) => void;
}

function FilterModal({ visible, onClose, filters, setFilters, onApply, onClear, nearbyMode, setNearbyMode }: FilterModalProps) {
  const insets = useSafeAreaInsets();
  const [provinceSearch, setProvinceSearch] = useState('');
  const [showAllProvinces, setShowAllProvinces] = useState(false);
  const [nearbyPreset, setNearbyPreset] = useState(!!nearbyMode);
  const [minRateText, setMinRateText] = useState(filters.minRate?.toString() ?? '');
  const [maxRateText, setMaxRateText] = useState(filters.maxRate?.toString() ?? '');

  const filteredProvinces = provinceSearch
    ? ALL_PROVINCES.filter(p => p.toLowerCase().includes(provinceSearch.toLowerCase()))
    : (showAllProvinces ? ALL_PROVINCES : POPULAR_PROVINCES);

  const SectionHeader = ({ icon, label, iconColor = '#0EA5E9' }: { icon: string; label: string; iconColor?: string }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
      <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: iconColor + '18', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon as any} size={15} color={iconColor} />
      </View>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>{label}</Text>
    </View>
  );

  return (
    <ModalContainer
      visible={visible}
      onClose={onClose}
      title="ตัวกรองการค้นหา"
      fullScreen={true}
    >
      <ScrollView
        style={[styles.filterContent, { backgroundColor: '#F8FAFC' }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Near Me */}
        <View style={{ marginBottom: 14 }}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setNearbyPreset(!nearbyPreset)}
            style={{
              backgroundColor: nearbyPreset ? '#E0F2FE' : '#fff',
              borderRadius: 16,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: nearbyPreset ? 2 : 1,
              borderColor: nearbyPreset ? '#0EA5E9' : '#E2E8F0',
              shadowColor: '#0EA5E9',
              shadowOpacity: nearbyPreset ? 0.12 : 0,
              shadowRadius: 8,
              elevation: nearbyPreset ? 3 : 0,
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: nearbyPreset ? '#0EA5E9' : '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
              <Ionicons name="location" size={22} color={nearbyPreset ? '#fff' : '#64748B'} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: nearbyPreset ? '#0EA5E9' : '#0F172A' }}>ใกล้ฉัน</Text>
              <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>งานใกล้ตำแหน่งของคุณมากที่สุด</Text>
            </View>
            <View style={{
              width: 28, height: 16, borderRadius: 8,
              backgroundColor: nearbyPreset ? '#0EA5E9' : '#CBD5E1',
              justifyContent: 'center',
              paddingHorizontal: 2,
            }}>
              <View style={{
                width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff',
                alignSelf: nearbyPreset ? 'flex-end' : 'flex-start',
              }} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Staff Type */}
        <View style={[styles.filterCard, { marginBottom: 14 }]}>
          <SectionHeader icon="person-outline" label="ประเภทบุคลากร" iconColor="#0EA5E9" />
          <View style={styles.filterOptions}>
            <Chip label="ทั้งหมด" selected={!filters.staffType}
              onPress={() => setFilters({ ...filters, staffType: undefined })} style={styles.optionChip} />
            {STAFF_TYPES.map((type) => (
              <Chip key={type.code} label={type.shortName}
                selected={filters.staffType === type.code}
                onPress={() => setFilters({ ...filters, staffType: type.code })}
                style={styles.optionChip} />
            ))}
          </View>
        </View>

        {/* Location Type */}
        <View style={[styles.filterCard, { marginBottom: 14 }]}>
          <SectionHeader icon="business-outline" label="ประเภทสถานที่" iconColor="#8B5CF6" />
          <View style={styles.filterOptions}>
            <Chip label="ทั้งหมด" selected={!filters.locationType}
              onPress={() => setFilters({ ...filters, locationType: undefined, homeCareOnly: false })}
              style={styles.optionChip} />
            {LOCATION_TYPES.map((loc) => (
              <Chip key={loc.code}
                label={`${loc.icon} ${loc.nameTH}`}
                selected={filters.locationType === loc.code}
                onPress={() => setFilters({ ...filters, locationType: loc.code, homeCareOnly: loc.code === 'HOME' })}
                style={styles.optionChip} />
            ))}
          </View>
        </View>

        {/* Province */}
        <View style={[styles.filterCard, { marginBottom: 14 }]}>
          <SectionHeader icon="map-outline" label="จังหวัด" iconColor="#10B981" />
          <TextInput
            style={styles.provinceSearchInput}
            placeholder="ค้นหาจังหวัด..."
            placeholderTextColor="#94A3B8"
            value={provinceSearch}
            onChangeText={setProvinceSearch}
          />
          <View style={styles.filterOptions}>
            <Chip label="ทั้งหมด" selected={!filters.province}
              onPress={() => setFilters({ ...filters, province: '', district: '' })} style={styles.optionChip} />
            {filteredProvinces.map((province) => (
              <Chip key={province} label={province}
                selected={filters.province === province}
                onPress={() => setFilters({ ...filters, province, district: '' })}
                style={styles.optionChip} />
            ))}
          </View>
          {!provinceSearch && (
            <TouchableOpacity style={styles.showMoreButton} onPress={() => setShowAllProvinces(!showAllProvinces)}>
              <Text style={styles.showMoreText}>{showAllProvinces ? 'แสดงน้อยลง' : 'ดูทั้งหมด 77 จังหวัด'}</Text>
              <Ionicons name={showAllProvinces ? 'chevron-up' : 'chevron-down'} size={16} color="#0EA5E9" />
            </TouchableOpacity>
          )}
        </View>

        {/* District (conditional) */}
        {filters.province && getDistrictsForProvince(filters.province).length > 0 && (
          <View style={[styles.filterCard, { marginBottom: 14 }]}>
            <SectionHeader icon="location-outline" label={filters.province === 'กรุงเทพมหานคร' ? 'เขต' : 'อำเภอ'} iconColor="#10B981" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} nestedScrollEnabled>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <Chip label={filters.province === 'กรุงเทพมหานคร' ? 'ทุกเขต' : 'ทุกอำเภอ'}
                  selected={!filters.district}
                  onPress={() => setFilters({ ...filters, district: '' })} style={styles.optionChip} />
                {getDistrictsForProvince(filters.province).map((district) => (
                  <Chip key={district} label={district}
                    selected={filters.district === district}
                    onPress={() => setFilters({ ...filters, district })}
                    style={styles.optionChip} />
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Salary Range */}
        <View style={[styles.filterCard, { marginBottom: 14 }]}>
          <SectionHeader icon="cash-outline" label="ค่าตอบแทน (บาท)" iconColor="#F59E0B" />
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>ขั้นต่ำ</Text>
              <TextInput
                style={[styles.provinceSearchInput, { marginBottom: 0 }]}
                placeholder="เช่น 500"
                placeholderTextColor="#CBD5E1"
                keyboardType="numeric"
                value={minRateText}
                onChangeText={(t) => {
                  setMinRateText(t);
                  setFilters({ ...filters, minRate: t ? parseInt(t) || undefined : undefined });
                }}
              />
            </View>
            <Text style={{ color: '#94A3B8', marginTop: 16 }}>—</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>สูงสุด</Text>
              <TextInput
                style={[styles.provinceSearchInput, { marginBottom: 0 }]}
                placeholder="เช่น 3000"
                placeholderTextColor="#CBD5E1"
                keyboardType="numeric"
                value={maxRateText}
                onChangeText={(t) => {
                  setMaxRateText(t);
                  setFilters({ ...filters, maxRate: t ? parseInt(t) || undefined : undefined });
                }}
              />
            </View>
          </View>
          {/* Quick rate chips */}
          <View style={[styles.filterOptions, { marginTop: 10 }]}>
            {[300, 500, 700, 1000, 1500, 2000].map((rate) => (
              <TouchableOpacity
                key={rate}
                onPress={() => {
                  setMinRateText(rate.toString());
                  setFilters({ ...filters, minRate: rate, maxRate: undefined });
                  setMaxRateText('');
                }}
                style={{
                  paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
                  backgroundColor: filters.minRate === rate && !filters.maxRate ? '#F59E0B' : '#FEF3C7',
                  borderWidth: 1, borderColor: '#FDE68A',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '600', color: filters.minRate === rate && !filters.maxRate ? '#fff' : '#92400E' }}>
                  {rate.toLocaleString()}+
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Special + Sort */}
        <View style={[styles.filterCard, { marginBottom: 14 }]}>
          <SectionHeader icon="options-outline" label="ตัวเลือกพิเศษ" iconColor="#EF4444" />
          <View style={styles.filterOptions}>
            <Chip label="🔥 ด่วนเท่านั้น" selected={filters.urgentOnly || false}
              onPress={() => setFilters({ ...filters, urgentOnly: !filters.urgentOnly })} style={styles.optionChip} />
            <Chip label="✓ ยืนยันตัวตน" selected={filters.verifiedOnly || false}
              onPress={() => setFilters({ ...filters, verifiedOnly: !filters.verifiedOnly })} style={styles.optionChip} />
          </View>
        </View>

        <View style={[styles.filterCard, { marginBottom: 24 }]}>
          <SectionHeader icon="swap-vertical-outline" label="เรียงตาม" iconColor="#64748B" />
          <View style={styles.filterOptions}>
            <Chip label="ล่าสุด" selected={filters.sortBy === 'latest' || !filters.sortBy}
              onPress={() => setFilters({ ...filters, sortBy: 'latest' })} style={styles.optionChip} />
            <Chip label="ค่าตอบแทนสูงสุด" selected={filters.sortBy === 'highestPay'}
              onPress={() => setFilters({ ...filters, sortBy: 'highestPay' })} style={styles.optionChip} />
            <Chip label="เช้า" selected={filters.sortBy === 'morning'}
              onPress={() => setFilters({ ...filters, sortBy: 'morning' })} style={styles.optionChip} />
            <Chip label="กลางคืน" selected={filters.sortBy === 'night'}
              onPress={() => setFilters({ ...filters, sortBy: 'night' })} style={styles.optionChip} />
          </View>
        </View>
      </ScrollView>

      {/* Actions */}
      <View style={[styles.filterActions, {
        paddingBottom: Math.max(insets.bottom, 16) + SPACING.md,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -4 },
        elevation: 8,
      }]}>
        <Button onPress={() => { onClear(); setMinRateText(''); setMaxRateText(''); }}
          variant="outline"
          style={{ flex: 1, marginRight: SPACING.sm, borderRadius: 14, height: 50 }}>
          ล้างตัวกรอง
        </Button>
        <Button
          onPress={() => { setNearbyMode(nearbyPreset); onApply(); }}
          style={{ flex: 2, borderRadius: 14, height: 50 }}>
          ค้นหา
        </Button>
      </View>
    </ModalContainer>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header
  header: {
    backgroundColor: '#0EA5E9',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    ...SHADOWS.medium,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
    paddingTop: SPACING.sm,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0EA5E9',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 4,
  },
  greeting: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  profileButton: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 22,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    height: 48,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: '#0F172A',
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#0EA5E9',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },

  // List
  listContent: {
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  listHeader: {
    marginBottom: SPACING.sm,
  },

  // Quick Filters
  quickFilters: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.sm,
  },

  // Results
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.xs,
  },
  resultsText: {
    fontSize: FONT_SIZES.sm,
    color: '#64748B',
  },
  resultsCount: {
    fontWeight: '700',
    color: '#0EA5E9',
  },
  clearFilters: {
    fontSize: FONT_SIZES.sm,
    color: '#0EA5E9',
    fontWeight: '500',
  },

  // Filter Modal
  filterContent: {
    flex: 1,
    padding: SPACING.md,
  },
  filterSection: {
    marginBottom: SPACING.lg,
  },
  filterLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: SPACING.sm,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  filterCard: {
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: SPACING.md,
    ...SHADOWS.small,
  },
  optionChip: {
    marginRight: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  provinceSearchInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
    fontSize: FONT_SIZES.md,
    color: '#0F172A',
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  showMoreText: {
    fontSize: FONT_SIZES.sm,
    color: '#0EA5E9',
    marginRight: 4,
  },
  filterActions: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },

  // ── Onboarding Banner ─────────────────────────────────────────────
  onboardingBanner: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#FAFAFF',
    borderRadius: 16,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#EDE9FE',
  },
  onboardingBannerStripe: {
    width: 5,
    backgroundColor: '#7C3AED',
  },
  onboardingBannerContent: {
    flex: 1,
    padding: SPACING.md,
    paddingLeft: 12,
    gap: 10,
  },
  onboardingBannerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  onboardingBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  onboardingBannerTag: {
    fontSize: 10,
    fontWeight: '600',
    color: '#7C3AED',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  onboardingBannerTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  onboardingBannerSub: {
    fontSize: 11,
    color: '#6D28D9',
    marginTop: 2,
    lineHeight: 15,
  },
  onboardingBannerFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  onboardingDots: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
  },
  onboardingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#DDD6FE',
  },
  onboardingDotActive: {
    width: 16,
    backgroundColor: '#7C3AED',
  },
  onboardingBannerCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7C3AED',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 4,
  },
  onboardingBannerCTAText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700',
  },

  // ── Nearby Job Alert Banner ───────────────────────────────────────
  nearbyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderRadius: BORDER_RADIUS.lg,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
  },
  nearbyBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flex: 1,
  },
  nearbyBannerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0EA5E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearbyBannerTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: '#0C4A6E',
  },
  nearbyBannerSub: {
    fontSize: 11,
    color: '#0369A1',
    marginTop: 2,
  },
  nearbyBannerCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: '#0EA5E9',
    gap: 2,
  },
  nearbyBannerCTAText: {
    fontSize: 12,
    color: '#0EA5E9',
    fontWeight: '700',
  },

  // ── Nearby Promo Modal ─────────────────────────────────────────────
  promoWrap: {
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  promoIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  promoTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  promoDesc: {
    fontSize: FONT_SIZES.sm,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  promoFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    alignSelf: 'stretch',
    marginBottom: SPACING.sm,
  },
  promoFeatureDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0F2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  promoFeatureText: {
    fontSize: FONT_SIZES.sm,
    color: '#334155',
    flex: 1,
  },
  promoCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    backgroundColor: '#0EA5E9',
    alignSelf: 'stretch',
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.lg,
    marginTop: SPACING.lg,
  },
  promoCTAText: {
    color: '#FFF',
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
  promoDismiss: {
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  promoDismissText: {
    fontSize: FONT_SIZES.sm,
    color: '#94A3B8',
    textDecorationLine: 'underline',
  },

  // ── Category Tabs ─────────────────────────────────────────────────
  categoryTabs: {
    flexDirection: 'row' as const,
    paddingLeft: 4,
    paddingRight: 12,
    paddingTop: 4,
    paddingBottom: 10,
    backgroundColor: '#0EA5E9',
    gap: 8,
  },
  categoryTab: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  categoryTabActive: {
    backgroundColor: '#FFFFFF',
  },
  categoryTabLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500' as const,
  },
  categoryTabLabelActive: {
    color: '#0284C7',
    fontWeight: '700' as const,
  },
});

