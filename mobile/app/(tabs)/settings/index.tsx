import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <Text style={styles.title}>Settings</Text>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={28} color="#111" />
        </View>

        <View style={{ marginLeft: 12 }}>
          <Text style={styles.name}>First Name Last Name</Text>
          <Text style={styles.phone}>(XXX) XXX - XXXX</Text>

          <Pressable style={styles.editButton}>
            <Text style={styles.editText}>Edit Profile</Text>
          </Pressable>
        </View>
      </View>

      {/* Settings Options */}
      <View style={styles.card}>
        <Pressable
          style={styles.row}
          onPress={() =>
            router.push("/(tabs)/settings/notifications")
          }
        >
          <View style={styles.rowLeft}>
            <Ionicons
              name="notifications-outline"
              size={20}
              color="#111"
            />
            <Text style={styles.rowText}>Notifications</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color="#9CA3AF"
          />
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          style={styles.row}
          onPress={() =>
            router.push("/(tabs)/settings/places")
          }
        >
          <View style={styles.rowLeft}>
            <Ionicons name="home-outline" size={20} color="#111" />
            <Text style={styles.rowText}>Places</Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color="#9CA3AF"
          />
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          style={styles.row}
          onPress={() =>
            router.push("/(tabs)/settings/security")
          }
        >
          <View style={styles.rowLeft}>
            <Ionicons
              name="shield-checkmark-outline"
              size={20}
              color="#111"
            />
            <Text style={styles.rowText}>
              Login & Security
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={18}
            color="#9CA3AF"
          />
        </Pressable>
      </View>

      {/* Logout */}
      <View style={[styles.card, { marginTop: 18 }]}>
        <Pressable style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons
              name="log-out-outline"
              size={20}
              color="#111"
            />
            <Text style={[styles.rowText, { fontWeight: "600" }]}>
              Log Out
            </Text>
          </View>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 16,
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginVertical: 12,
  },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  avatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#FDEBD0",
    alignItems: "center",
    justifyContent: "center",
  },

  name: {
    fontSize: 16,
    fontWeight: "700",
  },

  phone: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 2,
  },

  editButton: {
    marginTop: 8,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignSelf: "flex-start",
  },

  editText: {
    fontSize: 13,
    fontWeight: "600",
  },

  card: {
    marginTop: 14,
    backgroundColor: "white",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  rowText: {
    fontSize: 14,
  },

  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginLeft: 44,
  },
});