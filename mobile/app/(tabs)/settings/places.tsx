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

  const [savedModalOpen, setSavedModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
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
  }

  function openEditSavedPlace(place: SavedPlace) {
    setEditingId(place.id);
    setNicknameDraft(place.nickname);
    setAddressQuery(place.address);
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
      { id: String(Date.now()), nickname: nick, address: addr },
    ]);
    closeSavedModal();
  }

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

      {/* County Modal */}
      <Modal visible={countyModalOpen} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
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
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalCard}>
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
                </View>

                <Text style={[styles.modalTitle, { marginTop: 14 }]}>Enter Nickname:</Text>
                <TextInput value={nicknameDraft} onChangeText={setNicknameDraft} style={styles.modalInput} />

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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },

  header: {
    height: 52,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
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
  },
  cardRowTitle: { fontSize: 14, fontWeight: "600" },
  editText: { fontSize: 13, fontWeight: "600" },

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
    justifyContent: "center",
    paddingHorizontal: 16,
  },
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
  },
  suggestText: { fontSize: 13 },
});