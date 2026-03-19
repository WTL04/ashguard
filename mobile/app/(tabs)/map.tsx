import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Region } from 'react-native-maps';
import { Colors } from '@/constants/colors';

// ── Filter chip config ───────────────────────────────────────────────────────
const FILTERS = [
  { id: 'all',       label: 'All',        icon: 'apps-outline' },
  { id: 'hospitals', label: 'Hospitals',  icon: 'medical-outline' },
  { id: 'fires',     label: 'Fires',      icon: 'flame-outline' },
  { id: 'shelters',  label: 'Shelters',   icon: 'home-outline' },
  { id: 'food',      label: 'Food Banks', icon: 'fast-food-outline' },
] as const;

type FilterId = typeof FILTERS[number]['id'];

// California center
const CA_REGION: Region = {
  latitude: 36.7783,
  longitude: -119.4179,
  latitudeDelta: 10,
  longitudeDelta: 10,
};

export default function MapScreen() {
  const mapRef = useRef<MapView>(null);

  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [locationGranted, setLocationGranted] = useState(false);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [search, setSearch] = useState('');

  // Request location permission
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationGranted(true);
        const loc = await Location.getCurrentPositionAsync({});
        setUserCoords({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    })();
  }, []);

  const handleLocateMe = () => {
    if (!userCoords || !mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      },
      600
    );
  };

  return (
    <View style={styles.root}>
      {/* ── Full-screen map ────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={
          userCoords
            ? { ...userCoords, latitudeDelta: 0.05, longitudeDelta: 0.05 }
            : CA_REGION
        }
        showsUserLocation={locationGranted}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        onMapReady={() => setMapReady(true)}
      />

      {/* Loading overlay */}
      {!mapReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}

      {/* ── UI overlay ──────────────────────────────────────────────────── */}
      <SafeAreaView style={styles.uiLayer} edges={['top']} pointerEvents="box-none">

        {/* Search bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search fires, places, or resources"
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            <Ionicons name="search-outline" size={18} color="#9CA3AF" />
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
          style={styles.filtersScroll}
        >
          {FILTERS.map((f) => {
            const active = activeFilter === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setActiveFilter(f.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={f.icon as any}
                  size={13}
                  color={active ? '#fff' : '#374151'}
                  style={{ marginRight: 4 }}
                />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Floating action buttons */}
        <View style={styles.fab} pointerEvents="box-none">
          <TouchableOpacity style={styles.fabBtn} activeOpacity={0.85}>
            <Ionicons name="layers-outline" size={20} color="#374151" />
            <Text style={styles.fabLabel}>Layers</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.fabBtn} activeOpacity={0.85}>
            <Ionicons name="location-outline" size={20} color="#374151" />
            <Text style={styles.fabLabel}>Report</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.fabBtn, !locationGranted && { opacity: 0.4 }]}
            onPress={handleLocateMe}
            disabled={!locationGranted}
            activeOpacity={0.85}
          >
            <Ionicons name="locate-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#E5E7EB',
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },

  uiLayer: {
    flex: 1,
  },

  // Search
  searchRow: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    shadowColor: '#000',
    shadowOpacity: 0.10,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    padding: 0,
  },

  // Filter chips
  filtersScroll: {
    flexGrow: 0,
  },
  filtersRow: {
    paddingHorizontal: 12,
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  chipActive: {
    backgroundColor: Colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  chipTextActive: {
    color: '#FFFFFF',
  },

  // Floating buttons
  fab: {
    position: 'absolute',
    right: 12,
    top: 130,
    gap: 8,
  },
  fabBtn: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    minWidth: 56,
  },
  fabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#374151',
    marginTop: 2,
  },
});