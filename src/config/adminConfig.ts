import Constants from 'expo-constants';

// Extra values embedded at build time via app.config.js
const extra = Constants.expoConfig?.extra || {};

export const ADMIN_CONFIG = {
  username: extra.adminUsername ||
            process.env.EXPO_PUBLIC_ADMIN_USERNAME ||
            'adminmark',

  passwordHash: extra.adminPasswordHash ||
                process.env.EXPO_PUBLIC_ADMIN_PASSWORD_HASH ||
                '',

  displayName: 'Administrator',
  email: 'admin@nursego.admin',
};

export function validateAdminConfig(): { valid: boolean; error?: string } {
  if (!ADMIN_CONFIG.username) {
    return { valid: false, error: '⚠️ ADMIN_USERNAME not configured.' };
  }
  if (!ADMIN_CONFIG.passwordHash) {
    return { valid: false, error: '⚠️ ADMIN_PASSWORD_HASH not configured. Run: node scripts/generateAdminHash.js YOUR_PASSWORD' };
  }
  return { valid: true };
}
