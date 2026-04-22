import React, { useCallback, useEffect, useRef, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";

// ─── Mapbox token ─────────────────────────────────────────────────────────────
// Add this to your .env file:  EXPO_PUBLIC_MAPBOX_TOKEN=pk.your_token_here
const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────
type LatLng = {
  latitude: number;
  longitude: number;
};

type SavedPlace = {
  id: string;
  nickname: string;
  address: string;
  coords: LatLng | null;
};

type AddressSuggestion = {
  id: string;
  label: string;
  coords: LatLng;
};

// Mapbox Geocoding v5 feature shape (only fields we use)
type MapboxFeature = {
  id: string;
  place_name: string;
  center: [number, number]; // [longitude, latitude]
};

// ─── Constants ────────────────────────────────────────────────────────────────
const TAN        = "#FDEFE7";
const TAN_BORDER = "#F2D8C8";

// Bias autocomplete results toward Southern California
const PROXIMITY = "-118.2437,34.0522";

// ─── useMapbox hook ───────────────────────────────────────────────────────────
// Identical return shape to the old usePhoton hook — drop-in replacement.
function useMapbox() {
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading]         = useState(false);
  const debounceRef                   = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((input: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!input.trim()) { setSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);
        const url =
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(input)}.json` +
          `?access_token=${MAPBOX_TOKEN}` +
          `&autocomplete=true` +
          `&country=us` +
          `&types=address,place,neighborhood,locality` +
          `&proximity=${PROXIMITY}` +
          `&limit=6`;

        const res  = await fetch(url);
        const data = await res.json();

        const next: AddressSuggestion[] = (data?.features ?? []).map(
          (f: MapboxFeature) => ({
            id:    f.id,
            label: f.place_name,          // Mapbox returns a clean, full address string
            coords: {
              latitude:  f.center[1],
              longitude: f.center[0],
            },
          })
        );
        setSuggestions(next);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  const clear = useCallback(() => setSuggestions([]), []);

  return { suggestions, loading, search, clear };
}

async function geocodeAddressWithMapbox(input: string): Promise<LatLng | null> {
  const query = input.trim();
  if (!query || !MAPBOX_TOKEN) return null;

  try {
    const url =
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
      `?access_token=${MAPBOX_TOKEN}` +
      `&autocomplete=false` +
      `&country=us` +
      `&types=address,place,neighborhood,locality` +
      `&proximity=${PROXIMITY}` +
      `&limit=1`;

    const res = await fetch(url);
    const data = await res.json();
    const feature = data?.features?.[0] as MapboxFeature | undefined;

    if (!feature?.center) return null;

    return {
      latitude: feature.center[1],
      longitude: feature.center[0],
    };
  } catch {
    return null;
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function PlacesScreen() {
  const router = useRouter();

  // ── Accordion ──
  const [savedOpen, setSavedOpen] = useState(false);

  // ── County ──
  const [countyModalOpen, setCountyModalOpen] = useState(false);
  const [county, setCounty]                   = useState("LA County");
  const [countyDraft, setCountyDraft]         = useState(county);

  // ── Home ──
  const [homeModalOpen, setHomeModalOpen]                       = useState(false);
  const [home, setHome]                                         = useState("set address");
  const [homeCoords, setHomeCoords]                             = useState<LatLng | null>(null);
  const [homeDraft, setHomeDraft]                               = useState(home);
  const [homeCoordsFromSuggestion, setHomeCoordsFromSuggestion] = useState<LatLng | null>(null);
  const homeMapbox = useMapbox();

  // ── Saved Places ──
  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const [editingId, setEditingId]           = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft]   = useState("");
  const [addressQuery, setAddressQuery]     = useState("");
  const [addressCoords, setAddressCoords]   = useState<LatLng | null>(null);
  const savedMapbox = useMapbox();

  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([
    { id: "1", nickname: "set nickname", address: "set address", coords: null },
  ]);

  useEffect(() => {
    const loadUserPlaces = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          setHome("");
          setHomeCoords(null);
          setSavedPlaces([]);
          return;
        }

        const userRef = doc(db, "users", user.uid);
        const snapshot = await getDoc(userRef);

        if (!snapshot.exists()) {
          setHome("");
          setHomeCoords(null);
          setSavedPlaces([]);
          return;
        }

        const data = snapshot.data();

        setHome(data.homeAddress || "");
        setHomeCoords(data.homeCoords || null);
        setSavedPlaces(Array.isArray(data.savedPlaces) ? data.savedPlaces : []);
      } catch (error) {
        console.error("Error loading user places:", error);
        setHome("");
        setHomeCoords(null);
        setSavedPlaces([]);
      }
    };

    loadUserPlaces();
  }, []);

  async function persistHome(address: string, coords: LatLng | null) {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          homeAddress: address || "",
          homeCoords: coords ?? null,
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Error saving home:", error);
    }
  }

  async function persistSavedPlaces(places: SavedPlace[]) {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          savedPlaces: places ?? [],
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Error saving saved places:", error);
    }
  }

  // ─── Home modal ───────────────────────────────────────────────────────────
  function openHomeModal() {
    setHomeDraft(home);
    setHomeCoordsFromSuggestion(homeCoords);
    homeMapbox.clear();
    setHomeModalOpen(true);
  }

  function closeHomeModal() {
    setHomeModalOpen(false);
    homeMapbox.clear();
    Keyboard.dismiss();
  }

  async function saveHome() {
    const trimmed = homeDraft.trim();

    if (!trimmed) {
      setHome("");
      setHomeCoords(null);
      await persistHome("", null);
      closeHomeModal();
      return;
    }

    const coords =
      homeCoordsFromSuggestion ??
      (trimmed === home ? homeCoords : null) ??
      await geocodeAddressWithMapbox(trimmed);

    setHome(trimmed);
    setHomeCoords(coords);
    await persistHome(trimmed, coords);
    closeHomeModal();
  }

  // ─── Saved Places modal ───────────────────────────────────────────────────
  function closeSavedModal() {
    setSavedModalOpen(false);
    setEditingId(null);
    savedMapbox.clear();
    Keyboard.dismiss();
  }

  function openAddSavedPlace() {
    setEditingId(null);
    setNicknameDraft("");
    setAddressQuery("");
    setAddressCoords(null);
    savedMapbox.clear();
    setSavedModalOpen(true);
  }

  function openEditSavedPlace(place: SavedPlace) {
    setEditingId(place.id);
    setNicknameDraft(place.nickname);
    setAddressQuery(place.address);
    setAddressCoords(place.coords);
    savedMapbox.clear();
    setSavedModalOpen(true);
  }

  async function saveSavedPlace() {
    const nick = nicknameDraft.trim();
    const addr = addressQuery.trim();
    if (!nick || !addr) return;

    const existingPlace = editingId
      ? savedPlaces.find((p) => p.id === editingId) ?? null
      : null;

    const coords =
      addressCoords ??
      (existingPlace && existingPlace.address === addr ? existingPlace.coords : null) ??
      await geocodeAddressWithMapbox(addr);

    let next: SavedPlace[];
    if (editingId) {
      next = savedPlaces.map((p) =>
        p.id === editingId
          ? { ...p, nickname: nick, address: addr, coords }
          : p
      );
    } else {
      next = [
        ...savedPlaces,
        { id: String(Date.now()), nickname: nick, address: addr, coords },
      ];
    }
    setSavedPlaces(next);
    await persistSavedPlaces(next);
    closeSavedModal();
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#111" />
        </Pressable>
        <Text style={styles.headerTitle}>Places</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        {/* County */}
        <View style={styles.cardRow}>
          <Text style={styles.cardRowTitle}>County — {county}</Text>
          <Pressable onPress={() => { setCountyDraft(county); setCountyModalOpen(true); }}>
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        </View>

        {/* Home */}
        <View style={styles.cardRow}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Text style={styles.cardRowTitle}>Home</Text>
            <Text style={styles.cardRowSub} numberOfLines={1}>
              {home || "No home address set"}
            </Text>
          </View>
          <Pressable onPress={openHomeModal}>
            <Text style={styles.editText}>Edit</Text>
          </Pressable>
        </View>

        {/* Saved Places */}
        <Pressable style={styles.cardRow} onPress={() => setSavedOpen((v) => !v)}>
          <Text style={styles.cardRowTitle}>Saved Places</Text>
          <Ionicons name={savedOpen ? "chevron-up" : "chevron-down"} size={18} color="#111" />
        </Pressable>

        {savedOpen && (
          <View style={styles.savedPanel}>
            <Pressable style={styles.addBtn} onPress={openAddSavedPlace}>
              <Text style={styles.addBtnText}>+ Add Saved Place</Text>
            </Pressable>

            {savedPlaces.length === 0 ? (
              <Text style={styles.savedAddr}>No saved places yet</Text>
            ) : (
              savedPlaces.map((p) => (
                <View key={p.id} style={styles.savedRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.savedNick}>{p.nickname}</Text>
                    <Text style={styles.savedAddr}>{p.address}</Text>
                  </View>
                  <Pressable onPress={() => openEditSavedPlace(p)}>
                    <Text style={styles.editText}>Edit</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}
      </View>

      {/* ── County Modal ──────────────────────────────────────────────────── */}
      <Modal visible={countyModalOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Enter County:</Text>
                <TextInput
                  value={countyDraft}
                  onChangeText={setCountyDraft}
                  style={styles.modalInput}
                />
                <View style={styles.modalBtnRow}>
                  <Pressable
                    style={[styles.modalBtn, styles.primaryBtn]}
                    onPress={() => { setCounty(countyDraft); setCountyModalOpen(false); }}
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

      {/* ── Home Modal ────────────────────────────────────────────────────── */}
      <Modal visible={homeModalOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => { homeMapbox.clear(); Keyboard.dismiss(); }}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCardWide}>
                <View style={styles.modalHeader}>
                  <Ionicons name="home-outline" size={18} color="#F58500" style={{ marginRight: 6 }} />
                  <Text style={styles.modalTitleLarge}>Home Address</Text>
                </View>

                <View style={styles.searchFieldWrap}>
                  <Ionicons name="search" size={16} color="#999" style={styles.searchIcon} />
                  <TextInput
                    value={homeDraft}
                    onChangeText={(t) => {
                      setHomeDraft(t);
                      setHomeCoordsFromSuggestion(null);
                      homeMapbox.search(t);
                    }}
                    style={styles.searchInput}
                    placeholder="Search address..."
                    placeholderTextColor="#BBAA99"
                    autoCorrect={false}
                  />
                  {homeMapbox.loading && (
                    <ActivityIndicator size="small" color="#F58500" style={{ marginRight: 10 }} />
                  )}
                </View>

                {homeMapbox.suggestions.length > 0 && (
                  <View style={styles.suggestionBox}>
                    <FlatList
                      data={homeMapbox.suggestions}
                      keyExtractor={(item) => item.id}
                      keyboardShouldPersistTaps="handled"
                      style={{ maxHeight: 180 }}
                      renderItem={({ item }) => (
                        <Pressable
                          style={styles.suggestionRow}
                          onPress={() => {
                            setHomeDraft(item.label);
                            setHomeCoordsFromSuggestion(item.coords);
                            homeMapbox.clear();
                            Keyboard.dismiss();
                          }}
                        >
                          <Ionicons name="location-outline" size={15} color="#F58500" style={{ marginRight: 8 }} />
                          <Text style={styles.suggestionText}>{item.label}</Text>
                        </Pressable>
                      )}
                    />
                  </View>
                )}

                {!homeMapbox.loading && homeDraft.trim().length > 1 && homeMapbox.suggestions.length === 0 && (
                  <Text style={styles.noResultsText}>No results — keep typing</Text>
                )}

                {homeCoordsFromSuggestion && (
                  <View style={styles.coordsBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
                    <Text style={styles.coordsBadgeText}>
                      {homeCoordsFromSuggestion.latitude.toFixed(4)},{" "}
                      {homeCoordsFromSuggestion.longitude.toFixed(4)}
                    </Text>
                  </View>
                )}

                <View style={styles.modalBtnRow}>
                  <Pressable style={[styles.modalBtn, styles.primaryBtn]} onPress={saveHome}>
                    <Text style={styles.primaryBtnText}>Save</Text>
                  </Pressable>
                  <Pressable style={[styles.modalBtn, styles.secondaryBtn]} onPress={closeHomeModal}>
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Add / Edit Saved Place Modal ──────────────────────────────────── */}
      <Modal visible={savedModalOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => { savedMapbox.clear(); Keyboard.dismiss(); }}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCardWide}>
                <View style={styles.modalHeader}>
                  <Ionicons name="bookmark-outline" size={18} color="#F58500" style={{ marginRight: 6 }} />
                  <Text style={styles.modalTitleLarge}>
                    {editingId ? "Edit Saved Place" : "Add Saved Place"}
                  </Text>
                </View>

                <Text style={styles.modalLabel}>Address</Text>
                <View style={styles.searchFieldWrap}>
                  <Ionicons name="search" size={16} color="#999" style={styles.searchIcon} />
                  <TextInput
                    value={addressQuery}
                    onChangeText={(t) => {
                      setAddressQuery(t);
                      setAddressCoords(null);
                      savedMapbox.search(t);
                    }}
                    style={styles.searchInput}
                    placeholder="Search address..."
                    placeholderTextColor="#BBAA99"
                    autoCorrect={false}
                  />
                  {savedMapbox.loading && (
                    <ActivityIndicator size="small" color="#F58500" style={{ marginRight: 10 }} />
                  )}
                </View>

                {savedMapbox.suggestions.length > 0 && (
                  <View style={styles.suggestionBox}>
                    <FlatList
                      data={savedMapbox.suggestions}
                      keyExtractor={(item) => item.id}
                      keyboardShouldPersistTaps="handled"
                      style={{ maxHeight: 160 }}
                      renderItem={({ item }) => (
                        <Pressable
                          style={styles.suggestionRow}
                          onPress={() => {
                            setAddressQuery(item.label);
                            setAddressCoords(item.coords);
                            savedMapbox.clear();
                            Keyboard.dismiss();
                          }}
                        >
                          <Ionicons name="location-outline" size={15} color="#F58500" style={{ marginRight: 8 }} />
                          <Text style={styles.suggestionText}>{item.label}</Text>
                        </Pressable>
                      )}
                    />
                  </View>
                )}

                {!savedMapbox.loading && addressQuery.trim().length > 1 && savedMapbox.suggestions.length === 0 && (
                  <Text style={styles.noResultsText}>No results — keep typing</Text>
                )}

                {addressCoords && (
                  <View style={styles.coordsBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
                    <Text style={styles.coordsBadgeText}>
                      {addressCoords.latitude.toFixed(4)},{" "}
                      {addressCoords.longitude.toFixed(4)}
                    </Text>
                  </View>
                )}

                <Text style={[styles.modalLabel, { marginTop: 14 }]}>Nickname</Text>
                <View style={styles.searchFieldWrap}>
                  <Ionicons name="pricetag-outline" size={16} color="#999" style={styles.searchIcon} />
                  <TextInput
                    value={nicknameDraft}
                    onChangeText={setNicknameDraft}
                    style={styles.searchInput}
                    placeholder="e.g. Insurance Hospital"
                    placeholderTextColor="#BBAA99"
                  />
                </View>

                <View style={styles.modalBtnRow}>
                  <Pressable style={[styles.modalBtn, styles.darkBtn]} onPress={saveSavedPlace}>
                    <Text style={styles.darkBtnText}>Save</Text>
                  </Pressable>
                  <Pressable style={[styles.modalBtn, styles.secondaryBtn]} onPress={closeSavedModal}>
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },

  header: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn:     { width: 40, justifyContent: "center" },
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
    alignItems: "center",
  },
  cardRowTitle: { fontSize: 14, fontWeight: "600" },
  cardRowSub:   { fontSize: 12, color: "#6B7280", marginTop: 2 },
  editText:     { fontSize: 13, fontWeight: "600", color: "#F58500" },

  savedPanel: {
    backgroundColor: TAN,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: TAN_BORDER,
    gap: 10,
  },

  addBtn:     { backgroundColor: "#E7DAD2", borderRadius: 8, paddingVertical: 12, paddingHorizontal: 12 },
  addBtnText: { fontSize: 14, fontWeight: "700" },

  savedRow: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  savedNick: { fontWeight: "700" },
  savedAddr: { fontSize: 12, color: "#6B7280" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalCard:     { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16 },
  modalCardWide: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16 },

  modalHeader:     { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  modalTitleLarge: { fontSize: 16, fontWeight: "800", color: "#111" },
  modalTitle:      { fontWeight: "700", marginBottom: 8 },
  modalLabel:      { fontSize: 12, fontWeight: "700", color: "#6B7280", marginBottom: 6 },

  searchFieldWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TAN,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 4,
  },
  searchIcon:  { marginLeft: 10 },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, fontSize: 14, color: "#111" },

  modalInput: {
    backgroundColor: TAN,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 10,
  },

  suggestionBox: {
    borderWidth: 1,
    borderColor: "#FFD0A0",
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    marginBottom: 4,
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#FFE8CC",
  },
  suggestionText: { fontSize: 13, color: "#333", flex: 1 },
  noResultsText:  { fontSize: 12, color: "#999", textAlign: "center", paddingVertical: 6 },

  coordsBadge:     { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6, marginTop: 2 },
  coordsBadgeText: { fontSize: 11, color: "#16A34A", fontWeight: "600" },

  modalBtnRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  modalBtn:    { flex: 1, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  primaryBtn:       { backgroundColor: "#F59E0B" },
  primaryBtnText:   { color: "#fff", fontWeight: "800" },
  secondaryBtn:     { backgroundColor: "#D1D5DB" },
  secondaryBtnText: { fontWeight: "800" },
  darkBtn:          { backgroundColor: "#111827" },
  darkBtnText:      { color: "#fff", fontWeight: "800" },
});