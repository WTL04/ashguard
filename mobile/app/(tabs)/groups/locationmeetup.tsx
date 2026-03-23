import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Alert,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import MapView, { Marker, MapPressEvent, Region } from 'react-native-maps';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

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

const FALLBACK_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_EXPANDED = 0;
const SHEET_COLLAPSED = 230;

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
      coordinate: {
        latitude: center.latitude + 0.004,
        longitude: center.longitude - 0.003,
      },
      avatar: 'https://via.placeholder.com/48/8ec5ff',
    },
    {
      id: '2',
      name: 'Member 2',
      coordinate: {
        latitude: center.latitude - 0.005,
        longitude: center.longitude - 0.006,
      },
      avatar: 'https://via.placeholder.com/48/ffd36e',
    },
    {
      id: '3',
      name: 'Member 3',
      coordinate: {
        latitude: center.latitude - 0.007,
        longitude: center.longitude + 0.004,
      },
      avatar: 'https://via.placeholder.com/48/ff9f7a',
    },
  ];
}

export default function LocationMeetupScreen() {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView | null>(null);

  const [groupName, setGroupName] = useState('Name of Group');
  const [region, setRegion] = useState<Region>(FALLBACK_REGION);
  const [memberPins, setMemberPins] = useState<PlaceholderMember[]>(
    buildPlaceholderMembers({
      latitude: FALLBACK_REGION.latitude,
      longitude: FALLBACK_REGION.longitude,
    })
  );

  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSearchCard, setShowSearchCard] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const [meetupAddress, setMeetupAddress] = useState('');
  const [meetupCoords, setMeetupCoords] = useState<LatLng | null>(null);

  const sheetTranslateY = useRef(new Animated.Value(SHEET_EXPANDED)).current;
  const lastSheetTranslateY = useRef(SHEET_EXPANDED);

  useEffect(() => {
    loadSavedData();
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
      const savedGroupName = await AsyncStorage.getItem(GROUP_NAME_KEY);
      const savedAddress = await AsyncStorage.getItem(MEETUP_ADDRESS_KEY);
      const savedCoords = await AsyncStorage.getItem(MEETUP_COORDS_KEY);

      if (savedGroupName) setGroupName(savedGroupName);
      if (savedAddress) setMeetupAddress(savedAddress);

      const userCoords = await getUserLocationOrFallback();

      if (savedCoords) {
        const parsed = JSON.parse(savedCoords) as LatLng;
        setMeetupCoords(parsed);
      }

      const nextRegion: Region = {
        latitude: userCoords.latitude,
        longitude: userCoords.longitude,
        latitudeDelta: 0.04,
        longitudeDelta: 0.04,
      };

      setRegion(nextRegion);
      setMemberPins(buildPlaceholderMembers(userCoords));

      requestAnimationFrame(() => {
        mapRef.current?.animateToRegion(nextRegion, 700);
      });
    } catch (error) {
      console.log('Error loading meetup data:', error);

      const fallback = {
        latitude: FALLBACK_REGION.latitude,
        longitude: FALLBACK_REGION.longitude,
      };

      setRegion(FALLBACK_REGION);
      setMemberPins(buildPlaceholderMembers(fallback));

      requestAnimationFrame(() => {
        mapRef.current?.animateToRegion(FALLBACK_REGION, 700);
      });
    }
  };

  const getUserLocationOrFallback = async (): Promise<LatLng> => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== 'granted') {
        return {
          latitude: FALLBACK_REGION.latitude,
          longitude: FALLBACK_REGION.longitude,
        };
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
    } catch (error) {
      console.log('Error getting current location:', error);
      return {
        latitude: FALLBACK_REGION.latitude,
        longitude: FALLBACK_REGION.longitude,
      };
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

  const animateTo = (coords: LatLng) => {
    const nextRegion: Region = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      latitudeDelta: 0.02,
      longitudeDelta: 0.02,
    };

    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 500);
  };

  const handleMapPress = async (event: MapPressEvent) => {
    const coords = event.nativeEvent.coordinate;
    const fallbackAddress = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;

    await saveMeetup(fallbackAddress, coords);
    animateTo(coords);
  };

  const fetchPhotonSuggestions = async (input: string) => {
    setSearchText(input);

    if (!input.trim()) {
      setSuggestions([]);
      return;
    }

    try {
      setLoadingSuggestions(true);

      const url =
        `https://photon.komoot.io/api/?q=${encodeURIComponent(input)}` +
        `&limit=6&lat=${region.latitude}&lon=${region.longitude}`;

      const response = await fetch(url);
      const data = await response.json();

      const nextSuggestions: AddressSuggestion[] = (data?.features ?? [])
        .map((feature: PhotonFeature, index: number) => {
          const coords = feature.geometry?.coordinates;
          if (!coords || coords.length < 2) return null;

          return {
            id: `${coords[0]}_${coords[1]}_${index}`,
            label: buildPhotonLabel(feature),
            coords: {
              latitude: coords[1],
              longitude: coords[0],
            },
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
      Alert.alert(
        'No meetup selected',
        'Drop a pin on the map or search for an address first.'
      );
      return;
    }

    const address =
      meetupAddress ||
      `${meetupCoords.latitude.toFixed(5)}, ${meetupCoords.longitude.toFixed(5)}`;

    await saveMeetup(address, meetupCoords);
    router.back();
  };

  return (
    <>
      <StatusBar style="light" backgroundColor="#F58500" />

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.screen}>
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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
            <MapView
              ref={mapRef}
              style={styles.map}
              region={region}
              onPress={handleMapPress}
              showsUserLocation
            >
              {memberPins.map((member) => (
                <Marker
                  key={member.id}
                  coordinate={member.coordinate}
                  title={member.name}
                >
                  <View style={styles.memberMarker}>
                    <Image source={{ uri: member.avatar }} style={styles.memberAvatar} />
                  </View>
                </Marker>
              ))}

              {meetupCoords && (
                <Marker coordinate={meetupCoords} title="Emergency Meetup Spot">
                  <Ionicons name="location" size={42} color="#F58500" />
                </Marker>
              )}
            </MapView>

            {showSearchCard && (
              <View style={styles.searchModal}>
                <Text style={styles.searchLabel}>Search Address:</Text>

                <TextInput
                  value={searchText}
                  onChangeText={fetchPhotonSuggestions}
                  style={styles.searchField}
                  placeholder="Enter address"
                  placeholderTextColor="#777"
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
                  <Text style={styles.saveAddressButtonText}>SAVE ADDRESS</Text>
                </TouchableOpacity>
              </View>
            )}

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

              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleSaveCurrentMeetup}
              >
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
    backgroundColor: '#F3F3F3',
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
  map: {
    width: '100%',
    height: '100%',
  },
  memberMarker: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#fff',
    borderWidth: 3,
    borderColor: '#F58500',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  bottomPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#F7F7F7',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 22,
    height: 290,
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
    left: 18,
    right: 18,
    top: 110,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
    maxHeight: 320,
  },
  searchLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    textAlign: 'center',
    marginBottom: 10,
  },
  searchField: {
    height: 44,
    borderWidth: 1,
    borderColor: '#999',
    backgroundColor: '#EFE7D9',
    paddingHorizontal: 12,
    borderRadius: 4,
    fontSize: 15,
    marginBottom: 10,
  },
  suggestionList: {
    maxHeight: 140,
    marginBottom: 12,
  },
  suggestionRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
  },
  suggestionText: {
    fontSize: 14,
    color: '#222',
  },
  noResultsText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingVertical: 12,
  },
  saveAddressButton: {
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F58500',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveAddressButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});