// ============================================
// PLACES SERVICE - Google Places API + Longdo Map API
// ============================================
// Google Places: Free $200/month credit (~28,000 requests)
// Longdo (Fallback): 100,000 requests/month free

import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import { getCurrentGooglePlacesLanguage } from '../i18n';

// API Keys
const GOOGLE_PLACES_API_KEY = Constants.expoConfig?.extra?.googlePlacesApiKey || 
  process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || 
  'AIzaSyAJVBDwB2sl0XJc3FTvLi_l7lsOGgHBfwc';

const LONGDO_API_KEY = Constants.expoConfig?.extra?.longdoApiKey || process.env.EXPO_PUBLIC_LONGDO_API_KEY || '';

if (!GOOGLE_PLACES_API_KEY) {
  console.warn('⚠️ GOOGLE_PLACES_API_KEY not configured');
}

const LONGDO_SEARCH_API = 'https://search.longdo.com/mapsearch/json/search';
const LONGDO_SUGGEST_API = 'https://search.longdo.com/mapsearch/json/suggest';

export interface PlaceResult {
  name: string;
  province: string;
  district: string;
  address?: string;
  lat?: number;
  lng?: number;
  type?: string;
  place_id?: string;
}

export interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export interface PlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  geometry?: {
    location: {
      lat: number;
      lng: number;
    };
  };
  address_components?: {
    long_name: string;
    short_name: string;
    types: string[];
  }[];
}

// ============================================
// GOOGLE PLACES API - Autocomplete & Details
// ============================================
const GOOGLE_PLACES_AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const GOOGLE_PLACES_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

/**
 * Search places using Google Places Autocomplete API
 * Focused on hospitals and healthcare facilities in Thailand
 * 
 * NOTE: Google Places API JSON endpoint doesn't support CORS (browser)
 * - On Web: Uses local Thai hospital database only
 * - On Mobile (iOS/Android): Uses Google Places API
 */
export async function searchPlacesGoogle(query: string): Promise<PlaceResult[]> {
  if (!query || query.length < 2) return [];
  
  // On Web, Google Places API has CORS issues — return empty and let user type freely.
  if (Platform.OS === 'web') {
    return [];
  }
  
  try {
    const params = new URLSearchParams({
      input: query,
      key: GOOGLE_PLACES_API_KEY,
      language: getCurrentGooglePlacesLanguage(),
      components: 'country:th',
      // No 'types' filter — returns all: addresses, house numbers, establishments, landmarks
    });

    const response = await fetch(`${GOOGLE_PLACES_AUTOCOMPLETE_URL}?${params}`);
    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.warn('Google Places API error:', data.status, data.error_message);
      return [];
    }

    if (!data.predictions || data.predictions.length === 0) {
      return [];
    }

    // Extract province/district from prediction terms (no extra API calls needed)
    const results: PlaceResult[] = data.predictions.slice(0, 7).map((prediction: any) => {
      const terms: { value: string }[] = prediction.terms || [];
      // terms order: [name, ..., district, province, "ประเทศไทย"]
      const province = terms.length >= 2 ? terms[terms.length - 2]?.value || '' : '';
      const district = terms.length >= 3 ? terms[terms.length - 3]?.value || '' : '';
      return {
        name: prediction.structured_formatting?.main_text || prediction.description,
        province,
        district,
        address: prediction.description,
        lat: undefined,
        lng: undefined,
        type: 'google',
        place_id: prediction.place_id,
      };
    });

    return results;
  } catch (error) {
    console.error('Error searching Google Places:', error);
    return [];
  }
}

/**
 * Get place details from Google Places API
 */
