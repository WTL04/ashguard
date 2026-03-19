import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const BG = "#FFFFFF";
const TEXT = "#111111";
const MUTED = "#6B7280";
const ORANGE = "#F59E0B";

function TopBar({ title }: { title: string }) {
  const router = useRouter();
  return (
    <View style={styles.topBar}>
      <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={22} color={TEXT} />
      </Pressable>
      <Text style={styles.topTitle}>{title}</Text>
      <View style={{ width: 34 }} />
    </View>
  );
}

function CheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable style={styles.checkRow} onPress={onToggle}>
      <Text style={styles.checkText}>{label}</Text>
      <Ionicons name={checked ? "checkbox" : "square-outline"} size={18} color={ORANGE} />
    </Pressable>
  );
}

export default function DeleteDataScreen() {
  const [forumPosts, setForumPosts] = useState(true);
  const [comments, setComments] = useState(true);
  const [cachedChecklist, setCachedChecklist] = useState(true);
  const [cachedSaved, setCachedSaved] = useState(true);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <TopBar title="Delete Data" />

      <View style={styles.list}>
        <CheckRow label="Forum Posts" checked={forumPosts} onToggle={() => setForumPosts((v) => !v)} />
        <CheckRow label="Comments" checked={comments} onToggle={() => setComments((v) => !v)} />
        <CheckRow
          label="Cached Checklist"
          checked={cachedChecklist}
          onToggle={() => setCachedChecklist((v) => !v)}
        />
        <CheckRow
          label="Cached Saved Locations"
          checked={cachedSaved}
          onToggle={() => setCachedSaved((v) => !v)}
        />
      </View>

      <Pressable style={styles.deleteBtn} onPress={() => {}}>
        <Text style={styles.deleteBtnText}>Delete Data</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, paddingHorizontal: 18 },

  topBar: {
    paddingTop: 6,
    paddingBottom: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: { position: "absolute", left: 0, top: 6, padding: 6 },
  topTitle: { fontSize: 18, fontWeight: "700", color: TEXT },

  list: { marginTop: 18, gap: 18 },
  checkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  checkText: { fontSize: 12.5, fontWeight: "600", color: MUTED },

  deleteBtn: {
    marginTop: 30,
    alignSelf: "center",
    width: 160,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: ORANGE,
    alignItems: "center",
  },
  deleteBtnText: { fontSize: 12.5, fontWeight: "900", color: "white" },
});