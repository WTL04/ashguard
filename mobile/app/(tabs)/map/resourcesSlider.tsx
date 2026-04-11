import React, { useMemo, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider"

type NearbyPlace = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  type: "hotels" | "grocery" | "gas" | "convenience";
  distanceMeters?: number;
  rating?: number;
  isOpen?: boolean;
};

type ResourceType = 'hotels' | 'grocery' | 'gas' | 'convenience';

type ResourceBottomSheetProps = {
  visible: boolean;
  places: NearbyPlace[];
  selectedPlaceId: string | null;
  distanceRadius: number;
  resourceType: ResourceType;
  loading?: boolean;
  onChangeResourceType: (type: ResourceType) => void;
  onChangeDistanceRadius: (radius: number) => void;
  onSelectPlace: (place: NearbyPlace) => void;
  onClose?: () => void;
};

export default function ResourceBottomSheet({
  visible,
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
  const snapPoints = useMemo(() => ["10%", "20%", "65%"], []);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      if (selectedPlaceId) {
        bottomSheetRef.current?.snapToIndex(1);
      } else {
        bottomSheetRef.current?.snapToIndex(0);
      }
    } else {
        bottomSheetRef.current?.snapToIndex(0);
    }
  }, [visible, selectedPlaceId]);

  const milesValue = Math.round(distanceRadius / 1609.34);
  const MIN_MILES = 1;
  const MAX_MILES = 50;
  const MILES_TO_METERS = 1609.34;
  const sliderPercent = ((milesValue - MIN_MILES) / (MAX_MILES - MIN_MILES)) * 100;

  const selectedPlace = places.find(p => p.id === selectedPlaceId);

  const handleDecrease = () => {
    const newMiles = Math.max(MIN_MILES, milesValue - 1);
    onChangeDistanceRadius(newMiles * MILES_TO_METERS);
  };

  const handleIncrease = () => {
    const newMiles = Math.min(MAX_MILES, milesValue + 1);
    onChangeDistanceRadius(newMiles * MILES_TO_METERS);
  };

  return (
    <BottomSheet
    ref={bottomSheetRef}
    index={0}
    snapPoints={snapPoints}
    enablePanDownToClose={false}
    enableContentPanningGesture={false}
    topInset={insets.top}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Nearby Resources</Text>
        <Text style={styles.subtitle}>
          {loading ? "Loading..." : selectedPlace ? `Showing: ${selectedPlace.name}` : `${places.length} results`}
        </Text>

        {selectedPlace && (
          <View style={styles.selectedCard}>
            <View style={styles.selectedCardHeader}>
              <Text style={styles.selectedCardTitle} numberOfLines={1}>{selectedPlace.name}</Text>
              <TouchableOpacity onPress={() => onSelectPlace(selectedPlace)}>
                <Ionicons name="close-circle" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>
            {selectedPlace.address ? (
              <Text style={styles.selectedCardAddress} numberOfLines={1}>{selectedPlace.address}</Text>
            ) : null}
            <View style={styles.selectedCardMeta}>
              {selectedPlace.distanceMeters != null ? (
                <Text style={styles.selectedCardMetaText}>
                  {(selectedPlace.distanceMeters / 1609.34).toFixed(1)} mi away
                </Text>
              ) : null}
              {selectedPlace.rating != null ? (
                <Text style={styles.selectedCardMetaText}>  •  {selectedPlace.rating.toFixed(1)} ★</Text>
              ) : null}
              {typeof selectedPlace.isOpen === "boolean" ? (
                <Text style={styles.selectedCardMetaText}>
                  {"  •  "}
                  {selectedPlace.isOpen ? "Open" : "Closed"}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        <View style={styles.sliderContainer}>
          <Text style={styles.sliderLabel}>
            Distance: {milesValue} mi ({distanceRadius.toLocaleString()} m)
          </Text>
          <Slider
            style={styles.slider}
            minimumValue={1609}
            maximumValue={80467}
            step={1609}
            value={distanceRadius}
            onValueChange={onChangeDistanceRadius}
            minimumTrackTintColor="#F58500"
            maximumTrackTintColor="#E5E7EB"
            thumbTintColor="#F58500"
          />
          <View style={styles.sliderRange}>
            <Text style={styles.sliderRangeText}>1 mi</Text>
            <Text style={styles.sliderRangeText}>100 mi</Text>
          </View>
        </View>
      </View>

      <BottomSheetFlatList
        data={places}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const selected = item.id === selectedPlaceId;

          return (
            <TouchableOpacity
              style={[styles.card, selected && styles.cardSelected]}
              onPress={() => onSelectPlace(item)}
              activeOpacity={0.85}
            >
              <Text style={styles.cardTitle}>{item.name}</Text>

              {item.address ? (
                <Text style={styles.cardMeta}>{item.address}</Text>
              ) : null}

              <View style={styles.row}>
                {item.distanceMeters != null ? (
                  <Text style={styles.cardMeta}>
                    {(item.distanceMeters / 1609.34).toFixed(1)} mi
                  </Text>
                ) : null}

                {item.rating != null ? (
                  <Text style={styles.cardMeta}>  •  {item.rating.toFixed(1)} ★</Text>
                ) : null}

                {typeof item.isOpen === "boolean" ? (
                  <Text style={styles.cardMeta}>
                    {"  •  "}
                    {item.isOpen ? "Open" : "Closed"}
                  </Text>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No nearby resources found.</Text>
            </View>
          ) : null
        }
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    color: "#6B7280",
  },
  selectedCard: {
    marginTop: 12,
    backgroundColor: "#FFF7ED",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
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
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },
  selectedCardMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  selectedCardMetaText: {
    fontSize: 13,
    color: "#374151",
  },
  sliderContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  sliderLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderRange: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -4,
  },
  sliderRangeText: {
    fontSize: 11,
    color: "#9CA3AF",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
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
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  cardMeta: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  emptyState: {
    paddingTop: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
  },
});
