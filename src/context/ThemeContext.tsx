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
const withAlpha = (hex: string, alpha: number) => {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return hex;
  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

const applyPalette = (baseColors: ThemeColors, palette: ColorPalette, isDark: boolean): ThemeColors => {
  return {
    ...baseColors,
    primary: palette.primary,
    primaryLight: palette.primaryLight,
    primaryDark: palette.primaryDark,
    primaryBackground: isDark ? withAlpha(palette.primaryLight, 0.16) : palette.primaryBackground,
    secondary: palette.secondary,
    secondaryLight: isDark ? withAlpha(palette.secondary, 0.16) : baseColors.secondaryLight,
    accent: palette.accent,
    accentLight: isDark ? withAlpha(palette.accent, 0.16) : baseColors.accentLight,
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
  primary: '#8AC5FF',
  primaryLight: '#C6E0FF',
  primaryDark: '#4EA1F3',
  primaryBackground: 'rgba(138, 197, 255, 0.14)',

  background: '#090C14',
  backgroundSecondary: '#101522',
  surface: '#151B28',
  card: '#1A2232',

  text: '#F3F6FC',
  textSecondary: '#B7C0D4',
  textMuted: '#8792A8',
  textLight: '#657087',
  textInverse: '#090C14',

  border: '#2A3447',
  borderLight: '#202938',
  divider: '#202938',

  success: '#4ADE80',
  successLight: 'rgba(74, 222, 128, 0.16)',
  warning: '#FBBF24',
  warningLight: 'rgba(251, 191, 36, 0.16)',
  error: '#FB7185',
  errorLight: 'rgba(251, 113, 133, 0.16)',
  danger: '#FB7185',
  dangerLight: 'rgba(251, 113, 133, 0.16)',
  info: '#60A5FA',
  infoLight: 'rgba(96, 165, 250, 0.16)',
  
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
  secondary: '#67E8D2',
  secondaryDark: '#2FBFA9',
  secondaryLight: 'rgba(103, 232, 210, 0.16)',
  
  // Accent
  accent: '#E7C26A',
  accentDark: '#C9962E',
  accentLight: 'rgba(231, 194, 106, 0.16)',
  
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
  const colors = applyPalette(baseColors, selectedPalette, isDark);
  
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
