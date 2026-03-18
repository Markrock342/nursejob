// ============================================
// PRIVACY POLICY SCREEN - Production Ready
// ============================================

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED, PRIVACY_SECTIONS } from '../../legal/legalContent';

export default function PrivacyScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();

  const handleContactDPO = () => {
    Linking.openURL(`mailto:${LEGAL_CONTACT_EMAIL}?subject=คำถามเกี่ยวกับข้อมูลส่วนบุคคล`);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>นโยบายความเป็นส่วนตัว</Text>
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
          <View style={styles.introIcon}>
            <Ionicons name="shield-checkmark" size={32} color={colors.primary} />
          </View>
          <Text style={styles.introTitle}>ความเป็นส่วนตัวของคุณสำคัญสำหรับเรา</Text>
          <Text style={styles.introText}>
            NurseGo มุ่งมั่นปกป้องข้อมูลส่วนบุคคลของคุณ นโยบายฉบับนี้อธิบายว่าเราเก็บ ใช้ เปิดเผย
            และดูแลข้อมูลอย่างไรตามกรอบกฎหมายที่ใช้บังคับและตามข้อเท็จจริงของบริการในปัจจุบัน
          </Text>
        </View>

        {/* Quick Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>สรุปสั้นๆ</Text>
          <View style={styles.summaryItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.summaryText}>เราเก็บข้อมูลเท่าที่จำเป็นต่อการให้บริการ</Text>
          </View>
          <View style={styles.summaryItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.summaryText}>ข้อมูลของคุณได้รับการเข้ารหัสและปกป้อง</Text>
          </View>
          <View style={styles.summaryItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.summaryText}>เราไม่ขายข้อมูลของคุณให้บุคคลภายนอก</Text>
          </View>
          <View style={styles.summaryItem}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={styles.summaryText}>คุณสามารถลบบัญชีและข้อมูลได้ตลอดเวลา</Text>
          </View>
        </View>

        {/* Sections */}
        {PRIVACY_SECTIONS.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.content.map((paragraph, pIndex) => (
              <Text key={pIndex} style={styles.paragraph}>
                {paragraph}
              </Text>
            ))}
            {section.bullets && (
              <View style={styles.bulletList}>
                {section.bullets.map((bullet, bIndex) => (
                  <View key={bIndex} style={styles.bulletItem}>
                    <View style={styles.bullet} />
                    <Text style={styles.bulletText}>{bullet}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}

        {/* Contact Card */}
        <TouchableOpacity style={styles.contactCard} onPress={handleContactDPO}>
          <View style={styles.contactIconContainer}>
            <Ionicons name="mail" size={24} color={colors.white} />
          </View>
          <View style={styles.contactInfo}>
            <Text style={styles.contactTitle}>มีคำถามเกี่ยวกับความเป็นส่วนตัว?</Text>
            <Text style={styles.contactSubtitle}>ติดต่อเราเพื่อสอบถามหรือใช้สิทธิ์เกี่ยวกับข้อมูลส่วนบุคคล</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2569 NurseGo. สงวนลิขสิทธิ์.
          </Text>
          <Text style={styles.footerSubtext}>
            หากในอนาคตมีเว็บไซต์หรือบริการใหม่เพิ่มเติม อาจมีประกาศข้อมูลส่วนบุคคลเฉพาะช่องทางนั้นเพิ่มเติม
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
    backgroundColor: COLORS.white,
    padding: SPACING.xl,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  introIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  introTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  introText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: COLORS.successLight,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xl,
  },
  summaryTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.success,
    marginBottom: SPACING.md,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  summaryText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
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
  bulletList: {
    marginTop: SPACING.sm,
  },
  bulletItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: SPACING.sm,
    paddingLeft: SPACING.sm,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
    marginTop: 6,
    marginRight: SPACING.sm,
  },
  bulletText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    borderRadius: BORDER_RADIUS.lg,
    marginVertical: SPACING.lg,
    ...SHADOWS.sm,
  },
  contactIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  contactInfo: {
    flex: 1,
  },
  contactTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  contactSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
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
  footerSubtext: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
});

