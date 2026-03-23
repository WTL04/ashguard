import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  FlatList,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type SavedPlace = {
  id: string;
  nickname: string;
  address: string;
};

type PhotonFeature = {
  properties?: {
    name?: string;
    housenumber?: string;
    street?: string;
    suburb?: string;
    district?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
};

type AddressSuggestion = {
  id: string;
  label: string;
};

const COLORS = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  cardSoft: "#FFF7F2",
  border: "#E7EAF0",
  text: "#111827",
  subtext: "#6B7280",
  accent: "#F59E0B",
  accentSoft: "#FFF1D6",
  dark: "#111827",
  mutedBtn: "#EEF2F7",
  overlay: "rgba(17,24,39,0.35)",
};

const PHOTON_BASE_URL = "https://photon.komoot.io/api";

const STORAGE_KEYS = {
  county: "places_county",
  home: "places_home",
  savedPlaces: "places_saved_places",
  savedOpen: "places_saved_open",
};

const DEFAULT_COUNTY = "LA County";
const DEFAULT_HOME = "123 Street, Los Angeles, CA";
const DEFAULT_SAVED_PLACES: SavedPlace[] = [
  {
    id: "1",
    nickname: "Insurance Hospital",
    address: "123 Street, Los Angeles, CA",
  },
  {
    id: "2",
    nickname: "Nearest Food Bank",
    address: "123 Court, Ventura, CA",
  },
];

function formatPhotonLabel(feature: PhotonFeature): string {
  const p = feature.properties ?? {};

  const firstLine = [p.name, p.housenumber].filter(Boolean).join(" ").trim();
  const secondLine = [p.street, p.city, p.county, p.state, p.postcode, p.country]
    .filter(Boolean)
    .join(", ")
    .trim();

  const label = [firstLine, secondLine].filter(Boolean).join(", ").trim();

  if (label) return label;

  return [
    p.name,
    p.housenumber,
    p.street,
    p.suburb,
    p.district,
    p.city,
    p.county,
    p.state,
    p.postcode,
    p.country,
  ]
    .filter(Boolean)
    .join(", ");
}

async function fetchPhotonSuggestions(
  query: string,
  signal?: AbortSignal
): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];

  const params = new URLSearchParams({
    q: trimmed,
    limit: "8",
    lang: "en",
  });

  const response = await fetch(`${PHOTON_BASE_URL}?${params.toString()}`, {
    signal,
  });

  if (!response.ok) {
    throw new Error(`Photon request failed: ${response.status}`);
  }

  const data = await response.json();
  const features: PhotonFeature[] = Array.isArray(data?.features) ? data.features : [];

  const map = new Map<string, AddressSuggestion>();

  features.forEach((feature, index) => {
    const label = formatPhotonLabel(feature);
    if (!label) return;

    if (!map.has(label)) {
      map.set(label, {
        id: `${label}-${index}`,
        label,
      });
    }
  });

  return Array.from(map.values());
}

