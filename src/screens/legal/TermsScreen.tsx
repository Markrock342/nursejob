// ============================================
// TERMS OF SERVICE SCREEN - Production Ready
// ============================================

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { LEGAL_LAST_UPDATED, TERMS_SECTIONS } from '../../legal/legalContent';

export default function TermsScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ข้อกำหนดการใช้งาน</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Last Updated */}
        <View style={styles.lastUpdated}>
          <Ionicons name="time-outline" size={16} color={colors.textMuted} />
          <Text style={styles.lastUpdatedText}>อัปเดตล่าสุด: {LEGAL_LAST_UPDATED}</Text>
        </View>

        {/* Introduction */}
        <View style={styles.intro}>
          <Text style={styles.introText}>
            กรุณาอ่านข้อกำหนดการใช้งานฉบับนี้อย่างละเอียดก่อนสมัครสมาชิกหรือใช้บริการ
            เนื้อหาฉบับนี้ออกแบบให้สอดคล้องกับสถานะการให้บริการของ NurseGo ในปัจจุบันและจะมีการปรับปรุงเมื่อมีการเปลี่ยนแปลงสาระสำคัญ
          </Text>
        </View>

        {/* Sections */}
        {TERMS_SECTIONS.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.content.map((paragraph, pIndex) => (
              <Text key={pIndex} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
          </View>
        ))}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2569 NurseGo. สงวนลิขสิทธิ์.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  lastUpdated: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    gap: SPACING.xs,
  },
  lastUpdatedText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  intro: {
    backgroundColor: COLORS.primaryLight,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xl,
  },
  introText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    lineHeight: 22,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  paragraph: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 22,
    marginBottom: SPACING.sm,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    marginTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
});

