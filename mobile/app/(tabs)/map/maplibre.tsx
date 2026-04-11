import React, { useRef, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as MapLibreRN from '@maplibre/maplibre-react-native';
import {
  Camera,
  UserLocation,
  type CameraRef,
  ShapeSource,
  FillLayer,
  CircleLayer,
} from '@maplibre/maplibre-react-native';

const { MapView } = MapLibreRN;

import { Colors } from '@/constants/colors';
import {
  fetchFireData,
  fetchWeatherData,
  submitSelfReport,
  fetchSelfReports,
  fetchNearbyResources,
} from '../../services/mapApi';

import ResourceBottomSheet from './resourcesSlider';

// ── Filter chip config ───────────────────────────────────────────────────────
const FILTERS = [
  { id: 'all', label: 'All', icon: 'apps-outline' },
  { id: 'hospitals', label: 'Hospitals', icon: 'medical-outline' },
  { id: 'perimeters', label: 'Fire Perimeters', icon: 'flame-outline' },
  { id: 'hotspots', label: 'Satellite Hotspots', icon: 'radio-outline' },
  { id: 'prescribed', label: 'Prescribed Fires', icon: 'leaf-outline' },
  { id: 'weather', label: 'Weather Stations', icon: 'partly-sunny-outline' },
  { id: 'shelters', label: 'Shelters', icon: 'home-outline' },
  { id: 'resources', label: 'Resources', icon: 'fast-food-outline' },
] as const;

type FilterId = typeof FILTERS[number]['id'];

type ResourceType = 'hotels' | 'grocery' | 'gas' | 'convenience';

type NearbyPlace = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  address?: string;
  type: ResourceType;
  distanceMeters?: number;
  rating?: number;
  isOpen?: boolean;
};

const CA_CENTER: [number, number] = [-119.4179, 36.7783];
const CA_ZOOM = 6;

const CONFIDENCE_MAP: Record<string, string> = {
  H: 'High',
  M: 'Medium',
  L: 'Low',
};

const celsiusToFahrenheit = (c: number): string =>
  `${((c * 9) / 5 + 32).toFixed(1)} °F`;

const kmhToMph = (kmh: number): string =>
  `${(kmh * 0.621371).toFixed(1)} mph`;

const getFeatureProp = <T,>(
  feature: GeoJSON.Feature,
  key: string,
  fallback?: T
): T | undefined => {
  return (feature.properties?.[key] as T | undefined) ?? fallback;
};

const extractPlacesFromGeoJSON = (
  data: GeoJSON.FeatureCollection
): NearbyPlace[] => {
  return (data.features ?? [])
    .filter((f): f is GeoJSON.Feature<GeoJSON.Point> => f.geometry?.type === 'Point')
    .map((f, index) => {
      const coords = f.geometry.coordinates as [number, number];

      return {
        id: String(
          getFeatureProp<string | number>(f, 'id') ??
          getFeatureProp<string | number>(f, 'place_id') ??
          index
        ),
        name: getFeatureProp<string>(f, 'name', 'Unnamed place') ?? 'Unnamed place',
        latitude: coords[1],
        longitude: coords[0],
        address:
          getFeatureProp<string>(f, 'address') ??
          getFeatureProp<string>(f, 'address_line2'),
        type:
          (getFeatureProp<string>(f, 'resource_type') as ResourceType) ?? 'grocery',
        distanceMeters:
          getFeatureProp<number>(f, 'distanceMeters') ??
          getFeatureProp<number>(f, 'distance'),
        rating: getFeatureProp<number>(f, 'rating'),
        isOpen: getFeatureProp<boolean>(f, 'isOpen'),
      };
    });
};