export async function getPlaceDetailsGoogle(placeId: string): Promise<{
  name: string;
  address: string;
  province: string;
  district: string;
  lat: number;
  lng: number;
} | null> {
  try {
    const params = new URLSearchParams({
      place_id: placeId,
      key: GOOGLE_PLACES_API_KEY,
      language: getCurrentGooglePlacesLanguage(),
      fields: 'name,formatted_address,geometry,address_components',
    });

    const response = await fetch(`${GOOGLE_PLACES_DETAILS_URL}?${params}`);
    const data = await response.json();

    if (data.status !== 'OK' || !data.result) {
      return null;
    }

    const result = data.result;
    const components = result.address_components || [];

    // Extract province (administrative_area_level_1)
    const provinceComp = components.find((c: any) => 
      c.types.includes('administrative_area_level_1')
    );
    let province = provinceComp?.long_name || '';
    // Clean province name
    province = province.replace(/^จังหวัด/, '').trim();

    // Extract district (administrative_area_level_2 or sublocality_level_1)
    const districtComp = components.find((c: any) => 
      c.types.includes('administrative_area_level_2') ||
      c.types.includes('sublocality_level_1') ||
      c.types.includes('locality')
    );
    let district = districtComp?.long_name || '';
    // Clean district name
    district = district.replace(/^เขต/, '').replace(/^อำเภอ/, '').trim();

    return {
      name: result.name,
      address: result.formatted_address,
      province,
      district,
      lat: result.geometry?.location?.lat || 0,
      lng: result.geometry?.location?.lng || 0,
    };
  } catch (error) {
    console.error('Error getting place details:', error);
    return null;
  }
}

/**
 * Open Google Maps for navigation
 */
