import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const BG = "#F3F4F6";        
const CARD = "#FFFFFF";    
const BORDER = "#E5E7EB";    
const TEXT = "#111827";
const SUBTLE = "#6B7280";

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

function CardRow({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.cardRow} onPress={onPress}>
      <Text style={styles.rowText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={SUBTLE} />
    </Pressable>
  );
}

export default function SecurityScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <TopBar title="Login & Security" />

      <View style={styles.list}>
        <CardRow label="Reset Password" onPress={() => router.push("/(tabs)/settings/resetpass")} />
        <CardRow
          label="Location Permissions"
          onPress={() => router.push("/(tabs)/settings/locationpermission")}
        />
        <CardRow label="Delete Data" onPress={() => router.push("/(tabs)/settings/deletedata")} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, paddingHorizontal: 16 },

  topBar: {
    paddingTop: 6,
    paddingBottom: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: { position: "absolute", left: 0, top: 6, padding: 6 },
  topTitle: { fontSize: 18, fontWeight: "700", color: TEXT },

  list: { marginTop: 12, gap: 12 },

  cardRow: {
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowText: { fontSize: 14, fontWeight: "600", color: TEXT },
});