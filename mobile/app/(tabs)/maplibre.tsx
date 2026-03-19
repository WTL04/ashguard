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
import * as MapLibreRN from "@maplibre/maplibre-react-native";
import { Camera, UserLocation, type CameraRef, ShapeSource, FillLayer, LineLayer, SymbolLayer, CircleLayer } from "@maplibre/maplibre-react-native";
const { MapView } = MapLibreRN;
import { Colors } from '@/constants/colors';
import { fetchFireData } from "../services/mapApi";

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
const CA_CENTER: [number, number] = [-119.4179, 36.7783];
const CA_ZOOM = 5;

export default function MapLibre() {
  const cameraRef = useRef<CameraRef>(null);

  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [locationGranted, setLocationGranted] = useState(false);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [search, setSearch] = useState('');
  const [fireData, setFireData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [firesLoading, setFiresLoading] = useState(false);
  const [firesError, setFiresError] = useState<string | null>(null);

  // Request location permission
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationGranted(true);
        const loc = await Location.getCurrentPositionAsync({});
        setUserCoords([loc.coords.longitude, loc.coords.latitude]);
      }
    })();
  }, []);

  // Fetch fire data when map is ready
  useEffect(() => {
    if (!mapReady) return;
    setFiresLoading(true);
    setFiresError(null);
    fetchFireData()
      .then((data) => {
        setFireData(data);
        setFiresLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch fire data:', err);
        setFiresError('Failed to load fire data');
        setFiresLoading(false);
      });
  }, [mapReady]);


  // Set camera to user's location
  const handleLocateMe = () => {
    if (!userCoords || !cameraRef.current) return;
    cameraRef.current.flyTo(userCoords, 600);
  };

  // Set user location, use California coords if UserLocation doesnt work
  const defaultSettings = userCoords
    ? { centerCoordinate: userCoords, zoomLevel: 12 }
    : { centerCoordinate: CA_CENTER, zoomLevel: CA_ZOOM };

  return (
    <View style={styles.root}>
      {/* ── Full-screen map ────────────────────────────────────────────── */}
      <MapView
        style={StyleSheet.absoluteFill}
        mapStyle="https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json"
        onDidFinishLoadingMap={() => setMapReady(true)}
        compassEnabled={false}
        attributionEnabled={false}
      >
        <Camera ref={cameraRef} defaultSettings={defaultSettings} />
        {locationGranted && <UserLocation visible={locationGranted} />}
        {(activeFilter === 'all' || activeFilter === 'fires') && fireData && (
          <>
            {/* Satellite hotspot points - red circles */}
            <ShapeSource id="hotspots" shape={fireData}>
              <CircleLayer
                id="hotspots-layer"
                filter={['all', ['==', ['geometry-type'], 'Point'], ['!', ['has', 'prescribed_date_start']]]}
                style={{
                  circleColor: '#FF4444',
                  circleRadius: 6,
                  circleOpacity: 0.85,
                  circleStrokeWidth: 1,
                  circleStrokeColor: '#FFFFFF',
                }}
              />
            </ShapeSource>

            {/* Fire perimeters - red polygons */}
            <ShapeSource id="perimeters" shape={fireData}>
              <FillLayer
                id="perimeters-layer"
                filter={['==', ['geometry-type'], 'Polygon']}
                style={{
                  fillColor: '#FF4444',
                  fillOpacity: 0.35,
                  fillOutlineColor: '#CC0000',
                }}
              />
            </ShapeSource>

            {/* Prescribed fire points - orange circles */}
            <ShapeSource id="prescribed-fires" shape={fireData}>
              <CircleLayer
                id="prescribed-fires-layer"
                filter={['all', ['==', ['geometry-type'], 'Point'], ['has', 'prescribed_date_start']]}
                style={{
                  circleColor: '#31bf24',
                  circleRadius: 6,
                  circleOpacity: 0.85,
                  circleStrokeWidth: 1,
                  circleStrokeColor: '#FFFFFF',
                }}
              />
            </ShapeSource>
          </>
        )}
      </MapView>

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
            const showBadge = f.id === 'fires' && fireData;
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
                {showBadge && !firesLoading && !firesError && (
                  <View style={[styles.badge, active && styles.badgeActive]}>
                    <Text style={[styles.badgeText, active && styles.badgeTextActive]}>
                      {fireData?.features.length ?? 0}
                    </Text>
                  </View>
                )}
                {f.id === 'fires' && firesLoading && (
                  <ActivityIndicator
                    size="small"
                    color={active ? '#fff' : Colors.primary}
                    style={{ marginLeft: 4 }}
                  />
                )}
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

  // Badge
  badge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
  },
  badgeActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  badgeTextActive: {
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
