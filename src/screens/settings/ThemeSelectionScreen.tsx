import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../src/context/ThemeContext'; // Adjusted path
import { ThemePicker, BackButton } from '../../components/common';
import { SPACING, FONT_SIZES } from '../../theme';
import { useI18n } from '../../i18n';

const ThemeSelectionScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useI18n();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <BackButton />
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          <Text style={[styles.header, { color: colors.text }]}>{t('settings.theme.selectionTitle')}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {t('settings.theme.selectionDescription')}
          </Text>
          <ThemePicker />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingVertical: SPACING.lg,
  },
  container: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  header: {
    fontSize: FONT_SIZES.xxxl,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  description: {
    fontSize: FONT_SIZES.lg,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.md,
  },
});

export default ThemeSelectionScreen;
