// ============================================
// FAVORITES SCREEN - รายการโปรด (Redesigned)
// ============================================

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useScreenPerformance } from '../../hooks/useScreenPerformance';
import { getUserFavorites, removeFromFavorites, Favorite } from '../../services/favoritesService';
import { useI18n } from '../../i18n';

// ──────────────────────────────────────────
// EmptyState
// ──────────────────────────────────────────
function EmptyState({ filtered }: { filtered: boolean }) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{filtered ? '🔍' : '🤍'}</Text>
      <Text style={styles.emptyTitle}>
        {filtered ? t('favorites.noResults') : t('favorites.noSavedJobs')}
      </Text>
      <Text style={styles.emptyDesc}>
        {filtered
          ? t('favorites.tryDifferentSearch')
          : t('favorites.tapToSave')}
      </Text>
    </View>
  );
}

// ──────────────────────────────────────────
// FavoriteCard
// ──────────────────────────────────────────
interface FavoriteCardProps {
  favorite: Favorite;
  onPress: () => void;
  onRemove: () => void;
  removing: boolean;
}

function FavoriteCard({ favorite, onPress, onRemove, removing }: FavoriteCardProps) {
  const { t, resolvedLanguage } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const job = favorite.job;
  if (!job) return null;

  const wageMap: Record<string, string> = {
    hour: t('favorites.perHour'),
    day: t('favorites.perDay'),
    per_day: t('favorites.perDay'),
    month: t('favorites.perMonth'),
    per_month: t('favorites.perMonth'),
    shift: t('favorites.perShift'),
    per_shift: t('favorites.perShift'),
    negotiable: '',
  };
  const wage = job.shiftRate
    ? '฿' + job.shiftRate.toLocaleString(resolvedLanguage === 'th' ? 'th-TH' : 'en-US') + (wageMap[job.rateType] || t('favorites.perShift'))
    : t('favorites.negotiable');

  const savedDate = favorite.createdAt
    ? new Date(favorite.createdAt).toLocaleDateString(resolvedLanguage === 'th' ? 'th-TH' : 'en-US', {
        day: 'numeric',
        month: 'short',
      })
    : '';

  const toDate = (v: Date | import('@firebase/firestore').Timestamp | null | undefined): Date | null =>
    !v ? null : v instanceof Date ? v : typeof (v as any).toDate === 'function' ? (v as any).toDate() : null;
  const isExpired = job.expiresAt ? (toDate(job.expiresAt) ?? new Date()) < new Date() : false;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isExpired && styles.cardExpired,
        removing && { opacity: 0.4 },
      ]}
      onPress={onPress}
      activeOpacity={0.85}>
      {isExpired && (
        <View style={styles.expiredBanner}>
          <Text style={styles.expiredText}>{t('favorites.postExpired')}</Text>
        </View>
      )}
      <View style={styles.cardContent}>
        <View style={styles.cardLeft}>
          <View style={styles.titleRow}>
            {!!job.isUrgent && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentText}>{t('favorites.urgent')}</Text>
              </View>
            )}
            <Text style={styles.jobTitle} numberOfLines={2}>
              {job.title}
            </Text>
          </View>
          <View style={styles.metaRow}>
            <Ionicons name="business-outline" size={13} color={COLORS.textMuted} />
            <Text style={styles.metaText} numberOfLines={1}>
              {job.hospital || job.location?.hospital || t('favorites.noFacility')}
            </Text>
          </View>
          {!!job.location?.address && (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={13} color={COLORS.textMuted} />
              <Text style={styles.metaText} numberOfLines={1}>
                {job.location.address}
              </Text>
            </View>
          )}
          <View style={styles.bottomRow}>
            <View style={styles.wageBadge}>
              <Text style={styles.wageText}>{wage}</Text>
            </View>
            {!!job.shiftTime && (
              <View style={styles.shiftBadge}>
                <Text style={styles.shiftText}>{job.shiftTime}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.cardRight}>
          <TouchableOpacity
            style={styles.removeBtn}
            onPress={onRemove}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            {removing ? (
              <ActivityIndicator size="small" color="#EF4444" />
            ) : (
              <Ionicons name="heart" size={24} color="#EF4444" />
            )}
          </TouchableOpacity>
          <Text style={styles.savedDate}>{savedDate}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ──────────────────────────────────────────
// FavoritesScreen
// ──────────────────────────────────────────
export default function FavoritesScreen() {
  const { t, resolvedLanguage } = useI18n();
  useScreenPerformance('Favorites');
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const headerBackground = colors.surface;
  const statusBarStyle = isDark ? 'light-content' : 'dark-content';

  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadFavorites = useCallback(
    async (silent = false) => {
      if (!user?.uid) {
        setIsLoading(false);
        return;
      }
      if (!silent) setIsLoading(true);
      try {
        const data = await getUserFavorites(user.uid, {
          screenName: 'Favorites',
          source: 'favorites:screen_load',
        });
        setFavorites(data);
      } catch (e) {
        console.error('FavoritesScreen:', e);
        Alert.alert(t('common.alerts.loadErrorTitle'), t('common.alerts.loadErrorMessage'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [user?.uid],
  );

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites]),
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadFavorites(true);
  };

  const handleRemove = (fav: Favorite) => {
    Alert.alert(
      t('favorites.removeTitle'),
      t('favorites.removeMessage', { title: fav.job?.title || '' }),
      [
        { text: t('favorites.cancel'), style: 'cancel' },
        {
          text: t('favorites.remove'),
          style: 'destructive',
          onPress: async () => {
            if (!user?.uid) return;
            setRemovingId(fav.id);
            try {
              await removeFromFavorites(user.uid, fav.jobId);
              setFavorites(prev => prev.filter(f => f.id !== fav.id));
            } catch (e) {
              console.error(e);
            } finally {
              setRemovingId(null);
            }
          },
        },
      ],
    );
  };

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return favorites;
    const q = searchQuery.toLowerCase();
    return favorites.filter(
      f =>
        f.job?.title?.toLowerCase().includes(q) ||
        f.job?.hospital?.toLowerCase().includes(q) ||
        f.job?.location?.hospital?.toLowerCase().includes(q) ||
        f.job?.location?.address?.toLowerCase().includes(q),
    );
  }, [favorites, searchQuery]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: headerBackground }]}
      edges={['top']}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={headerBackground} translucent={false} />
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          { backgroundColor: headerBackground, borderBottomColor: colors.border },
        ]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('favorites.title')}</Text>
          {favorites.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{favorites.length}</Text>
            </View>
          )}
        </View>

        <View style={{ width: 40 }} />
      </View>

      {/* ── Search Bar ── */}
      <View
        style={[
          styles.searchWrap,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}>
        <View
          style={[
            styles.searchBox,
            { backgroundColor: colors.backgroundSecondary },
          ]}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('favorites.searchPlaceholder')}
            placeholderTextColor={COLORS.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* ── Content ── */}
      {isLoading ? (
        <View style={styles.loadingCenter}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>{t('favorites.loading')}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <FavoriteCard
              favorite={item}
              onPress={() =>
                item.job && navigation.navigate('JobDetail', { job: item.job, source: 'favorites' })
              }
              onRemove={() => handleRemove(item)}
              removing={removingId === item.id}
            />
          )}
          ListEmptyComponent={
            <EmptyState filtered={searchQuery.length > 0} />
          }
          ListHeaderComponent={
            searchQuery && filtered.length > 0 ? (
              <Text style={styles.resultCount}>{t('favorites.resultCount', { filtered: String(filtered.length), total: String(favorites.length) })}</Text>
            ) : null
          }
          contentContainerStyle={[
            styles.listContent,
            filtered.length === 0 && styles.listEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          onRefresh={handleRefresh}
          refreshing={isRefreshing}
          ItemSeparatorComponent={() => (
            <View style={{ height: SPACING.sm }} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ──────────────────────────────────────────
// Styles
// ──────────────────────────────────────────
const createStyles = (COLORS: any) => StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerTitle: { fontSize: FONT_SIZES.lg, fontWeight: '700' },
  countBadge: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: { fontSize: FONT_SIZES.xs, fontWeight: '700', color: '#fff' },

  // Search
  searchWrap: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  searchInput: { flex: 1, fontSize: FONT_SIZES.sm, paddingVertical: 0 },

  // Loading
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  loadingText: { fontSize: FONT_SIZES.sm, color: COLORS.textSecondary },

  // List
  listContent: { padding: SPACING.md },
  listEmpty: { flexGrow: 1 },
  resultCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },

  // Card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    ...SHADOWS.small,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardExpired: { opacity: 0.7, borderColor: COLORS.border },
  expiredBanner: {
    backgroundColor: COLORS.errorLight,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.errorLight,
  },
  expiredText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
    fontWeight: '600',
    textAlign: 'center',
  },
  cardContent: {
    flexDirection: 'row',
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  cardLeft: { flex: 1, gap: 6 },
  cardRight: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  removeBtn: { padding: 4 },
  savedDate: { fontSize: 10, color: COLORS.textMuted, textAlign: 'center' },
  titleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  urgentBadge: {
    backgroundColor: COLORS.warningLight,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  urgentText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.warning,
    fontWeight: '700',
  },
  jobTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.text,
    flex: 1,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  wageBadge: {
    backgroundColor: COLORS.successLight,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  wageText: { fontSize: FONT_SIZES.sm, fontWeight: '700', color: COLORS.success },
  shiftBadge: {
    backgroundColor: COLORS.infoLight,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  shiftText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.info,
    fontWeight: '600',
  },

  // Empty
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: SPACING.xl,
  },
  emptyIcon: { fontSize: 64, marginBottom: SPACING.md },
  emptyTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
