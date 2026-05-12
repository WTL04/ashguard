import React from "react";
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

type RowConfig = {
  label: string;
  description: string;
  icon: string;
  route: string;
  danger?: boolean;
};

const ROWS: RowConfig[] = [
  {
    label: "Reset Password",
    description: "Change your account password",
    icon: "lock-closed-outline",
    route: "/(tabs)/settings/resetpass",
  },
  {
    label: "Location Permissions",
    description: "Manage how your location is used",
    icon: "location-outline",
    route: "/(tabs)/settings/locationpermission",
  },
  {
    label: "Delete Data",
    description: "Permanently remove your account data",
    icon: "trash-outline",
    route: "/(tabs)/settings/deletedata",
    danger: true,
  },
];

export default function SecurityScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </Pressable>
        <Text style={styles.headerTitle}>Login & Security</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.card}>
          {ROWS.map((row, index) => (
            <View key={row.route}>
              {index > 0 && <View style={styles.divider} />}
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
                onPress={() => router.push(row.route as any)}
              >
                <View style={[styles.iconWrap, row.danger && styles.iconWrapDanger]}>
                  <Ionicons
                    name={row.icon as any}
                    size={16}
                    color={row.danger ? "#EF4444" : ORANGE}
                  />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowLabel, row.danger && styles.rowLabelDanger]}>
                    {row.label}
                  </Text>
                  <Text style={styles.rowDesc}>{row.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={MUTED} />
              </Pressable>
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
    backgroundColor: ORANGE_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: ORANGE_MID,
  },
  iconWrapDanger: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
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
  rowLabelDanger: {
    color: "#EF4444",
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