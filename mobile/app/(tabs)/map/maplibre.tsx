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
  PointAnnotation,
} from '@maplibre/maplibre-react-native';

const { MapView } = MapLibreRN;

import { Colors } from '@/constants/colors';
import {
  fetchFireData,
  fetchWeatherData,
  submitSelfReport,
  fetchNearbyResources,
} from '../../services/mapApi';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

import ResourceBottomSheet from './resourcesSlider';

// ── Filter chip config ───────────────────────────────────────────────────────
const FILTERS = [
  { id: 'all', label: 'All', icon: 'apps-outline' },
  { id: 'resources', label: 'Resources', icon: 'fast-food-outline' },
  { id: 'perimeters', label: 'Fire Perimeters', icon: 'flame-outline' },
  { id: 'hotspots', label: 'Satellite Hotspots', icon: 'radio-outline' },
  { id: 'prescribed', label: 'Prescribed Fires', icon: 'leaf-outline' },
  { id: 'weather', label: 'Weather Stations', icon: 'partly-sunny-outline' },
] as const;

type FilterId = typeof FILTERS[number]['id'];

import { ResourceType, ResourceFilterType, NearbyPlace } from './resourceTypes';

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

const extractGeoapifyPlacesFromGeoJSON = (
  data: GeoJSON.FeatureCollection,
  userCoords: [number, number] | null
): NearbyPlace[] => {
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const getDistanceMeters = (
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

  const places = (data.features ?? [])
    .filter((f): f is GeoJSON.Feature<GeoJSON.Point> => f.geometry?.type === 'Point')
    .map((f, index) => {
      const coords = f.geometry.coordinates as [number, number];

      const computedDistance = userCoords
        ? getDistanceMeters(userCoords, coords)
        : undefined;

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
          getFeatureProp<string>(f, 'address_line1') ??
          getFeatureProp<string>(f, 'address_line2'),
        type:
          (getFeatureProp<string>(f, 'resource_type') as ResourceType) ?? 'grocery',
        distanceMeters:
          getFeatureProp<number>(f, 'distanceMeters') ??
          getFeatureProp<number>(f, 'distance') ??
          computedDistance,
        rating: getFeatureProp<number>(f, 'rating'),
        isOpen: getFeatureProp<boolean>(f, 'isOpen'),
      };
    });

  return userCoords
    ? places.sort(
        (a, b) =>
          (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) -
          (b.distanceMeters ?? Number.MAX_SAFE_INTEGER)
      )
    : places;
};

