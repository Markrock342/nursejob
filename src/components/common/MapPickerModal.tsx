// ============================================
// MAP PICKER MODAL
// Grab-style draggable map pin location picker
// - Pan map to position center pin
// - "ตำแหน่งของฉัน" jumps to GPS location
// - Confirm returns { lat, lng, address }
// ============================================

import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import MapView, { Region, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';

const { width: W, height: H } = Dimensions.get('window');

export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
  province: string;
  district: string;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (location: PickedLocation) => void;
  /** Initial coords to center on (defaults to Bangkok) */
  initialLat?: number;
  initialLng?: number;
}

const BANGKOK: Region = {
  latitude: 13.756117,
  longitude: 100.501984,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

export default function MapPickerModal({
  visible,
  onClose,
  onConfirm,
  initialLat,
  initialLng,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);

  const initRegion: Region = initialLat && initialLng
    ? { latitude: initialLat, longitude: initialLng, latitudeDelta: 0.008, longitudeDelta: 0.008 }
    : BANGKOK;

  const [region, setRegion] = useState<Region>(initRegion);
  const [isDragging, setIsDragging] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [address, setAddress] = useState<string>('');
  const [province, setProvince] = useState<string>('');
  const [district, setDistrict] = useState<string>('');

  // ── Reverse-geocode whenever region idle ─────────────────────────────
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    try {
      setIsGeocoding(true);
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (results.length > 0) {
        const r = results[0];
        // Thai: region = จังหวัด, subregion = อำเภอ/เขต
        const prov = r.region || r.city || '';
        const dist = r.subregion || r.district || r.city || '';
        setProvince(prov);
        setDistrict(dist);
        const parts = [r.name, r.street, dist, prov]
          .filter(Boolean);
        setAddress(parts.join(', '));
      } else {
        setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        setProvince('');
        setDistrict('');
      }
    } catch {
      setAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      setProvince('');
      setDistrict('');
    } finally {
      setIsGeocoding(false);
    }
  }, []);

  const handleRegionChangeComplete = useCallback((r: Region) => {
    setRegion(r);
    setIsDragging(false);
    reverseGeocode(r.latitude, r.longitude);
  }, [reverseGeocode]);

  // ── Jump to user GPS ──────────────────────────────────────────────────
  const handleMyLocation = async () => {
    try {
      setIsLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const newRegion: Region = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      };
      mapRef.current?.animateToRegion(newRegion, 600);
      setRegion(newRegion);
      reverseGeocode(loc.coords.latitude, loc.coords.longitude);
    } finally {
      setIsLocating(false);
    }
  };

  // ── Confirm ───────────────────────────────────────────────────────────
  const handleConfirm = () => {
    onConfirm({
      lat: region.latitude,
      lng: region.longitude,
      address,
      province,
      district,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        {/* MAP */}
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          loadingEnabled
          loadingIndicatorColor={colors.primary}
          moveOnMarkerPress={false}
          initialRegion={initRegion}
          onRegionChange={() => setIsDragging(true)}
          onRegionChangeComplete={handleRegionChangeComplete}
          showsUserLocation
          showsMyLocationButton={false}
          showsScale={false}
          showsCompass={false}
          rotateEnabled={false}
        />

        {/* HEADER */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity style={styles.headerClose} onPress={onClose} hitSlop={{ top: 12, left: 12, right: 12, bottom: 12 }}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>เลือกตำแหน่ง</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* CENTER PIN */}
        <View pointerEvents="none" style={styles.pinContainer}>
          {/* Shadow dot on ground */}
          <View style={[styles.pinShadow, isDragging && styles.pinShadowDragging]} />
          {/* Pin icon — floats up when dragging */}
          <View style={[styles.pin, isDragging && styles.pinDragging]}>
            <Ionicons name="location" size={40} color={COLORS.primary} />
          </View>
        </View>

        {/* ADDRESS CARD */}
        <View style={[styles.addressCard, { bottom: insets.bottom + 20 + 80 }]}>
          {isGeocoding || isDragging ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="location-outline" size={18} color={COLORS.primary} />
              <Text style={styles.addressText} numberOfLines={2}>
                {address || 'กำลังหาที่อยู่...'}
              </Text>
            </View>
          )}
        </View>

        {/* MY LOCATION BUTTON */}
        <TouchableOpacity
          style={[styles.myLocBtn, { bottom: insets.bottom + 20 + 80 + 72 }]}
          onPress={handleMyLocation}
          disabled={isLocating}
        >
          {isLocating
            ? <ActivityIndicator size="small" color={COLORS.primary} />
            : <Ionicons name="locate" size={22} color={COLORS.primary} />
          }
        </TouchableOpacity>

        {/* CONFIRM BUTTON */}
        <View style={[styles.confirmBar, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.confirmText}>ยืนยันตำแหน่งนี้</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Header
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  headerClose: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: '#fff',
  },

  // Center pin
  pinContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -20,
    marginTop: -48,
    alignItems: 'center',
  },
  pinShadow: {
    position: 'absolute',
    bottom: -4,
    width: 14,
    height: 6,
    borderRadius: 7,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  pinShadowDragging: {
    width: 8,
    height: 4,
    opacity: 0.15,
    bottom: -12,
  },
  pin: {
    marginBottom: 2,
  },
  pinDragging: {
    transform: [{ translateY: -8 }],
  },

  // Address card
  addressCard: {
    position: 'absolute',
    left: SPACING.md,
    right: SPACING.md,
    backgroundColor: '#fff',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minHeight: 52,
    justifyContent: 'center',
    ...SHADOWS.medium,
  },
  addressText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    lineHeight: 20,
  },

  // GPS button
  myLocBtn: {
    position: 'absolute',
    right: SPACING.md,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.medium,
  },

  // Confirm bar
  confirmBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    backgroundColor: 'rgba(255,255,255,0.97)',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: BORDER_RADIUS.xl,
    gap: 8,
  },
  confirmText: {
    color: '#fff',
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
  },
});
