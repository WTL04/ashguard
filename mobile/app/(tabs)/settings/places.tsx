import React, { useMemo, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

type SavedPlace = {
  id: string;
  nickname: string;
  address: string;
};

<<<<<<< HEAD
const TAN = "#FDEFE7";
const TAN_BORDER = "#F2D8C8";

export default function PlacesScreen() {
  const router = useRouter();

  const [savedOpen, setSavedOpen] = useState(false);

  const [countyModalOpen, setCountyModalOpen] = useState(false);
  const [county, setCounty] = useState("LA County");
  const [countyDraft, setCountyDraft] = useState(county);

  const [homeModalOpen, setHomeModalOpen] = useState(false);
  const [home, setHome] = useState("123 Street, Los Angeles, CA");
  const [homeDraft, setHomeDraft] = useState(home);

=======
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

const ORANGE = "#F58500";
const ORANGE_LIGHT = "#FFF4E6";
const ORANGE_MID = "#FFE0B2";
const BG = "#FAF8F5";
const CARD = "#FFFFFF";
const BORDER = "#F0EBE3";
const TEXT = "#1A1614";
const MUTED = "#9B9189";

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
  { id: "1", nickname: "Insurance Hospital", address: "123 Street, Los Angeles, CA" },
  { id: "2", nickname: "Nearest Food Bank", address: "123 Court, Ventura, CA" },
];

function formatPhotonLabel(feature: PhotonFeature): string {
  const p = feature.properties ?? {};
  const firstLine = [p.name, p.housenumber].filter(Boolean).join(" ").trim();
  const secondLine = [p.street, p.city, p.county, p.state, p.postcode, p.country]
    .filter(Boolean).join(", ").trim();
  const label = [firstLine, secondLine].filter(Boolean).join(", ").trim();
  if (label) return label;
  return [p.name, p.housenumber, p.street, p.suburb, p.district, p.city, p.county, p.state, p.postcode, p.country]
    .filter(Boolean).join(", ");
}

async function fetchPhotonSuggestions(query: string, signal?: AbortSignal): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 3) return [];
  const params = new URLSearchParams({ q: trimmed, limit: "8", lang: "en" });
  const response = await fetch(`${PHOTON_BASE_URL}?${params.toString()}`, { signal });
  if (!response.ok) throw new Error(`Photon request failed: ${response.status}`);
  const data = await response.json();
  const features: PhotonFeature[] = Array.isArray(data?.features) ? data.features : [];
  const map = new Map<string, AddressSuggestion>();
  features.forEach((feature, index) => {
    const label = formatPhotonLabel(feature);
    if (!label) return;
    if (!map.has(label)) map.set(label, { id: `${label}-${index}`, label });
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
      setResults([]); setLoading(false); setError("");
      return;
    }
    const controller = new AbortController();
    abortRef.current?.abort();
    abortRef.current = controller;
    const timeout = setTimeout(async () => {
      try {
        setLoading(true); setError("");
        const items = await fetchPhotonSuggestions(query, controller.signal);
        setResults(items);
      } catch (err: any) {
        if (err?.name !== "AbortError") { setResults([]); setError("Could not load suggestions."); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => { clearTimeout(timeout); controller.abort(); };
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
>>>>>>> 0670bd0 (Push notification and settings design overhaul)
  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
<<<<<<< HEAD
  const [showSuggestions, setShowSuggestions] = useState(false);

  const ALL_ADDRESSES = useMemo(
    () => [
      "123 Street, Los Angeles, CA",
      "123 Court, Ventura, CA",
      "123 Lane, Westminster, CA",
      "123 Main St, Santa Monica, CA",
      "123 Broadway, Los Angeles, CA",
      "123 Ocean Ave, Santa Monica, CA",
      "1234 Sunset Blvd, Los Angeles, CA",
      "1235 Sunset Blvd, Los Angeles, CA",
      "1236 Sunset Blvd, Los Angeles, CA",
      "124 Street, Los Angeles, CA",
      "125 Street, Los Angeles, CA",
    ],
    []
  );

  const addressSuggestions = useMemo(() => {
    const q = addressQuery.trim().toLowerCase();
    if (!q) return [];
    return ALL_ADDRESSES.filter((a) => a.toLowerCase().includes(q)).slice(0, 15);
  }, [addressQuery, ALL_ADDRESSES]);

  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([
    { id: "1", nickname: "Insurance Hospital", address: "123 Street, Los Angeles, CA" },
    { id: "2", nickname: "Nearest Food Bank", address: "123 Court, Ventura, CA" },
  ]);

  function closeDropdownOnly() {
    setShowSuggestions(false);
    Keyboard.dismiss();
  }

  function closeSavedModal() {
    setSavedModalOpen(false);
    setEditingId(null);
    setShowSuggestions(false);
    Keyboard.dismiss();
  }

  function openAddSavedPlace() {
    setEditingId(null);
    setNicknameDraft("");
    setAddressQuery("");
    setSavedModalOpen(true);
=======
  const [showSavedSuggestions, setShowSavedSuggestions] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(DEFAULT_SAVED_PLACES);

  const { results: homeSuggestions, loading: homeLoading, error: homeError } =
    usePhotonAutocomplete(homeDraft, homeModalOpen && showHomeSuggestions);
  const { results: savedSuggestions, loading: savedLoading, error: savedError } =
    usePhotonAutocomplete(addressQuery, savedModalOpen && showSavedSuggestions);

  const totalSavedPlaces = useMemo(() => savedPlaces.length, [savedPlaces]);

  useEffect(() => {
    async function loadStoredData() {
      try {
        const [storedCounty, storedHome, storedSavedPlaces, storedSavedOpen] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.county),
          AsyncStorage.getItem(STORAGE_KEYS.home),
          AsyncStorage.getItem(STORAGE_KEYS.savedPlaces),
          AsyncStorage.getItem(STORAGE_KEYS.savedOpen),
        ]);
        if (storedCounty) { setCounty(storedCounty); setCountyDraft(storedCounty); }
        if (storedHome) { setHome(storedHome); setHomeDraft(storedHome); }
        if (storedSavedPlaces) {
          const parsed = JSON.parse(storedSavedPlaces);
          if (Array.isArray(parsed)) setSavedPlaces(parsed);
        }
        if (storedSavedOpen !== null) setSavedOpen(storedSavedOpen === "true");
      } catch (error) {
        console.log("Failed to load places data:", error);
      } finally {
        setHydrated(true);
      }
    }
    loadStoredData();
  }, []);

  useEffect(() => { if (hydrated) AsyncStorage.setItem(STORAGE_KEYS.county, county).catch(console.log); }, [county, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(STORAGE_KEYS.home, home).catch(console.log); }, [home, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(STORAGE_KEYS.savedPlaces, JSON.stringify(savedPlaces)).catch(console.log); }, [savedPlaces, hydrated]);
  useEffect(() => { if (hydrated) AsyncStorage.setItem(STORAGE_KEYS.savedOpen, String(savedOpen)).catch(console.log); }, [savedOpen, hydrated]);

  function closeDropdownOnly() { setShowSavedSuggestions(false); setShowHomeSuggestions(false); Keyboard.dismiss(); }
  function closeSavedModal() { setSavedModalOpen(false); setEditingId(null); setShowSavedSuggestions(false); Keyboard.dismiss(); }
  function closeHomeModal() { setHomeModalOpen(false); setShowHomeSuggestions(false); Keyboard.dismiss(); }

  function openAddSavedPlace() {
    setEditingId(null); setNicknameDraft(""); setAddressQuery(""); setShowSavedSuggestions(false); setSavedModalOpen(true);
>>>>>>> 0670bd0 (Push notification and settings design overhaul)
  }
  function openEditSavedPlace(place: SavedPlace) {
<<<<<<< HEAD
    setEditingId(place.id);
    setNicknameDraft(place.nickname);
    setAddressQuery(place.address);
    setSavedModalOpen(true);
=======
    setEditingId(place.id); setNicknameDraft(place.nickname); setAddressQuery(place.address); setShowSavedSuggestions(false); setSavedModalOpen(true);
>>>>>>> 0670bd0 (Push notification and settings design overhaul)
  }
  function saveSavedPlace() {
<<<<<<< HEAD
    const nick = nicknameDraft.trim();
    const addr = addressQuery.trim();
=======
    const nick = nicknameDraft.trim(); const addr = addressQuery.trim();
>>>>>>> 0670bd0 (Push notification and settings design overhaul)
    if (!nick || !addr) return;
    if (editingId) {
      setSavedPlaces((prev) => prev.map((p) => p.id === editingId ? { ...p, nickname: nick, address: addr } : p));
    } else {
      setSavedPlaces((prev) => [...prev, { id: String(Date.now()), nickname: nick, address: addr }]);
    }
<<<<<<< HEAD

    setSavedPlaces((prev) => [
      ...prev,
      { id: String(Date.now()), nickname: nick, address: addr },
    ]);
    closeSavedModal();
  }
=======
    closeSavedModal();
  }
  function saveHomeAddress() { const value = homeDraft.trim(); if (!value) return; setHome(value); closeHomeModal(); }
  function saveCountyValue() { const value = countyDraft.trim(); if (!value) return; setCounty(value); setCountyModalOpen(false); }
>>>>>>> 0670bd0 (Push notification and settings design overhaul)

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
<<<<<<< HEAD
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#111" />
        </Pressable>
        <Text style={styles.headerTitle}>Places</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* County */}
        <View style={styles.cardRow}>
          <Text style={styles.cardRowTitle}>County - {county}</Text>
          <Pressable
            onPress={() => {
              setCountyDraft(county);
              setCountyModalOpen(true);
            }}
          >
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        </View>

        {/* Home */}
        <View style={styles.cardRow}>
          <Text style={styles.cardRowTitle}>Home</Text>
          <Pressable
            onPress={() => {
              setHomeDraft(home);
              setHomeModalOpen(true);
            }}
          >
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        </View>

        {/* Saved Places */}
        <Pressable style={styles.cardRow} onPress={() => setSavedOpen((v) => !v)}>
          <Text style={styles.cardRowTitle}>Saved Places</Text>
          <Ionicons
            name={savedOpen ? "chevron-up" : "chevron-down"}
            size={18}
            color="#111"
          />
        </Pressable>

        {savedOpen && (
          <View style={styles.savedPanel}>
            <Pressable style={styles.addBtn} onPress={openAddSavedPlace}>
              <Text style={styles.addBtnText}>+ Add Saved Place</Text>
            </Pressable>

            {savedPlaces.map((p) => (
              <View key={p.id} style={styles.savedRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.savedNick}>{p.nickname}</Text>
                  <Text style={styles.savedAddr}>{p.address}</Text>
                </View>

                <Pressable onPress={() => openEditSavedPlace(p)}>
                  <Text style={styles.editText}>Edit</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </View>
=======
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </Pressable>
        <Text style={styles.headerTitle}>Places</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Location Settings */}
        <Text style={styles.sectionHeader}>LOCATION</Text>
        <View style={styles.card}>
          {/* County row */}
          <View style={styles.settingRow}>
            <View style={styles.settingIconWrap}>
              <Ionicons name="map-outline" size={16} color={ORANGE} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>County</Text>
              <Text style={styles.settingValue}>{county}</Text>
            </View>
            <Pressable
              style={styles.editPill}
              onPress={() => { setCountyDraft(county); setCountyModalOpen(true); }}
            >
              <Text style={styles.editPillText}>Edit</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />

          {/* Home row */}
          <View style={styles.settingRow}>
            <View style={styles.settingIconWrap}>
              <Ionicons name="home-outline" size={16} color={ORANGE} />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Home Address</Text>
              <Text style={styles.settingValue} numberOfLines={1}>{home}</Text>
            </View>
            <Pressable
              style={styles.editPill}
              onPress={() => { setHomeDraft(home); setShowHomeSuggestions(true); setHomeModalOpen(true); }}
            >
              <Text style={styles.editPillText}>Edit</Text>
            </Pressable>
          </View>
        </View>

        {/* Saved Places */}
        <Pressable style={styles.sectionHeaderRow} onPress={() => setSavedOpen((v) => !v)}>
          <Text style={styles.sectionHeader}>SAVED PLACES</Text>
          <Ionicons name={savedOpen ? "chevron-up" : "chevron-down"} size={14} color={MUTED} />
        </Pressable>

        {savedOpen && (
          <View style={styles.card}>
            {savedPlaces.map((place, index) => (
              <View key={place.id}>
                {index > 0 && <View style={styles.divider} />}
                <View style={styles.settingRow}>
                  <View style={styles.settingIconWrap}>
                    <Ionicons name="bookmark-outline" size={16} color={ORANGE} />
                  </View>
                  <View style={styles.settingText}>
                    <Text style={styles.settingLabel}>{place.nickname}</Text>
                    <Text style={styles.settingValue} numberOfLines={1}>{place.address}</Text>
                  </View>
                  <Pressable style={styles.editPill} onPress={() => openEditSavedPlace(place)}>
                    <Text style={styles.editPillText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={styles.trashBtn}
                    onPress={() => setSavedPlaces((prev) => prev.filter((p) => p.id !== place.id))}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </Pressable>
                </View>
              </View>
            ))}

            <View style={styles.divider} />
            <Pressable style={styles.addRow} onPress={openAddSavedPlace}>
              <View style={styles.addRowIconWrap}>
                <Ionicons name="add" size={18} color={ORANGE} />
              </View>
              <Text style={styles.addRowText}>Add a place</Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
>>>>>>> 0670bd0 (Push notification and settings design overhaul)

      {/* County Modal */}
      <Modal visible={countyModalOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
<<<<<<< HEAD
                <Text style={styles.modalTitle}>Enter County:</Text>
                <TextInput value={countyDraft} onChangeText={setCountyDraft} style={styles.modalInput} />

                <View style={styles.modalBtnRow}>
                  <Pressable
                    style={[styles.modalBtn, styles.primaryBtn]}
                    onPress={() => {
                      setCounty(countyDraft);
                      setCountyModalOpen(false);
                    }}
                  >
                    <Text style={styles.primaryBtnText}>Save</Text>
=======
                <View style={styles.modalIconWrap}>
                  <Ionicons name="map-outline" size={20} color={ORANGE} />
                </View>
                <Text style={styles.modalTitle}>County</Text>
                <Text style={styles.modalSub}>Update the county for your location preferences.</Text>
                <TextInput
                  value={countyDraft}
                  onChangeText={setCountyDraft}
                  style={styles.modalInput}
                  placeholder="e.g. LA County"
                  placeholderTextColor={MUTED}
                />
                <View style={styles.modalBtnRow}>
                  <Pressable style={styles.modalSaveBtn} onPress={saveCountyValue}>
                    <Text style={styles.modalSaveBtnText}>Save</Text>
>>>>>>> 0670bd0 (Push notification and settings design overhaul)
                  </Pressable>
                  <Pressable style={styles.modalCancelBtn} onPress={() => setCountyModalOpen(false)}>
                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Home Modal */}
      <Modal visible={homeModalOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
<<<<<<< HEAD
                <Text style={styles.modalTitle}>Home Address:</Text>
                <TextInput value={homeDraft} onChangeText={setHomeDraft} style={styles.modalInput} />

                <View style={styles.modalBtnRow}>
                  <Pressable
                    style={[styles.modalBtn, styles.primaryBtn]}
                    onPress={() => {
                      setHome(homeDraft);
                      setHomeModalOpen(false);
                    }}
                  >
                    <Text style={styles.primaryBtnText}>Save</Text>
                  </Pressable>

                  <Pressable
                    style={[styles.modalBtn, styles.secondaryBtn]}
                    onPress={() => setHomeModalOpen(false)}
                  >
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
=======
                <View style={styles.modalIconWrap}>
                  <Ionicons name="home-outline" size={20} color={ORANGE} />
                </View>
                <Text style={styles.modalTitle}>Home Address</Text>
                <Text style={styles.modalSub}>Start typing to search for your address.</Text>
                <View style={styles.searchInputWrap}>
                  <Ionicons name="search-outline" size={17} color={MUTED} />
                  <TextInput
                    value={homeDraft}
                    onChangeText={(text) => { setHomeDraft(text); setShowHomeSuggestions(true); }}
                    style={styles.searchInput}
                    placeholder="Search address"
                    placeholderTextColor={MUTED}
                  />
                </View>
                {showHomeSuggestions && (
                  <View style={styles.dropdownList}>
                    {homeLoading ? (
                      <View style={styles.dropdownLoading}>
                        <ActivityIndicator size="small" color={ORANGE} />
                        <Text style={styles.dropdownMsg}>Searching...</Text>
                      </View>
                    ) : homeError ? (
                      <Text style={styles.dropdownMsg}>{homeError}</Text>
                    ) : homeDraft.trim().length < 3 ? (
                      <Text style={styles.dropdownMsg}>Type at least 3 characters</Text>
                    ) : homeSuggestions.length > 0 ? (
                      <FlatList
                        data={homeSuggestions}
                        keyExtractor={(item) => item.id}
                        style={{ maxHeight: 180 }}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item, index }) => (
                          <Pressable
                            style={[styles.dropdownRow, index === 0 && { borderTopWidth: 0 }]}
                            onPress={() => { setHomeDraft(item.label); setShowHomeSuggestions(false); Keyboard.dismiss(); }}
                          >
                            <Ionicons name="location-outline" size={15} color={ORANGE} />
                            <Text style={styles.dropdownText}>{item.label}</Text>
                          </Pressable>
                        )}
                      />
                    ) : (
                      <Text style={styles.dropdownMsg}>No matches found</Text>
                    )}
                  </View>
                )}
                <View style={styles.modalBtnRow}>
                  <Pressable style={styles.modalSaveBtn} onPress={saveHomeAddress}>
                    <Text style={styles.modalSaveBtnText}>Save</Text>
                  </Pressable>
                  <Pressable style={styles.modalCancelBtn} onPress={closeHomeModal}>
                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
>>>>>>> 0670bd0 (Push notification and settings design overhaul)
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Add/Edit Saved Place Modal */}
      <Modal visible={savedModalOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={closeDropdownOnly}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
<<<<<<< HEAD
              <View style={styles.modalCardWide}>
                <Text style={styles.modalTitle}>Enter Address:</Text>

                <View style={styles.dropdownWrap}>
                  <TextInput
                    value={addressQuery}
                    onChangeText={(t) => {
                      setAddressQuery(t);
                      setShowSuggestions(true);
                    }}
                    style={styles.modalInput}
                  />

                  {showSuggestions && addressSuggestions.length > 0 && (
                    <View style={styles.dropdownList}>
                      <FlatList
                        data={addressSuggestions}
                        keyExtractor={(item) => item}
                        style={{ maxHeight: 140 }}
                        renderItem={({ item }) => (
                          <Pressable
                            style={styles.dropdownRow}
                            onPress={() => {
                              setAddressQuery(item);
                              setShowSuggestions(false);
                            }}
                          >
                            <Text style={styles.suggestText}>{item}</Text>
                          </Pressable>
                        )}
                      />
                    </View>
                  )}
=======
              <View style={styles.modalCard}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="bookmark-outline" size={20} color={ORANGE} />
                </View>
                <Text style={styles.modalTitle}>{editingId ? "Edit Place" : "Add Place"}</Text>
                <Text style={styles.modalSub}>Search an address and give it a nickname.</Text>

                <Text style={styles.fieldLabel}>Address</Text>
                <View style={styles.searchInputWrap}>
                  <Ionicons name="search-outline" size={17} color={MUTED} />
                  <TextInput
                    value={addressQuery}
                    onChangeText={(text) => { setAddressQuery(text); setShowSavedSuggestions(true); }}
                    style={styles.searchInput}
                    placeholder="Search address"
                    placeholderTextColor={MUTED}
                  />
>>>>>>> 0670bd0 (Push notification and settings design overhaul)
                </View>
                {showSavedSuggestions && (
                  <View style={styles.dropdownList}>
                    {savedLoading ? (
                      <View style={styles.dropdownLoading}>
                        <ActivityIndicator size="small" color={ORANGE} />
                        <Text style={styles.dropdownMsg}>Searching...</Text>
                      </View>
                    ) : savedError ? (
                      <Text style={styles.dropdownMsg}>{savedError}</Text>
                    ) : addressQuery.trim().length < 3 ? (
                      <Text style={styles.dropdownMsg}>Type at least 3 characters</Text>
                    ) : savedSuggestions.length > 0 ? (
                      <FlatList
                        data={savedSuggestions}
                        keyExtractor={(item) => item.id}
                        style={{ maxHeight: 160 }}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item, index }) => (
                          <Pressable
                            style={[styles.dropdownRow, index === 0 && { borderTopWidth: 0 }]}
                            onPress={() => { setAddressQuery(item.label); setShowSavedSuggestions(false); Keyboard.dismiss(); }}
                          >
                            <Ionicons name="location-outline" size={15} color={ORANGE} />
                            <Text style={styles.dropdownText}>{item.label}</Text>
                          </Pressable>
                        )}
                      />
                    ) : (
                      <Text style={styles.dropdownMsg}>No matches found</Text>
                    )}
                  </View>
                )}

<<<<<<< HEAD
                <Text style={[styles.modalTitle, { marginTop: 14 }]}>Enter Nickname:</Text>
                <TextInput value={nicknameDraft} onChangeText={setNicknameDraft} style={styles.modalInput} />

                <View style={styles.modalBtnRow}>
                  <Pressable style={[styles.modalBtn, styles.darkBtn]} onPress={saveSavedPlace}>
                    <Text style={styles.darkBtnText}>Save</Text>
                  </Pressable>

                  <Pressable style={[styles.modalBtn, styles.secondaryBtn]} onPress={closeSavedModal}>
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
=======
                <Text style={[styles.fieldLabel, { marginTop: 14 }]}>Nickname</Text>
                <View style={styles.searchInputWrap}>
                  <Ionicons name="bookmark-outline" size={17} color={MUTED} />
                  <TextInput
                    value={nicknameDraft}
                    onChangeText={setNicknameDraft}
                    style={styles.searchInput}
                    placeholder="e.g. Insurance Hospital"
                    placeholderTextColor={MUTED}
                  />
                </View>

                <View style={styles.modalBtnRow}>
                  <Pressable style={styles.modalSaveBtn} onPress={saveSavedPlace}>
                    <Text style={styles.modalSaveBtnText}>Save</Text>
                  </Pressable>
                  <Pressable style={styles.modalCancelBtn} onPress={closeSavedModal}>
                    <Text style={styles.modalCancelBtnText}>Cancel</Text>
>>>>>>> 0670bd0 (Push notification and settings design overhaul)
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

const styles = StyleSheet.create({
<<<<<<< HEAD
  container: { flex: 1, backgroundColor: "#F3F4F6" },

  header: {
    height: 52,
    paddingHorizontal: 12,
=======
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  header: {
>>>>>>> 0670bd0 (Push notification and settings design overhaul)
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: BG,
  },
<<<<<<< HEAD
  backBtn: { width: 40, justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111" },

  content: { paddingHorizontal: 14, paddingTop: 10, gap: 12 },

  cardRow: {
    backgroundColor: "#F7F7F7",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
=======
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT,
    letterSpacing: -0.3,
  },

  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ORANGE_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: ORANGE_MID,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: MUTED,
    marginBottom: 3,
  },
  settingValue: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
  },

  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: 16,
  },

  editPill: {
    backgroundColor: ORANGE_LIGHT,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: ORANGE_MID,
  },
  editPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: ORANGE,
  },

  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    marginLeft: 4,
    marginRight: 4,
>>>>>>> 0670bd0 (Push notification and settings design overhaul)
  },
  cardRowTitle: { fontSize: 14, fontWeight: "600" },
  editText: { fontSize: 13, fontWeight: "600" },

<<<<<<< HEAD
  savedPanel: {
    backgroundColor: TAN,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: TAN_BORDER,
    gap: 10,
  },

  addBtn: {
    backgroundColor: "#E7DAD2",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  addBtnText: { fontSize: 14, fontWeight: "700" },

  savedRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  savedNick: { fontWeight: "700" },
  savedAddr: { fontSize: 12, color: "#6B7280" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
=======
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  addRowIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ORANGE_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: ORANGE_MID,
  },
  addRowText: {
    fontSize: 15,
    fontWeight: "600",
    color: ORANGE,
  },
  trashBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
>>>>>>> 0670bd0 (Push notification and settings design overhaul)
    justifyContent: "center",
    paddingHorizontal: 20,
  },
<<<<<<< HEAD
  modalCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16 },
  modalCardWide: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16 },

  modalTitle: { fontWeight: "700", marginBottom: 8 },

  modalInput: {
    backgroundColor: TAN,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 10,
  },

  modalBtnRow: { flexDirection: "row", gap: 10, marginTop: 16 },

  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryBtn: { backgroundColor: "#F59E0B" },
  primaryBtnText: { color: "#fff", fontWeight: "800" },

  secondaryBtn: { backgroundColor: "#D1D5DB" },
  secondaryBtnText: { fontWeight: "800" },

  darkBtn: { backgroundColor: "#111827" },
  darkBtnText: { color: "#fff", fontWeight: "800" },

  dropdownWrap: { position: "relative" },
  dropdownList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
  },
  dropdownRow: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
=======
  modalCard: {
    backgroundColor: CARD,
    borderRadius: 24,
    padding: 24,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  modalIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: ORANGE_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: ORANGE_MID,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT,
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 0.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },

  modalInput: {
    height: 50,
    backgroundColor: BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    fontSize: 15,
    color: TEXT,
    marginBottom: 4,
  },

  searchInputWrap: {
    height: 50,
    backgroundColor: BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: TEXT,
    paddingVertical: 0,
  },

  dropdownList: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 14,
    backgroundColor: CARD,
    overflow: "hidden",
    marginBottom: 4,
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  dropdownText: {
    flex: 1,
    fontSize: 13,
    color: TEXT,
    lineHeight: 19,
  },
  dropdownMsg: {
    fontSize: 13,
    color: MUTED,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  dropdownLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  modalSaveBtn: {
    flex: 1,
    height: 50,
    backgroundColor: ORANGE,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ORANGE,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalSaveBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
  modalCancelBtn: {
    flex: 1,
    height: 50,
    backgroundColor: BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  modalCancelBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: MUTED,
>>>>>>> 0670bd0 (Push notification and settings design overhaul)
  },
  suggestText: { fontSize: 13 },
});