function usePhotonAutocomplete(query: string, enabled: boolean) {
  const [results, setResults] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!enabled || query.trim().length < 3) {
      abortRef.current?.abort();
      setResults([]);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;

    const timeout = setTimeout(async () => {
      try {
        setLoading(true);
        setError("");
        const items = await fetchPhotonSuggestions(query, controller.signal);
        setResults(items);
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setResults([]);
          setError("Could not load address suggestions.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, enabled]);

  return { results, loading, error };
}

export default function PlacesScreen() {
  const router = useRouter();

  const [hydrated, setHydrated] = useState(false);

  const [savedOpen, setSavedOpen] = useState(true);

  const [countyModalOpen, setCountyModalOpen] = useState(false);
  const [county, setCounty] = useState(DEFAULT_COUNTY);
  const [countyDraft, setCountyDraft] = useState(DEFAULT_COUNTY);

  const [homeModalOpen, setHomeModalOpen] = useState(false);
  const [home, setHome] = useState(DEFAULT_HOME);
  const [homeDraft, setHomeDraft] = useState(DEFAULT_HOME);
  const [showHomeSuggestions, setShowHomeSuggestions] = useState(false);

  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [showSavedSuggestions, setShowSavedSuggestions] = useState(false);

  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(DEFAULT_SAVED_PLACES);

  const { results: homeSuggestions, loading: homeLoading, error: homeError } =
    usePhotonAutocomplete(homeDraft, homeModalOpen && showHomeSuggestions);

  const {
    results: savedSuggestions,
    loading: savedLoading,
    error: savedError,
  } = usePhotonAutocomplete(addressQuery, savedModalOpen && showSavedSuggestions);

  const totalSavedPlaces = useMemo(() => savedPlaces.length, [savedPlaces]);

  useEffect(() => {
    async function loadStoredData() {
      try {
        const [storedCounty, storedHome, storedSavedPlaces, storedSavedOpen] =
          await Promise.all([
            AsyncStorage.getItem(STORAGE_KEYS.county),
            AsyncStorage.getItem(STORAGE_KEYS.home),
            AsyncStorage.getItem(STORAGE_KEYS.savedPlaces),
            AsyncStorage.getItem(STORAGE_KEYS.savedOpen),
          ]);

        if (storedCounty) {
          setCounty(storedCounty);
          setCountyDraft(storedCounty);
        }

        if (storedHome) {
          setHome(storedHome);
          setHomeDraft(storedHome);
        }

        if (storedSavedPlaces) {
          const parsed = JSON.parse(storedSavedPlaces);
          if (Array.isArray(parsed)) {
            setSavedPlaces(parsed);
          }
        }

        if (storedSavedOpen !== null) {
          setSavedOpen(storedSavedOpen === "true");
        }
      } catch (error) {
        console.log("Failed to load places data:", error);
      } finally {
        setHydrated(true);
      }
    }

    loadStoredData();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.county, county).catch((error) => {
      console.log("Failed to save county:", error);
    });
  }, [county, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.home, home).catch((error) => {
      console.log("Failed to save home:", error);
    });
  }, [home, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.savedPlaces, JSON.stringify(savedPlaces)).catch(
      (error) => {
        console.log("Failed to save saved places:", error);
      }
    );
  }, [savedPlaces, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEYS.savedOpen, String(savedOpen)).catch((error) => {
      console.log("Failed to save savedOpen:", error);
    });
  }, [savedOpen, hydrated]);

  function closeDropdownOnly() {
    setShowSavedSuggestions(false);
    setShowHomeSuggestions(false);
    Keyboard.dismiss();
  }

  function closeSavedModal() {
    setSavedModalOpen(false);
    setEditingId(null);
    setShowSavedSuggestions(false);
    Keyboard.dismiss();
  }

  function closeHomeModal() {
    setHomeModalOpen(false);
    setShowHomeSuggestions(false);
    Keyboard.dismiss();
  }

  function openAddSavedPlace() {
    setEditingId(null);
    setNicknameDraft("");
    setAddressQuery("");
    setShowSavedSuggestions(false);
    setSavedModalOpen(true);
  }

  function openEditSavedPlace(place: SavedPlace) {
    setEditingId(place.id);
    setNicknameDraft(place.nickname);
    setAddressQuery(place.address);
    setShowSavedSuggestions(false);
    setSavedModalOpen(true);
  }

  function saveSavedPlace() {
    const nick = nicknameDraft.trim();
    const addr = addressQuery.trim();

    if (!nick || !addr) return;

    if (editingId) {
      setSavedPlaces((prev) =>
        prev.map((p) =>
          p.id === editingId ? { ...p, nickname: nick, address: addr } : p
        )
      );
      closeSavedModal();
      return;
    }

    setSavedPlaces((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        nickname: nick,
        address: addr,
      },
    ]);
    closeSavedModal();
  }

  function saveHomeAddress() {
    const value = homeDraft.trim();
    if (!value) return;
    setHome(value);
    closeHomeModal();
  }

  function saveCountyValue() {
    const value = countyDraft.trim();
    if (!value) return;
    setCounty(value);
    setCountyModalOpen(false);
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={22} color={COLORS.text} />
        </Pressable>

        <Text style={styles.headerTitle}>Places</Text>

        <View style={styles.iconBtnPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="location" size={20} color={COLORS.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>Manage your places</Text>
            <Text style={styles.heroSubtitle}>
              Set your county, update your home address, and save frequently used
              places for faster access.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location Settings</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingIconWrap}>
              <Ionicons name="map-outline" size={18} color={COLORS.dark} />
            </View>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>County</Text>
              <Text style={styles.settingValue}>{county}</Text>
            </View>
            <Pressable
              style={styles.editPill}
              onPress={() => {
                setCountyDraft(county);
                setCountyModalOpen(true);
              }}
            >
              <Text style={styles.editPillText}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingIconWrap}>
              <Ionicons name="home-outline" size={18} color={COLORS.dark} />
            </View>
            <View style={styles.settingTextWrap}>
              <Text style={styles.settingLabel}>Home Address</Text>
              <Text style={styles.settingValueMuted}>{home}</Text>
            </View>
            <Pressable
              style={styles.editPill}
              onPress={() => {
                setHomeDraft(home);
                setShowHomeSuggestions(true);
                setHomeModalOpen(true);
              }}
            >
              <Text style={styles.editPillText}>Edit</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Pressable
            style={styles.savedHeaderCard}
            onPress={() => setSavedOpen((prev) => !prev)}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>Saved Places</Text>
              <Text style={styles.savedCountText}>
                {totalSavedPlaces} saved {totalSavedPlaces === 1 ? "place" : "places"}
              </Text>
            </View>

            <View style={styles.savedHeaderRight}>
              <Pressable
                style={styles.addMiniBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  openAddSavedPlace();
                }}
              >
                <Ionicons name="add" size={16} color="#fff" />
                <Text style={styles.addMiniBtnText}>Add</Text>
              </Pressable>

              <Ionicons
                name={savedOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={COLORS.text}
              />
            </View>
          </Pressable>

          {savedOpen && (
            <View style={styles.savedPanel}>
              {savedPlaces.map((place) => (
                <View key={place.id} style={styles.savedRow}>
                  <View style={styles.savedRowIcon}>
                    <Ionicons name="bookmark-outline" size={18} color={COLORS.accent} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.savedNick}>{place.nickname}</Text>
                    <Text style={styles.savedAddr}>{place.address}</Text>
                  </View>

                  <Pressable
                    style={styles.rowEditBtn}
                    onPress={() => openEditSavedPlace(place)}
                  >
                    <Text style={styles.rowEditBtnText}>Edit</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* County Modal */}
      <Modal visible={countyModalOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Enter County</Text>
                <Text style={styles.modalSubtitle}>
                  Update the county used for your location preferences.
                </Text>

                <TextInput
                  value={countyDraft}
                  onChangeText={setCountyDraft}
                  style={styles.modalInput}
                  placeholder="e.g. LA County"
                  placeholderTextColor="#9CA3AF"
                />

                <View style={styles.modalBtnRow}>
                  <Pressable
                    style={[styles.modalBtn, styles.primaryBtn]}
                    onPress={saveCountyValue}
                  >
                    <Text style={styles.primaryBtnText}>Save</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.modalBtn, styles.secondaryBtn]}
                    onPress={() => setCountyModalOpen(false)}
                  >
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Home Modal */}
      <Modal visible={homeModalOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={closeDropdownOnly}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCardWide}>
                <Text style={styles.modalTitle}>Home Address</Text>
                <Text style={styles.modalSubtitle}>
                  Start typing to search for an address.
                </Text>

                <View style={styles.dropdownWrap}>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="search-outline" size={18} color="#6B7280" />
                    <TextInput
                      value={homeDraft}
                      onChangeText={(text) => {
                        setHomeDraft(text);
                        setShowHomeSuggestions(true);
                      }}
                      style={styles.modalInputFlex}
                      placeholder="Search address"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  {showHomeSuggestions && (
                    <View style={styles.dropdownList}>
                      {homeLoading ? (
                        <View style={styles.dropdownLoading}>
                          <ActivityIndicator size="small" color={COLORS.accent} />
                          <Text style={styles.dropdownLoadingText}>Searching...</Text>
                        </View>
                      ) : homeError ? (
                        <Text style={styles.dropdownMessage}>{homeError}</Text>
                      ) : homeDraft.trim().length < 3 ? (
                        <Text style={styles.dropdownMessage}>
                          Type at least 3 characters
                        </Text>
                      ) : homeSuggestions.length > 0 ? (
                        <FlatList
                          data={homeSuggestions}
                          keyExtractor={(item) => item.id}
                          style={{ maxHeight: 220 }}
                          keyboardShouldPersistTaps="handled"
                          renderItem={({ item, index }) => (
                            <Pressable
                              style={[
                                styles.dropdownRow,
                                index === 0 && styles.dropdownRowFirst,
                              ]}
                              onPress={() => {
                                setHomeDraft(item.label);
                                setShowHomeSuggestions(false);
                                Keyboard.dismiss();
                              }}
                            >
                              <Ionicons
                                name="location-outline"
                                size={16}
                                color={COLORS.accent}
                                style={{ marginTop: 2 }}
                              />
                              <Text style={styles.suggestText}>{item.label}</Text>
                            </Pressable>
                          )}
                        />
                      ) : (
                        <Text style={styles.dropdownMessage}>No matches found</Text>
                      )}
                    </View>
                  )}
                </View>

                <View style={styles.modalBtnRow}>
                  <Pressable
                    style={[styles.modalBtn, styles.darkBtn]}
                    onPress={saveHomeAddress}
                  >
                    <Text style={styles.darkBtnText}>Save</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.modalBtn, styles.secondaryBtn]}
                    onPress={closeHomeModal}
                  >
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Saved Place Modal */}
      <Modal visible={savedModalOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={closeDropdownOnly}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCardWide}>
                <Text style={styles.modalTitle}>
                  {editingId ? "Edit Saved Place" : "Add Saved Place"}
                </Text>
                <Text style={styles.modalSubtitle}>
                  Search an address, then save it with a nickname.
                </Text>

                <Text style={styles.fieldLabel}>Address</Text>
                <View style={styles.dropdownWrap}>
                  <View style={styles.inputWithIcon}>
                    <Ionicons name="search-outline" size={18} color="#6B7280" />
                    <TextInput
                      value={addressQuery}
                      onChangeText={(text) => {
                        setAddressQuery(text);
                        setShowSavedSuggestions(true);
                      }}
                      style={styles.modalInputFlex}
                      placeholder="Enter address"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  {showSavedSuggestions && (
                    <View style={styles.dropdownList}>
                      {savedLoading ? (
                        <View style={styles.dropdownLoading}>
                          <ActivityIndicator size="small" color={COLORS.accent} />
                          <Text style={styles.dropdownLoadingText}>Searching...</Text>
                        </View>
                      ) : savedError ? (
                        <Text style={styles.dropdownMessage}>{savedError}</Text>
                      ) : addressQuery.trim().length < 3 ? (
                        <Text style={styles.dropdownMessage}>
                          Type at least 3 characters
                        </Text>
                      ) : savedSuggestions.length > 0 ? (
                        <FlatList
                          data={savedSuggestions}
                          keyExtractor={(item) => item.id}
                          style={{ maxHeight: 220 }}
                          keyboardShouldPersistTaps="handled"
                          renderItem={({ item, index }) => (
                            <Pressable
                              style={[
                                styles.dropdownRow,
                                index === 0 && styles.dropdownRowFirst,
                              ]}
                              onPress={() => {
                                setAddressQuery(item.label);
                                setShowSavedSuggestions(false);
                                Keyboard.dismiss();
                              }}
                            >
                              <Ionicons
                                name="location-outline"
                                size={16}
                                color={COLORS.accent}
                                style={{ marginTop: 2 }}
                              />
                              <Text style={styles.suggestText}>{item.label}</Text>
                            </Pressable>
                          )}
                        />
                      ) : (
                        <Text style={styles.dropdownMessage}>No matches found</Text>
                      )}
                    </View>
                  )}
                </View>

                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Nickname</Text>
                <View style={styles.inputWithIcon}>
                  <Ionicons name="bookmark-outline" size={18} color="#6B7280" />
                  <TextInput
                    value={nicknameDraft}
                    onChangeText={setNicknameDraft}
                    style={styles.modalInputFlex}
                    placeholder="e.g. Insurance Hospital"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>

                <View style={styles.modalBtnRow}>
                  <Pressable
                    style={[styles.modalBtn, styles.darkBtn]}
                    onPress={saveSavedPlace}
                  >
                    <Text style={styles.darkBtnText}>Save</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.modalBtn, styles.secondaryBtn]}
                    onPress={closeSavedModal}
                  >
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
}

