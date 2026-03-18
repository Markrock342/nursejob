import * as eva from '@eva-design/eva';
import { PALETTES } from './palettes';

export function getEvaTheme(paletteId: string, isDark: boolean) {
  const base = isDark ? eva.dark : eva.light;
  const palette = PALETTES.find(p => p.id === paletteId) || PALETTES[0];

  const customVars: Record<string, string> = {
    // Primary scale
    'color-primary-100': palette.primaryLight,
    'color-primary-200': palette.primaryLight,
    'color-primary-300': palette.primary,
    'color-primary-500': palette.primary,
    'color-primary-700': palette.primaryDark,
    'color-primary-800': palette.primaryDark,
    'color-primary-900': palette.primaryDark,

    // Accents / secondary
    'color-secondary-500': palette.secondary,
    'color-accent-500': palette.accent,

    // Backgrounds
    'background-basic-color-1': isDark ? '#18191A' : base['color-basic-100'] ?? '#FFFFFF',
    'background-basic-color-2': isDark ? '#242526' : base['color-basic-200'] ?? '#F7F9FC',

    // Keep a variable for a lighter primary background if provided
    'color-primary-background': palette.primaryBackground,
  };

  // Merge base Eva theme with our custom variables — keys in customVars will override
  return {
    ...base,
    ...customVars,
  } as any;
}
