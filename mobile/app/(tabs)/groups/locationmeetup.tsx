import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  Animated,
  PanResponder,
  ActivityIndicator,
} from 'react-native';
import * as MapLibreRN from '@maplibre/maplibre-react-native';
import {
  Camera,
  UserLocation,
  type CameraRef,
  ShapeSource,
  CircleLayer,
} from '@maplibre/maplibre-react-native';
const { MapView } = MapLibreRN;
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';

const GROUP_NAME_KEY = 'emergency_group_name';
const MEETUP_ADDRESS_KEY = 'emergency_group_meetup_address';
const MEETUP_COORDS_KEY = 'emergency_group_meetup_coords';

type LatLng = {
  latitude: number;
  longitude: number;
};

type PhotonFeature = {
  geometry?: {
    coordinates?: [number, number];
  };
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
};

type AddressSuggestion = {
  id: string;
  label: string;
  coords: LatLng;
};

type PlaceholderMember = {
  id: string;
  name: string;
  coordinate: LatLng;
  avatar: string;
};

const FALLBACK_COORDS: [number, number] = [-122.4194, 37.7749];
const DEFAULT_ZOOM = 12;

// The visible content of the panel is 290px tall.
// We add 200px of overhang below the screen so there is never a grey gap —
// the panel background extends well past the bottom edge.
const PANEL_VISIBLE_HEIGHT = 290;
const PANEL_OVERHANG = 200;
const PANEL_TOTAL_HEIGHT = PANEL_VISIBLE_HEIGHT + PANEL_OVERHANG;

// When collapsed we slide down so only ~68px (drag handle + start of title) peeks.
const SHEET_EXPANDED = 0;
const SHEET_COLLAPSED = PANEL_VISIBLE_HEIGHT - 68;

function buildPhotonLabel(feature: PhotonFeature) {
  const p = feature.properties ?? {};
  const line1 = [p.name, p.street, p.housenumber].filter(Boolean).join(' ');
  const line2 = [p.city, p.state, p.postcode, p.country].filter(Boolean).join(', ');
  return [line1, line2].filter(Boolean).join(', ') || 'Selected meetup location';
}

function buildPlaceholderMembers(center: LatLng): PlaceholderMember[] {
  return [
    {
      id: '1',
      name: 'Member 1',
      coordinate: { latitude: center.latitude + 0.004, longitude: center.longitude - 0.003 },
      avatar: 'https://via.placeholder.com/48/8ec5ff',
    },
    {
      id: '2',
      name: 'Member 2',
      coordinate: { latitude: center.latitude - 0.005, longitude: center.longitude - 0.006 },
      avatar: 'https://via.placeholder.com/48/ffd36e',
    },
    {
      id: '3',
      name: 'Member 3',
      coordinate: { latitude: center.latitude - 0.007, longitude: center.longitude + 0.004 },
      avatar: 'https://via.placeholder.com/48/ff9f7a',
    },
  ];
}

function latLngToCoords(latlng: LatLng): [number, number] {
  return [latlng.longitude, latlng.latitude];
}

