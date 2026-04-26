import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, Switch, Platform } from "react-native";
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
const TEAL = "#0F9D94";

type RowConfig = {
  key: keyof { tracking: boolean; display: boolean };
  label: string;
  description: string;
  icon: string;
};

const ROWS: RowConfig[] = [
  {
    key: "tracking",
    label: "Allow Location Tracking",
    description: "Let the app access your device's GPS location",
    icon: "navigate-outline",
  },
  {
    key: "display",
    label: "Display Location",
    description: "Share your location with your emergency group",
    icon: "people-outline",
  },
];

export default function LocationPermissionScreen() {
  const router = useRouter();
  const [values, setValues] = useState({ tracking: true, display: false });

  const toggle = (key: keyof typeof values) =>
    setValues((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </Pressable>
        <Text style={styles.headerTitle}>Location Permissions</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionHeader}>PERMISSIONS</Text>
        <View style={styles.card}>
          {ROWS.map((row, index) => (
            <View key={row.key}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.row}>
                <View style={[styles.iconWrap, values[row.key] && styles.iconWrapActive]}>
                  <Ionicons
                    name={row.icon as any}
                    size={16}
                    color={values[row.key] ? ORANGE : MUTED}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{row.label}</Text>
                  <Text style={styles.rowDesc}>{row.description}</Text>
                </View>
                <Switch
                  value={values[row.key]}
                  onValueChange={() => toggle(row.key)}
                  trackColor={{ false: "#E8E2DA", true: ORANGE }}
                  thumbColor="#fff"
                  style={Platform.OS === "ios" ? { transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] } : undefined}
                />
              </View>
            </View>
          ))}
        </View>
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

  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: 16,
  },
});