const shadow = Platform.select({
  ios: {
    shadowColor: "#111827",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  android: {
    elevation: 3,
  },
  default: {},
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },

  header: {
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    ...shadow,
  },
  iconBtnPlaceholder: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: 0.2,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
    gap: 16,
  },

  heroCard: {
    backgroundColor: COLORS.cardSoft,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F6DEC7",
    flexDirection: "row",
    gap: 12,
    ...shadow,
  },
  heroIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.subtext,
  },

  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
  },

  settingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...shadow,
  },
  settingIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  settingTextWrap: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.subtext,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  settingValue: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  settingValueMuted: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text,
  },

  editPill: {
    backgroundColor: COLORS.mutedBtn,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  editPillText: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.dark,
  },

  savedHeaderCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...shadow,
  },
  savedCountText: {
    fontSize: 13,
    color: COLORS.subtext,
    marginTop: 4,
  },
  savedHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  addMiniBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.dark,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
  },
  addMiniBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 12,
  },

  savedPanel: {
    gap: 10,
  },
  savedRow: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    ...shadow,
  },
  savedRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  savedNick: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 4,
  },
  savedAddr: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.subtext,
  },
  rowEditBtn: {
    backgroundColor: COLORS.mutedBtn,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rowEditBtnText: {
    fontSize: 12,
    fontWeight: "800",
    color: COLORS.dark,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    ...shadow,
  },
  modalCardWide: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    ...shadow,
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.subtext,
    marginBottom: 14,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 8,
  },

  modalInput: {
    backgroundColor: "#FAFBFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },

  inputWithIcon: {
    minHeight: 50,
    backgroundColor: "#FAFBFC",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalInputFlex: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: COLORS.text,
  },

  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  modalBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryBtn: {
    backgroundColor: COLORS.accent,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },

  secondaryBtn: {
    backgroundColor: "#E5E7EB",
  },
  secondaryBtnText: {
    color: COLORS.dark,
    fontWeight: "800",
    fontSize: 14,
  },

  darkBtn: {
    backgroundColor: COLORS.dark,
  },
  darkBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },

  dropdownWrap: {
    position: "relative",
  },
  dropdownList: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    overflow: "hidden",
  },
  dropdownRow: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  dropdownRowFirst: {
    borderTopWidth: 0,
  },
  suggestText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.text,
  },
  dropdownMessage: {
    paddingHorizontal: 12,
    paddingVertical: 14,
    fontSize: 13,
    color: COLORS.subtext,
  },
  dropdownLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  dropdownLoadingText: {
    fontSize: 13,
    color: COLORS.subtext,
  },
});