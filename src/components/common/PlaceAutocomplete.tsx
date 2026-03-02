// ============================================
// PLACE AUTOCOMPLETE COMPONENT - Google Places API only
// ============================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { searchPlacesGoogle, getPlaceDetailsGoogle, PlaceResult } from '../../services/placesService';

// Re-export PlaceResult type for compatibility
interface LocalPlaceResult {
  name: string;
  province: string;
  district: string;
  address?: string;
  lat?: number;
  lng?: number;
  place_id?: string;
}

interface PlaceAutocompleteProps {
  value: string;
  onSelect: (place: LocalPlaceResult) => void;
  placeholder?: string;
  label?: string;
  error?: string;
}

// Debounce helper
function debounce<T extends (...args: any[]) => any>(func: T, wait: number) {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function PlaceAutocomplete({
  value,
  onSelect,
  placeholder = 'ค้นหาโรงพยาบาล/คลินิก/สถานที่...',
  label,
  error,
}: PlaceAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<LocalPlaceResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [apiError, setApiError] = useState(false);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Search using Google Places API only
  const searchOnlineDebounced = useCallback(
    debounce(async (text: string) => {
      if (!text || text.length < 2) {
        setIsLoading(false);
        return;
      }

      setApiError(false);
      try {
        const apiResults = await searchPlacesGoogle(text);
        setResults(apiResults);
        setShowResults(true);
      } catch (err) {
        console.error('Place search error:', err);
        setApiError(true);
        setResults([]);
        setShowResults(true);
      } finally {
        setIsLoading(false);
      }
    }, 500),
    []
  );

  const handleTextChange = (text: string) => {
    setQuery(text);
    
    if (!text || text.length < 1) {
      setResults([]);
      setShowResults(false);
      setIsLoading(false);
      setApiError(false);
      return;
    }

    if (text.length >= 2) {
      setIsLoading(true);
      searchOnlineDebounced(text);
    } else {
      // น้อยกว่า 2 ตัวอักษร ยังไม่ค้นหา แต่อาจล้างผลลัพธ์เก่า
      setResults([]);
      setShowResults(false);
    }
  };

  const handleSelect = async (place: LocalPlaceResult) => {
    setQuery(place.name);
    setShowResults(false);
    Keyboard.dismiss();
    // Fetch lat/lng in background if we have a place_id (only fires once on selection)
    if (place.place_id) {
      try {
        const details = await getPlaceDetailsGoogle(place.place_id);
        if (details) {
          onSelect({
            ...place,
            lat: details.lat,
            lng: details.lng,
            province: details.province || place.province,
            district: details.district || place.district,
          });
          return;
        }
      } catch (_) { /* fall through */ }
    }
    onSelect(place);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    setApiError(false);
    onSelect({ name: '', province: '', district: '' });
  };

  const renderResultItem = ({ item }: { item: LocalPlaceResult }) => (
    <TouchableOpacity
      style={styles.resultItem}
      onPress={() => handleSelect(item)}
      activeOpacity={0.7}
    >
      <View style={styles.resultIcon}>
        <Ionicons name="location" size={20} color={COLORS.primary} />
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultName} numberOfLines={1}>
          {item.name}
        </Text>
        {(item.district || item.province) && (
          <Text style={styles.resultAddress} numberOfLines={1}>
            {item.district ? `${item.district}, ` : ''}{item.province}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={[styles.inputContainer, error && styles.inputError]}>
        <Ionicons
          name="search-outline"
          size={20}
          color={COLORS.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={query}
          onChangeText={handleTextChange}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          onFocus={() => query.length >= 2 && setShowResults(true)}
        />
        {isLoading ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : query.length > 0 ? (
          <TouchableOpacity onPress={handleClear}>
            <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

      {/* Results dropdown — use ScrollView instead of FlatList to avoid VirtualizedList nesting warning */}
      {showResults && results.length > 0 && (
        <View style={styles.resultsContainer}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={styles.resultsList}
            nestedScrollEnabled
          >
            {results.map((item, index) => (
              <React.Fragment key={`${item.name}-${index}`}>
                {renderResultItem({ item })}
                {index < results.length - 1 && <View style={styles.separator} />}
              </React.Fragment>
            ))}
          </ScrollView>
        </View>
      )}

      {/* No results / error panel */}
      {showResults && results.length === 0 && !isLoading && (
        <View style={styles.noResultsContainer}>
          {apiError ? (
            <>
              <Ionicons name="wifi-outline" size={28} color={COLORS.textMuted} />
              <Text style={styles.noResultsText}>เชื่อมต่อ Google Maps ไม่ได้</Text>
              <Text style={styles.noResultsHint}>ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต</Text>
            </>
          ) : (
            <>
              <Ionicons name="search-outline" size={28} color={COLORS.textMuted} />
              <Text style={styles.noResultsText}>ไม่พบสถานที่</Text>
              <Text style={styles.noResultsHint}>ลองพิมพ์ชื่อเต็มหรือพิมพ์เป็นภาษาอังกฤษ</Text>
            </>
          )}
          <TouchableOpacity
            style={styles.useTypedButton}
            onPress={() => handleSelect({ name: query, province: '', district: '' })}
          >
            <Text style={styles.useTypedText}>ใช้ชื่อที่พิมพ์: "{query}"</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ============================================
// Quick Place Picker (Popular hospitals)
// ============================================
interface QuickPlacePickerProps {
  province?: string;
  onSelect: (place: PlaceResult) => void;
}

// QuickPlacePicker — no longer uses a local database.
// Returns null; kept for API compatibility.
export function QuickPlacePicker(_props: QuickPlacePickerProps) {
  return null;
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 100,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputError: {
    borderColor: COLORS.danger,
  },
  searchIcon: {
    marginRight: SPACING.sm,
  },
  input: {
    flex: 1,
    paddingVertical: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  errorText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.danger,
    marginTop: SPACING.xs,
  },
  resultsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.xs,
    maxHeight: 250,
    ...SHADOWS.medium,
    zIndex: 1000,
  },
  resultsList: {
    borderRadius: BORDER_RADIUS.md,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
  },
  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.sm,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  resultAddress: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.md,
  },
  noResultsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    marginTop: SPACING.xs,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOWS.medium,
    zIndex: 1000,
  },
  noResultsText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  noResultsHint: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
  useTypedButton: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  useTypedText: {
    color: '#FFF',
    fontWeight: '700',
  },


});

export default PlaceAutocomplete;
