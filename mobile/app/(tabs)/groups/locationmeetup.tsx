import React, { useRef, useState, useEffect, useMemo } from 'react';
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
  Modal,
  ScrollView,
  Image,
} from 'react-native';
import * as MapLibreRN from '@maplibre/maplibre-react-native';
import {
  Camera,
  UserLocation,
  type CameraRef,
  ShapeSource,
  CircleLayer,
  SymbolLayer,
} from '@maplibre/maplibre-react-native';
const { MapView } = MapLibreRN;
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

const GROUP_NAME_KEY = 'emergency_group_name';
const GROUP_MEMBERS_KEY = 'emergency_group_members';
const MEETUP_ADDRESS_KEY = 'emergency_group_meetup_address';
const MEETUP_COORDS_KEY = 'emergency_group_meetup_coords';

type LatLng = {
  latitude: number;
  longitude: number;
};

// Mapbox token — add EXPO_PUBLIC_MAPBOX_TOKEN=pk.your_token_here to your .env
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

// Bias autocomplete toward Southern California
const MAPBOX_PROXIMITY = '-118.2437,34.0522';

type MapboxFeature = {
  id: string;
  place_name: string;
  center: [number, number]; // [longitude, latitude]
};

type AddressSuggestion = {
  id: string;
  label: string;
  coords: LatLng;
};

type SafetyStatus = 'SAFE' | 'NEED HELP!' | 'IN DANGER';

type SavedGroupMember = {
  id: string;
  uid?: string;
  name: string;
  avatar: string;
  status: SafetyStatus;
  phoneNumber?: string;
  source: 'contact' | 'firestore';
};

type LiveMapMember = {
  id: string;
  uid?: string;
  name: string;
  avatar: string;
  status: SafetyStatus;
  coordinate: LatLng | null;
  locationSharingEnabled: boolean;
  lastUpdated?: number | null;
  source: 'contact' | 'firestore';
};

const FALLBACK_COORDS: [number, number] = [-122.4194, 37.7749];
const DEFAULT_ZOOM = 12;

const PANEL_VISIBLE_HEIGHT = 290;
const PANEL_OVERHANG = 200;
const PANEL_TOTAL_HEIGHT = PANEL_VISIBLE_HEIGHT + PANEL_OVERHANG;

const SHEET_EXPANDED = 0;
const SHEET_COLLAPSED = PANEL_VISIBLE_HEIGHT - 68;

const AVATAR_COLORS = ['#F58500', '#E07000', '#FB923C', '#C2410C', '#EA580C'];

const getAvatarColor = (name: string) =>
  AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

function latLngToCoords(latlng: LatLng): [number, number] {
  return [latlng.longitude, latlng.latitude];
}

