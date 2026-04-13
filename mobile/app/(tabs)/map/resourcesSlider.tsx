import React, { useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Linking,
  Platform,
} from "react-native";
import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";

// ── Types ─────────────────────────────────────────────────────────────────────

import { ResourceType, ResourceFilterType, NearbyPlace } from "./resourceTypes";

type ResourceBottomSheetProps = {
  visible: boolean;
  /** When true, the sheet collapses to just the drag handle (non-resource marker is selected) */
  peekOnly?: boolean;
  isResourcesFilterActive: boolean;
  places: NearbyPlace[];
  selectedPlaceId: string | null;
  distanceRadius: number;
  resourceType: ResourceFilterType;  
  loading?: boolean;
  onChangeResourceType: (type: ResourceFilterType) => void;
  onChangeDistanceRadius: (radius: number) => void;
  onSelectPlace: (place: NearbyPlace) => void;
  onClose?: () => void;
};

// ── Resource chip config ──────────────────────────────────────────────────────

const ALL_CHIP = { type: "all" as ResourceFilterType, label: "All", icon: "apps-outline" as keyof typeof Ionicons.glyphMap };

const RESOURCE_TYPES: { type: ResourceType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { type: "hospital",    label: "Hospital",    icon: "medkit-outline" },
  { type: "pharmacy",    label: "Pharmacy",    icon: "fitness-outline" },
  { type: "gas",         label: "Gas",         icon: "car-outline" },
  { type: "grocery",     label: "Grocery",     icon: "cart-outline" },
  { type: "hotels",      label: "Hotels",      icon: "bed-outline" },
  { type: "convenience", label: "Convenience", icon: "storefront-outline" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Opens the native Maps app (Apple Maps on iOS, Google Maps on Android)
 * with walking/driving directions to the given destination.
 */
function openDirections(place: NearbyPlace) {
  const label = encodeURIComponent(place.name);
  const { latitude: lat, longitude: lng } = place;

  const url =
    Platform.OS === "ios"
      ? `maps://?daddr=${lat},${lng}&q=${label}`
      : `geo:${lat},${lng}?q=${lat},${lng}(${label})`;

  Linking.canOpenURL(url).then((supported) => {
    if (supported) {
      Linking.openURL(url);
    } else {
      // Fallback: Google Maps web
      Linking.openURL(
        `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      );
    }
  });
}

/** Render opening hours as a compact string */
function formatHours(openingHours: string | string[] | undefined): string | null {
  if (!openingHours) return null;
  if (typeof openingHours === "string") return openingHours;
  // Array of "Monday: 8:00 AM – 10:00 PM" strings — show today's entry if possible
  const dayIndex = new Date().getDay(); // 0 = Sunday
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const todayPrefix = days[dayIndex];
  const todayLine = openingHours.find((h) => h.startsWith(todayPrefix));
  if (todayLine) return todayLine.replace(`${todayPrefix}: `, "Today: ");
  return openingHours[0] ?? null;
}

function formatDistanceMiles(distanceMeters?: number): string | null {
  if (distanceMeters == null) return null;
  return `${(distanceMeters / 1609.34).toFixed(1)} mi`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ResourceBottomSheet({
  visible,
  peekOnly = false,
  isResourcesFilterActive,
  places,
  selectedPlaceId,
  distanceRadius,
  resourceType,
  loading = false,
  onChangeResourceType,
  onChangeDistanceRadius,
  onSelectPlace,
  onClose,
}: ResourceBottomSheetProps) {
    const bottomSheetRef = useRef<BottomSheet>(null);
    const snapPoints = useMemo(() => [28, "36%", "52%", "68%", "90%"], []);
    const insets = useSafeAreaInsets();

    const milesValue = Math.round(distanceRadius / 1609.34);
    const MIN_MILES = 1;
    const MAX_MILES = 50;
    const MILES_TO_METERS = 1609;
    const selectedPlace = places.find((p) => p.id === selectedPlaceId);

  useEffect(() => {
    if (peekOnly) {
      bottomSheetRef.current?.snapToIndex(0);
    } else if (visible && selectedPlace) {
      bottomSheetRef.current?.snapToIndex(1);
    } else if (visible && isResourcesFilterActive) {
      bottomSheetRef.current?.snapToIndex(2);
    } else if (visible) {
      bottomSheetRef.current?.snapToIndex(0);
    } else {
      bottomSheetRef.current?.snapToIndex(0);
    }
  }, [visible, peekOnly, selectedPlace, isResourcesFilterActive]);

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={1}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      enableContentPanningGesture={false}
      topInset={insets.top}
      handleIndicatorStyle={styles.handle}
      backgroundStyle={styles.sheetBackground}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Nearby Resources</Text>
        <Text style={styles.subtitle}>
          {loading
            ? "Loading..."
            : selectedPlace
            ? `Showing: ${selectedPlace.name}`
            : `${places.length} result${places.length !== 1 ? "s" : ""}`}
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipRow}
        >
          {[ALL_CHIP, ...RESOURCE_TYPES].map(({ type, label, icon }) => {
            const active = resourceType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => onChangeResourceType(type)}
                activeOpacity={0.75}
              >
                <Ionicons name={icon} size={14} color={active ? "#FFFFFF" : "#6B7280"} style={styles.chipIcon} />
                <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {selectedPlace && (
          <View style={styles.selectedCard}>
            <View style={styles.selectedCardHeader}>
              <Text style={styles.selectedCardTitle} numberOfLines={1}>
                {selectedPlace.name}
              </Text>
              <TouchableOpacity onPress={() => onSelectPlace(selectedPlace)}>
                <Ionicons name="close-circle" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedPlace.address ? (
              <Text style={styles.selectedCardAddress} numberOfLines={2}>
                {selectedPlace.address}
              </Text>
            ) : null}

            <View style={styles.selectedCardMeta}>
              {selectedPlace.distanceMeters != null ? (
                <Text style={styles.selectedCardMetaText}>
                  {(selectedPlace.distanceMeters / 1609.34).toFixed(1)} mi
                </Text>
              ) : null}
              {selectedPlace.rating != null ? (
                <Text style={styles.selectedCardMetaText}>
                  {"  ·  "}
                  {selectedPlace.rating.toFixed(1)} ★
                </Text>
              ) : null}
              {typeof selectedPlace.isOpen === "boolean" ? (
                <Text
                  style={[
                    styles.selectedCardMetaText,
                    selectedPlace.isOpen ? styles.openText : styles.closedText,
                  ]}
                >
                  {"  ·  "}
                  {selectedPlace.isOpen ? "Open now" : "Closed"}
                </Text>
              ) : null}
            </View>

            <TouchableOpacity
              style={styles.directionsButton}
              onPress={() => openDirections(selectedPlace)}
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
        )}

        <View style={styles.sliderContainer}>
          <View style={styles.sliderLabelRow}>
            <Text style={styles.sliderLabel}>Radius</Text>
            <Text style={styles.sliderValue}>{milesValue} mi</Text>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={MIN_MILES * MILES_TO_METERS}
            maximumValue={MAX_MILES * MILES_TO_METERS}
            step={MILES_TO_METERS}
            value={distanceRadius}
            onValueChange={onChangeDistanceRadius}
            minimumTrackTintColor="#F58500"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor="#F58500"
          />
          <View style={styles.sliderRange}>
            <Text style={styles.sliderRangeText}>1 mi</Text>
            <Text style={styles.sliderRangeText}>{MAX_MILES} mi</Text>
          </View>
        </View>
      </View>

      <BottomSheetFlatList
        data={places}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const selected = item.id === selectedPlaceId;
          const hoursString = formatHours(item.openingHours);

          return (
            <TouchableOpacity
              style={[styles.card, selected && styles.cardSelected]}
              onPress={() => onSelectPlace(item)}
              activeOpacity={0.85}
            >
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.name}
                </Text>
                {typeof item.isOpen === "boolean" && (
                  <View
                    style={[
                      styles.openBadge,
                      item.isOpen ? styles.openBadgeOpen : styles.openBadgeClosed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.openBadgeText,
                        item.isOpen
                          ? styles.openBadgeTextOpen
                          : styles.openBadgeTextClosed,
                      ]}
                    >
                      {item.isOpen ? "Open" : "Closed"}
                    </Text>
                  </View>
                )}
              </View>

              {item.address ? (
                <View style={styles.metaRow}>
                  <Ionicons
                    name="location-outline"
                    size={13}
                    color="#9CA3AF"
                    style={styles.metaIcon}
                  />
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {item.address}
                  </Text>
                </View>
              ) : null}

              {hoursString ? (
                <View style={styles.metaRow}>
                  <Ionicons
                    name="time-outline"
                    size={13}
                    color="#9CA3AF"
                    style={styles.metaIcon}
                  />
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {hoursString}
                  </Text>
                </View>
              ) : null}

              <View style={styles.cardFooter}>
                <View style={styles.row}>
                  {item.distanceMeters != null ? (
                    <View style={styles.metaRow}>
                      <Ionicons
                        name="walk-outline"
                        size={13}
                        color="#9CA3AF"
                        style={styles.metaIcon}
                      />
                      <Text style={styles.cardMeta}>
                        {(item.distanceMeters / 1609.34).toFixed(1)} mi away
                      </Text>
                    </View>
                  ) : null}
                  {item.rating != null ? (
                    <Text style={[styles.cardMeta, { marginLeft: 10 }]}>
                      {item.rating.toFixed(1)} ★
                    </Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  style={styles.cardDirectionsButton}
                  onPress={() => openDirections(item)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="navigate-outline" size={14} color="#F58500" />
                  <Text style={styles.cardDirectionsText}>Directions</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={32} color="#D1D5DB" />
              <Text style={styles.emptyText}>No nearby resources found.</Text>
              <Text style={styles.emptySubtext}>Try increasing the search radius.</Text>
            </View>
          ) : null
        }
      />
    </BottomSheet>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  handle: {
    backgroundColor: "#D1D5DB",
    width: 36,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginTop: 4,
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#9CA3AF",
  },

  // ── Chips ──
  chipScroll: {
    marginTop: 12,
    marginHorizontal: -16,
  },
  chipRow: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: "row",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  chipActive: {
    backgroundColor: "#F58500",
    borderColor: "#F58500",
  },
  chipIcon: {
    marginRight: 5,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6B7280",
  },
  chipLabelActive: {
    color: "#FFFFFF",
  },

  // ── Selected card ──
  selectedCard: {
    marginTop: 12,
    backgroundColor: "#FFF7ED",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: "#F58500",
  },
  selectedCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  selectedCardAddress: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 6,
    lineHeight: 18,
  },
  selectedCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginBottom: 2,
  },
  selectedCardMetaText: {
    fontSize: 12,
    color: "#374151",
  },
  openText: { color: "#16A34A" },
  closedText: { color: "#DC2626" },
  directionsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    backgroundColor: "#F58500",
    borderRadius: 10,
    paddingVertical: 9,
  },
  directionsButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  // ── Slider ──
  sliderContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  sliderLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sliderLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6B7280",
  },
  sliderValue: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F58500",
  },
  slider: {
    width: "100%",
    height: 36,
    marginVertical: -4,
  },
  sliderRange: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sliderRangeText: {
    fontSize: 10,
    color: "#D1D5DB",
  },

  // ── List ──
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    paddingTop: 4,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  cardSelected: {
    borderColor: "#F58500",
    backgroundColor: "#FFF7ED",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
    marginRight: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 3,
  },
  metaIcon: {
    marginRight: 4,
  },
  cardMeta: {
    fontSize: 12,
    color: "#6B7280",
    flex: 1,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    flex: 1,
  },
  openBadge: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  openBadgeOpen: {
    backgroundColor: "#DCFCE7",
  },
  openBadgeClosed: {
    backgroundColor: "#FEE2E2",
  },
  openBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  openBadgeTextOpen: {
    color: "#16A34A",
  },
  openBadgeTextClosed: {
    color: "#DC2626",
  },
  cardDirectionsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#F58500",
    backgroundColor: "#FFF7ED",
  },
  cardDirectionsText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#F58500",
  },

  // ── Empty ──
  emptyState: {
    paddingTop: 40,
    alignItems: "center",
    gap: 6,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: "#9CA3AF",
  },
});