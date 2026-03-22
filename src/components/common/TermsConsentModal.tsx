// ============================================
// TERMS CONSENT MODAL - Must scroll to accept
// ============================================

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import {
  LEGAL_EFFECTIVE_DATE,
  LEGAL_LAST_UPDATED,
  TERMS_CONSENT_PRIVACY_SUMMARY,
  TERMS_CONSENT_TERMS_SUMMARY,
} from '../../legal/legalContent';

interface TermsConsentModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export default function TermsConsentModal({
  visible,
  onAccept,
  onDecline,
}: TermsConsentModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [currentTab, setCurrentTab] = useState<'terms' | 'privacy'>('terms');

  useEffect(() => {
    if (visible && typeof document !== 'undefined') {
      try {
        const active = document.activeElement as HTMLElement | null;
        if (active && active !== document.body) active.blur();
      } catch (e) {}
    }
  }, [visible]);

  useEffect(() => {
    if (visible) {
      setCurrentTab('terms');
      setHasScrolledToEnd(false);
    }
  }, [visible]);

  // Check if scrolled to bottom
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isAtBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 50;
    if (isAtBottom) {
      setHasScrolledToEnd(true);
    }
  };

  const termsContent = TERMS_CONSENT_TERMS_SUMMARY;
  const privacyContent = TERMS_CONSENT_PRIVACY_SUMMARY;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDecline}
    >
      <View style={styles.overlay} accessibilityViewIsModal={true}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerIcon}>📋</Text>
            <Text style={styles.headerTitle}>ข้อตกลงการใช้งาน</Text>
            <Text style={styles.headerSubtitle}>
              กรุณาอ่านสรุปสาระสำคัญก่อนดำเนินการต่อ
            </Text>
            <Text style={styles.headerMeta}>
              มีผลใช้บังคับ {LEGAL_EFFECTIVE_DATE} · อัปเดตล่าสุด {LEGAL_LAST_UPDATED}
            </Text>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, currentTab === 'terms' && styles.tabActive]}
              onPress={() => {
                setCurrentTab('terms');
                setHasScrolledToEnd(false);
              }}
            >
              <Text style={[styles.tabText, currentTab === 'terms' && styles.tabTextActive]}>
                ข้อตกลงและเงื่อนไข
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, currentTab === 'privacy' && styles.tabActive]}
              onPress={() => {
                setCurrentTab('privacy');
                setHasScrolledToEnd(false);
              }}
            >
              <Text style={[styles.tabText, currentTab === 'privacy' && styles.tabTextActive]}>
                นโยบายความเป็นส่วนตัว
              </Text>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.scrollView}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={true}
          >
            <Text style={styles.content}>
              {currentTab === 'terms' ? termsContent : privacyContent}
            </Text>
            <View style={styles.endMarker}>
              <Text style={styles.endMarkerText}>
                {hasScrolledToEnd ? '✅ อ่านจบแล้ว' : '👇 เลื่อนลงเพื่ออ่านต่อ'}
              </Text>
            </View>
          </ScrollView>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={onDecline}
            >
              <Text style={styles.declineButtonText}>ไม่ยอมรับ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.acceptButton,
                !hasScrolledToEnd && styles.acceptButtonDisabled,
              ]}
              onPress={onAccept}
              disabled={!hasScrolledToEnd}
            >
              <Text style={[
                styles.acceptButtonText,
                !hasScrolledToEnd && styles.acceptButtonTextDisabled,
              ]}>
                {hasScrolledToEnd ? '✅ ยอมรับ' : '⏳ กรุณาอ่านให้จบ'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (COLORS: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  container: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.xl,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    ...SHADOWS.large,
  },
  header: {
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerIcon: {
    fontSize: 40,
    marginBottom: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  headerMeta: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  scrollView: {
    maxHeight: 350,
    paddingHorizontal: SPACING.lg,
  },
  content: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 22,
    paddingVertical: SPACING.md,
  },
  endMarker: {
    alignItems: 'center',
    paddingVertical: SPACING.lg,
    marginBottom: SPACING.md,
  },
  endMarkerText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: SPACING.lg,
    gap: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  declineButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.border,
    alignItems: 'center',
  },
  declineButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  acceptButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  acceptButtonDisabled: {
    backgroundColor: COLORS.border,
  },
  acceptButtonText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  acceptButtonTextDisabled: {
    color: COLORS.textMuted,
  },
});