export default function LocationMeetupScreen() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraRef>(null);
  const hasCenteredOnUserRef = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [mapLoadCount, setMapLoadCount] = useState(0);
  const [locationResolved, setLocationResolved] = useState(false);
  
  const [groupName, setGroupName] = useState('Name of Group');
  const [memberPins, setMemberPins] = useState<PlaceholderMember[]>(
    buildPlaceholderMembers({ latitude: FALLBACK_COORDS[1], longitude: FALLBACK_COORDS[0] })
  );

  const [locationGranted, setLocationGranted] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);

  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSearchCard, setShowSearchCard] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [meetupAddress, setMeetupAddress] = useState('');
  const [meetupCoords, setMeetupCoords] = useState<LatLng | null>(null);

  const sheetTranslateY = useRef(new Animated.Value(SHEET_EXPANDED)).current;
  const lastSheetTranslateY = useRef(SHEET_EXPANDED);

  // Floating buttons track above the sheet as it moves
  const floatingButtonsBottom = useRef(
    new Animated.Value(PANEL_VISIBLE_HEIGHT + 16)
  ).current;

  useFocusEffect(
    React.useCallback(() => {
      loadSavedData();
    }, [])
  );

  useEffect(() => {
    if (!mapReady || !userCoords || hasCenteredOnUserRef.current || !cameraRef.current) return;
    hasCenteredOnUserRef.current = true;
    cameraRef.current.setCamera({
      centerCoordinate: userCoords,
      zoomLevel: 14,
      animationDuration: 0,
    });
  }, [mapReady, userCoords]);

  // Keep floating buttons above the sheet
  useEffect(() => {
    const id = sheetTranslateY.addListener(({ value }) => {
      floatingButtonsBottom.setValue(PANEL_VISIBLE_HEIGHT - value + 16);
    });
    return () => sheetTranslateY.removeListener(id);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 5,
      onPanResponderGrant: () => {
        sheetTranslateY.stopAnimation((value: number) => {
          lastSheetTranslateY.current = value;
        });
      },
      onPanResponderMove: (_, gesture) => {
        let nextValue = lastSheetTranslateY.current + gesture.dy;
        if (nextValue < SHEET_EXPANDED) nextValue = SHEET_EXPANDED;
        if (nextValue > SHEET_COLLAPSED) nextValue = SHEET_COLLAPSED;
        sheetTranslateY.setValue(nextValue);
      },
      onPanResponderRelease: (_, gesture) => {
        let finalValue = lastSheetTranslateY.current;

        if (gesture.dy < -40) {
          finalValue = SHEET_EXPANDED;
        } else if (gesture.dy > 40) {
          finalValue = SHEET_COLLAPSED;
        } else {
          sheetTranslateY.stopAnimation((value: number) => {
            finalValue =
              value < (SHEET_COLLAPSED - SHEET_EXPANDED) / 2
                ? SHEET_EXPANDED
                : SHEET_COLLAPSED;
            Animated.spring(sheetTranslateY, {
              toValue: finalValue,
              useNativeDriver: true,
              tension: 80,
              friction: 12,
            }).start(() => {
              lastSheetTranslateY.current = finalValue;
            });
          });
          return;
        }

        Animated.spring(sheetTranslateY, {
          toValue: finalValue,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }).start(() => {
          lastSheetTranslateY.current = finalValue;
        });
      },
    })
  ).current;

  const loadSavedData = async () => {
    try {
      hasCenteredOnUserRef.current = false;
      setLocationResolved(false);

      const savedGroupName = await AsyncStorage.getItem(GROUP_NAME_KEY);
      const savedAddress = await AsyncStorage.getItem(MEETUP_ADDRESS_KEY);
      const savedCoords = await AsyncStorage.getItem(MEETUP_COORDS_KEY);

      if (savedGroupName) setGroupName(savedGroupName);
      if (savedAddress) setMeetupAddress(savedAddress);

      if (savedCoords) {
        const parsed = JSON.parse(savedCoords) as LatLng;
        setMeetupCoords(parsed);
      } else {
        setMeetupCoords(null);
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      setLocationGranted(permission.status === 'granted');
      setLocationResolved(true);
    } catch (error) {
      console.log('Error loading meetup data:', error);
      setLocationGranted(false);
      setLocationResolved(true);
    }
  };

  const saveMeetup = async (address: string, coords: LatLng) => {
    try {
      await AsyncStorage.setItem(MEETUP_ADDRESS_KEY, address);
      await AsyncStorage.setItem(MEETUP_COORDS_KEY, JSON.stringify(coords));
      setMeetupAddress(address);
      setMeetupCoords(coords);
    } catch (error) {
      console.log('Error saving meetup:', error);
      Alert.alert('Error', 'Could not save meetup location.');
    }
  };

  const animateTo = (coords: LatLng, zoom = 14) => {
    cameraRef.current?.setCamera({
      centerCoordinate: [coords.longitude, coords.latitude],
      zoomLevel: zoom,
      animationDuration: 600,
    });
  };

  const handleUserLocationUpdate = (location: any) => {
    const coords = location?.coords;
    if (!coords) return;
    const nextLocation: LatLng = { latitude: coords.latitude, longitude: coords.longitude };
    const nextCoords: [number, number] = [coords.longitude, coords.latitude];
    setUserLocation(nextLocation);
    setUserCoords(nextCoords);
    setLocationGranted(true);
    setMemberPins(buildPlaceholderMembers(nextLocation));
  };

  const handleMapPress = async (e: any) => {
    const coords = e.geometry?.coordinates ?? e.nativeEvent?.geometry?.coordinates;
    if (!coords || coords.length < 2) return;
    const lng = coords[0];
    const lat = coords[1];
    await saveMeetup(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, { latitude: lat, longitude: lng });
    animateTo({ latitude: lat, longitude: lng });
  };

  const fetchPhotonSuggestions = async (input: string) => {
    setSearchText(input);
    if (!input.trim()) { setSuggestions([]); return; }

    try {
      setLoadingSuggestions(true);
      const searchCenter = userCoords ?? FALLBACK_COORDS;
      const url =
        `https://photon.komoot.io/api/?q=${encodeURIComponent(input)}` +
        `&limit=6&lat=${searchCenter[1]}&lon=${searchCenter[0]}`;
      const response = await fetch(url);
      const data = await response.json();

      const nextSuggestions: AddressSuggestion[] = (data?.features ?? [])
        .map((feature: PhotonFeature, index: number) => {
          const c = feature.geometry?.coordinates;
          if (!c || c.length < 2) return null;
          return {
            id: `${c[0]}_${c[1]}_${index}`,
            label: buildPhotonLabel(feature),
            coords: { latitude: c[1], longitude: c[0] },
          };
        })
        .filter(Boolean) as AddressSuggestion[];

      setSuggestions(nextSuggestions);
    } catch (error) {
      console.log('Photon search error:', error);
      setSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSelectSuggestion = async (item: AddressSuggestion) => {
    await saveMeetup(item.label, item.coords);
    animateTo(item.coords);
    setSearchText(item.label);
    setSuggestions([]);
    setShowSearchCard(false);
  };

  const handleSaveCurrentMeetup = async () => {
    if (!meetupCoords) {
      Alert.alert('No meetup selected', 'Drop a pin on the map or search for an address first.');
      return;
    }
    try {
      const address =
        meetupAddress ||
        `${meetupCoords.latitude.toFixed(5)}, ${meetupCoords.longitude.toFixed(5)}`;
      await AsyncStorage.setItem(MEETUP_ADDRESS_KEY, address);
      await AsyncStorage.setItem(MEETUP_COORDS_KEY, JSON.stringify(meetupCoords));
      setMeetupAddress(address);
      setMeetupCoords(meetupCoords);
      router.back();
    } catch (error) {
      console.log('Error saving meetup before exit:', error);
      Alert.alert('Error', 'Could not save meetup location.');
    }
  };

  const handleBackPress = async () => {
    try {
      if (meetupCoords) {
        const address =
          meetupAddress ||
          `${meetupCoords.latitude.toFixed(5)}, ${meetupCoords.longitude.toFixed(5)}`;
        await AsyncStorage.setItem(MEETUP_ADDRESS_KEY, address);
        await AsyncStorage.setItem(MEETUP_COORDS_KEY, JSON.stringify(meetupCoords));
      }
    } catch (error) {
      console.log('Error saving before going back:', error);
    } finally {
      router.back();
    }
  };

  const handleSnapToMeetupPin = () => {
    if (!meetupCoords) { Alert.alert('No meetup pin', 'Set a meetup location first.'); return; }
    animateTo(meetupCoords, 14);
  };

  const handleSnapToUserLocation = () => {
    if (!userLocation) { Alert.alert('Location unavailable', 'Waiting for your live location.'); return; }
    animateTo(userLocation, 14);
  };

  const membersGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: memberPins.map((member) => ({
      type: 'Feature',
      properties: { id: member.id, name: member.name, avatar: member.avatar },
      geometry: { type: 'Point', coordinates: latLngToCoords(member.coordinate) },
    })),
  };

  const meetupGeoJSON: GeoJSON.FeatureCollection = meetupCoords
    ? {
        type: 'FeatureCollection',
        features: [{
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: latLngToCoords(meetupCoords) },
        }],
      }
    : { type: 'FeatureCollection', features: [] };

  const map_light_mode = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
  const meetupSourceKey = meetupCoords
    ? `meetup-pin-${meetupCoords.latitude}-${meetupCoords.longitude}-${mapLoadCount}`
    : `meetup-pin-empty-${mapLoadCount}`;

  return (
    <>
      <StatusBar style="light" backgroundColor="#F58500" />

      {/* Match panel color so any background bleed is invisible */}
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.screen}>
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>{groupName}</Text>
              <Ionicons name="pencil" size={16} color="#111" />
            </View>
          </View>

          <View style={styles.mapWrap}>
            {!locationResolved ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#F58500" />
              </View>
            ) : (
              <MapView
                style={StyleSheet.absoluteFill}
                mapStyle={map_light_mode}
                onDidFinishLoadingMap={() => {
                  setMapReady(true);
                  setMapLoadCount((c) => c + 1);
                }}
                onPress={handleMapPress}
                compassEnabled={false}
                attributionEnabled={false}
              >
                <Camera
                  ref={cameraRef}
                  defaultSettings={{ centerCoordinate: FALLBACK_COORDS, zoomLevel: DEFAULT_ZOOM }}
                />
                {locationGranted && (
                  <UserLocation
                    visible={true}
                    onUpdate={handleUserLocationUpdate}
                    renderMode="native"
                    androidRenderMode="normal"
                  />
                )}
                <ShapeSource id="member-pins" shape={membersGeoJSON}>
                  <CircleLayer
                    id="member-pins-layer"
                    style={{
                      circleColor: '#F58500',
                      circleRadius: 10,
                      circleStrokeWidth: 3,
                      circleStrokeColor: '#FFFFFF',
                    }}
                  />
                </ShapeSource>
                <ShapeSource key={meetupSourceKey} id="meetup-pin" shape={meetupGeoJSON}>
                  <CircleLayer
                    id="meetup-pin-layer"
                    style={{
                      circleColor: '#2563EB',
                      circleRadius: 10,
                      circleStrokeWidth: 4,
                      circleStrokeColor: '#FFFFFF',
                    }}
                  />
                </ShapeSource>
              </MapView>
            )}

            {/* Floating buttons — animated to always sit above the sheet */}
            <Animated.View
              style={[styles.floatingButtonsWrap, { bottom: floatingButtonsBottom }]}
            >
              <TouchableOpacity
                style={[styles.floatingButton, styles.myLocationButton]}
                onPress={handleSnapToUserLocation}
              >
                <Ionicons name="locate" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.floatingButton, styles.meetupPinButton]}
                onPress={handleSnapToMeetupPin}
              >
                <Ionicons name="location" size={20} color="#fff" />
              </TouchableOpacity>
            </Animated.View>

            {/* Search card with tap-outside-to-close backdrop */}
            {showSearchCard && (
              <>
                <TouchableOpacity
                  style={StyleSheet.absoluteFill}
                  activeOpacity={1}
                  onPress={() => setShowSearchCard(false)}
                />
                <View style={styles.searchModal}>
                  <View style={styles.searchModalHeader}>
                    <Ionicons name="search" size={20} color="#F58500" style={{ marginRight: 8 }} />
                    <Text style={styles.searchLabel}>Search Address</Text>
                  </View>
                  <TextInput
                    value={searchText}
                    onChangeText={fetchPhotonSuggestions}
                    style={styles.searchField}
                    placeholder="Enter address..."
                    placeholderTextColor="#BBAA99"
                    autoFocus
                  />
                  <FlatList
                    data={suggestions}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    style={styles.suggestionList}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.suggestionRow}
                        onPress={() => handleSelectSuggestion(item)}
                      >
                        <Ionicons
                          name="location-outline"
                          size={16}
                          color="#F58500"
                          style={{ marginRight: 10 }}
                        />
                        <Text style={styles.suggestionText}>{item.label}</Text>
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={
                      searchText.trim() && !loadingSuggestions ? (
                        <Text style={styles.noResultsText}>No matching addresses found</Text>
                      ) : null
                    }
                  />
                  <TouchableOpacity style={styles.saveAddressButton} onPress={handleSaveCurrentMeetup}>
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.saveAddressButtonText}>SAVE ADDRESS</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Bottom sheet
                bottom: -PANEL_OVERHANG means the panel's bottom edge sits 200px
                below the screen — the background color extends there, so no gap. */}
            <Animated.View
              style={[
                styles.bottomPanel,
                { transform: [{ translateY: sheetTranslateY }] },
              ]}
            >
              <View {...panResponder.panHandlers} style={styles.dragArea}>
                <View style={styles.dragHandle} />
              </View>
              <Text style={styles.panelTitle}>Set Emergency Meetup Location</Text>
              <Text style={styles.panelSubtitle}>Drop a pin on the map</Text>
              <Text style={styles.panelOr}>--- OR ---</Text>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setShowSearchCard((prev) => !prev)}
              >
                <Text style={styles.secondaryButtonText}>SEARCH BY ADDRESS</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={handleSaveCurrentMeetup}>
                <Text style={styles.primaryButtonText}>SAVE</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7', // matches panel — any bleed is invisible
  },
  screen: {
    flex: 1,
  },
  header: {
    backgroundColor: '#F58500',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  backButton: {
    marginRight: 10,
    padding: 2,
  },
  headerTitleWrap: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF4E8',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 16,
    paddingRight: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    marginLeft: 18,
  },
  mapWrap: {
    flex: 1,
    position: 'relative',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F7F7',
  },
  floatingButtonsWrap: {
    position: 'absolute',
    right: 16,
    alignItems: 'center',
  },
  floatingButton: {
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
  myLocationButton: {
    marginBottom: 12,
  },
  meetupPinButton: {},
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -PANEL_OVERHANG, // extends 200px below screen — no gap possible
    backgroundColor: '#F7F7F7',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 22,
    height: PANEL_TOTAL_HEIGHT,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 10,
  },
  dragArea: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 10,
  },
  dragHandle: {
    width: 52,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D0D0D0',
  },
  panelTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#D97706',
    textAlign: 'center',
    marginBottom: 8,
  },
  panelSubtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
    textAlign: 'center',
  },
  panelOr: {
    marginTop: 10,
    marginBottom: 14,
    fontSize: 15,
    fontWeight: '700',
    color: '#444',
    textAlign: 'center',
  },
  secondaryButton: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#F58500',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  secondaryButtonText: {
    color: '#F58500',
    fontSize: 16,
    fontWeight: '700',
  },
  primaryButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F58500',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  searchModal: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 90,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#F58500',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
    maxHeight: 340,
    borderWidth: 1.5,
    borderColor: '#FFE0B2',
  },
  searchModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  searchLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F58500',
    letterSpacing: 0.3,
  },
  searchField: {
    height: 48,
    borderWidth: 1.5,
    borderColor: '#FFD0A0',
    backgroundColor: '#FFF8F0',
    paddingHorizontal: 18,
    borderRadius: 24,
    fontSize: 15,
    color: '#222',
    marginBottom: 10,
  },
  suggestionList: {
    maxHeight: 140,
    marginBottom: 12,
  },
  suggestionRow: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#FFE8CC',
    flexDirection: 'row',
    alignItems: 'center',
  },
  suggestionText: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  noResultsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 12,
  },
  saveAddressButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F58500',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F58500',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  saveAddressButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