export async function openGoogleMapsNavigation(
  destination: { lat: number; lng: number; name?: string }
): Promise<boolean> {
  try {
    const { lat, lng, name } = destination;
    
    // Try Google Maps app first
    const googleMapsUrl = Platform.select({
      ios: `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`,
      android: `google.navigation:q=${lat},${lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });

    const canOpen = await Linking.canOpenURL(googleMapsUrl);
    
    if (canOpen) {
      await Linking.openURL(googleMapsUrl);
      return true;
    }

    // Fallback to web URL
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}${name ? `&destination_place_id=${encodeURIComponent(name)}` : ''}`;
    await Linking.openURL(webUrl);
    return true;
  } catch (error) {
    console.error('Error opening Google Maps:', error);
    return false;
  }
}

/**
 * Open place in Google Maps (view location)
 */
export async function openInGoogleMaps(
  location: { lat: number; lng: number; name?: string }
): Promise<boolean> {
  try {
    const { lat, lng, name } = location;
    const query = name ? encodeURIComponent(name) : `${lat},${lng}`;
    
    const url = Platform.select({
      ios: `comgooglemaps://?q=${query}&center=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${query}`,
      default: `https://www.google.com/maps/search/?api=1&query=${query}`,
    });

    const canOpen = await Linking.canOpenURL(url);
    
    if (canOpen) {
      await Linking.openURL(url);
      return true;
    }

    // Fallback to web
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
    return true;
  } catch (error) {
    console.error('Error opening Google Maps:', error);
    return false;
  }
}

// Legacy autocomplete helper – map Google search results ให้เป็น prediction เดิม
export async function getPlacePredictions(
  input: string,
  types: string = 'establishment'
): Promise<PlacePrediction[]> {
  const results = await searchPlacesGoogle(input);
  return results.map((r, index) => ({
    place_id: `google_${index}`,
    description: `${r.name}, ${r.district} ${r.province}`.trim(),
    structured_formatting: {
      main_text: r.name,
      secondary_text: `${r.district} ${r.province}`.trim(),
    },
  }));
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  // Wrapper เพื่อความเข้ากันได้กับโค้ดเดิม ถ้าจำเป็นต้องใช้ในอนาคต
  console.warn('getPlaceDetails is deprecated. Use getPlaceDetailsGoogle instead.');
  return null;
}

// Extract province from address components
export function extractProvince(addressComponents: PlaceDetails['address_components']): string {
  if (!addressComponents) return '';
  const province = addressComponents.find(
    (comp) => comp.types.includes('administrative_area_level_1')
  );
  return province?.long_name || '';
}

// Extract district from address components
export function extractDistrict(addressComponents: PlaceDetails['address_components']): string {
  if (!addressComponents) return '';
  const district = addressComponents.find(
    (comp) => comp.types.includes('administrative_area_level_2') ||
              comp.types.includes('sublocality_level_1') ||
              comp.types.includes('locality')
  );
  return district?.long_name || '';
}

// ============================================
// Thai Hospital/Clinic Database (Fallback)
// ============================================
// เมื่อไม่มี API Key หรือ API ไม่ทำงาน จะใช้ข้อมูลนี้แทน

export const THAI_HOSPITALS: { name: string; province: string; district: string }[] = [
  // กรุงเทพมหานคร
  { name: 'โรงพยาบาลศิริราช', province: 'กรุงเทพมหานคร', district: 'บางกอกน้อย' },
  { name: 'โรงพยาบาลจุฬาลงกรณ์', province: 'กรุงเทพมหานคร', district: 'ปทุมวัน' },
  { name: 'โรงพยาบาลรามาธิบดี', province: 'กรุงเทพมหานคร', district: 'ราชเทวี' },
  { name: 'โรงพยาบาลพระมงกุฎเกล้า', province: 'กรุงเทพมหานคร', district: 'ราชเทวี' },
  { name: 'โรงพยาบาลราชวิถี', province: 'กรุงเทพมหานคร', district: 'ราชเทวี' },
  { name: 'โรงพยาบาลภูมิพลอดุลยเดช', province: 'กรุงเทพมหานคร', district: 'สายไหม' },
  { name: 'โรงพยาบาลตำรวจ', province: 'กรุงเทพมหานคร', district: 'ปทุมวัน' },
  { name: 'โรงพยาบาลกลาง', province: 'กรุงเทพมหานคร', district: 'ป้อมปราบฯ' },
  { name: 'โรงพยาบาลเจริญกรุงประชารักษ์', province: 'กรุงเทพมหานคร', district: 'บางคอแหลม' },
  { name: 'โรงพยาบาลตากสิน', province: 'กรุงเทพมหานคร', district: 'คลองสาน' },
  { name: 'โรงพยาบาลวชิรพยาบาล', province: 'กรุงเทพมหานคร', district: 'ดุสิต' },
  { name: 'โรงพยาบาลนพรัตนราชธานี', province: 'กรุงเทพมหานคร', district: 'คันนายาว' },
  { name: 'โรงพยาบาลเลิดสิน', province: 'กรุงเทพมหานคร', district: 'บางรัก' },
  { name: 'โรงพยาบาลสมิติเวช สุขุมวิท', province: 'กรุงเทพมหานคร', district: 'คลองเตย' },
  { name: 'โรงพยาบาลบำรุงราษฎร์', province: 'กรุงเทพมหานคร', district: 'วัฒนา' },
  { name: 'โรงพยาบาลกรุงเทพ', province: 'กรุงเทพมหานคร', district: 'วัฒนา' },
  { name: 'โรงพยาบาลพญาไท 1', province: 'กรุงเทพมหานคร', district: 'ราชเทวี' },
  { name: 'โรงพยาบาลพญาไท 2', province: 'กรุงเทพมหานคร', district: 'พญาไท' },
  { name: 'โรงพยาบาลพญาไท 3', province: 'กรุงเทพมหานคร', district: 'ภาษีเจริญ' },
  { name: 'โรงพยาบาลเปาโล พหลโยธิน', province: 'กรุงเทพมหานคร', district: 'พญาไท' },
  { name: 'โรงพยาบาลเปาโล เกษตร', province: 'กรุงเทพมหานคร', district: 'จตุจักร' },
  { name: 'โรงพยาบาลวิภาวดี', province: 'กรุงเทพมหานคร', district: 'จตุจักร' },
  { name: 'โรงพยาบาลเวชธานี', province: 'กรุงเทพมหานคร', district: 'ห้วยขวาง' },
  { name: 'โรงพยาบาลมงกุฎวัฒนะ', province: 'กรุงเทพมหานคร', district: 'หลักสี่' },
  { name: 'โรงพยาบาลวิชัยยุทธ', province: 'กรุงเทพมหานคร', district: 'พญาไท' },
  { name: 'โรงพยาบาลเซนต์หลุยส์', province: 'กรุงเทพมหานคร', district: 'สาทร' },
  { name: 'โรงพยาบาลบีเอ็นเอช', province: 'กรุงเทพมหานคร', district: 'สาทร' },
  { name: 'โรงพยาบาลพระราม 9', province: 'กรุงเทพมหานคร', district: 'ห้วยขวาง' },
  { name: 'โรงพยาบาลลาดพร้าว', province: 'กรุงเทพมหานคร', district: 'ลาดพร้าว' },
  { name: 'โรงพยาบาลสินแพทย์', province: 'กรุงเทพมหานคร', district: 'ลาดพร้าว' },
  { name: 'โรงพยาบาลนวมินทร์', province: 'กรุงเทพมหานคร', district: 'บึงกุ่ม' },
  { name: 'โรงพยาบาลคามิลเลียน', province: 'กรุงเทพมหานคร', district: 'วัฒนา' },
  { name: 'โรงพยาบาลมิชชั่น', province: 'กรุงเทพมหานคร', district: 'พญาไท' },
  { name: 'โรงพยาบาลเซ็นทรัล เจเนอรัล', province: 'กรุงเทพมหานคร', district: 'บางพลัด' },
  { name: 'โรงพยาบาลยันฮี', province: 'กรุงเทพมหานคร', district: 'บางพลัด' },
  { name: 'โรงพยาบาลธนบุรี', province: 'กรุงเทพมหานคร', district: 'บางกอกใหญ่' },
  { name: 'โรงพยาบาลสิรินธร', province: 'กรุงเทพมหานคร', district: 'ประเวศ' },
  { name: 'โรงพยาบาลหลวงพ่อทวีศักดิ์', province: 'กรุงเทพมหานคร', district: 'หนองแขม' },
  { name: 'โรงพยาบาลราชพิพัฒน์', province: 'กรุงเทพมหานคร', district: 'บางแค' },
  { name: 'โรงพยาบาลผู้สูงอายุบางขุนเทียน', province: 'กรุงเทพมหานคร', district: 'บางขุนเทียน' },
  
  // นนทบุรี
  { name: 'โรงพยาบาลพระนั่งเกล้า', province: 'นนทบุรี', district: 'เมืองนนทบุรี' },
  { name: 'โรงพยาบาลบางใหญ่', province: 'นนทบุรี', district: 'บางใหญ่' },
  { name: 'โรงพยาบาลบางบัวทอง', province: 'นนทบุรี', district: 'บางบัวทอง' },
  { name: 'โรงพยาบาลปากเกร็ด', province: 'นนทบุรี', district: 'ปากเกร็ด' },
  { name: 'โรงพยาบาลศูนย์การแพทย์ปัญญานันทภิกขุ', province: 'นนทบุรี', district: 'ปากเกร็ด' },
  { name: 'โรงพยาบาลนนทเวช', province: 'นนทบุรี', district: 'เมืองนนทบุรี' },
  { name: 'โรงพยาบาลเกษมราษฎร์ รัตนาธิเบศร์', province: 'นนทบุรี', district: 'เมืองนนทบุรี' },
  
  // ปทุมธานี
  { name: 'โรงพยาบาลปทุมธานี', province: 'ปทุมธานี', district: 'เมืองปทุมธานี' },
  { name: 'โรงพยาบาลธรรมศาสตร์เฉลิมพระเกียรติ', province: 'ปทุมธานี', district: 'คลองหลวง' },
  { name: 'โรงพยาบาลรังสิต', province: 'ปทุมธานี', district: 'ธัญบุรี' },
  { name: 'โรงพยาบาลภัทร-ธนบุรี', province: 'ปทุมธานี', district: 'ลำลูกกา' },
  
  // สมุทรปราการ
  { name: 'โรงพยาบาลสมุทรปราการ', province: 'สมุทรปราการ', district: 'เมืองสมุทรปราการ' },
  { name: 'โรงพยาบาลบางพลี', province: 'สมุทรปราการ', district: 'บางพลี' },
  { name: 'โรงพยาบาลบางบ่อ', province: 'สมุทรปราการ', district: 'บางบ่อ' },
  { name: 'โรงพยาบาลพระสมุทรเจดีย์สวาทยานนท์', province: 'สมุทรปราการ', district: 'พระสมุทรเจดีย์' },
  { name: 'โรงพยาบาลเมืองสมุทรปากน้ำ', province: 'สมุทรปราการ', district: 'เมืองสมุทรปราการ' },
  
  // ชลบุรี
  { name: 'โรงพยาบาลชลบุรี', province: 'ชลบุรี', district: 'เมืองชลบุรี' },
  { name: 'โรงพยาบาลบางละมุง', province: 'ชลบุรี', district: 'บางละมุง' },
  { name: 'โรงพยาบาลพัทยาเมโมเรียล', province: 'ชลบุรี', district: 'บางละมุง' },
  { name: 'โรงพยาบาลกรุงเทพพัทยา', province: 'ชลบุรี', district: 'บางละมุง' },
  { name: 'โรงพยาบาลศรีราชา', province: 'ชลบุรี', district: 'ศรีราชา' },
  { name: 'โรงพยาบาลสมิติเวช ศรีราชา', province: 'ชลบุรี', district: 'ศรีราชา' },
  { name: 'โรงพยาบาลแหลมฉบัง', province: 'ชลบุรี', district: 'ศรีราชา' },
  
  // เชียงใหม่
  { name: 'โรงพยาบาลมหาราชนครเชียงใหม่', province: 'เชียงใหม่', district: 'เมืองเชียงใหม่' },
  { name: 'โรงพยาบาลนครพิงค์', province: 'เชียงใหม่', district: 'แม่ริม' },
  { name: 'โรงพยาบาลลานนา', province: 'เชียงใหม่', district: 'เมืองเชียงใหม่' },
  { name: 'โรงพยาบาลเชียงใหม่ราม', province: 'เชียงใหม่', district: 'เมืองเชียงใหม่' },
  { name: 'โรงพยาบาลแมคคอร์มิค', province: 'เชียงใหม่', district: 'เมืองเชียงใหม่' },
  { name: 'โรงพยาบาลราชเวช', province: 'เชียงใหม่', district: 'เมืองเชียงใหม่' },
  
  // ขอนแก่น
  { name: 'โรงพยาบาลศรีนครินทร์', province: 'ขอนแก่น', district: 'เมืองขอนแก่น' },
  { name: 'โรงพยาบาลขอนแก่น', province: 'ขอนแก่น', district: 'เมืองขอนแก่น' },
  { name: 'โรงพยาบาลราชพฤกษ์', province: 'ขอนแก่น', district: 'เมืองขอนแก่น' },
  { name: 'โรงพยาบาลขอนแก่นราม', province: 'ขอนแก่น', district: 'เมืองขอนแก่น' },
  
  // นครราชสีมา
  { name: 'โรงพยาบาลมหาราชนครราชสีมา', province: 'นครราชสีมา', district: 'เมืองนครราชสีมา' },
  { name: 'โรงพยาบาลเทพรัตน์นครราชสีมา', province: 'นครราชสีมา', district: 'เมืองนครราชสีมา' },
  { name: 'โรงพยาบาลกรุงเทพราชสีมา', province: 'นครราชสีมา', district: 'เมืองนครราชสีมา' },
  
  // ภูเก็ต
  { name: 'โรงพยาบาลวชิระภูเก็ต', province: 'ภูเก็ต', district: 'เมืองภูเก็ต' },
  { name: 'โรงพยาบาลกรุงเทพภูเก็ต', province: 'ภูเก็ต', district: 'เมืองภูเก็ต' },
  { name: 'โรงพยาบาลสิริโรจน์', province: 'ภูเก็ต', district: 'เมืองภูเก็ต' },
  { name: 'โรงพยาบาลมิชชั่นภูเก็ต', province: 'ภูเก็ต', district: 'เมืองภูเก็ต' },
  
  // สงขลา
  { name: 'โรงพยาบาลสงขลานครินทร์', province: 'สงขลา', district: 'หาดใหญ่' },
  { name: 'โรงพยาบาลหาดใหญ่', province: 'สงขลา', district: 'หาดใหญ่' },
  { name: 'โรงพยาบาลกรุงเทพหาดใหญ่', province: 'สงขลา', district: 'หาดใหญ่' },
  { name: 'โรงพยาบาลราษฎร์ยินดี', province: 'สงขลา', district: 'หาดใหญ่' },
  
  // ระยอง
  { name: 'โรงพยาบาลระยอง', province: 'ระยอง', district: 'เมืองระยอง' },
  { name: 'โรงพยาบาลกรุงเทพระยอง', province: 'ระยอง', district: 'เมืองระยอง' },
  
  // อุดรธานี
  { name: 'โรงพยาบาลอุดรธานี', province: 'อุดรธานี', district: 'เมืองอุดรธานี' },
  { name: 'โรงพยาบาลศรีสะเกษ', province: 'ศรีสะเกษ', district: 'เมืองศรีสะเกษ' },
  
  // เพิ่มคลินิกยอดนิยม
  { name: 'คลินิกเวชกรรม', province: 'กรุงเทพมหานคร', district: '' },
  { name: 'คลินิกทันตกรรม', province: 'กรุงเทพมหานคร', district: '' },
  { name: 'ศูนย์การแพทย์', province: 'กรุงเทพมหานคร', district: '' },
];

// Search in Thai hospitals database (fallback when no API)
export function searchThaiHospitals(query: string): typeof THAI_HOSPITALS {
  if (!query || query.length < 2) return [];
  
  const lowerQuery = query.toLowerCase();
  return THAI_HOSPITALS.filter(
    (h) => 
      h.name.toLowerCase().includes(lowerQuery) ||
      h.province.includes(query) ||
      h.district.includes(query)
  ).slice(0, 10); // Limit to 10 results
}
