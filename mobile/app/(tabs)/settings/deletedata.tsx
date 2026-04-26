import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const ORANGE = "#F58500";
const ORANGE_LIGHT = "#FFF4E6";
const ORANGE_MID = "#FFE0B2";
const BG = "#FAF8F5";
const CARD = "#FFFFFF";
const BORDER = "#F0EBE3";
const TEXT = "#1A1614";
const MUTED = "#9B9189";

type DataItem = {
  key: string;
  label: string;
  description: string;
  icon: string;
};

const DATA_ITEMS: DataItem[] = [
  {
    key: "forumPosts",
    label: "Forum Posts",
    description: "All posts you've made in the community forum",
    icon: "chatbubbles-outline",
  },
  {
    key: "comments",
    label: "Comments",
    description: "Replies and comments on forum threads",
    icon: "chatbubble-outline",
  },
  {
    key: "cachedChecklist",
    label: "Cached Checklist",
    description: "Locally stored checklist progress and items",
    icon: "checkbox-outline",
  },
  {
    key: "cachedSaved",
    label: "Cached Saved Locations",
    description: "Saved places and location history",
    icon: "location-outline",
  },
];

export default function DeleteDataScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<Record<string, boolean>>({
    forumPosts: true,
    comments: true,
    cachedChecklist: true,
    cachedSaved: true,
  });

  const toggleItem = (key: string) =>
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }));

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </Pressable>
        <Text style={styles.headerTitle}>Delete Data</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.content}>
        {/* Warning banner */}
        <View style={styles.warningBanner}>
          <Ionicons name="warning-outline" size={18} color="#EF4444" />
          <Text style={styles.warningText}>
            This action is permanent and cannot be undone.
          </Text>
        </View>

        <Text style={styles.sectionHeader}>SELECT DATA TO DELETE</Text>
        <View style={styles.card}>
          {DATA_ITEMS.map((item, index) => (
            <View key={item.key}>
              {index > 0 && <View style={styles.divider} />}
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                onPress={() => toggleItem(item.key)}
              >
                <View style={[
                  styles.iconWrap,
                  selected[item.key] && styles.iconWrapActive,
                ]}>
                  <Ionicons
                    name={item.icon as any}
                    size={16}
                    color={selected[item.key] ? ORANGE : MUTED}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Text style={styles.rowDesc}>{item.description}</Text>
                </View>
                <View style={[
                  styles.checkbox,
                  selected[item.key] && styles.checkboxActive,
                ]}>
                  {selected[item.key] && (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  )}
                </View>
              </Pressable>
            </View>
          ))}
        </View>

        {/* Delete button */}
        <Pressable
          style={({ pressed }) => [
            styles.deleteBtn,
            selectedCount === 0 && styles.deleteBtnDisabled,
            pressed && selectedCount > 0 && { opacity: 0.85 },
          ]}
          onPress={() => {}}
          disabled={selectedCount === 0}
        >
          <Ionicons name="trash-outline" size={18} color="#fff" />
          <Text style={styles.deleteBtnText}>
            Delete {selectedCount > 0 ? `${selectedCount} Item${selectedCount > 1 ? "s" : ""}` : "Data"}
          </Text>
        </Pressable>
      </View>
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

  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  warningBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: "#EF4444",
    fontWeight: "600",
    lineHeight: 18,
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
    overflow: "hidden",
    marginBottom: 24,
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
    gap: 14,
  },

  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  iconWrapActive: {
    backgroundColor: ORANGE_LIGHT,
    borderColor: ORANGE_MID,
  },

  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 3,
  },
  rowDesc: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 16,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: BORDER,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxActive: {
    backgroundColor: ORANGE,
    borderColor: ORANGE,
  },

  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: 16,
  },

  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#EF4444",
    shadowColor: "#EF4444",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  deleteBtnDisabled: {
    backgroundColor: "#D1D5DB",
    shadowOpacity: 0,
    elevation: 0,
  },
  deleteBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
});