// ============================================
// UTILITY FUNCTIONS
// ============================================

import { Alert, Linking, Platform } from 'react-native';
import { ERROR_MESSAGES } from '../theme';

// Format salary display
export const formatSalary = (
  min: number,
  max: number,
  unit: 'hour' | 'day' | 'month' = 'month'
): string => {
  const unitText = unit === 'hour' ? 'ชม.' : unit === 'day' ? 'วัน' : 'เดือน';
  if (min === max) {
    return `${min.toLocaleString()} บาท/${unitText}`;
  }
  return `${min.toLocaleString()}-${max.toLocaleString()} บาท/${unitText}`;
};

// Format date (Thai)
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Format time
export const formatTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Format relative time (Thai)
export const formatRelativeTime = (date: Date | string | any): string => {
  if (!date) return 'ไม่ระบุ';
  
  let d: Date;
  
  // Handle Firestore Timestamp
  if (date?.toDate && typeof date.toDate === 'function') {
    d = date.toDate();
  } else if (date instanceof Date) {
    d = date;
  } else if (typeof date === 'string') {
    d = new Date(date);
  } else if (typeof date === 'number') {
    d = new Date(date);
  } else if (date?.seconds) {
    // Firestore Timestamp object
    d = new Date(date.seconds * 1000);
  } else {
    return 'ไม่ระบุ';
  }
  
  // Check if valid date
  if (isNaN(d.getTime())) {
    return 'ไม่ระบุ';
  }
  
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'เมื่อสักครู่';
  if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
  if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
  if (diffDays < 7) return `${diffDays} วันที่แล้ว`;
  return formatDate(d);
};

// Get Firebase error message in Thai
export const getErrorMessage = (error: any): string => {
  // Extract error code from various Firebase error formats
  let code = error?.code || '';
  
  // Handle Firebase error message format: "Firebase: Error (auth/xxx)"
  if (!code && error?.message) {
    const match = error.message.match(/\(([^)]+)\)/);
    if (match) {
      code = match[1];
    }
  }
  
  // Also check for "auth/xxx" pattern directly in message
  if (!code && error?.message) {
    const authMatch = error.message.match(/(auth\/[a-z-]+)/);
    if (authMatch) {
      code = authMatch[1];
    }
  }
  
  // If we found a valid error code, return the mapped message
  if (code && ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES]) {
    return ERROR_MESSAGES[code as keyof typeof ERROR_MESSAGES];
  }
  
  // Fallback to default
  return ERROR_MESSAGES.default;
};

// Validate email
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Validate phone (Thai format)
export const isValidPhone = (phone: string): boolean => {
  const phoneRegex = /^0[0-9]{8,9}$/;
  return phoneRegex.test(phone.replace(/[-\s]/g, ''));
};

// Format phone display
export const formatPhone = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 9) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)}-${cleaned.slice(5)}`;
  }
  return phone;
};

// Open phone dialer
export const callPhone = (phone: string): void => {
  const phoneNumber = phone.replace(/[-\s]/g, '');
  Linking.openURL(`tel:${phoneNumber}`).catch(() => {
    Alert.alert('ไม่สามารถโทรได้', 'กรุณาลองใหม่อีกครั้ง');
  });
};

// Open LINE
export const openLine = (lineId: string): void => {
  const cleanId = lineId.replace('@', '');
  Linking.openURL(`https://line.me/R/ti/p/@${cleanId}`).catch(() => {
    Alert.alert('LINE ID', lineId);
  });
};

// Open Maps
export const openMaps = (address: string): void => {
  const encodedAddress = encodeURIComponent(address);
  const url = Platform.select({
    ios: `maps:0,0?q=${encodedAddress}`,
    android: `geo:0,0?q=${encodedAddress}`,
    default: `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`,
  });
  
  Linking.openURL(url as string).catch(() => {
    Alert.alert('ไม่สามารถเปิดแผนที่ได้');
  });
};

// Open Google Maps with directions
export const openMapsDirections = (destination: string): void => {
  const encodedDestination = encodeURIComponent(destination);
  // Use Google Maps directions
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving`;
  
  Linking.openURL(googleMapsUrl).catch(() => {
    // Fallback to regular map search
    openMaps(destination);
  });
};

// Open Google Maps with coordinates
export const openMapsWithCoords = (lat: number, lng: number, label?: string): void => {
  const encodedLabel = label ? encodeURIComponent(label) : '';
  const url = Platform.select({
    ios: `maps:0,0?q=${lat},${lng}${encodedLabel ? `(${encodedLabel})` : ''}`,
    android: `geo:${lat},${lng}?q=${lat},${lng}${encodedLabel ? `(${encodedLabel})` : ''}`,
    default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  });
  
  Linking.openURL(url as string).catch(() => {
    Alert.alert('ไม่สามารถเปิดแผนที่ได้');
  });
};

// Open Google Maps directions with coordinates
export const openMapsDirectionsWithCoords = (lat: number, lng: number): void => {
  const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  
  Linking.openURL(googleMapsUrl).catch(() => {
    Alert.alert('ไม่สามารถเปิดแผนที่ได้');
  });
};

// Truncate text
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

// Generate unique ID
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Debounce function
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Capitalize first letter
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

// Get initials from name
export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Check if string is empty or whitespace
export const isEmpty = (str: string | undefined | null): boolean => {
  return !str || str.trim().length === 0;
};

// Calculate distance (simplified)
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Format distance
export const formatDistance = (km: number): string => {
  if (km < 1) {
    return `${Math.round(km * 1000)} ม.`;
  }
  return `${km.toFixed(1)} กม.`;
};

// Sleep/delay
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Safe JSON parse
export const safeJsonParse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
};

// Array helpers
export const uniqueArray = <T>(arr: T[]): T[] => [...new Set(arr)];

export const shuffleArray = <T>(arr: T[]): T[] => {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

// Form validation
export interface ValidationResult {
  isValid: boolean;
  errors: { [key: string]: string };
}

export const validateLoginForm = (email: string, password: string): ValidationResult => {
  const errors: { [key: string]: string } = {};
  
  if (isEmpty(email)) {
    errors.email = 'กรุณากรอกอีเมล';
  } else if (!isValidEmail(email)) {
    errors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
  }
  
  if (isEmpty(password)) {
    errors.password = 'กรุณากรอกรหัสผ่าน';
  } else if (password.length < 8) {
    errors.password = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateRegisterForm = (
  email: string,
  password: string,
  confirmPassword: string,
  displayName: string
): ValidationResult => {
  const errors: { [key: string]: string } = {};
  
  if (isEmpty(displayName)) {
    errors.displayName = 'กรุณากรอกชื่อ';
  } else if (displayName.length < 2) {
    errors.displayName = 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร';
  }
  
  if (isEmpty(email)) {
    errors.email = 'กรุณากรอกอีเมล';
  } else if (!isValidEmail(email)) {
    errors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
  }
  
  if (isEmpty(password)) {
    errors.password = 'กรุณากรอกรหัสผ่าน';
  } else if (password.length < 8) {
    errors.password = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
  }
  
  if (password !== confirmPassword) {
    errors.confirmPassword = 'รหัสผ่านไม่ตรงกัน';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
