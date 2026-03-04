// ============================================
// FEEDBACK SCREEN - หน้าส่ง Feedback/รีวิว
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Constants from 'expo-constants';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { KittenButton as Button, Card } from '../../components/common';
import CustomAlert, { AlertState, initialAlertState, createAlert } from '../../components/common/CustomAlert';
import {
  createFeedback,
  getUserFeedback,
  canUserLeaveFeedback,
  AppFeedback,
  FeedbackType,
  FEEDBACK_TYPES,
  FEEDBACK_STATUS_LABELS,
} from '../../services/feedbackService';
import { formatRelativeTime } from '../../utils/helpers';

export default function FeedbackScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors } = useTheme();
  
  const [rating, setRating] = useState(5);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('app_review');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [canSubmit, setCanSubmit] = useState(true);
  const [myFeedback, setMyFeedback] = useState<AppFeedback[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [alert, setAlert] = useState<AlertState>(initialAlertState);
  const closeAlert = () => setAlert(initialAlertState);

  useEffect(() => {
    if (user?.uid) {
      checkCanSubmit();
      loadMyFeedback();
    }
  }, [user?.uid]);

  const checkCanSubmit = async () => {
    if (!user?.uid) return;
    const can = await canUserLeaveFeedback(user.uid);
    setCanSubmit(can);
  };

  const loadMyFeedback = async () => {
    if (!user?.uid) return;
    const feedback = await getUserFeedback(user.uid);
    setMyFeedback(feedback);
  };

  const handleSubmit = async () => {
    if (!user) {
      setAlert({ ...createAlert.warning('กรุณาเข้าสู่ระบบ', 'คุณต้องเข้าสู่ระบบก่อนส่ง feedback') } as AlertState);
      return;
    }

    if (!title.trim()) {
      setAlert({ ...createAlert.warning('กรุณากรอกข้อมูล', 'กรุณากรอกหัวข้อ') } as AlertState);
      return;
    }

    if (!message.trim()) {
      setAlert({ ...createAlert.warning('กรุณากรอกข้อมูล', 'กรุณากรอกข้อความ') } as AlertState);
      return;
    }

    setIsSubmitting(true);
    try {
      await createFeedback({
        userId: user.uid,
        userName: user.displayName || 'ผู้ใช้',
        userEmail: user.email || '',
        rating,
        type: feedbackType,
        title: title.trim(),
        message: message.trim(),
        appVersion: Constants.expoConfig?.version || '1.0.0',
        platform: Platform.OS as 'ios' | 'android' | 'web',
      });

      setAlert({
        ...createAlert.success('ส่ง Feedback สำเร็จ', 'ขอบคุณสำหรับความคิดเห็นของคุณ เราจะนำไปปรับปรุงแอพให้ดียิ่งขึ้น'),
        onConfirm: () => { closeAlert(); navigation.goBack(); },
      } as AlertState);
    } catch (error: any) {
      setAlert({ ...createAlert.error('ข้อผิดพลาด', error.message) } as AlertState);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStars = () => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            onPress={() => setRating(star)}
            style={styles.starButton}
          >
            <Ionicons
              name={star <= rating ? 'star' : 'star-outline'}
              size={40}
              color={star <= rating ? '#FFD700' : colors.textMuted}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const getRatingText = () => {
    switch (rating) {
      case 1: return 'แย่มาก 😢';
      case 2: return 'ไม่ดี 😕';
      case 3: return 'ปานกลาง 😐';
      case 4: return 'ดี 😊';
      case 5: return 'ยอดเยี่ยม 🤩';
      default: return '';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return colors.warning;
      case 'read': return colors.info;
      case 'responded': return colors.success;
      case 'resolved': return colors.primary;
      default: return colors.textMuted;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <CustomAlert {...alert} onClose={closeAlert} />
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feedback & รีวิว</Text>
        <TouchableOpacity onPress={() => setShowHistory(!showHistory)}>
          <Ionicons 
            name={showHistory ? 'create-outline' : 'time-outline'} 
            size={24} 
            color={colors.primary} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {showHistory ? (
          // History View
          <View>
            <Text style={styles.sectionTitle}>ประวัติ Feedback ของคุณ</Text>
            
            {myFeedback.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Ionicons name="chatbox-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyText}>ยังไม่มี feedback</Text>
              </Card>
            ) : (
              myFeedback.map((item) => (
                <Card key={item.id} style={styles.feedbackCard}>
                  <View style={styles.feedbackHeader}>
                    <View style={styles.feedbackStars}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Ionicons
                          key={star}
                          name={star <= item.rating ? 'star' : 'star-outline'}
                          size={16}
                          color={star <= item.rating ? '#FFD700' : colors.textMuted}
                        />
                      ))}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                        {FEEDBACK_STATUS_LABELS[item.status]}
                      </Text>
                    </View>
                  </View>
                  
                  <Text style={styles.feedbackTitle}>{item.title}</Text>
                  <Text style={styles.feedbackMessage}>{item.message}</Text>
                  <Text style={styles.feedbackDate}>{formatRelativeTime(item.createdAt)}</Text>
                  
                  {item.adminResponse && (
                    <View style={styles.adminResponse}>
                      <Text style={styles.adminResponseLabel}>📢 ตอบกลับจากทีมงาน:</Text>
                      <Text style={styles.adminResponseText}>{item.adminResponse}</Text>
                    </View>
                  )}
                </Card>
              ))
            )}
          </View>
        ) : (
          // Submit Form View
          <View>
            {!canSubmit ? (
              <Card style={styles.limitCard}>
                <Ionicons name="time" size={32} color={colors.warning} />
                <Text style={styles.limitText}>
                  คุณส่ง feedback ไปแล้ววันนี้{'\n'}กรุณารอพรุ่งนี้
                </Text>
              </Card>
            ) : (
              <>
                {/* Rating */}
                <Card style={styles.card}>
                  <Text style={styles.cardTitle}>ให้คะแนนแอพของเรา</Text>
                  {renderStars()}
                  <Text style={styles.ratingText}>{getRatingText()}</Text>
                </Card>

                {/* Feedback Type */}
                <Card style={styles.card}>
                  <Text style={styles.cardTitle}>ประเภท Feedback</Text>
                  <View style={styles.typeContainer}>
                    {FEEDBACK_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type.value}
                        style={[
                          styles.typeButton,
                          feedbackType === type.value && styles.typeButtonActive,
                        ]}
                        onPress={() => setFeedbackType(type.value)}
                      >
                        <Ionicons
                          name={type.icon as any}
                          size={20}
                          color={feedbackType === type.value ? colors.white : colors.primary}
                        />
                        <Text
                          style={[
                            styles.typeText,
                            feedbackType === type.value && styles.typeTextActive,
                          ]}
                        >
                          {type.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </Card>

                {/* Title & Message */}
                <Card style={styles.card}>
                  <Text style={styles.cardTitle}>ข้อความของคุณ</Text>
                  
                  <TextInput
                    style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                    placeholder="หัวข้อ"
                    placeholderTextColor={colors.textMuted}
                    value={title}
                    onChangeText={setTitle}
                    maxLength={100}
                  />
                  
                  <TextInput
                    style={[styles.input, styles.messageInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                    placeholder="รายละเอียด... (บอกเราว่าคุณชอบอะไร หรืออยากให้ปรับปรุงอะไร)"
                    placeholderTextColor={colors.textMuted}
                    value={message}
                    onChangeText={setMessage}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                    maxLength={1000}
                  />
                  <Text style={styles.charCount}>{message.length}/1000</Text>
                </Card>

                {/* Submit Button */}
                <Button
                  title="📤 ส่ง Feedback"
                  onPress={handleSubmit}
                  loading={isSubmitting}
                  disabled={!title.trim() || !message.trim()}
                  style={styles.submitButton}
                />

                <Text style={styles.disclaimer}>
                  Feedback ของคุณจะช่วยให้เราพัฒนาแอพให้ดียิ่งขึ้น
                  ทีมงานจะอ่านทุกข้อความ 💙
                </Text>
              </>
            )}
          </View>
        )}
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
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  card: {
    marginBottom: SPACING.md,
  },
  cardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  starButton: {
    padding: SPACING.xs,
  },
  ratingText: {
    textAlign: 'center',
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.primary,
    marginTop: SPACING.sm,
  },
  typeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primary,
    gap: SPACING.xs,
  },
  typeButtonActive: {
    backgroundColor: COLORS.primary,
  },
  typeText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  typeTextActive: {
    color: COLORS.white,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  messageInput: {
    minHeight: 120,
  },
  charCount: {
    textAlign: 'right',
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  submitButton: {
    marginTop: SPACING.md,
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.md,
    marginBottom: SPACING.xl,
  },
  limitCard: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  limitText: {
    textAlign: 'center',
    fontSize: FONT_SIZES.md,
    color: COLORS.warning,
    marginTop: SPACING.md,
  },
  emptyCard: {
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    color: COLORS.textMuted,
    marginTop: SPACING.md,
  },
  feedbackCard: {
    marginBottom: SPACING.md,
  },
  feedbackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  feedbackStars: {
    flexDirection: 'row',
    gap: 2,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  feedbackTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  feedbackMessage: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  feedbackDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  adminResponse: {
    marginTop: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.successLight,
    borderRadius: BORDER_RADIUS.md,
  },
  adminResponseLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.success,
    marginBottom: 4,
  },
  adminResponseText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
});

