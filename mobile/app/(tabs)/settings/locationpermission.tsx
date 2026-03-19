import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const BG = "#FFFFFF";
const CARD = "#F6F6F6";
const BORDER = "#E5E7EB";
const TEXT = "#111111";
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

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowText}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#FFFFFF", true: "#F59E0B" }}
        thumbColor={value ? BG : "#FFFFFF"}
      />
    </View>
  );
}

export default function LocationPermissionScreen() {
  const [tracking, setTracking] = useState(true);
  const [display, setDisplay] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <TopBar title="Location Permissions" />

      <View style={{ marginTop: 14, gap: 10 }}>
        <ToggleRow label="Allow Location Tracking" value={tracking} onChange={setTracking} />
        <ToggleRow label="Display Location" value={display} onChange={setDisplay} />
      </View>
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

  row: {
    backgroundColor: CARD,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowText: { fontSize: 13, fontWeight: "600", color: TEXT },
});