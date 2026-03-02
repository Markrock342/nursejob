// ============================================
// GEOHASH UTILITY — Pure TypeScript
// ใช้สำหรับ proximity search "งานใกล้ตัว"
// ไม่มี external dependency
// ============================================

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Encode lat/lng coordinates เป็น geohash string
 * @param lat  latitude  (ละติจูด)
 * @param lng  longitude (ลองจิจูด)
 * @param precision  ความละเอียด:
 *   1 ≈ 2500km  |  4 ≈ 40km  |  5 ≈ 5km  |  6 ≈ 1.2km  |  7 ≈ 150m
 */
export function encodeGeohash(lat: number, lng: number, precision = 5): string {
  let idx = 0;     // index ใน BASE32
  let bit = 0;     // bit counter 0–4
  let evenBit = true;
  let geohash = '';

  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;

  while (geohash.length < precision) {
    if (evenBit) {
      // bisect E/W longitude
      const lngMid = (lngMin + lngMax) / 2;
      if (lng >= lngMid) {
        idx = idx * 2 + 1;
        lngMin = lngMid;
      } else {
        idx = idx * 2;
        lngMax = lngMid;
      }
    } else {
      // bisect N/S latitude
      const latMid = (latMin + latMax) / 2;
      if (lat >= latMid) {
        idx = idx * 2 + 1;
        latMin = latMid;
      } else {
        idx = idx * 2;
        latMax = latMid;
      }
    }
    evenBit = !evenBit;

    if (++bit === 5) {
      geohash += BASE32[idx];
      bit = 0;
      idx = 0;
    }
  }
  return geohash;
}

/**
 * Decode geohash กลับเป็น { lat, lng } (จุดกึ่งกลาง)
 */
export function decodeGeohash(geohash: string): { lat: number; lng: number } {
  let evenBit = true;
  let latMin = -90, latMax = 90;
  let lngMin = -180, lngMax = 180;

  for (const char of geohash) {
    const idx = BASE32.indexOf(char);
    if (idx === -1) throw new Error(`Invalid geohash character: ${char}`);

    for (let bits = 4; bits >= 0; bits--) {
      const bitN = (idx >> bits) & 1;
      if (evenBit) {
        const lngMid = (lngMin + lngMax) / 2;
        if (bitN === 1) lngMin = lngMid;
        else lngMax = lngMid;
      } else {
        const latMid = (latMin + latMax) / 2;
        if (bitN === 1) latMin = latMid;
        else latMax = latMid;
      }
      evenBit = !evenBit;
    }
  }

  return {
    lat: (latMin + latMax) / 2,
    lng: (lngMin + lngMax) / 2,
  };
}

/**
 * คืน array ของ geohash ที่ต้องใช้ใน Firestore query
 * เพื่อหาโพสที่อยู่ใน radius ที่กำหนด
 *
 * ใช้ใน Firestore:
 *   where('geohash', 'in', getQueryGeohashes(lat, lng, 10))
 */
export function getQueryGeohashes(lat: number, lng: number, radiusKm: number): string[] {
  // เลือก precision ตาม radius
  let precision: number;
  if (radiusKm <= 1) precision = 6;
  else if (radiusKm <= 5) precision = 5;
  else if (radiusKm <= 40) precision = 4;
  else precision = 3;

  const center = encodeGeohash(lat, lng, precision);
  const neighbors = getNeighbors(center);
  // Firestore 'in' query รองรับสูงสุด 10 values
  return [center, ...neighbors].slice(0, 9);
}

/**
 * หา geohash เพื่อนบ้านทั้ง 8 ทิศ (N, NE, E, SE, S, SW, W, NW)
 * ใช้ใน proximity search
 */
export function getNeighbors(geohash: string): string[] {
  const { lat, lng } = decodeGeohash(geohash);
  const precision = geohash.length;

  // ขนาดประมาณของ cell ที่ precision นั้น (degree)
  const latErr = 45 / Math.pow(2, 2.5 * precision - 0.5);
  const lngErr = 45 / Math.pow(2, 2.5 * precision);

  return [
    encodeGeohash(lat + latErr * 2, lng, precision),               // N
    encodeGeohash(lat + latErr * 2, lng + lngErr * 2, precision),  // NE
    encodeGeohash(lat, lng + lngErr * 2, precision),               // E
    encodeGeohash(lat - latErr * 2, lng + lngErr * 2, precision),  // SE
    encodeGeohash(lat - latErr * 2, lng, precision),               // S
    encodeGeohash(lat - latErr * 2, lng - lngErr * 2, precision),  // SW
    encodeGeohash(lat, lng - lngErr * 2, precision),               // W
    encodeGeohash(lat + latErr * 2, lng - lngErr * 2, precision),  // NW
  ];
}

/**
 * คำนวณระยะทาง (กม.) ระหว่างสองจุด ด้วยสูตร Haversine
 * ใช้ใน client-side sorting "งานใกล้สุด"
 */
export function getDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // รัศมีโลก กม.
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * แปลงระยะทางเป็น label สำหรับแสดงใน UI
 * เช่น 0.5 → "500 ม.", 2.3 → "2.3 กม."
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} ม.`;
  if (km < 10) return `${km.toFixed(1)} กม.`;
  return `${Math.round(km)} กม.`;
}