const extractHospitalsFromGeoJSON = (
  data: GeoJSON.FeatureCollection,
  userCoords: [number, number] | null
): NearbyPlace[] => {
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const getDistanceMeters = (
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

  const places = (data.features ?? [])
    .filter((f): f is GeoJSON.Feature<GeoJSON.Point> => f.geometry?.type === 'Point')
    .map((f, index) => {
      const coords = f.geometry.coordinates as [number, number];
      const props = f.properties ?? {};

      const name =
        (props.NAME as string) ??
        (props.Name as string) ??
        (props.name as string) ??
        (props.FACILITY as string) ??
        'Unnamed hospital';

      const address =
        (props.ADDRESS as string) ??
        (props.Address as string) ??
        (props.address as string) ??
        [props.CITY, props.STATE].filter(Boolean).join(', ');

      const distanceMeters = userCoords
        ? getDistanceMeters(userCoords, coords)
        : undefined;

      return {
        id: String(
          props.OBJECTID ??
            props.ID ??
            props.id ??
            props.place_id ??
            index
        ),
        name,
        latitude: coords[1],
        longitude: coords[0],
        address: address || undefined,
        type: 'hospital' as ResourceType,
        distanceMeters,
      };
    });

  return userCoords
    ? places.sort(
        (a, b) =>
          (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) -
          (b.distanceMeters ?? Number.MAX_SAFE_INTEGER)
      )
    : places;
};

const getResourceMarkerIconName = (
  type: ResourceType
): keyof typeof Ionicons.glyphMap => {
  switch (type) {
    case 'hospital':
      return 'medkit';
    case 'pharmacy':
      return 'medical';
    case 'gas':
      return 'car';
    case 'grocery':
      return 'cart';
    case 'hotels':
      return 'bed';
    case 'convenience':
      return 'storefront';
    default:
      return 'location';
  }
};

const getResourceFeatureType = (feature: GeoJSON.Feature): ResourceType => {
  const rawType =
    (feature.properties?.resource_type as ResourceType | undefined) ??
    (feature.properties?.type as ResourceType | undefined);

  if (rawType) return rawType;

  const name = String(
    feature.properties?.NAME ??
      feature.properties?.Name ??
      feature.properties?.name ??
      ''
  ).toLowerCase();

  if (name.includes('hospital')) return 'hospital';
  return 'hospital';
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
  const [hospitalsData, setHospitalsData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [resourceType, setResourceType] = useState<ResourceFilterType>('all');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [distanceRadius, setDistanceRadius] = useState(10000);

  // Report fire modal state
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [selfReportsData, setSelfReportsData] = useState<GeoJSON.FeatureCollection | null>(null);

  // Selected marker ids for visual highlighting
  const [selectedFireId, setSelectedFireId] = useState<string | null>(null);
  const [selectedWeatherId, setSelectedWeatherId] = useState<string | null>(null);

  const clearSelections = () => {
    setSelectedData(null);
    setSelectedStation(null);
    setSelectedPlaceId(null);
    setSelectedFireId(null);
    setSelectedWeatherId(null);
  };

  const focusCameraOnCoordinate = (
    coordinate: [number, number],
    zoomLevel = 13
  ) => {
    if (!cameraRef.current) return;

    cameraRef.current.setCamera({
      centerCoordinate: coordinate,
      zoomLevel,
      heading: 0,
      pitch: 0,
      animationMode: 'flyTo',
      animationDuration: 600,
    });
  };

  const getFeatureId = (feature: GeoJSON.Feature, fallback = ''): string => {
    return String(
      feature.properties?.id ??
        feature.properties?.place_id ??
        feature.properties?.OBJECTID ??
        feature.properties?.ID ??
        feature.properties?.reportId ??
        feature.properties?.incident_number ??
        fallback
    );
  };

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
    if (!locationGranted) return;

    let subscription: Location.LocationSubscription | null = null;

    (async () => {
      try {
        const lastKnown = await Location.getLastKnownPositionAsync();

        if (lastKnown) {
          setUserCoords([lastKnown.coords.longitude, lastKnown.coords.latitude]);
        } else {
          const current = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          setUserCoords([current.coords.longitude, current.coords.latitude]);
        }

        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 1,
          },
          (location) => {
            setUserCoords([location.coords.longitude, location.coords.latitude]);
          }
        );
      } catch (err) {
        console.warn('Could not get current position:', err);
      }
    })();

    return () => subscription?.remove();
  }, [locationGranted]);

  useEffect(() => {
    if (!mapReady || !userCoords || hasCenteredOnUserRef.current || !cameraRef.current) return;

    hasCenteredOnUserRef.current = true;
    cameraRef.current.setCamera({
      centerCoordinate: userCoords,
      zoomLevel: 13,
      heading: 0,
      pitch: 0,
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

        setHospitalsData({
          type: 'FeatureCollection',
          features: data.hospitals?.features ?? [],
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

  const ALL_RESOURCE_TYPES: ResourceType[] = [
    'hospital',
    'pharmacy',
    'gas',
    'grocery',
    'hotels',
    'convenience',
  ];

  useEffect(() => {
    if (!userCoords) return;

    const loadResources = async () => {
      try {
        setResourcesLoading(true);
        setResourcesError(null);

        const [longitude, latitude] = userCoords;

        if (resourceType === 'all') {
          const apiTypes: ResourceType[] = [
            'pharmacy',
            'gas',
            'grocery',
            'hotels',
            'convenience',
          ];

          const [apiResults, hospitalCollection] = await Promise.all([
            Promise.all(
              apiTypes.map((type) =>
                fetchNearbyResources({ latitude, longitude, type, radius: distanceRadius })
                  .then((data) => extractGeoapifyPlacesFromGeoJSON(data, userCoords))
                  .catch(() => [] as NearbyPlace[])
              )
            ),
            Promise.resolve(
              extractHospitalsFromGeoJSON(
                hospitalsData ?? { type: 'FeatureCollection', features: [] },
                userCoords
              ).filter((p) => p.distanceMeters == null || p.distanceMeters <= distanceRadius)
            ),
          ]);

          const allPlaces = [hospitalCollection, ...apiResults].flat();

          const seen = new Set<string>();
          const dedupedPlaces = allPlaces.filter((p) => {
            if (seen.has(p.id)) return false;
            seen.add(p.id);
            return true;
          });

          dedupedPlaces.sort(
            (a, b) =>
              (a.distanceMeters ?? Number.MAX_SAFE_INTEGER) -
              (b.distanceMeters ?? Number.MAX_SAFE_INTEGER)
          );

          const mergedFeatures: GeoJSON.Feature[] = dedupedPlaces.map((place) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [place.longitude, place.latitude] },
            properties: {
              id: place.id,
              name: place.name,
              resource_type: place.type,
              distanceMeters: place.distanceMeters,
            },
          }));

          setResourcesData({ type: 'FeatureCollection', features: mergedFeatures });
          setNearbyPlaces(dedupedPlaces);
          setSheetOpen(true);
          return;
        }

        if (resourceType === 'hospital') {
          const hospitalCollection: GeoJSON.FeatureCollection = hospitalsData ?? {
            type: 'FeatureCollection',
            features: [],
          };
          setResourcesData(hospitalCollection);
          setNearbyPlaces(extractHospitalsFromGeoJSON(hospitalCollection, userCoords));
          setSheetOpen(true);
          return;
        }

        const data = await fetchNearbyResources({
          latitude,
          longitude,
          type: resourceType,
          radius: distanceRadius,
        });

        setResourcesData(data);
        setNearbyPlaces(extractGeoapifyPlacesFromGeoJSON(data, userCoords));
        setSheetOpen(true);
      } catch (err) {
        console.error('Failed to fetch nearby resources:', err);
        setResourcesError('Failed to load nearby resources');
      } finally {
        setResourcesLoading(false);
      }
    };

    loadResources();
  }, [userCoords, resourceType, distanceRadius, hospitalsData]);

  useEffect(() => {
    if (!mapReady) return;

    const q = query(collection(db, 'self_reports'), where('isActive', '==', true));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const features: GeoJSON.Feature[] = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [data.longitude, data.latitude],
            },
            properties: {
              reportId: doc.id,
              type: data.type ?? 'fire',
              status: data.status ?? 'pending',
              description: data.description ?? '',
              source: data.source ?? 'user',
              confirmedCount: data.confirmedCount ?? 0,
              isActive: data.isActive ?? true,
            },
          };
        });

        setSelfReportsData({ type: 'FeatureCollection', features });
      },
      (err) => {
        console.error('Self-reports listener error:', err);
      }
    );

    return () => unsubscribe();
  }, [mapReady]);

  const getFeatureCenter = (feature: GeoJSON.Feature): [number, number] | null => {
    const geom = feature.geometry;
    if (!geom) return null;

    if (geom.type === 'Point') {
      return geom.coordinates as [number, number];
    }

    if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
      const coords =
        geom.type === 'Polygon' ? geom.coordinates[0] : geom.coordinates[0][0];

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
    const featureId = getFeatureId(feature);

    setSelectedStation(null);
    setSelectedPlaceId(null);
    setSelectedWeatherId(null);
    setSelectedFireId(featureId);
    setSelectedData(feature);

    const center = getFeatureCenter(feature);
    if (center) {
      const zoom =
        feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon'
          ? 10
          : 13;

      focusCameraOnCoordinate(center, zoom);
    }
  };

  const handleStationPress = (feature: GeoJSON.Feature) => {
    const featureId = getFeatureId(feature);

    setSelectedData(null);
    setSelectedPlaceId(null);
    setSelectedFireId(null);
    setSelectedWeatherId(featureId);
    setSelectedStation(feature);

    const center = getFeatureCenter(feature);
    if (center) {
      focusCameraOnCoordinate(center, 13);
    }
  };

  const handleResourcePress = (feature: GeoJSON.Feature) => {
    const center = getFeatureCenter(feature);
    const id = getFeatureId(feature);

    setSelectedData(null);
    setSelectedStation(null);
    setSelectedFireId(null);
    setSelectedWeatherId(null);
    setSelectedPlaceId(id);
    setSheetOpen(true);

    if (center) {
      focusCameraOnCoordinate(center, 13);
    }
  };

  const handleSelectPlaceFromSheet = (place: NearbyPlace) => {
    setSelectedData(null);
    setSelectedStation(null);
    setSelectedFireId(null);
    setSelectedWeatherId(null);

    if (selectedPlaceId === place.id) {
      setSelectedPlaceId(null);
    } else {
      setSelectedPlaceId(place.id);
      focusCameraOnCoordinate([place.longitude, place.latitude], 13);
    }
  };

  const handleUserLocationUpdate = (location: any) => {
    const coords = location?.coords;
    if (!coords) return;
    setUserCoords([coords.longitude, coords.latitude]);
  };

  const handleLocateMe = async () => {
    if (!cameraRef.current) return;

    clearSelections();

    try {
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords: [number, number] = [
        current.coords.longitude,
        current.coords.latitude,
      ];

      setUserCoords(coords);

      cameraRef.current.setCamera({
        centerCoordinate: coords,
        zoomLevel: 13,
        heading: 0,
        pitch: 0,
        animationMode: 'flyTo',
        animationDuration: 600,
      });
    } catch (err) {
      console.warn('Locate me failed:', err);

      cameraRef.current.setCamera({
        centerCoordinate: CA_CENTER,
        zoomLevel: CA_ZOOM,
        heading: 0,
        pitch: 0,
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

    clearSelections();
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

  const visibleNearbyPlaces = useMemo(() => {
    if (resourceType === 'all') return nearbyPlaces;

    if (resourceType === 'hospital') {
      return nearbyPlaces.filter(
        (place) => place.distanceMeters == null || place.distanceMeters <= distanceRadius
      );
    }

    return nearbyPlaces;
  }, [nearbyPlaces, resourceType, distanceRadius]);

  const visibleResourcesData = useMemo<GeoJSON.FeatureCollection | null>(() => {
    if (!resourcesData) return null;

    const allowedIds = new Set(visibleNearbyPlaces.map((place) => place.id));

    return {
      type: 'FeatureCollection',
      features: (resourcesData.features ?? []).filter((feature) => {
        const id = String(
          feature.properties?.id ??
            feature.properties?.place_id ??
            feature.properties?.OBJECTID ??
            feature.properties?.ID ??
            ''
        );

        return allowedIds.has(id);
      }),
    };
  }, [resourcesData, visibleNearbyPlaces]);

  const visibleResourcePointFeatures = useMemo<GeoJSON.Feature<GeoJSON.Point>[]>(() => {
    return (visibleResourcesData?.features ?? []).filter(
      (feature): feature is GeoJSON.Feature<GeoJSON.Point> =>
        feature.geometry?.type === 'Point'
    );
  }, [visibleResourcesData]);

  const hotspotsCount = hotspotsData?.features.length ?? 0;
  const perimetersCount = perimetersData?.features.length ?? 0;
  const prescribedCount = prescribedData?.features.length ?? 0;
  const weatherCount = weatherData?.features.length ?? 0;
  const resourcesCount = visibleNearbyPlaces.length;

  const mapLightMode =
    'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

  const selectedResourceFeatureId = useMemo(
    () => selectedPlaceId ?? '__none__',
    [selectedPlaceId]
  );

  const selectedFireFeatureId = useMemo(
    () => selectedFireId ?? '__none__',
    [selectedFireId]
  );

  const selectedWeatherFeatureId = useMemo(
    () => selectedWeatherId ?? '__none__',
    [selectedWeatherId]
  );

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
          defaultSettings={{
            centerCoordinate: CA_CENTER,
            zoomLevel: CA_ZOOM,
            heading: 0,
            pitch: 0,
          }}
        />

        {locationGranted && (
          <UserLocation
            visible={locationGranted}
            onUpdate={handleUserLocationUpdate}
            renderMode="native"
            androidRenderMode="normal"
          />
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
                circleColor: [
                  'case',
                  [
                    '==',
                    [
                      'to-string',
                      ['coalesce', ['get', 'id'], ['get', 'OBJECTID'], ['get', 'incident_number'], ''],
                    ],
                    selectedFireFeatureId,
                  ],
                  '#C2410C',
                  '#FF6B35',
                ],
                circleRadius: [
                  'case',
                  [
                    '==',
                    [
                      'to-string',
                      ['coalesce', ['get', 'id'], ['get', 'OBJECTID'], ['get', 'incident_number'], ''],
                    ],
                    selectedFireFeatureId,
                  ],
                  5,
                  3,
                ],
                circleOpacity: 0.9,
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
                fillColor: [
                  'case',
                  [
                    '==',
                    [
                      'to-string',
                      ['coalesce', ['get', 'id'], ['get', 'OBJECTID'], ['get', 'incident_number'], ''],
                    ],
                    selectedFireFeatureId,
                  ],
                  '#B91C1C',
                  '#FF4444',
                ],
                fillOpacity: 1,
                fillOutlineColor: [
                  'case',
                  [
                    '==',
                    [
                      'to-string',
                      ['coalesce', ['get', 'id'], ['get', 'OBJECTID'], ['get', 'incident_number'], ''],
                    ],
                    selectedFireFeatureId,
                  ],
                  '#7F1D1D',
                  '#CC0000',
                ],
              }}
            />
          </ShapeSource>
        )}

        {(activeFilter === 'all' || activeFilter === 'prescribed') &&
          (prescribedData?.features ?? [])
            .filter((f): f is GeoJSON.Feature<GeoJSON.Point> => f.geometry?.type === 'Point')
            .map((feature, idx) => {
              const coords = feature.geometry.coordinates as [number, number];
              const id = getFeatureId(feature, String(idx));
              const selected = selectedFireId === id;

              return (
                <PointAnnotation
                  key={`prescribed-${id}-${selected ? 'sel' : 'def'}`}
                  id={`prescribed-${id}`}
                  coordinate={coords}
                  onSelected={() => handleFirePress(feature)}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View
                      style={[
                        styles.prescribedMarker,
                        selected && styles.prescribedMarkerSelected,
                      ]}
                    >
                      <Ionicons name="leaf" size={12} color="#FFFFFF" />
                    </View>
                  </View>
                </PointAnnotation>
              );
            })}

        {(activeFilter === 'all' || activeFilter === 'prescribed') && prescribedData && (
          <ShapeSource
            id="prescribed-polygon-data"
            shape={{
              type: 'FeatureCollection',
              features: (prescribedData.features ?? []).filter(
                (f) => f.geometry?.type !== 'Point'
              ),
            }}
            onPress={(e) => handleFirePress(e.features[0])}
          >
            <FillLayer
              id="prescribed-polygon-layer"
              style={{
                fillColor: [
                  'case',
                  [
                    '==',
                    [
                      'to-string',
                      ['coalesce', ['get', 'id'], ['get', 'OBJECTID'], ['get', 'incident_number'], ''],
                    ],
                    selectedFireFeatureId,
                  ],
                  '#5B21B6',
                  '#7C3AED',
                ],
                fillOpacity: 0.45,
                fillOutlineColor: [
                  'case',
                  [
                    '==',
                    [
                      'to-string',
                      ['coalesce', ['get', 'id'], ['get', 'OBJECTID'], ['get', 'incident_number'], ''],
                    ],
                    selectedFireFeatureId,
                  ],
                  '#4C1D95',
                  '#5B21B6',
                ],
              }}
            />
          </ShapeSource>
        )}

        {(activeFilter === 'all' || activeFilter === 'weather') &&
          (weatherData?.features ?? [])
            .filter((f): f is GeoJSON.Feature<GeoJSON.Point> => f.geometry?.type === 'Point')
            .map((feature, idx) => {
              const coords = feature.geometry.coordinates as [number, number];
              const id = getFeatureId(feature, String(idx));
              const selected = selectedWeatherId === id;

              return (
                <PointAnnotation
                  key={`weather-${id}-${selected ? 'sel' : 'def'}`}
                  id={`weather-${id}`}
                  coordinate={coords}
                  onSelected={() => handleStationPress(feature)}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View
                      style={[
                        styles.weatherMarker,
                        selected && styles.weatherMarkerSelected,
                      ]}
                    >
                      <Ionicons name="partly-sunny" size={12} color="#FFFFFF" />
                    </View>
                  </View>
                </PointAnnotation>
              );
            })}

        {(activeFilter === 'all' || activeFilter === 'resources') &&
          visibleResourcePointFeatures.map((feature) => {
            const coords = feature.geometry.coordinates as [number, number];
            const markerId = String(
              feature.properties?.id ??
                feature.properties?.place_id ??
                feature.properties?.OBJECTID ??
                feature.properties?.ID ??
                ''
            );
            const selected = markerId === selectedResourceFeatureId;
            const resourceMarkerType = getResourceFeatureType(feature);

            return (
              <PointAnnotation
                key={`resource-${markerId}-${selected ? 'sel' : 'def'}`}
                id={`resource-${markerId}`}
                coordinate={coords}
                onSelected={() => handleResourcePress(feature)}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={[
                      styles.resourceMarker,
                      selected
                        ? styles.resourceMarkerSelected
                        : styles.resourceMarkerDefault,
                    ]}
                  >
                    <Ionicons
                      name={getResourceMarkerIconName(resourceMarkerType)}
                      size={11}
                      color="#FFFFFF"
                    />
                  </View>
                </View>
              </PointAnnotation>
            );
          })}

        {selfReportsData &&
          (selfReportsData.features ?? [])
            .filter((f): f is GeoJSON.Feature<GeoJSON.Point> => f.geometry?.type === 'Point')
            .map((feature, idx) => {
              const coords = feature.geometry.coordinates as [number, number];
              const id = getFeatureId(feature, String(idx));
              const selected = selectedFireId === id;

              return (
                <PointAnnotation
                  key={`selfreport-${id}-${selected ? 'sel' : 'def'}`}
                  id={`selfreport-${id}`}
                  coordinate={coords}
                  onSelected={() => handleFirePress(feature)}
                >
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <View
                      style={[
                        styles.selfReportMarker,
                        selected && styles.selfReportMarkerSelected,
                      ]}
                    >
                      <Ionicons name="warning" size={12} color="#FFFFFF" />
                    </View>
                  </View>
                </PointAnnotation>
              );
            })}
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
                  clearSelections();
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

                {isFireFilter && !firesLoading && !firesError && (
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

                {isResourceFilter &&
                  !resourcesLoading &&
                  !resourcesError &&
                  badgeCount > 0 && (
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
              onPress={() => {
                setSelectedData(null);
                setSelectedFireId(null);
              }}
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

            {!!selectedData.properties?.satellite && (
              <Text style={styles.popupDetail}>🛰️ Source: {selectedData.properties.satellite}</Text>
            )}

            {!!selectedData.properties?.confidence && (
              <Text style={styles.popupDetail}>
                🎯 Confidence:{' '}
                {CONFIDENCE_MAP[selectedData.properties.confidence] ??
                  selectedData.properties.confidence}
              </Text>
            )}

            {!!selectedData.properties?.acq_date && (
              <Text style={styles.popupDetail}>📅 Acquired: {selectedData.properties.acq_date}</Text>
            )}

            {!!selectedData.properties?.name && (
              <Text style={styles.popupDetail}>🌿 Name: {selectedData.properties.name}</Text>
            )}

            {!!selectedData.properties?.prescribed_date_start && (
              <Text style={styles.popupDetail}>
                🗓️ Start Date: {selectedData.properties.prescribed_date_start}
              </Text>
            )}

            {!!selectedData.properties?.incident_name && (
              <Text style={styles.popupDetail}>
                🔥 Incident Name: {selectedData.properties.incident_name}
              </Text>
            )}

            {!!selectedData.properties?.incident_number && (
              <Text style={styles.popupDetail}>
                📋 Incident #: {selectedData.properties.incident_number}
              </Text>
            )}

            {!!selectedData.properties?.source && selectedData.properties.source !== 'user' && (
              <Text style={styles.popupDetail}>📡 Source: {selectedData.properties.source}</Text>
            )}

            {!!selectedData.properties?.mission && (
              <Text style={styles.popupDetail}>🎯 Mission: {selectedData.properties.mission}</Text>
            )}

            {!!selectedData.properties?.displayStatus && (
              <Text style={styles.popupDetail}>
                📊 Status: {selectedData.properties.displayStatus}
              </Text>
            )}

            {!!selectedData.properties?.description &&
              selectedData.properties.source !== 'user' && (
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
              onPress={() => {
                setSelectedStation(null);
                setSelectedWeatherId(null);
              }}
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
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>

      <ResourceBottomSheet
        visible={sheetOpen}
        peekOnly={!!(selectedData || selectedStation)}
        isResourcesFilterActive={activeFilter === 'resources'}
        places={visibleNearbyPlaces}
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
    backgroundColor: '#EDE9FE',
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
    color: '#7C3AED',
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

  resourceMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  resourceMarkerDefault: {
    backgroundColor: '#10B981',
  },
  resourceMarkerSelected: {
    backgroundColor: '#065F46',
  },

  prescribedMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  prescribedMarkerSelected: {
    backgroundColor: '#5B21B6',
  },

  weatherMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  weatherMarkerSelected: {
    backgroundColor: '#1D4ED8',
  },

  selfReportMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  selfReportMarkerSelected: {
    backgroundColor: '#B45309',
  },
});