export default function MapLibre() {
  const cameraRef = useRef<CameraRef>(null);
  const hasCenteredOnUserRef = useRef(false);

  const [activeFilter, setActiveFilter] = useState<FilterId>('all');
  const [locationGranted, setLocationGranted] = useState(false);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [search, setSearch] = useState('');

  // Fire state
  const [hotspotsData, setHotspotsData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [perimetersData, setPerimetersData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [prescribedData, setPrescribedData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [firesLoading, setFiresLoading] = useState(false);
  const [firesError, setFiresError] = useState<string | null>(null);
  const [selectedData, setSelectedData] = useState<GeoJSON.Feature | null>(null);

  // Weather state
  const [weatherData, setWeatherData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<GeoJSON.Feature | null>(null);

  // Resource state
  const [resourcesData, setResourcesData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [resourceType, setResourceType] = useState<ResourceType>('grocery');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [distanceRadius, setDistanceRadius] = useState(10000); // default set to 10000 meters

  // Report fire modal state
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [selfReportsData, setSelfReportsData] = useState<GeoJSON.FeatureCollection | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') setLocationGranted(true);
      } catch (err) {
        console.warn('Location permission error:', err);
      }
    })();
  }, []);

  useEffect(() => {
    if (!mapReady || !userCoords || hasCenteredOnUserRef.current || !cameraRef.current) return;

    hasCenteredOnUserRef.current = true;
    cameraRef.current.setCamera({
      centerCoordinate: userCoords,
      zoomLevel: 13,
      animationDuration: 0,
    });
  }, [mapReady, userCoords]);

  useEffect(() => {
    if (!mapReady) return;

    setFiresLoading(true);
    setFiresError(null);

    fetchFireData()
      .then((data) => {
        const hotspotFeatures = (data.satellite_hotspots?.features ?? []).filter(
          (f: GeoJSON.Feature) => !f.properties?.prescribed_date_start
        );

        setHotspotsData({
          type: 'FeatureCollection',
          features: hotspotFeatures,
        });

        setPerimetersData({
          type: 'FeatureCollection',
          features: data.fire_perimeters?.features ?? [],
        });

        const prescribedFeatures = [
          ...(data.prescribed_fires?.features ?? []),
          ...(data.satellite_hotspots?.features ?? []).filter(
            (f: GeoJSON.Feature) => f.properties?.prescribed_date_start
          ),
        ];

        setPrescribedData({
          type: 'FeatureCollection',
          features: prescribedFeatures,
        });

        setFiresLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch fire data:', err);
        setFiresError('Failed to load fire data');
        setFiresLoading(false);
      });
  }, [mapReady]);

  useEffect(() => {
    if (!mapReady) return;

    setWeatherLoading(true);
    setWeatherError(null);

    fetchWeatherData()
      .then((data) => {
        setWeatherData({
          type: 'FeatureCollection',
          features: data.weather_stations?.features ?? [],
        });
        setWeatherLoading(false);
      })
      .catch((err) => {
        console.error('Failed to fetch weather data:', err);
        setWeatherError('Failed to load weather data');
        setWeatherLoading(false);
      });
  }, [mapReady]);

  useEffect(() => {
    if (!userCoords) return;

    const loadResources = async () => {
      try {
        setResourcesLoading(true);
        setResourcesError(null);

        const [longitude, latitude] = userCoords;

        const data = await fetchNearbyResources({
          latitude,
          longitude,
          type: resourceType,
          radius: distanceRadius,
        });

        setResourcesData(data);
        setNearbyPlaces(extractPlacesFromGeoJSON(data));
        setSheetOpen(true);
      } catch (err) {
        console.error('Failed to fetch nearby resources:', err);
        setResourcesError('Failed to load nearby resources');
      } finally {
        setResourcesLoading(false);
      }
    };

    loadResources();
  }, [userCoords, resourceType, distanceRadius]);

  useEffect(() => {
    if (!mapReady) return;
    loadSelfReports();
  }, [mapReady]);

  const getFeatureCenter = (feature: GeoJSON.Feature): [number, number] | null => {
    const geom = feature.geometry;
    if (!geom) return null;

    if (geom.type === 'Point') {
      return geom.coordinates as [number, number];
    }

    if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
      const coords = geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];
      let sumLng = 0;
      let sumLat = 0;

      for (const coord of coords) {
        sumLng += coord[0];
        sumLat += coord[1];
      }

      return [sumLng / coords.length, sumLat / coords.length];
    }

    return null;
  };

  const handleFirePress = (feature: GeoJSON.Feature) => {
    setSelectedStation(null);
    setSelectedPlaceId(null);
    setSelectedData(feature);
    setSheetOpen(false);

    const center = getFeatureCenter(feature);
    if (center && cameraRef.current) {
      cameraRef.current.flyTo(center, 500);
    }
  };

  const handleStationPress = (feature: GeoJSON.Feature) => {
    setSelectedData(null);
    setSelectedPlaceId(null);
    setSelectedStation(feature);
    setSheetOpen(false);

    const center = getFeatureCenter(feature);
    if (center && cameraRef.current) {
      cameraRef.current.flyTo(center, 500);
    }
  };

  const handleResourcePress = (feature: GeoJSON.Feature) => {
    const center = getFeatureCenter(feature);
    const id = String(
      feature.properties?.id ?? feature.properties?.place_id ?? ''
    );

    setSelectedData(null);
    setSelectedStation(null);
    setSelectedPlaceId(id);
    setSheetOpen(true);

    if (center && cameraRef.current) {
      cameraRef.current.flyTo(center, 500);
    }
  };

  const handleSelectPlaceFromSheet = (place: NearbyPlace) => {
    setSelectedData(null);
    setSelectedStation(null);
    setSelectedPlaceId(place.id);

    cameraRef.current?.flyTo([place.longitude, place.latitude], 500);
  };

  const handleUserLocationUpdate = (location: any) => {
    const coords = location?.coords;
    if (!coords) return;
    setUserCoords([coords.longitude, coords.latitude]);
  };

  const handleLocateMe = () => {
    if (!cameraRef.current) return;

    if (userCoords) {
      cameraRef.current.setCamera({
        centerCoordinate: userCoords,
        zoomLevel: 13,
        animationMode: 'flyTo',
        animationDuration: 600,
      });
    } else {
      cameraRef.current.setCamera({
        centerCoordinate: CA_CENTER,
        zoomLevel: CA_ZOOM,
        animationMode: 'flyTo',
        animationDuration: 600,
      });
    }
  };

  const handleOpenReport = () => {
    if (!userCoords) {
      Alert.alert(
        'Location unavailable',
        'We need your current location before you can submit a fire report.'
      );
      return;
    }

    setSelectedData(null);
    setSelectedStation(null);
    setSelectedPlaceId(null);
    setReportModalVisible(true);
  };

  const handleConfirmReport = async () => {
    if (!userCoords) {
      Alert.alert('Location unavailable', 'We could not get your current location.');
      return;
    }

    try {
      setSubmittingReport(true);

      const [longitude, latitude] = userCoords;

      await submitSelfReport({
        latitude,
        longitude,
        description: 'User-reported fire',
      });

      await loadSelfReports();

      setReportModalVisible(false);

      Alert.alert(
        'Report submitted',
        'Your fire report was submitted using your current location.'
      );
    } catch (error) {
      console.error('Failed to submit self report:', error);
      Alert.alert('Error', 'Failed to submit fire report.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const loadSelfReports = async () => {
    try {
      const data = await fetchSelfReports();
      setSelfReportsData(data);
    } catch (err) {
      console.error('Failed to fetch self reports:', err);
    }
  };

  const hotspotsCount = hotspotsData?.features.length ?? 0;
  const perimetersCount = perimetersData?.features.length ?? 0;
  const prescribedCount = prescribedData?.features.length ?? 0;
  const weatherCount = weatherData?.features.length ?? 0;
  const resourcesCount = nearbyPlaces.length;

  const mapLightMode =
    'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

  const selectedResourceFeatureId = useMemo(() => selectedPlaceId ?? '', [selectedPlaceId]);

  return (
    <View style={styles.root}>
      <MapView
        style={StyleSheet.absoluteFill}
        mapStyle={mapLightMode}
        onDidFinishLoadingMap={() => setMapReady(true)}
        compassEnabled={false}
        attributionEnabled={false}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{ centerCoordinate: CA_CENTER, zoomLevel: CA_ZOOM }}
        />

        {locationGranted && (
          <UserLocation visible={locationGranted} onUpdate={handleUserLocationUpdate} />
        )}

        {(activeFilter === 'all' || activeFilter === 'hotspots') && hotspotsData && (
          <ShapeSource
            id="hotspots-data"
            shape={hotspotsData}
            onPress={(e) => handleFirePress(e.features[0])}
          >
            <CircleLayer
              id="hotspots-layer"
              style={{
                circleColor: '#FF6B35',
                circleRadius: 3,
                circleOpacity: 0.85,
                circleStrokeWidth: 1,
                circleStrokeColor: '#FFFFFF',
              }}
            />
          </ShapeSource>
        )}

        {(activeFilter === 'all' || activeFilter === 'perimeters') && perimetersData && (
          <ShapeSource
            id="perimeters-data"
            shape={perimetersData}
            onPress={(e) => handleFirePress(e.features[0])}
          >
            <FillLayer
              id="perimeters-layer"
              style={{
                fillColor: '#FF4444',
                fillOpacity: 1,
                fillOutlineColor: '#CC0000',
              }}
            />
          </ShapeSource>
        )}

        {(activeFilter === 'all' || activeFilter === 'prescribed') && prescribedData && (
          <ShapeSource
            id="prescribed-data"
            shape={prescribedData}
            onPress={(e) => handleFirePress(e.features[0])}
          >
            <CircleLayer
              id="prescribed-fires-layer"
              style={{
                circleColor: '#31bf24',
                circleRadius: 2,
                circleOpacity: 0.85,
                circleStrokeWidth: 1,
                circleStrokeColor: '#FFFFFF',
              }}
            />
          </ShapeSource>
        )}

        {(activeFilter === 'all' || activeFilter === 'weather') && weatherData && (
          <ShapeSource
            id="weather-data"
            shape={weatherData}
            onPress={(e) => handleStationPress(e.features[0])}
          >
            <CircleLayer
              id="weather-layer"
              style={{
                circleColor: '#3B82F6',
                circleRadius: 5,
                circleOpacity: 0.9,
                circleStrokeWidth: 1.5,
                circleStrokeColor: '#FFFFFF',
              }}
            />
          </ShapeSource>
        )}

        {(activeFilter === 'all' || activeFilter === 'resources') && resourcesData && (
          <ShapeSource
            id="resources-data"
            shape={resourcesData}
            onPress={(e) => handleResourcePress(e.features[0])}
          >
            <CircleLayer
              id="resources-layer"
              style={{
                circleColor: [
                  'case',
                  ['==', ['to-string', ['coalesce', ['get', 'id'], ['get', 'place_id'], '']], selectedResourceFeatureId],
                  '#F58500',
                  '#10B981',
                ],
                circleRadius: [
                  'case',
                  ['==', ['to-string', ['coalesce', ['get', 'id'], ['get', 'place_id'], '']], selectedResourceFeatureId],
                  7,
                  5,
                ],
                circleOpacity: 0.9,
                circleStrokeWidth: 1.5,
                circleStrokeColor: '#FFFFFF',
              }}
            />
          </ShapeSource>
        )}

        {selfReportsData && (
          <ShapeSource
            id="self-reports-data"
            shape={selfReportsData}
            onPress={(e) => handleFirePress(e.features[0])}
          >
            <CircleLayer
              id="self-reports-layer"
              style={{
                circleColor: '#F59E0B',
                circleRadius: 6,
                circleOpacity: 0.95,
                circleStrokeWidth: 2,
                circleStrokeColor: '#FFFFFF',
              }}
            />
          </ShapeSource>
        )}
      </MapView>

      {!mapReady && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      )}

      <SafeAreaView style={styles.uiLayer} edges={['top']} pointerEvents="box-none">
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
          style={styles.filtersScroll}
        >
          {FILTERS.map((f) => {
            const active = activeFilter === f.id;
            const isFireFilter = ['hotspots', 'perimeters', 'prescribed'].includes(f.id);
            const isWeatherFilter = f.id === 'weather';
            const isResourceFilter = f.id === 'resources';

            let badgeCount = 0;
            let badgeStyle = styles.badge;
            let badgeTextStyle = styles.badgeText;
            let badgeActiveStyle = styles.badgeActive;

            if (f.id === 'hotspots') {
              badgeCount = hotspotsCount;
              badgeStyle = styles.badgeHotspots;
              badgeTextStyle = styles.badgeHotspotsText;
            } else if (f.id === 'perimeters') {
              badgeCount = perimetersCount;
              badgeStyle = styles.badge;
              badgeTextStyle = styles.badgeText;
            } else if (f.id === 'prescribed') {
              badgeCount = prescribedCount;
              badgeStyle = styles.badgePrescribed;
              badgeTextStyle = styles.badgePrescribedText;
              badgeActiveStyle = styles.badgePrescribedActive;
            } else if (f.id === 'weather') {
              badgeCount = weatherCount;
              badgeStyle = styles.badgeWeather;
              badgeTextStyle = styles.badgeWeatherText;
            } else if (f.id === 'resources') {
              badgeCount = resourcesCount;
              badgeStyle = styles.badgeResource;
              badgeTextStyle = styles.badgeResourceText;
            }

            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => {
                  setActiveFilter(f.id);
                  if (f.id === 'resources') setSheetOpen(true);
                }}
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

                {isFireFilter && !firesLoading && !firesError && badgeCount > 0 && (
                  <View style={[badgeStyle, active && badgeActiveStyle]}>
                    <Text style={[badgeTextStyle, active && styles.badgeTextActive]}>
                      {badgeCount}
                    </Text>
                  </View>
                )}

                {isFireFilter && firesLoading && (
                  <ActivityIndicator
                    size="small"
                    color={active ? '#fff' : Colors.primary}
                    style={{ marginLeft: 4 }}
                  />
                )}

                {isWeatherFilter && !weatherLoading && !weatherError && badgeCount > 0 && (
                  <View style={[badgeStyle, active && badgeActiveStyle]}>
                    <Text style={[badgeTextStyle, active && styles.badgeTextActive]}>
                      {badgeCount}
                    </Text>
                  </View>
                )}

                {isWeatherFilter && weatherLoading && (
                  <ActivityIndicator
                    size="small"
                    color={active ? '#fff' : Colors.primary}
                    style={{ marginLeft: 4 }}
                  />
                )}

                {isResourceFilter && !resourcesLoading && !resourcesError && badgeCount > 0 && (
                  <View style={[badgeStyle, active && badgeActiveStyle]}>
                    <Text style={[badgeTextStyle, active && styles.badgeTextActive]}>
                      {badgeCount}
                    </Text>
                  </View>
                )}

                {isResourceFilter && resourcesLoading && (
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

        <View style={styles.fab} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.roundMapButton}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Layers"
          >
            <Ionicons name="layers-outline" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.roundMapButton}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Report fire"
            onPress={handleOpenReport}
          >
            <Ionicons name="warning-outline" size={20} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.roundMapButton}
            onPress={handleLocateMe}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Locate me"
          >
            <Ionicons name="locate" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {selectedData && (
          <View style={styles.popup} pointerEvents="box-none">
            <TouchableOpacity
              style={[styles.popupClose, { padding: 8, marginRight: -8, marginTop: -8 }]}
              onPress={() => setSelectedData(null)}
            >
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>

            <Text style={styles.popupTitle}>
              {selectedData.properties?.source === 'user'
                ? 'User Fire Report'
                : selectedData.properties?.prescribed_date_start
                ? 'Prescribed Fire'
                : selectedData.geometry?.type === 'Polygon' ||
                  selectedData.geometry?.type === 'MultiPolygon'
                ? 'Fire Perimeter'
                : 'Satellite Hotspot'}
            </Text>

            <View style={styles.popupDivider} />

            {selectedData.properties?.source === 'user' && (
              <Text style={styles.popupDetail}>
                ⚠️ Community report: {selectedData.properties.description || 'User-reported fire'}
              </Text>
            )}

            {selectedData.properties?.satellite && (
              <Text style={styles.popupDetail}>🛰️ Source: {selectedData.properties.satellite}</Text>
            )}

            {selectedData.properties?.confidence && (
              <Text style={styles.popupDetail}>
                🎯 Confidence:{' '}
                {CONFIDENCE_MAP[selectedData.properties.confidence] ??
                  selectedData.properties.confidence}
              </Text>
            )}

            {selectedData.properties?.acq_date && (
              <Text style={styles.popupDetail}>📅 Acquired: {selectedData.properties.acq_date}</Text>
            )}

            {selectedData.properties?.name && (
              <Text style={styles.popupDetail}>🌿 Name: {selectedData.properties.name}</Text>
            )}

            {selectedData.properties?.prescribed_date_start && (
              <Text style={styles.popupDetail}>
                🗓️ Start Date: {selectedData.properties.prescribed_date_start}
              </Text>
            )}

            {selectedData.properties?.incident_name && (
              <Text style={styles.popupDetail}>
                🔥 Incident Name: {selectedData.properties.incident_name}
              </Text>
            )}

            {selectedData.properties?.incident_number && (
              <Text style={styles.popupDetail}>
                📋 Incident #: {selectedData.properties.incident_number}
              </Text>
            )}

            {selectedData.properties?.source && (
              <Text style={styles.popupDetail}>📡 Source: {selectedData.properties.source}</Text>
            )}

            {selectedData.properties?.mission && (
              <Text style={styles.popupDetail}>🎯 Mission: {selectedData.properties.mission}</Text>
            )}

            {selectedData.properties?.displayStatus && (
              <Text style={styles.popupDetail}>
                📊 Status: {selectedData.properties.displayStatus}
              </Text>
            )}

            {selectedData.properties?.description && (
              <Text style={styles.popupDetail}>
                📝 Description: {selectedData.properties.description}
              </Text>
            )}

            {selectedData.properties?.area_acres && (
              <Text style={styles.popupDetail}>
                📐 Area: {selectedData.properties.area_acres.toFixed(3)} acres
              </Text>
            )}

            {selectedData.properties?.FireDiscoveryDate && (
              <Text style={styles.popupDetail}>
                🗓️ Discovered:{' '}
                {new Date(selectedData.properties.FireDiscoveryDate).toLocaleDateString()}
              </Text>
            )}

            {selectedData.properties?.CreationDate && (
              <Text style={styles.popupDetail}>
                📅 Created: {new Date(selectedData.properties.CreationDate).toLocaleDateString()}
              </Text>
            )}

            {selectedData.properties?.EditDate && (
              <Text style={styles.popupDetail}>
                ✏️ Updated: {new Date(selectedData.properties.EditDate).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}

        {selectedStation && (
          <View style={styles.popup} pointerEvents="box-none">
            <TouchableOpacity
              style={[styles.popupClose, { padding: 8, marginRight: -8, marginTop: -8 }]}
              onPress={() => setSelectedStation(null)}
            >
              <Ionicons name="close" size={24} color="#374151" />
            </TouchableOpacity>

            <Text style={styles.popupTitle}>
              🌤️ {selectedStation.properties?.stationName ?? selectedStation.properties?.stationId}
            </Text>

            <View style={styles.popupDivider} />

            <Text style={styles.popupDetail}>
              📡 Station ID: {selectedStation.properties?.stationId}
            </Text>

            {selectedStation.properties?.temperature != null && (
              <Text style={styles.popupDetail}>
                🌡️ Temperature: {celsiusToFahrenheit(selectedStation.properties.temperature)}
              </Text>
            )}

            {selectedStation.properties?.relativeHumidity != null && (
              <Text style={styles.popupDetail}>
                💧 Humidity: {selectedStation.properties.relativeHumidity.toFixed(1)} %
              </Text>
            )}

            {selectedStation.properties?.dewpoint != null && (
              <Text style={styles.popupDetail}>
                🌫️ Dew Point: {celsiusToFahrenheit(selectedStation.properties.dewpoint)}
              </Text>
            )}

            {selectedStation.properties?.windSpeed != null && (
              <Text style={styles.popupDetail}>
                💨 Wind Speed: {kmhToMph(selectedStation.properties.windSpeed)}
              </Text>
            )}

            {selectedStation.properties?.timestamp && (
              <Text style={styles.popupDetail}>
                🕐 Updated: {new Date(selectedStation.properties.timestamp).toLocaleString()}
              </Text>
            )}
          </View>
        )}

        <Modal
          visible={reportModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setReportModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.reportModal}>
              <Text style={styles.reportModalTitle}>Report Fire</Text>
              <Text style={styles.reportModalText}>
                Submit a fire report using your current location?
              </Text>

              {userCoords && (
                <Text style={styles.reportModalCoords}>
                  Lat: {userCoords[1].toFixed(5)} | Lng: {userCoords[0].toFixed(5)}
                </Text>
              )}

              <View style={styles.reportModalActions}>
                <TouchableOpacity
                  style={styles.reportCancelButton}
                  onPress={() => setReportModalVisible(false)}
                  activeOpacity={0.85}
                  disabled={submittingReport}
                >
                  <Text style={styles.reportCancelText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.reportConfirmButton}
                  onPress={handleConfirmReport}
                  activeOpacity={0.85}
                  disabled={submittingReport}
                >
                  {submittingReport ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.reportConfirmText}>Confirm</Text>
                  )} </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>


      {/* Slider for resources */}
      <ResourceBottomSheet
        visible={sheetOpen}
        places={nearbyPlaces}
        selectedPlaceId={selectedPlaceId}
        distanceRadius={distanceRadius}
        resourceType={resourceType}
        loading={resourcesLoading}
        onChangeResourceType={setResourceType}
        onChangeDistanceRadius={setDistanceRadius}
        onSelectPlace={handleSelectPlaceFromSheet}
        onClose={() => setSheetOpen(false)}
      />
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
    shadowOpacity: 0.1,
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

  badgeHotspots: {
    backgroundColor: '#FFEDD5',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
  },
  badgeHotspotsText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#EA580C',
  },

  badgePrescribed: {
    backgroundColor: '#DCFCE7',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
  },
  badgePrescribedActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  badgePrescribedText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#16A34A',
  },

  badgeWeather: {
    backgroundColor: '#DBEAFE',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
  },
  badgeWeatherText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2563EB',
  },

  badgeResource: {
    backgroundColor: '#D1FAE5',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
  },
  badgeResourceText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },

  fab: {
    position: 'absolute',
    right: 12,
    top: 130,
    gap: 8,
  },
  roundMapButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F58500',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },

  popup: {
    position: 'absolute',
    bottom: 32,
    left: 16,
    right: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  popupClose: {
    position: 'absolute',
    top: 12,
    right: 12,
  },
  popupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    paddingRight: 24,
  },
  popupDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 8,
  },
  popupDetail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  reportModal: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  reportModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  reportModalText: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 10,
  },
  reportModalCoords: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
  },
  reportModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  reportCancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  reportCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  reportConfirmButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#F58500',
    minWidth: 92,
    alignItems: 'center',
  },
  reportConfirmText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
