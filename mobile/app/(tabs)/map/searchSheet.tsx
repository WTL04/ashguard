import React, { useRef, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Platform,
} from 'react-native';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

// ── Types ─────────────────────────────────────────────────────────────────────

import { type MapboxSuggestion } from '@/lib/useMapboxSearch';

type SavedLocation = {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  coordinate: [number, number];
  address?: string;
  isHome?: boolean;
};

// The unified "selected item" shown in the card — covers both saved places
// and address suggestions.
type SelectedItem = {
  title: string;
  address: string;
  coordinate: [number, number];
  icon: keyof typeof Ionicons.glyphMap;
  distanceMeters?: number | null;
  isHome?: boolean;
  isSaved?: boolean;
};

type SearchBottomSheetProps = {
  visible: boolean;
  searchText: string;
  suggestions: MapboxSuggestion[];
  loading: boolean;
  savedLocations: SavedLocation[];
  selectedSavedPlaceId: string | null;
  currentLocation?: [number, number] | null;
  onSelectSavedPlace: (location: SavedLocation) => void;
  onSelectSuggestion: (suggestion: MapboxSuggestion) => void;
  onClose: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const toRadians = (value: number) => (value * Math.PI) / 180;

const getDistanceMetersBetweenCoords = (
  from: [number, number],
  to: [number, number]
): number => {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;

  const R = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const formatDistanceMiles = (distanceMeters?: number | null): string | null => {
  if (distanceMeters == null) return null;
  return `${(distanceMeters / 1609.34).toFixed(1)} mi`;
};

const getCategoryIcon = (category?: string): keyof typeof Ionicons.glyphMap => {
  switch (category) {
    case 'city':
    case 'county':
    case 'state':
      return 'business-outline';
    case 'street':
    case 'road':
      return 'navigate-outline';
    case 'amenity':
    case 'leisure':
      return 'storefront-outline';
    case 'postcode':
      return 'mail-outline';
    default:
      return 'location-outline';
  }
};

/**
 * Opens the native Maps app with directions to a coordinate.
 * Falls back to Google Maps web if the native URL is unsupported.
 */
function openDirectionsToCoord(
  coordinate: [number, number],
  label: string
) {
  const [lon, lat] = coordinate;
  const encodedLabel = encodeURIComponent(label);

  const url =
    Platform.OS === 'ios'
      ? `maps://?daddr=${lat},${lon}&q=${encodedLabel}`
      : `geo:${lat},${lon}?q=${lat},${lon}(${encodedLabel})`;

  Linking.canOpenURL(url).then((supported) => {
    if (supported) {
      Linking.openURL(url);
    } else {
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`
      );
    }
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SearchBottomSheet({
  visible,
  searchText,
  suggestions,
  loading,
  savedLocations,
  selectedSavedPlaceId,
  currentLocation,
  onSelectSavedPlace,
  onSelectSuggestion,
  onClose,
}: SearchBottomSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

  // Tracks the item currently shown in the selected card (saved place OR suggestion)
  const [selectedItem, setSelectedItem] = useState<SelectedItem | null>(null);

  // Two snap points: half-screen for saved places / selected card, near-full for typing
const snapPoints = useMemo(() => ['42%', '60%', '82%'], []);

const isTyping = searchText.trim().length > 0;
const showCard = !!selectedItem;

useEffect(() => {
  if (!visible) {
    sheetRef.current?.close();
    return;
  }

  if (isTyping) {
    sheetRef.current?.snapToIndex(2);
  } else if (showCard) {
    sheetRef.current?.snapToIndex(1);
  } else {
    sheetRef.current?.snapToIndex(0);
  }
}, [visible, isTyping, showCard]);

  // Clear selected item whenever the search sheet closes
  useEffect(() => {
    if (!visible) setSelectedItem(null);
  }, [visible]);


  useEffect(() => {
    if (selectedItem) {
      setSelectedItem(null);
    }
  }, [isTyping]);

  // ── Internal handlers ────────────────────────────────────────────────────────

  const handleSavedPlaceTap = (loc: SavedLocation) => {
    setSelectedItem({
      title: loc.label,
      address: loc.address ?? loc.label,
      coordinate: loc.coordinate,
      icon: loc.icon,
      distanceMeters: currentLocation
        ? getDistanceMetersBetweenCoords(currentLocation, loc.coordinate)
        : null,
      isHome: loc.isHome,
      isSaved: true,
    });

    sheetRef.current?.snapToIndex(1);
    onSelectSavedPlace(loc);
  };

  const handleSuggestionTap = (suggestion: MapboxSuggestion) => {
    setSelectedItem({
      title: suggestion.shortLabel,
      address: suggestion.label,
      coordinate: suggestion.coords as [number, number],
      icon: getCategoryIcon(suggestion.category),
      distanceMeters: currentLocation
        ? getDistanceMetersBetweenCoords(
            currentLocation,
            suggestion.coords as [number, number]
          )
        : null,
    });

    sheetRef.current?.snapToIndex(1);
    onSelectSuggestion(suggestion);
  };

  const handleClearCard = () => {
    setSelectedItem(null);
  };

  // ── Sub-renders ──────────────────────────────────────────────────────────────

  // Selected card — matches resourcesSlider's selectedCard layout exactly:
  // bold title + × close | address line | orange Get Directions button
  const renderSelectedCard = () => {
    if (!selectedItem) return null;

    return (
      <View style={styles.selectedCard}>
        {/* Row 1: title + close — mirrors selectedCardHeader in resourcesSlider */}
        <View style={styles.selectedCardHeader}>
          <Text style={styles.selectedCardTitle} numberOfLines={1}>
            {selectedItem.title}
          </Text>
          <TouchableOpacity
            onPress={handleClearCard}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="close-circle" size={22} color="#6B7280" />
          </TouchableOpacity>
        </View>

        {/* Row 2: address — mirrors selectedCardAddress in resourcesSlider */}
        {!!selectedItem.address && (
          <Text style={styles.selectedCardAddress} numberOfLines={2}>
            {selectedItem.address}
          </Text>
        )}

        {selectedItem.distanceMeters != null && (
          <View style={styles.selectedCardMeta}>
            <Text style={styles.selectedCardMetaText}>
              {formatDistanceMiles(selectedItem.distanceMeters)}
            </Text>
          </View>
        )}

        {/* Row 3: full-width orange Get Directions — mirrors directionsButton */}
        <TouchableOpacity
          style={styles.directionsButton}
          onPress={() =>
            openDirectionsToCoord(selectedItem.coordinate, selectedItem.title)
          }
          activeOpacity={0.82}
        >
          <Ionicons
            name="navigate"
            size={15}
            color="#FFFFFF"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.directionsButtonText}>Get Directions</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // Suggestion row
  const renderSuggestion = ({ item }: { item: MapboxSuggestion }) => (
    <TouchableOpacity
      style={styles.suggestionRow}
      onPress={() => handleSuggestionTap(item)}
      activeOpacity={0.75}
    >
      <View style={styles.suggestionIconWrap}>
        <Ionicons
          name={getCategoryIcon(item.category)}
          size={16}
          color="#6B7280"
        />
      </View>
      <View style={styles.suggestionText}>
        <Text style={styles.suggestionLabel} numberOfLines={1}>
          {item.shortLabel}
        </Text>
        <Text style={styles.suggestionSubLabel} numberOfLines={1}>
          {item.label}
        </Text>
      </View>
      <Ionicons name="arrow-forward-outline" size={14} color="#D1D5DB" />
    </TouchableOpacity>
  );

  // Empty state
  const renderEmpty = () => {
    if (loading) return null;
    if (isTyping) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={32} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>No results found</Text>
          <Text style={styles.emptySubtitle}>
            Try a different address or place name
          </Text>
        </View>
      );
    }
    if (showCard) return null; // card is visible, no empty state needed
    return (
      <View style={styles.emptyState}>
        <Ionicons name="map-outline" size={32} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>Search AshGuard</Text>
        <Text style={styles.emptySubtitle}>
          Find fires, resources, or any address in California
        </Text>
      </View>
    );
  };

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      topInset={insets.top}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.background}
      android_keyboardInputMode="adjustResize"
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
    >
      {/* ── Saved Places Row ───────────────────────────────────────────────── */}
      {savedLocations.length > 0 && (
        <View style={styles.savedSection}>
          <Text style={styles.sectionLabel}>Saved Places</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.savedRow}
            keyboardShouldPersistTaps="handled"
          >
            {savedLocations.map((loc) => {
              const isSelected = selectedItem?.isSaved
                ? selectedItem.title === loc.label
                : selectedSavedPlaceId === loc.id;
              return (
                <TouchableOpacity
                  key={loc.id}
                  style={[
                    styles.savedChip,
                    isSelected && styles.savedChipSelected,
                    loc.isHome && !isSelected && styles.savedChipHome,
                  ]}
                  onPress={() => handleSavedPlaceTap(loc)}
                  activeOpacity={0.82}
                >
                  <Ionicons
                    name={loc.icon}
                    size={13}
                    color={isSelected || loc.isHome ? '#FFFFFF' : '#4B5563'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.savedChipText,
                      (isSelected || loc.isHome) && styles.savedChipTextLight,
                    ]}
                    numberOfLines={1}
                  >
                    {loc.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Divider ───────────────────────────────────────────────────────── */}
      {savedLocations.length > 0 && <View style={styles.divider} />}

      {/* ── Selected place / suggestion card ──────────────────────────────── */}
      {showCard && (
        <View style={styles.cardSection}>
          {renderSelectedCard()}
        </View>
      )}

      {/* ── Suggestions header (hidden when card is shown) ────────────────── */}
      {!showCard && (
        <View style={styles.suggestionsHeader}>
          <Text style={styles.sectionLabel}>
            {isTyping ? 'Suggestions' : 'Start typing to search'}
          </Text>
          {loading && (
            <ActivityIndicator
              size="small"
              color="#F58500"
              style={{ marginLeft: 8 }}
            />
          )}
        </View>
      )}

      {/* ── Suggestions List (hidden when card is shown) ──────────────────── */}
      {!showCard && (
        <BottomSheetFlatList
          data={suggestions}
          keyExtractor={(item) => item.placeId}
          renderItem={renderSuggestion}
          ListEmptyComponent={renderEmpty}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
        />
      )}
    </BottomSheet>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },

  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
  },

  // ── Saved Places ───────────────────────────────────────────────────────────
  savedSection: {
    paddingTop: 4,
    paddingBottom: 4,
  },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 4,
  },

  savedRow: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 4,
  },

  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  savedChipHome: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },

  savedChipSelected: {
    backgroundColor: '#7C3AED',
    borderColor: '#7C3AED',
  },

  savedChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    maxWidth: 120,
  },

  savedChipTextLight: {
    color: '#FFFFFF',
  },

  // ── Divider ────────────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
    marginVertical: 4,
  },

  // ── Selected card (mirrors resourcesSlider selectedCard) ───────────────────
  cardSection: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },

  selectedCard: {
    marginTop: 4,
    backgroundColor: '#FFF7ED',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: '#F58500',
  },

  selectedCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  selectedCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },

  selectedCardAddress: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 6,
    lineHeight: 18,
  },

  directionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    backgroundColor: '#F58500',
    borderRadius: 10,
    paddingVertical: 9,
  },

  directionsButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Suggestions ────────────────────────────────────────────────────────────
  suggestionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },

  listContent: {
    paddingBottom: 32,
  },

  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },

  suggestionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },

  suggestionText: {
    flex: 1,
    marginRight: 8,
  },

  suggestionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },

  suggestionSubLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  rowSeparator: {
    height: 1,
    backgroundColor: '#F9FAFB',
    marginLeft: 62,
  },

  // ── Empty State ────────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    paddingHorizontal: 32,
  },

  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginTop: 12,
    marginBottom: 6,
  },

  emptySubtitle: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 19,
  },
  selectedCardMeta: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },

  selectedCardMetaText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
});