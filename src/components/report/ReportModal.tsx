// ============================================
// REPORT MODAL - Modal สำหรับรายงาน
// ============================================

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { ModalContainer, KittenButton as Button } from '../common';
import {
  createReport,
  ReportType,
  ReportReason,
  REPORT_REASONS,
  hasUserReported,
} from '../../services/reportService';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  targetType: ReportType;
  targetId: string;
  targetName?: string;
  targetDescription?: string;
  reporterId: string;
  reporterName: string;
  reporterEmail: string;
}

export default function ReportModal({
  visible,
  onClose,
  targetType,
  targetId,
  targetName,
  targetDescription,
  reporterId,
  reporterName,
  reporterEmail,
}: ReportModalProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  const getTargetTypeLabel = () => {
    switch (targetType) {
      case 'job': return 'ประกาศ';
      case 'user': return 'ผู้ใช้';
      case 'message': return 'ข้อความ';
      case 'review': return 'รีวิว';
      default: return 'เนื้อหา';
    }
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาเลือกเหตุผลในการรายงาน');
      return;
    }

    setIsCheckingDuplicate(true);
    try {
      // Check if already reported
      const alreadyReported = await hasUserReported(reporterId, targetId);
      if (alreadyReported) {
        Alert.alert('แจ้งเตือน', 'คุณได้รายงาน' + getTargetTypeLabel() + 'นี้ไปแล้ว');
        setIsCheckingDuplicate(false);
        return;
      }
    } catch (error) {
      // Continue if check fails
    }
    setIsCheckingDuplicate(false);

    setIsSubmitting(true);
    try {
      await createReport({
        type: targetType,
        reason: selectedReason,
        reasonText: additionalInfo.trim() || undefined,
        reporterId,
        reporterName,
        reporterEmail,
        targetId,
        targetType,
        targetName,
        targetDescription,
      });

      Alert.alert(
        '✅ ส่งรายงานสำเร็จ',
        'ขอบคุณสำหรับการรายงาน ทีมงานจะตรวจสอบโดยเร็วที่สุด',
        [{ text: 'ตกลง', onPress: onClose }]
      );
      
      // Reset form
      setSelectedReason(null);
      setAdditionalInfo('');
    } catch (error: any) {
      Alert.alert('ข้อผิดพลาด', error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setAdditionalInfo('');
    onClose();
  };

  return (
    <ModalContainer
      visible={visible}
      onClose={handleClose}
      title={`รายงาน${getTargetTypeLabel()}`}
    >
      <View style={styles.container}>
        {/* Target Info */}
        <View style={styles.targetInfo}>
          <Ionicons 
            name={targetType === 'job' ? 'briefcase' : targetType === 'user' ? 'person' : targetType === 'review' ? 'flag' : 'chatbubble'} 
            size={20} 
            color={COLORS.primary} 
          />
          <Text style={styles.targetName} numberOfLines={2}>
            {targetName || targetId}
          </Text>
        </View>

        {/* Reason Selection */}
        <Text style={styles.sectionTitle}>เหตุผลในการรายงาน</Text>
        <View style={styles.reasonList}>
          {REPORT_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason.value}
              style={[
                styles.reasonItem,
                selectedReason === reason.value && styles.reasonItemSelected,
              ]}
              onPress={() => setSelectedReason(reason.value)}
            >
              <View style={styles.reasonHeader}>
                <View style={[
                  styles.radioButton,
                  selectedReason === reason.value && styles.radioButtonSelected,
                ]}>
                  {selectedReason === reason.value && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
                <Text style={[
                  styles.reasonLabel,
                  selectedReason === reason.value && styles.reasonLabelSelected,
                ]}>
                  {reason.label}
                </Text>
              </View>
              <Text style={styles.reasonDescription}>{reason.description}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Additional Info */}
        <Text style={styles.sectionTitle}>รายละเอียดเพิ่มเติม (ไม่บังคับ)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="อธิบายเพิ่มเติมเกี่ยวกับปัญหาที่พบ..."
          value={additionalInfo}
          onChangeText={setAdditionalInfo}
          multiline
          numberOfLines={3}
          maxLength={500}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{additionalInfo.length}/500</Text>

        {/* Submit Button */}
        <View style={styles.buttonContainer}>
          <Button
            title="ยกเลิก"
            variant="outline"
            onPress={handleClose}
            style={styles.button}
            disabled={isSubmitting}
          />
          <Button
            title="ส่งรายงาน"
            variant="danger"
            onPress={handleSubmit}
            style={styles.button}
            loading={isSubmitting || isCheckingDuplicate}
            disabled={!selectedReason}
          />
        </View>

        {/* Note */}
        <Text style={styles.note}>
          หมายเหตุ: การรายงานเท็จอาจทำให้บัญชีของคุณถูกจำกัดการใช้งาน
        </Text>
      </View>
    </ModalContainer>
  );
}

const createStyles = (COLORS: any) => StyleSheet.create({
  container: {
    padding: SPACING.md,
  },
  targetInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  targetName: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    marginTop: SPACING.sm,
  },
  reasonList: {
    gap: SPACING.sm,
  },
  reasonItem: {
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  reasonItemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '10',
  },
  reasonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  radioButtonSelected: {
    borderColor: COLORS.primary,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.primary,
  },
  reasonLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
    color: COLORS.text,
  },
  reasonLabelSelected: {
    color: COLORS.primary,
  },
  reasonDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginLeft: 28,
  },
  textInput: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    minHeight: 80,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  charCount: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.lg,
  },
  button: {
    flex: 1,
  },
  note: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: SPACING.md,
  },
});
