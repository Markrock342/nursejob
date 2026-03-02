import { useState, useEffect, useCallback } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';

// Guard geolocation import so app doesn't crash in Expo Go where
// `react-native-geolocation-service` (native module) may not be available.
let Geolocation: any = undefined;
function getGeolocationSync() {
  if (Geolocation !== undefined) return Geolocation;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Geolocation = require('react-native-geolocation-service');
  } catch (e) {
    Geolocation = null;
    console.warn('react-native-geolocation-service not available. useLocation will return an error until running in a dev-client or native build.');
  }
  return Geolocation;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export function useLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      // Check first — avoids showing the OS popup when permission is already granted
      const alreadyGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      if (alreadyGranted) return true;

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'ขออนุญาตเข้าถึงตำแหน่ง',
          message: 'แอปต้องการใช้ตำแหน่งของคุณเพื่อแสดงงานใกล้เคียง',
          buttonPositive: 'อนุญาต',
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
    // iOS: handled by geolocation lib
    return true;
  }, []);

  const getLocation = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        setError('ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง');
        setLoading(false);
        return;
      }
      const G = getGeolocationSync();
      if (!G) {
        setError('Geolocation native module not available (Expo Go). Use a development build or run on a device with the native module installed.');
        setLoading(false);
        return;
      }

      G.getCurrentPosition(
        (pos: any) => {
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
          setLoading(false);
        },
        (err: any) => {
          setError(err.message);
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
      );
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  }, [requestPermission]);

  return { location, loading, error, getLocation };
}
