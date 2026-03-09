// ============================================
// CUSTOM ALERT v2 — Modern Bottom-Sheet Style
// ============================================

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../context/ThemeContext';

const { width, height } = Dimensions.get('window');

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'question';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

interface CustomAlertProps {
  visible: boolean;
  type?: AlertType;
  title?: string;
  message?: string;
  buttons?: AlertButton[];
  onClose: () => void;
  icon?: string;
  autoClose?: number;
}

const ALERT_ICONS: Record<AlertType, {
  ionicon: string;
  defaultTitle: string;
}> = {
  success: {
    ionicon: 'checkmark-circle',
    defaultTitle: 'สำเร็จ!',
  },
  error: {
    ionicon: 'close-circle',
    defaultTitle: 'เกิดข้อผิดพลาด',
  },
  warning: {
    ionicon: 'warning',
    defaultTitle: 'คำเตือน',
  },
  info: {
    ionicon: 'information-circle',
    defaultTitle: 'แจ้งเตือน',
  },
  question: {
    ionicon: 'help-circle',
    defaultTitle: 'ยืนยันรายการ',
  },
};

export default function CustomAlert({
  visible,
  type = 'info',
  title,
  message,
  buttons = [{ text: 'ตกลง' }],
  onClose,
  autoClose,
}: CustomAlertProps) {
  const { colors, isDark } = useTheme();
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(80)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const iconScaleAnim = useRef(new Animated.Value(0)).current;

  const iconConfig = ALERT_ICONS[type];
  const config = {
    success: { color: colors.success, bgColor: colors.successLight, ringColor: isDark ? 'rgba(52,211,153,0.2)' : 'rgba(16,185,129,0.15)' },
    error: { color: colors.error, bgColor: colors.errorLight, ringColor: isDark ? 'rgba(248,113,113,0.22)' : 'rgba(239,68,68,0.15)' },
    warning: { color: colors.warning, bgColor: colors.warningLight, ringColor: isDark ? 'rgba(251,191,36,0.2)' : 'rgba(245,158,11,0.15)' },
    info: { color: colors.info, bgColor: colors.infoLight, ringColor: isDark ? 'rgba(96,165,250,0.2)' : 'rgba(59,130,246,0.15)' },
    question: { color: colors.primary, bgColor: colors.primaryBackground, ringColor: isDark ? 'rgba(96,165,250,0.18)' : 'rgba(14,165,233,0.12)' },
  }[type];
  const displayTitle = title || iconConfig.defaultTitle;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, friction: 9, tension: 55, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 9, tension: 55, useNativeDriver: true }),
      ]).start(() => {
        Animated.spring(iconScaleAnim, { toValue: 1, friction: 5, tension: 80, useNativeDriver: true }).start();
      });
      if (autoClose) {
        const timer = setTimeout(() => handleClose(), autoClose);
        return () => clearTimeout(timer);
      }
    } else {
      backdropAnim.setValue(0);
      slideAnim.setValue(80);
      scaleAnim.setValue(0.92);
      iconScaleAnim.setValue(0);
    }
  }, [visible]);

  const handleClose = (callback?: () => void) => {
    Animated.parallel([
      Animated.timing(backdropAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 60, duration: 160, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.92, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      onClose();
      callback?.();
    });
  };

  const getButtonStyle = (btnStyle?: string, index?: number, total?: number) => {
    const isLast = index === (total ?? 1) - 1;
    if (btnStyle === 'cancel') return { bg: colors.backgroundSecondary, fg: colors.textSecondary, border: colors.border };
    if (btnStyle === 'destructive') return { bg: colors.errorLight, fg: colors.error, border: colors.error };
    if (isLast || total === 1) return { bg: config.color, fg: colors.white, border: config.color };
    return { bg: colors.background, fg: colors.textSecondary, border: colors.border };
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => handleClose()}
    >
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim, backgroundColor: colors.overlay }]}> 
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => buttons.length === 1 && handleClose()}
        />
      </Animated.View>

      <View style={styles.centeredView} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.surface, shadowColor: isDark ? '#000000' : '#0F172A' },
            { transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
          ]}
        >
          <View style={[styles.topAccent, { backgroundColor: config.color }]} />
          <View style={styles.body}>
            <Animated.View
              style={[styles.iconRing, { backgroundColor: config.ringColor, transform: [{ scale: iconScaleAnim }] }]}
            >
              <View style={[styles.iconCircle, { backgroundColor: config.bgColor }]}>
                <Ionicons name={iconConfig.ionicon as any} size={38} color={config.color} />
              </View>
            </Animated.View>

            <Text style={[styles.title, { color: colors.text }]}>{displayTitle}</Text>
            {message ? <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text> : null}

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={[styles.buttonRow, buttons.length > 2 && styles.buttonColumn]}>
              {buttons.map((btn, idx) => {
                const bs = getButtonStyle(btn.style, idx, buttons.length);
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.btn,
                      buttons.length <= 2 && { flex: 1 },
                      buttons.length > 2 && { width: '100%' },
                      { backgroundColor: bs.bg, borderColor: bs.border },
                    ]}
                    onPress={() => handleClose(btn.onPress)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.btnText, { color: bs.fg }]}>{btn.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ============================================
// HOOK FOR EASY USAGE
// ============================================

export interface AlertState {
  visible: boolean;
  type: AlertType;
  title?: string;
  message?: string;
  buttons: AlertButton[];
  icon?: string;
  autoClose?: number;
}

export const initialAlertState: AlertState = {
  visible: false,
  type: 'info',
  title: '',
  message: '',
  buttons: [{ text: 'ตกลง' }],
};

// Helper function to create alert configs
export const createAlert = {
  success: (title: string, message?: string, buttons?: AlertButton[]): AlertState => ({
    visible: true,
    type: 'success',
    title,
    message,
    buttons: buttons || [{ text: 'ตกลง' }],
  }),
  
  error: (title: string, message?: string, buttons?: AlertButton[]): AlertState => ({
    visible: true,
    type: 'error',
    title,
    message,
    buttons: buttons || [{ text: 'ตกลง' }],
  }),
  
  warning: (title: string, message?: string, buttons?: AlertButton[]): AlertState => ({
    visible: true,
    type: 'warning',
    title,
    message,
    buttons: buttons || [{ text: 'ตกลง' }],
  }),
  
  info: (title: string, message?: string, buttons?: AlertButton[]): AlertState => ({
    visible: true,
    type: 'info',
    title,
    message,
    buttons: buttons || [{ text: 'ตกลง' }],
  }),
  
  confirm: (title: string, message: string, onConfirm: () => void, onCancel?: () => void): AlertState => ({
    visible: true,
    type: 'question',
    title,
    message,
    buttons: [
      { text: 'ยกเลิก', style: 'cancel', onPress: onCancel },
      { text: 'ยืนยัน', onPress: onConfirm },
    ],
  }),
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.55)',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
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
  body: {
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
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    width: '100%',
    marginVertical: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  buttonColumn: {
    flexDirection: 'column',
    gap: 8,
  },
  btn: {
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    minHeight: 48,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
