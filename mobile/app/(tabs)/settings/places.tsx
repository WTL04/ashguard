import React, { useEffect, useState } from "react";
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
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, getDoc, setDoc } from "firebase/firestore";
import {
  useMapboxSearch,
  geocodeAddressWithMapbox,
} from "@/lib/useMapboxSearch";

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

const BG = "#FAF8F5";
const CARD = "#FFFFFF";
const BORDER = "#F0EBE3";
const TEXT = "#1A1614";
const MUTED = "#9B9189";
const ORANGE = "#F58500";
const ORANGE_LIGHT = "#FFF4E6";
const ORANGE_MID = "#FFE0B2";
const RED = "#EF4444";
const RED_LIGHT = "#FFF1F2";
const RED_MID = "#FECDD3";

export default function PlacesScreen() {
  const router = useRouter();

  const [savedOpen, setSavedOpen] = useState(true);

  const [countyModalOpen, setCountyModalOpen] = useState(false);
  const [county, setCounty] = useState("LA County");
  const [countyDraft, setCountyDraft] = useState("LA County");

  const [homeModalOpen, setHomeModalOpen] = useState(false);
  const [home, setHome] = useState("");
  const [homeCoords, setHomeCoords] = useState<LatLng | null>(null);
  const [homeDraft, setHomeDraft] = useState("");
  const [homeCoordsFromSuggestion, setHomeCoordsFromSuggestion] =
    useState<LatLng | null>(null);
  const homeMapbox = useMapboxSearch();

  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [addressCoords, setAddressCoords] = useState<LatLng | null>(null);
  const savedMapbox = useMapboxSearch();

  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);

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

        if (data.county) {
          setCounty(data.county);
          setCountyDraft(data.county);
        }
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

  async function persistCounty(value: string) {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const userRef = doc(db, "users", user.uid);
      await setDoc(
        userRef,
        {
          county: value,
        },
        { merge: true }
      );
    } catch (error) {
      console.error("Error saving county:", error);
    }
  }

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
      (await geocodeAddressWithMapbox(trimmed));

    setHome(trimmed);
    setHomeCoords(coords);
    await persistHome(trimmed, coords);
    closeHomeModal();
  }

  function closeSavedModal() {
    setSavedModalOpen(false);
    setEditingId(null);
    setNicknameDraft("");
    setAddressQuery("");
    setAddressCoords(null);
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
      (await geocodeAddressWithMapbox(addr));

    let next: SavedPlace[];
    if (editingId) {
      next = savedPlaces.map((p) =>
        p.id === editingId ? { ...p, nickname: nick, address: addr, coords } : p
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

  async function deleteSavedPlace(id: string) {
    const next = savedPlaces.filter((place) => place.id !== id);
    setSavedPlaces(next);
    await persistSavedPlaces(next);
  }

  async function saveCountyValue() {
    const value = countyDraft.trim();
    if (!value) return;
    setCounty(value);
    await persistCounty(value);
    setCountyModalOpen(false);
  }

  const renderInfoRow = ({
    icon,
    label,
    value,
    onEdit,
    iconColor = ORANGE,
    iconActive = true,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    onEdit: () => void;
    iconColor?: string;
    iconActive?: boolean;
  }) => (
    <View style={styles.row}>
      <View style={[styles.iconWrap, iconActive && styles.iconWrapActive]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowOverline}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      <Pressable style={styles.editButton} onPress={onEdit}>
        <Text style={styles.editButtonText}>Edit</Text>
      </Pressable>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </Pressable>
        <Text style={styles.headerTitle}>Places</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeader}>LOCATION</Text>
        <View style={styles.card}>
          {renderInfoRow({
            icon: "map-outline",
            label: "County",
            value: county || "Set county",
            onEdit: () => {
              setCountyDraft(county);
              setCountyModalOpen(true);
            },
          })}

          <View style={styles.divider} />

          {renderInfoRow({
            icon: "home-outline",
            label: "Home Address",
            value: home || "Set address",
            onEdit: openHomeModal,
          })}
        </View>

        <View style={styles.savedHeaderRow}>
          <Text style={styles.sectionHeader}>SAVED PLACES</Text>
          <Pressable onPress={() => setSavedOpen((prev) => !prev)} hitSlop={10}>
            <Ionicons
              name={savedOpen ? "chevron-up" : "chevron-down"}
              size={16}
              color={MUTED}
            />
          </Pressable>
        </View>

        {savedOpen && (
          <View style={styles.card}>
            {savedPlaces.length > 0 &&
              savedPlaces.map((place, index) => (
                <View key={place.id}>
                  {index > 0 && <View style={styles.divider} />}
                  <View style={styles.row}>
                    <View style={[styles.iconWrap, styles.iconWrapActive]}>
                      <Ionicons name="bookmark-outline" size={16} color={ORANGE} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.rowOverline}>{place.nickname}</Text>
                      <Text style={styles.rowValue} numberOfLines={1}>
                        {place.address}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.editButton}
                      onPress={() => openEditSavedPlace(place)}
                    >
                      <Text style={styles.editButtonText}>Edit</Text>
                    </Pressable>
                    <Pressable
                      style={styles.deleteButton}
                      onPress={() => deleteSavedPlace(place.id)}
                    >
                      <Ionicons name="trash-outline" size={15} color={RED} />
                    </Pressable>
                  </View>
                </View>
              ))}

            {savedPlaces.length > 0 && <View style={styles.divider} />}

            <Pressable style={styles.addRow} onPress={openAddSavedPlace}>
              <View style={styles.addIconWrap}>
                <Ionicons name="add" size={18} color={ORANGE} />
              </View>
              <Text style={styles.addRowText}>Add a place</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <Modal visible={countyModalOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="map-outline" size={18} color={ORANGE} />
                </View>
                <Text style={styles.modalTitle}>Edit County</Text>
                <Text style={styles.modalSub}>
                  Update the county used for your location settings.
                </Text>
                <TextInput
                  value={countyDraft}
                  onChangeText={setCountyDraft}
                  style={styles.input}
                  placeholder="e.g. LA County"
                  placeholderTextColor={MUTED}
                />
                <View style={styles.modalBtnRow}>
                  <Pressable style={styles.primaryBtn} onPress={saveCountyValue}>
                    <Text style={styles.primaryBtnText}>Save</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryBtn}
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

      <Modal visible={homeModalOpen} transparent animationType="fade">
        <TouchableWithoutFeedback
          onPress={() => {
            homeMapbox.clear();
            Keyboard.dismiss();
          }}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCardWide}>
                <View style={styles.modalHeaderRow}>
                  <View style={styles.modalIconWrapSmall}>
                    <Ionicons name="home-outline" size={16} color={ORANGE} />
                  </View>
                  <Text style={styles.modalTitleWide}>Home Address</Text>
                </View>

                <View style={styles.searchFieldWrap}>
                  <Ionicons name="search" size={16} color={MUTED} style={styles.searchIcon} />
                  <TextInput
                    value={homeDraft}
                    onChangeText={(text) => {
                      setHomeDraft(text);
                      setHomeCoordsFromSuggestion(null);
                      homeMapbox.search(text);
                    }}
                    style={styles.searchInput}
                    placeholder="Search address..."
                    placeholderTextColor="#B8AEA6"
                    autoCorrect={false}
                  />
                  {homeMapbox.loading && (
                    <ActivityIndicator size="small" color={ORANGE} style={styles.loader} />
                  )}
                </View>

                {homeMapbox.suggestions.length > 0 && (
                  <View style={styles.suggestionBox}>
                    <FlatList
                      data={homeMapbox.suggestions}
                      keyExtractor={(item) => item.placeId}
                      keyboardShouldPersistTaps="handled"
                      style={{ maxHeight: 180 }}
                      renderItem={({ item }) => (
                        <Pressable
                          style={styles.suggestionRow}
                          onPress={() => {
                            const [longitude, latitude] = item.coords;
                            setHomeDraft(item.shortLabel);
                            setHomeCoordsFromSuggestion({ latitude, longitude });
                            homeMapbox.clear();
                            Keyboard.dismiss();
                          }}
                        >
                          <Ionicons
                            name="location-outline"
                            size={15}
                            color={ORANGE}
                            style={{ marginRight: 8 }}
                          />
                          <Text style={styles.suggestionText}>{item.label}</Text>
                        </Pressable>
                      )}
                    />
                  </View>
                )}

                {!homeMapbox.loading &&
                  homeDraft.trim().length > 1 &&
                  homeMapbox.suggestions.length === 0 && (
                    <Text style={styles.helperText}>No results yet. Keep typing.</Text>
                  )}

                {homeCoordsFromSuggestion && (
                  <View style={styles.coordsBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
                    <Text style={styles.coordsBadgeText}>
                      {homeCoordsFromSuggestion.latitude.toFixed(4)}, {" "}
                      {homeCoordsFromSuggestion.longitude.toFixed(4)}
                    </Text>
                  </View>
                )}

                <View style={styles.modalBtnRow}>
                  <Pressable style={styles.primaryBtn} onPress={saveHome}>
                    <Text style={styles.primaryBtnText}>Save</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryBtn} onPress={closeHomeModal}>
                    <Text style={styles.secondaryBtnText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={savedModalOpen} transparent animationType="fade">
        <TouchableWithoutFeedback
          onPress={() => {
            savedMapbox.clear();
            Keyboard.dismiss();
          }}
        >
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCardWide}>
                <View style={styles.modalHeaderRow}>
                  <View style={styles.modalIconWrapSmall}>
                    <Ionicons name="bookmark-outline" size={16} color={ORANGE} />
                  </View>
                  <Text style={styles.modalTitleWide}>
                    {editingId ? "Edit Saved Place" : "Add Saved Place"}
                  </Text>
                </View>

                <Text style={styles.inputLabel}>Address</Text>
                <View style={styles.searchFieldWrap}>
                  <Ionicons name="search" size={16} color={MUTED} style={styles.searchIcon} />
                  <TextInput
                    value={addressQuery}
                    onChangeText={(text) => {
                      setAddressQuery(text);
                      setAddressCoords(null);
                      savedMapbox.search(text);
                    }}
                    style={styles.searchInput}
                    placeholder="Search address..."
                    placeholderTextColor="#B8AEA6"
                    autoCorrect={false}
                  />
                  {savedMapbox.loading && (
                    <ActivityIndicator size="small" color={ORANGE} style={styles.loader} />
                  )}
                </View>

                {savedMapbox.suggestions.length > 0 && (
                  <View style={styles.suggestionBox}>
                    <FlatList
                      data={savedMapbox.suggestions}
                      keyExtractor={(item) => item.placeId}
                      keyboardShouldPersistTaps="handled"
                      style={{ maxHeight: 160 }}
                      renderItem={({ item }) => (
                        <Pressable
                          style={styles.suggestionRow}
                          onPress={() => {
                            const [longitude, latitude] = item.coords;
                            setAddressQuery(item.shortLabel);
                            setAddressCoords({ latitude, longitude });
                            savedMapbox.clear();
                            Keyboard.dismiss();
                          }}
                        >
                          <Ionicons
                            name="location-outline"
                            size={15}
                            color={ORANGE}
                            style={{ marginRight: 8 }}
                          />
                          <Text style={styles.suggestionText}>{item.label}</Text>
                        </Pressable>
                      )}
                    />
                  </View>
                )}

                {!savedMapbox.loading &&
                  addressQuery.trim().length > 1 &&
                  savedMapbox.suggestions.length === 0 && (
                    <Text style={styles.helperText}>No results yet. Keep typing.</Text>
                  )}

                {addressCoords && (
                  <View style={styles.coordsBadge}>
                    <Ionicons name="checkmark-circle" size={13} color="#16A34A" />
                    <Text style={styles.coordsBadgeText}>
                      {addressCoords.latitude.toFixed(4)}, {" "}
                      {addressCoords.longitude.toFixed(4)}
                    </Text>
                  </View>
                )}

                <Text style={[styles.inputLabel, { marginTop: 14 }]}>Nickname</Text>
                <View style={styles.searchFieldWrap}>
                  <Ionicons
                    name="pricetag-outline"
                    size={16}
                    color={MUTED}
                    style={styles.searchIcon}
                  />
                  <TextInput
                    value={nicknameDraft}
                    onChangeText={setNicknameDraft}
                    style={styles.searchInput}
                    placeholder="e.g. Insurance Hospital"
                    placeholderTextColor="#B8AEA6"
                  />
                </View>

                <View style={styles.modalBtnRow}>
                  <Pressable style={styles.primaryBtn} onPress={saveSavedPlace}>
                    <Text style={styles.primaryBtnText}>Save</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryBtn} onPress={closeSavedModal}>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    backgroundColor: BG,
  },
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

  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 28,
  },

  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
  },
  savedHeaderRow: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: 16,
  },

  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: ORANGE_LIGHT,
    borderColor: ORANGE_MID,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowOverline: {
    fontSize: 12,
    fontWeight: "600",
    color: MUTED,
    marginBottom: 3,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
  },

  editButton: {
    minWidth: 68,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: ORANGE_LIGHT,
    borderWidth: 1,
    borderColor: ORANGE_MID,
    alignItems: "center",
    justifyContent: "center",
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: ORANGE,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: RED_LIGHT,
    borderWidth: 1,
    borderColor: RED_MID,
    alignItems: "center",
    justifyContent: "center",
  },

  addRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  addIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FFF8F0",
    borderWidth: 1,
    borderColor: ORANGE_MID,
    alignItems: "center",
    justifyContent: "center",
  },
  addRowText: {
    fontSize: 15,
    fontWeight: "700",
    color: ORANGE,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(26, 22, 20, 0.35)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: CARD,
    borderRadius: 24,
    padding: 24,
  },
  modalCardWide: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 18,
  },
  modalIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: ORANGE_LIGHT,
    borderWidth: 1,
    borderColor: ORANGE_MID,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 14,
  },
  modalIconWrapSmall: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: ORANGE_LIGHT,
    borderWidth: 1,
    borderColor: ORANGE_MID,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT,
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  modalTitleWide: {
    fontSize: 16,
    fontWeight: "800",
    color: TEXT,
  },
  modalSub: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: MUTED,
    marginBottom: 6,
  },
  input: {
    backgroundColor: ORANGE_LIGHT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: TEXT,
  },
  searchFieldWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: ORANGE_LIGHT,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  searchIcon: {
    marginLeft: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 14,
    color: TEXT,
  },
  loader: {
    marginRight: 10,
  },

  suggestionBox: {
    borderWidth: 1,
    borderColor: ORANGE_MID,
    borderRadius: 12,
    backgroundColor: CARD,
    marginTop: 8,
    overflow: "hidden",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  suggestionText: {
    fontSize: 13,
    color: TEXT,
    flex: 1,
  },
  helperText: {
    fontSize: 12,
    color: MUTED,
    textAlign: "center",
    paddingVertical: 8,
  },
  coordsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  coordsBadgeText: {
    fontSize: 11,
    color: "#16A34A",
    fontWeight: "600",
  },

  modalBtnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  primaryBtn: {
    flex: 1,
    height: 50,
    backgroundColor: ORANGE,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  secondaryBtn: {
    flex: 1,
    height: 50,
    backgroundColor: BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: MUTED,
  },
});
