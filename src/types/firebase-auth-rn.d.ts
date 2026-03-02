/**
 * Type declaration for getReactNativePersistence
 * which lives in @firebase/auth's react-native export condition (dist/rn/)
 * Metro resolves it at runtime, but TypeScript doesn't see it.
 */
declare module '@firebase/auth/dist/rn/index.js' {
  import type { Persistence } from 'firebase/auth';
  import type { ReactNativeAsyncStorage } from '@firebase/auth';
  export function getReactNativePersistence(
    storage: ReactNativeAsyncStorage
  ): Persistence;
}
