import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { KittenButton as Button } from '../../components/common';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { AuthStackParamList } from '../../types';

// ============================================
// Types
// ============================================
type ChooseRoleScreenNavigationProp = NativeStackNavigationProp<AuthStackParamList, 'ChooseRole'>;
type ChooseRoleScreenRouteProp = RouteProp<AuthStackParamList, 'ChooseRole'>;

interface Props {
  navigation: ChooseRoleScreenNavigationProp;
  route: ChooseRoleScreenRouteProp;
}

// ============================================
// Component
// ============================================
export default function ChooseRoleScreen({ navigation, route }: Props) {
  const { phone, registrationData } = route.params; // registrationData อาจมีข้อมูลมาด้วยในอนาคต
  const [selectedRole, setSelectedRole] = useState<'nurse' | 'hospital' | null>(null);

  const handleContinue = () => {
    // นำทางไปยัง CompleteRegistration โดยส่ง role ที่เลือกไปด้วย
    navigation.navigate('CompleteRegistration', {
      phone,
      phoneVerified: true,
      role: selectedRole || 'user', // ถ้าไม่ได้เลือก ให้เป็น 'user' default
      ...registrationData, // ส่งข้อมูลอื่นๆ ที่อาจมีมาด้วย
    });
  };

  const handleSkip = () => {
    // ข้ามการเลือก role, ตั้งเป็น 'user' default
    navigation.navigate('CompleteRegistration', {
      phone,
      phoneVerified: true,
      role: 'user',
      ...registrationData,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>คุณเป็นใคร?</Text>
        <Text style={styles.subtitle}>เลือกบทบาทของคุณเพื่อประสบการณ์ที่เหมาะสม</Text>

        <View style={styles.roleSelectionContainer}>
          <TouchableOpacity
            style={[
              styles.roleCard,
              selectedRole === 'nurse' && styles.roleCardSelected,
            ]}
            onPress={() => setSelectedRole('nurse')}
          >
            <Ionicons
              name="heart-circle-outline" // ไอคอนสำหรับพยาบาล
              size={60}
              color={selectedRole === 'nurse' ? COLORS.white : COLORS.primary}
            />
            <Text
              style={[
                styles.roleCardTitle,
                selectedRole === 'nurse' && styles.roleCardTitleSelected,
              ]}
            >
              พยาบาล
            </Text>
            <Text
              style={[
                styles.roleCardDescription,
                selectedRole === 'nurse' && styles.roleCardDescriptionSelected,
              ]}
            >
              กำลังมองหางานเวร, งานพาร์ทไทม์
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.roleCard,
              selectedRole === 'hospital' && styles.roleCardSelected,
            ]}
            onPress={() => setSelectedRole('hospital')}
          >
            <Ionicons
              name="business-outline" // ไอคอนสำหรับโรงพยาบาล
              size={60}
              color={selectedRole === 'hospital' ? COLORS.white : COLORS.accent}
            />
            <Text
              style={[
                styles.roleCardTitle,
                selectedRole === 'hospital' && styles.roleCardTitleSelected,
              ]}
            >
              โรงพยาบาล / ผู้จ้างงาน
            </Text>
            <Text
              style={[
                styles.roleCardDescription,
                selectedRole === 'hospital' && styles.roleCardDescriptionSelected,
              ]}
            >
              ต้องการโพสต์หาพยาบาล หรือบุคลากรทางการแพทย์
            </Text>
          </TouchableOpacity>
        </View>

        <Button
          title="ดำเนินการต่อ"
          onPress={handleContinue}
          disabled={selectedRole === null}
          style={styles.continueButton}
        />
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <Text style={styles.skipButtonText}>ข้ามไปก่อน</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  backButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? SPACING.xl : SPACING.lg,
    left: SPACING.lg,
    zIndex: 1,
    padding: SPACING.sm,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
  },
  title: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    maxWidth: 300,
  },
  roleSelectionContainer: {
    flexDirection: 'column',
    gap: SPACING.md,
    width: '100%',
    maxWidth: 350,
    marginBottom: SPACING.xl,
  },
  roleCard: {
    backgroundColor: COLORS.card,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  roleCardSelected: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  roleCardTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  roleCardTitleSelected: {
    color: COLORS.white,
  },
  roleCardDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  roleCardDescriptionSelected: {
    color: COLORS.white,
  },
  continueButton: {
    marginTop: SPACING.md,
    width: '100%',
    maxWidth: 350,
  },
  skipButton: {
    marginTop: SPACING.md,
  },
  skipButtonText: {
    color: COLORS.primary,
    fontSize: FONT_SIZES.md,
    fontWeight: '500',
  },
});
