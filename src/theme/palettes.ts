// ============================================
// THEME PALETTES - ชุดสีต่างๆ สำหรับแอพ
// ============================================

export interface ColorPalette {
  id: string;
  name: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryBackground: string;
  secondary: string;
  accent: string;
}

export const PALETTES: ColorPalette[] = [
  {
    id: 'default-blue',
    name: 'NurseGo Sky (Default)',
    primary: '#0EA5E9',
    primaryLight: '#38BDF8',
    primaryDark: '#0284C7',
    primaryBackground: '#F0F9FF',
    secondary: '#10B981',
    accent: '#F59E0B',
  },
  {
    id: 'teal-serene',
    name: 'Teal Serenity',
    primary: '#0D9488',
    primaryLight: '#5EEAD4',
    primaryDark: '#0F766E',
    primaryBackground: '#F0FDFA',
    secondary: '#2DD4BF',
    accent: '#F43F5E',
  },
  {
    id: 'royal-purple',
    name: 'Royal Care',
    primary: '#7C3AED',
    primaryLight: '#C4B5FD',
    primaryDark: '#5B21B6',
    primaryBackground: '#F5F3FF',
    secondary: '#A855F7',
    accent: '#10B981',
  },
  {
    id: 'medical-green',
    name: 'Medical Green',
    primary: '#059669',
    primaryLight: '#6EE7B7',
    primaryDark: '#065F46',
    primaryBackground: '#ECFDF5',
    secondary: '#10B981',
    accent: '#F59E0B',
  },
  {
    id: 'soft-indigo',
    name: 'Soft Indigo',
    primary: '#4F46E5',
    primaryLight: '#A5B4FC',
    primaryDark: '#3730A3',
    primaryBackground: '#EEF2FF',
    secondary: '#6366F1',
    accent: '#EC4899',
  },
  {
    id: 'rose-care',
    name: 'Rose Care',
    primary: '#E11D48',
    primaryLight: '#FDA4AF',
    primaryDark: '#9F1239',
    primaryBackground: '#FFF1F2',
    secondary: '#FB7185',
    accent: '#0EA5E9',
  },
  {
    id: 'midnight-navy',
    name: 'Midnight Navy',
    primary: '#1E293B',
    primaryLight: '#64748B',
    primaryDark: '#0F172A',
    primaryBackground: '#F8FAFC',
    secondary: '#475569',
    accent: '#3B82F6',
  },
  {
    id: 'warm-orange',
    name: 'Vital Orange',
    primary: '#EA580C',
    primaryLight: '#FDBA74',
    primaryDark: '#9A3412',
    primaryBackground: '#FFF7ED',
    secondary: '#F97316',
    accent: '#0D9488',
  }
];
