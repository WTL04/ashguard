import React, { useMemo, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";
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
  const snapPoints = useMemo(() => ["3%", "40%", "82%"], []);

  useEffect(() => {
    if (visible) {
        bottomSheetRef.current?.snapToIndex(1);
    } else {
        bottomSheetRef.current?.snapToIndex(0);
    }
  }, [visible]);

  const milesValue = Math.round(distanceRadius / 1609.34);
  const MIN_MILES = 1;
  const MAX_MILES = 50;
  const MILES_TO_METERS = 1609.34;
  const sliderPercent = ((milesValue - MIN_MILES) / (MAX_MILES - MIN_MILES)) * 100;

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
    >
      <View style={styles.header}>
        <Text style={styles.title}>Nearby Resources</Text>
        <Text style={styles.subtitle}>
          {loading ? "Loading..." : `${places.length} results`}
        </Text>
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