function formatLastUpdated(timestamp?: number | null) {
  if (!timestamp) return null;
  const date = new Date(timestamp);
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getCoordsFromUserData(data: any): LatLng | null {
  const liveLat = data?.location?.latitude;
  const liveLng = data?.location?.longitude;

  if (typeof liveLat === 'number' && typeof liveLng === 'number') {
    return { latitude: liveLat, longitude: liveLng };
  }

  const homeLat = data?.homeCoords?.latitude;
  const homeLng = data?.homeCoords?.longitude;

  if (typeof homeLat === 'number' && typeof homeLng === 'number') {
    return { latitude: homeLat, longitude: homeLng };
  }

  return null;
}

function getStatusColor(status: SafetyStatus) {
  if (status === 'SAFE') return '#22C55E';
  if (status === 'NEED HELP!') return '#F59E0B';
  if (status === 'IN DANGER') return '#EF4444';
  return '#9CA3AF';
}

export default function LocationMeetupScreen() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraRef>(null);
  const hasCenteredOnUserRef = useRef(false);

  const [mapReady, setMapReady] = useState(false);
  const [mapLoadCount, setMapLoadCount] = useState(0);
  const [locationResolved, setLocationResolved] = useState(false);
  
  const [groupName, setGroupName] = useState('Name of Group');
  const [groupMembers, setGroupMembers] = useState<SavedGroupMember[]>([]);
  const [memberPins, setMemberPins] = useState<LiveMapMember[]>([]);

  const [locationGranted, setLocationGranted] = useState(false);
  const [userLocation, setUserLocation] = useState<LatLng | null>(null);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);

  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSearchCard, setShowSearchCard] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [meetupAddress, setMeetupAddress] = useState('');
  const [meetupCoords, setMeetupCoords] = useState<LatLng | null>(null);

  // Member picker modal
  const [showMemberPicker, setShowMemberPicker] = useState(false);

  const sheetTranslateY = useRef(new Animated.Value(SHEET_EXPANDED)).current;
  const lastSheetTranslateY = useRef(SHEET_EXPANDED);

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

  useEffect(() => {
    const id = sheetTranslateY.addListener(({ value }) => {
      floatingButtonsBottom.setValue(PANEL_VISIBLE_HEIGHT - value + 16);
    });
    return () => sheetTranslateY.removeListener(id);
  }, [floatingButtonsBottom, sheetTranslateY]);

  useEffect(() => {
    if (groupMembers.length === 0) {
      setMemberPins([]);
      return;
    }

    const firestoreMembers = groupMembers.filter((m) => m.source === 'firestore');
    const contactMembers = groupMembers.filter((m) => m.source === 'contact');

    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const docsById = new Map(snapshot.docs.map((doc) => [doc.id, doc.data()]));

      const contactPins: LiveMapMember[] = contactMembers.map((member) => ({
        id: member.id,
        uid: member.uid,
        name: member.name,
        avatar: member.avatar,
        status: member.status,
        coordinate: null,
        locationSharingEnabled: false,
        lastUpdated: null,
        source: member.source,
      }));

      const firestorePins: LiveMapMember[] = firestoreMembers.map((member) => {
        const possibleId = member.uid || member.id.replace('firestore-', '');
        const data = docsById.get(possibleId);

        if (!data) {
          return {
            id: member.id,
            uid: member.uid,
            name: member.name,
            avatar: member.avatar,
            status: member.status,
            coordinate: null,
            locationSharingEnabled: false,
            lastUpdated: null,
            source: member.source,
          };
        }

        const coords = getCoordsFromUserData(data);
        const sharingEnabled =
          typeof data.locationSharingEnabled === 'boolean'
            ? data.locationSharingEnabled
            : true;

        return {
          id: member.id,
          uid: possibleId,
          name: `${data.firstName || ''} ${data.lastName || ''}`.trim() || member.name,
          avatar: data.photoURL || member.avatar,
          status: data.status || member.status,
          coordinate: sharingEnabled ? coords : null,
          locationSharingEnabled: sharingEnabled,
          lastUpdated:
            data.locationUpdatedAt?.toMillis?.() ??
            data.location?.timestamp ??
            data.lastSeen?.toMillis?.() ??
            data.updatedAt?.toMillis?.() ??
            null,
          source: member.source,
        };
      });

      setMemberPins([...contactPins, ...firestorePins]);
    });

    return () => unsubscribe();
  }, [groupMembers]);

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
      const savedMembersRaw = await AsyncStorage.getItem(GROUP_MEMBERS_KEY);

      const savedMembers: SavedGroupMember[] = savedMembersRaw
        ? JSON.parse(savedMembersRaw)
        : [];

      if (savedGroupName) setGroupName(savedGroupName);
      if (savedAddress) setMeetupAddress(savedAddress);

      if (savedCoords) {
        const parsed = JSON.parse(savedCoords) as LatLng;
        setMeetupCoords(parsed);
      } else {
        setMeetupCoords(null);
      }

      setGroupMembers(savedMembers);

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

    const nextLocation: LatLng = {
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
    const nextCoords: [number, number] = [coords.longitude, coords.latitude];

    setUserLocation(nextLocation);
    setUserCoords(nextCoords);
    setLocationGranted(true);
  };

  const handleMapPress = async (e: any) => {
    const coords = e.geometry?.coordinates ?? e.nativeEvent?.geometry?.coordinates;
    if (!coords || coords.length < 2) return;

    const lng = coords[0];
    const lat = coords[1];

    await saveMeetup(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, {
      latitude: lat,
      longitude: lng,
    });

    animateTo({ latitude: lat, longitude: lng });
  };

  const fetchMapboxSuggestions = async (input: string) => {
    setSearchText(input);
    if (!input.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      setLoadingSuggestions(true);
      // Use live user location as proximity when available, fall back to SoCal center
      const proximity = userCoords
        ? `${userCoords[0]},${userCoords[1]}`
        : MAPBOX_PROXIMITY;

      const url =
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(input)}.json` +
        `?access_token=${MAPBOX_TOKEN}` +
        `&autocomplete=true` +
        `&country=us` +
        `&types=address,place,neighborhood,locality` +
        `&proximity=${proximity}` +
        `&limit=6`;

      const response = await fetch(url);
      const data = await response.json();

      const nextSuggestions: AddressSuggestion[] = (data?.features ?? []).map(
        (feature: MapboxFeature) => ({
          id: feature.id,
          label: feature.place_name,
          coords: {
            latitude: feature.center[1],
            longitude: feature.center[0],
          },
        })
      );

      setSuggestions(nextSuggestions);
    } catch (error) {
      console.log('Mapbox geocoding error:', error);
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
    if (!meetupCoords) {
      Alert.alert('No meetup pin', 'Set a meetup location first.');
      return;
    }
    animateTo(meetupCoords, 14);
  };

  const handleSnapToUserLocation = () => {
    if (!userLocation) {
      Alert.alert('Location unavailable', 'Waiting for your live location.');
      return;
    }
    animateTo(userLocation, 14);
  };

  const handleSnapToMember = (member: LiveMapMember) => {
    if (!member.coordinate) return;
    setShowMemberPicker(false);
    // Wait for the modal fade-out before moving the camera
    setTimeout(() => animateTo(member.coordinate as LatLng, 15), 320);
  };

  const membersGeoJSON: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: memberPins
      .filter((member) => member.coordinate)
      .map((member) => ({
        type: 'Feature',
        properties: {
          id: member.id,
          name: member.name,
          status: member.status,
          lastUpdatedLabel: formatLastUpdated(member.lastUpdated),
        },
        geometry: {
          type: 'Point',
          coordinates: latLngToCoords(member.coordinate as LatLng),
        },
      })),
  };

  const meetupGeoJSON: GeoJSON.FeatureCollection = meetupCoords
    ? {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: latLngToCoords(meetupCoords) },
          },
        ],
      }
    : { type: 'FeatureCollection', features: [] };

  const map_light_mode = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

  const meetupSourceKey = meetupCoords
    ? `meetup-pin-${meetupCoords.latitude}-${meetupCoords.longitude}-${mapLoadCount}`
    : `meetup-pin-empty-${mapLoadCount}`;

  // Split members into available and unavailable for the picker
  const availableMembers = memberPins.filter((m) => m.coordinate);
  const unavailableMembers = memberPins.filter((m) => !m.coordinate);

  return (
    <>
      <StatusBar style="light" backgroundColor="#F58500" />

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.screen}>
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {groupName}
              </Text>
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
                  defaultSettings={{
                    centerCoordinate: FALLBACK_COORDS,
                    zoomLevel: DEFAULT_ZOOM,
                  }}
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
                  <SymbolLayer
                    id="member-pins-labels"
                    style={{
                      textField: ['get', 'name'],
                      textSize: 12,
                      textOffset: [0, 1.6],
                      textAnchor: 'top',
                      textAllowOverlap: true,
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

            {/* Floating action buttons */}
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

              {/* New: Group members button */}
              <TouchableOpacity
                style={[styles.floatingButton, styles.membersButton]}
                onPress={() => setShowMemberPicker(true)}
              >
                <Ionicons name="people" size={20} color="#fff" />
                {memberPins.length > 0 && (
                  <View style={styles.memberCountBadge}>
                    <Text style={styles.memberCountText}>{memberPins.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Search card */}
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
                    onChangeText={fetchMapboxSuggestions}
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

                  <TouchableOpacity
                    style={styles.saveAddressButton}
                    onPress={handleSaveCurrentMeetup}
                  >
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={18}
                      color="#fff"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.saveAddressButtonText}>SAVE ADDRESS</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {/* Bottom panel — no unavailable section here anymore */}
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

      {/* Member Picker Modal */}
      <Modal
        visible={showMemberPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMemberPicker(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowMemberPicker(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.memberPickerCard}
            onPress={() => {}}
          >
            {/* Header */}
            <View style={styles.pickerHeader}>
              <View style={styles.pickerHeaderLeft}>
                <Ionicons name="people" size={18} color="#F58500" />
                <Text style={styles.pickerTitle}>Group Members</Text>
              </View>
              <TouchableOpacity onPress={() => setShowMemberPicker(false)}>
                <Ionicons name="close" size={22} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.pickerScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Members with location */}
              {availableMembers.length > 0 && (
                <>
                  <Text style={styles.pickerSectionLabel}>Location Available</Text>
                  {availableMembers.map((member) => {
                    const timestamp = formatLastUpdated(member.lastUpdated);
                    return (
                      <TouchableOpacity
                        key={member.id}
                        style={styles.memberRow}
                        onPress={() => handleSnapToMember(member)}
                        activeOpacity={0.75}
                      >
                        {/* Avatar */}
                        {member.avatar ? (
                          <Image source={{ uri: member.avatar }} style={styles.memberAvatar} />
                        ) : (
                          <View
                            style={[
                              styles.memberAvatarFallback,
                              { backgroundColor: getAvatarColor(member.name) },
                            ]}
                          >
                            <Text style={styles.memberInitials}>
                              {getInitials(member.name)}
                            </Text>
                          </View>
                        )}

                        {/* Name + timestamp */}
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName} numberOfLines={1}>
                            {member.name}
                          </Text>
                          {timestamp ? (
                            <Text style={styles.memberTimestamp}>Updated {timestamp}</Text>
                          ) : (
                            <Text style={styles.memberTimestamp}>Location active</Text>
                          )}
                        </View>

                        {/* Status dot */}
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: getStatusColor(member.status) },
                          ]}
                        />

                        {/* Snap icon */}
                        <Ionicons name="navigate" size={18} color="#F58500" style={{ marginLeft: 6 }} />


                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {/* Members without location */}
              {unavailableMembers.length > 0 && (
                <>
                  <Text style={[styles.pickerSectionLabel, { marginTop: availableMembers.length > 0 ? 14 : 0 }]}>
                    Location Unavailable
                  </Text>
                  {unavailableMembers.map((member) => (
                    <View key={member.id} style={[styles.memberRow, styles.memberRowUnavailable]}>
                      {member.avatar ? (
                        <Image
                          source={{ uri: member.avatar }}
                          style={[styles.memberAvatar, styles.memberAvatarDimmed]}
                        />
                      ) : (
                        <View
                          style={[
                            styles.memberAvatarFallback,
                            styles.memberAvatarDimmed,
                            { backgroundColor: '#C0C0C0' },
                          ]}
                        >
                          <Text style={styles.memberInitials}>
                            {getInitials(member.name)}
                          </Text>
                        </View>
                      )}

                      <View style={styles.memberInfo}>
                        <Text style={[styles.memberName, { color: '#999' }]} numberOfLines={1}>
                          {member.name}
                        </Text>
                        <Text style={styles.memberTimestampMissing}>
                          {member.locationSharingEnabled === false
                            ? 'Location sharing off'
                            : 'Location unavailable'}
                        </Text>
                      </View>

                      <Ionicons name="location-outline" size={18} color="#CCC" />

                    </View>
                  ))}
                </>
              )}

              {memberPins.length === 0 && (
                <View style={styles.emptyPicker}>
                  <Ionicons name="people-outline" size={36} color="#DDD" />
                  <Text style={styles.emptyPickerText}>No group members yet</Text>
                </View>
              )}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
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
  meetupPinButton: {
    marginBottom: 12,
  },
  membersButton: {
    // third button — no extra margin needed
  },
  memberCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#F58500',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#F58500',
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -PANEL_OVERHANG,
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

  // ── Member Picker Modal ──────────────────────────────────────────────────
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
    justifyContent: 'flex-end',
    paddingBottom: 100, // sit above the bottom panel
    paddingHorizontal: 16,
  },
  memberPickerCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    paddingTop: 16,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 14,
    maxHeight: 420,
    borderWidth: 1.5,
    borderColor: '#FFE0B2',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 12,
  },
  pickerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1C1410',
    letterSpacing: 0.2,
  },
  pickerScroll: {
    paddingHorizontal: 16,
    maxHeight: 340,
  },
  pickerSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#999',
    letterSpacing: 0.4,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#FFE8CC',
  },
  memberRowUnavailable: {
    backgroundColor: '#F9F9F9',
    borderColor: '#EFEFEF',
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    marginRight: 12,
  },
  memberAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 12,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberAvatarDimmed: {
    opacity: 0.45,
  },
  memberInitials: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1C1410',
  },
  memberTimestamp: {
    fontSize: 11,
    color: '#B07830',
    marginTop: 2,
    fontWeight: '500',
  },
  memberTimestampMissing: {
    fontSize: 11,
    color: '#BBBBBB',
    marginTop: 2,
    fontWeight: '500',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 4,
  },
  emptyPicker: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 10,
  },
  emptyPickerText: {
    fontSize: 14,
    color: '#BBBBBB',
    fontWeight: '500',
  },
});