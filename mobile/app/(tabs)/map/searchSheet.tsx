import React, { useRef, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
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
  isHome?: boolean;
};

type SearchBottomSheetProps = {
  visible: boolean;
  searchText: string;
  suggestions: MapboxSuggestion[];
  loading: boolean;
  savedLocations: SavedLocation[];
  selectedSavedPlaceId: string | null;
  onSelectSavedPlace: (location: SavedLocation) => void;
  onSelectSuggestion: (suggestion: MapboxSuggestion) => void;
  onClose: () => void;
};

// ── Category icon map ─────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function SearchBottomSheet({
  visible,
  searchText,
  suggestions,
  loading,
  savedLocations,
  selectedSavedPlaceId,
  onSelectSavedPlace,
  onSelectSuggestion,
  onClose,
}: SearchBottomSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const insets = useSafeAreaInsets();

  // Two snap points: half-screen for saved places, near-full for typing suggestions
  const snapPoints = useMemo(() => ['42%', '82%'], []);

  const isTyping = searchText.trim().length > 0;

  useEffect(() => {
    if (visible) {
      // Snap to taller position when user is actively typing suggestions
      sheetRef.current?.snapToIndex(isTyping ? 1 : 0);
    } else {
      sheetRef.current?.close();
    }
  }, [visible, isTyping]);

  // ── Suggestion row ──────────────────────────────────────────────────────────
  const renderSuggestion = ({ item }: { item: MapboxSuggestion }) => (
    <TouchableOpacity
      style={styles.suggestionRow}
      onPress={() => onSelectSuggestion(item)}
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

  // ── Empty state ─────────────────────────────────────────────────────────────
  const renderEmpty = () => {
    if (loading) return null; // spinner shown in header
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
      // Keyboard-aware: sheet rises above keyboard
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
              const selected = selectedSavedPlaceId === loc.id;
              return (
                <TouchableOpacity
                  key={loc.id}
                  style={[
                    styles.savedChip,
                    selected && styles.savedChipSelected,
                    loc.isHome && !selected && styles.savedChipHome,
                  ]}
                  onPress={() => onSelectSavedPlace(loc)}
                  activeOpacity={0.82}
                >
                  <Ionicons
                    name={loc.icon}
                    size={13}
                    color={selected || loc.isHome ? '#FFFFFF' : '#4B5563'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.savedChipText,
                      (selected || loc.isHome) && styles.savedChipTextLight,
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
      {savedLocations.length > 0 && (
        <View style={styles.divider} />
      )}

      {/* ── Suggestions Header ────────────────────────────────────────────── */}
      <View style={styles.suggestionsHeader}>
        <Text style={styles.sectionLabel}>
          {isTyping ? 'Suggestions' : 'Start typing to search'}
        </Text>
        {loading && (
          <ActivityIndicator size="small" color="#F58500" style={{ marginLeft: 8 }} />
        )}
      </View>

      {/* ── Suggestions List ──────────────────────────────────────────────── */}
      <BottomSheetFlatList
        data={suggestions}
        keyExtractor={(item) => item.placeId}
        renderItem={renderSuggestion}
        ListEmptyComponent={renderEmpty}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.rowSeparator} />}
      />
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
});