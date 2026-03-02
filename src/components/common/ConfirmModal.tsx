// ============================================
// CONFIRM MODAL - Beautiful Alert Replacement
// ============================================

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme';

interface ConfirmModalProps {
  visible: boolean;
  title?: string;
  message: string;
  icon?: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'success' | 'warning' | 'info';
}

export default function ConfirmModal({
  visible,
  title,
  message,
  icon,
  confirmText = 'ตกลง',
  cancelText = 'ยกเลิก',
  confirmColor,
  onConfirm,
  onCancel,
  type = 'danger',
}: ConfirmModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const getTypeStyles = () => {
    switch (type) {
      case 'danger':
        return {
          ionicon: 'log-out-outline' as const,
          color: '#EF4444',
          ringBg: 'rgba(239,68,68,0.10)',
          innerBg: '#FEF2F2',
        };
      case 'success':
        return {
          ionicon: 'checkmark-circle-outline' as const,
          color: '#10B981',
          ringBg: 'rgba(16,185,129,0.10)',
          innerBg: '#ECFDF5',
        };
      case 'warning':
        return {
          ionicon: 'alert-circle-outline' as const,
          color: '#F59E0B',
          ringBg: 'rgba(245,158,11,0.10)',
          innerBg: '#FFFBEB',
        };
      case 'info':
      default:
        return {
          ionicon: 'information-circle-outline' as const,
          color: COLORS.primary,
          ringBg: 'rgba(99,102,241,0.10)',
          innerBg: '#EEF2FF',
        };
    }
  };

  const typeStyles = getTypeStyles();
  const accentColor = confirmColor || typeStyles.color;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 9, tension: 60, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.88);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]} accessibilityViewIsModal={true}>
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
          {/* Top accent bar */}
          <View style={[styles.topAccent, { backgroundColor: accentColor }]} />

          <View style={styles.modalBody}>
            {/* Icon ring */}
            <View style={[styles.iconRing, { backgroundColor: typeStyles.ringBg }]}>
              <View style={[styles.iconInner, { backgroundColor: typeStyles.innerBg }]}>
                <Ionicons name={typeStyles.ionicon} size={38} color={accentColor} />
              </View>
            </View>

            {/* Title */}
            {title && <Text style={styles.modalTitle}>{title}</Text>}

            {/* Message */}
            <Text style={styles.modalMessage}>{message}</Text>

            <View style={styles.divider} />

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.btn, styles.btnCancel]}
                onPress={onCancel}
                activeOpacity={0.8}
              >
                <Text style={styles.btnCancelText}>{cancelText}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btn, styles.btnConfirm, { backgroundColor: accentColor }]}
                onPress={onConfirm}
                activeOpacity={0.8}
              >
                <Text style={styles.btnConfirmText}>{confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ============================================
// SUCCESS MODAL - For success messages
// ============================================
interface SuccessModalProps {
  visible: boolean;
  title?: string;
  message: string;
  icon?: string;
  buttonText?: string;
  onClose: () => void;
}

export function SuccessModal({
  visible,
  title = 'สำเร็จ!',
  message,
  icon = '🎉',
  buttonText = 'ตกลง',
  onClose,
}: SuccessModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 9, tension: 60, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.88);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]} accessibilityViewIsModal={true}>
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
          {/* Top accent */}
          <View style={[styles.topAccent, { backgroundColor: '#10B981' }]} />
          <View style={styles.modalBody}>
            {/* Icon */}
            <View style={[styles.iconRing, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
              <View style={[styles.iconInner, { backgroundColor: '#ECFDF5' }]}>
                <Ionicons name="checkmark-circle" size={38} color="#10B981" />
              </View>
            </View>
            <Text style={styles.modalTitle}>{title}</Text>
            <Text style={styles.modalMessage}>{message}</Text>
            <View style={styles.divider} />
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: '#10B981', borderColor: '#10B981' }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={[styles.modalBtnText, { color: '#FFF' }]}>{buttonText}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ============================================
// ERROR MODAL - For error messages
// ============================================
interface ErrorModalProps {
  visible: boolean;
  title?: string;
  message: string;
  icon?: string;
  buttonText?: string;
  onClose: () => void;
}

export function ErrorModal({
  visible,
  title = 'เกิดข้อผิดพลาด',
  message,
  icon = '❌',
  buttonText = 'ตกลง',
  onClose,
}: ErrorModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, friction: 9, tension: 60, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      scaleAnim.setValue(0.88);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: opacityAnim }]} accessibilityViewIsModal={true}>
        <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.topAccent, { backgroundColor: '#EF4444' }]} />
          <View style={styles.modalBody}>
            <View style={[styles.iconRing, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
              <View style={[styles.iconInner, { backgroundColor: '#FEF2F2' }]}>
                <Ionicons name="close-circle" size={38} color="#EF4444" />
              </View>
            </View>
            <Text style={styles.modalTitle}>{title}</Text>
            <Text style={styles.modalMessage}>{message}</Text>
            <View style={styles.divider} />
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: '#EF4444', borderColor: '#EF4444' }]}
              onPress={onClose}
              activeOpacity={0.8}
            >
              <Text style={[styles.modalBtnText, { color: '#FFF' }]}>{buttonText}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 360,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 16,
  },
  topAccent: {
    height: 5,
    width: '100%',
  },
  modalBody: {
    padding: 28,
    alignItems: 'center',
  },
  iconRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 4,
  },
  iconInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  modalMessage: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    width: '100%',
    marginVertical: 20,
  },
  modalBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    minHeight: 50,
  },
  modalBtnText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  // ConfirmModal button styles
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnCancel: {
    backgroundColor: '#F1F5F9',
  },
  btnCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  btnConfirm: {
    backgroundColor: '#EF4444',
  },
  btnConfirmText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
