// ============================================
// THEME CONTEXT - ระบบธีม (ขาว/ดำ/ตามระบบ)
// ============================================

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PALETTES, ColorPalette } from '../theme/palettes';

// ============================================
// Types
// ============================================
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  // Primary colors
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryBackground: string;
  
  // Background colors
  background: string;
  surface: string;
  card: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textMuted: string;
  textLight: string;
  textInverse: string;
  
  // Border colors
  border: string;
  borderLight: string;
  
  // Status colors
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  error: string;
  errorLight: string;
  danger: string;
  dangerLight: string;
  info: string;
  infoLight: string;
  
  // Special colors
  urgent: string;
  verified: string;
  premium: string;
  online: string;
  offline: string;
  
  // Social colors
  google: string;
  facebook: string;
  line: string;
  
  // Other
  white: string;
  black: string;
  overlay: string;
  overlayLight: string;
  
  // Secondary
  secondary: string;
  secondaryDark: string;
  secondaryLight: string;
  
  // Accent
  accent: string;
  accentDark: string;
  accentLight: string;
  
  // Additional
  backgroundSecondary: string;
  divider: string;
}

interface ThemeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  paletteId: string;
  setPalette: (id: string) => void;
  isDark: boolean;
  colors: ThemeColors;
}

// ============================================
// Helper to apply palette to theme colors
// ============================================
const applyPalette = (baseColors: ThemeColors, palette: ColorPalette): ThemeColors => {
  return {
    ...baseColors,
    primary: palette.primary,
    primaryLight: palette.primaryLight,
    primaryDark: palette.primaryDark,
    primaryBackground: palette.primaryBackground,
    secondary: palette.secondary,
    accent: palette.accent,
  };
};

// ============================================
// Light Theme Colors (Base) — NurseGo Design System v2
// ============================================
export const lightColors: ThemeColors = {
  // Brand — Sky Blue (trust + medical)
  primary: '#0EA5E9',
  primaryLight: '#38BDF8',
  primaryDark: '#0284C7',
  primaryBackground: '#F0F9FF',

  // Backgrounds
  background: '#F8FAFC',
  backgroundSecondary: '#F1F5F9',
  surface: '#FFFFFF',
  card: '#FFFFFF',

  // Text (Slate scale)
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textLight: '#CBD5E1',
  textInverse: '#FFFFFF',

  // Borders
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  divider: '#F1F5F9',

  // Status
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  danger: '#EF4444',
  dangerLight: '#FEE2E2',
  info: '#3B82F6',
  infoLight: '#DBEAFE',

  // Marketplace
  urgent: '#EF4444',
  verified: '#10B981',
  premium: '#F59E0B',
  online: '#22C55E',
  offline: '#94A3B8',

  // Social
  google: '#EA4335',
  facebook: '#1877F2',
  line: '#00B900',

  // Secondary — Emerald (healthcare + growth)
  secondary: '#10B981',
  secondaryDark: '#059669',
  secondaryLight: '#34D399',

  // Accent — Amber (CTAs + important)
  accent: '#F59E0B',
  accentDark: '#D97706',
  accentLight: '#FCD34D',

  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(15, 23, 42, 0.6)',
  overlayLight: 'rgba(15, 23, 42, 0.35)',
};

// ============================================
// Dark Theme Colors
// ============================================
export const darkColors: ThemeColors = {
  primary: '#60A5FA',
  primaryLight: '#93C5FD',
  primaryDark: '#3B82F6',
  primaryBackground: '#1E3A5F',
  
  background: '#0F172A',
  backgroundSecondary: '#1E293B',
  surface: '#1E293B',
  card: '#334155',
  
  text: '#F1F5F9',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  textLight: '#64748B',
  textInverse: '#0F172A',
  
  border: '#475569',
  borderLight: '#334155',
  divider: '#334155',
  
  success: '#34D399',
  successLight: '#064E3B',
  warning: '#FBBF24',
  warningLight: '#78350F',
  error: '#F87171',
  errorLight: '#7F1D1D',
  danger: '#F87171',
  dangerLight: '#7F1D1D',
  info: '#60A5FA',
  infoLight: '#1E3A8A',
  
  // Special
  urgent: '#FF6B6B',
  verified: '#4ADE80',
  premium: '#FCD34D',
  online: '#4ADE80',
  offline: '#64748B',
  
  // Social
  google: '#EA4335',
  facebook: '#1877F2',
  line: '#06C755',
  
  // Secondary
  secondary: '#67E8F9',
  secondaryDark: '#22D3EE',
  secondaryLight: '#A5F3FC',
  
  // Accent
  accent: '#FB7185',
  accentDark: '#F43F5E',
  accentLight: '#FDA4AF',
  
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.7)',
  overlayLight: 'rgba(0, 0, 0, 0.5)',
};

// ============================================
// Global Theme State (สำหรับเข้าถึงจากทุกที่)
// ============================================
let currentColors: ThemeColors = lightColors;
let currentIsDark: boolean = false;
let themeListeners: Array<() => void> = [];

export function getCurrentColors(): ThemeColors {
  return currentColors;
}

export function getIsDark(): boolean {
  return currentIsDark;
}

export function subscribeToTheme(listener: () => void): () => void {
  themeListeners.push(listener);
  return () => {
    themeListeners = themeListeners.filter(l => l !== listener);
  };
}

function notifyThemeListeners() {
  themeListeners.forEach(listener => listener());
}

// ============================================
// Context
// ============================================
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@theme_mode';
const PALETTE_STORAGE_KEY = '@theme_palette';

// ============================================
// Provider
// ============================================
interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [paletteId, setPaletteIdState] = useState<string>('default-blue');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved theme on mount
  useEffect(() => {
    loadSavedTheme();
  }, []);

  const loadSavedTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeModeState(savedTheme as ThemeMode);
      }
      
      const savedPalette = await AsyncStorage.getItem(PALETTE_STORAGE_KEY);
      if (savedPalette && PALETTES.some(p => p.id === savedPalette)) {
        setPaletteIdState(savedPalette);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      setThemeModeState(mode);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const setPalette = async (id: string) => {
    try {
      await AsyncStorage.setItem(PALETTE_STORAGE_KEY, id);
      setPaletteIdState(id);
    } catch (error) {
      console.error('Error saving palette:', error);
    }
  };

  // Determine if dark mode should be active
  const isDark = themeMode === 'dark' || 
    (themeMode === 'system' && systemColorScheme === 'dark');

  // Get current colors based on palette
  const selectedPalette = PALETTES.find(p => p.id === paletteId) || PALETTES[0];
  const baseColors = isDark ? darkColors : lightColors;
  const colors = applyPalette(baseColors, selectedPalette);
  
  // Update global state
  useEffect(() => {
    currentColors = colors;
    currentIsDark = isDark;
    notifyThemeListeners();
  }, [isDark, colors]);

  const value: ThemeContextType = {
    themeMode,
    setThemeMode,
    paletteId,
    setPalette,
    isDark,
    colors,
  };

  // Don't render until theme is loaded
  if (!isLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

// ============================================
// Hooks
// ============================================
export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Hook สำหรับ re-render เมื่อ theme เปลี่ยน
export function useColors(): ThemeColors {
  const { colors } = useTheme();
  return colors;
}

export default ThemeContext;
