import React, { useMemo, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import BottomSheet, { BottomSheetFlatList } from "@gorhom/bottom-sheet";

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
  resourceType: ResourceType;
  loading?: boolean;
  onChangeResourceType: (type: ResourceType) => void;
  onSelectPlace: (place: NearbyPlace) => void;
  onClose?: () => void;
};

export default function ResourceBottomSheet({
  visible,
  places,
  selectedPlaceId,
  resourceType,
  loading = false,
  onChangeResourceType,
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