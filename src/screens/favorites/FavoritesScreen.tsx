// ============================================
// FAVORITES SCREEN - รายการโปรด
// ============================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getUserFavorites, removeFromFavorites, Favorite } from '../../services/favoritesService';
import { JobCard } from '../../components/job/JobCard';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { RootStackParamList } from '../../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function FavoritesScreen() {
  const { user, isInitialized } = useAuth();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();

  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadFavorites = useCallback(async () => {
    if (!user?.uid || !isInitialized) {
      setFavorites([]);
      setIsLoading(false);
      return;
    }
    try {
      const data = await getUserFavorites(user.uid);
      setFavorites(data);
    } catch (e) {
      console.error('Error loading favorites:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.uid, isInitialized]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadFavorites();
    }, [loadFavorites])
  );

  const handleRemove = async (fav: Favorite) => {
    if (!user?.uid) return;
    setRemovingId(fav.id);
    try {
      await removeFromFavorites(user.uid, fav.jobId);
      setFavorites(prev => prev.filter(f => f.id !== fav.id));
    } catch (e) {
      console.error('Error removing favorite:', e);
    } finally {
      setRemovingId(null);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadFavorites();
  };

  // ── Empty State ──────────────────────────────
  const EmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="heart-outline" size={72} color={colors.textMuted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        ยังไม่มีรายการโปรด
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        กดหัวใจบนประกาศงานที่สนใจ{'\n'}เพื่อบันทึกไว้ที่นี่
      </Text>
      <TouchableOpacity
        style={[styles.browseBtn, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate('Main' as any)}
      >
        <Text style={styles.browseBtnText}>ดูประกาศงาน</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>รายการโปรด</Text>
        {favorites.length > 0 ? (
          <View style={[styles.countBadge, { backgroundColor: colors.primary + '18' }]}>
            <Text style={[styles.countText, { color: colors.primary }]}>{favorites.length}</Text>
          </View>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.listContent,
            favorites.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={<EmptyState />}
          renderItem={({ item }) => {
            if (!item.job) return null;
            return (
              <View style={styles.cardWrapper}>
                <JobCard
                  job={item.job}
                  onPress={() => navigation.navigate('JobDetail', { jobId: item.jobId })}
                  onSave={() => handleRemove(item)}
                  isSaved={true}
                />
                {removingId === item.id && (
                  <View style={styles.removingOverlay}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
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
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
  },
  countBadge: {
    width: 40,
    height: 28,
    borderRadius: BORDER_RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  listContentEmpty: {
    flex: 1,
  },
  cardWrapper: {
    position: 'relative',
  },
  removingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BORDER_RADIUS.lg,
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    marginTop: SPACING.md,
  },
  emptySubtitle: {
    fontSize: FONT_SIZES.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  browseBtn: {
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm + 2,
    borderRadius: BORDER_RADIUS.full,
  },
  browseBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: FONT_SIZES.md,
  },
});
