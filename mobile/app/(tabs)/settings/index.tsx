import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { auth, db } from "@/lib/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { logOut } from "@/lib/authService";

type UserProfile = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  photoURL?: string;
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

const SETTINGS_ROWS = [
  {
    key: "notifications",
    label: "Notifications",
    description: "Manage alerts and reminders",
    icon: "notifications-outline",
    route: "/(tabs)/settings/notifications",
  },
  {
    key: "places",
    label: "Places",
    description: "Edit your county and saved locations",
    icon: "map-outline",
    route: "/(tabs)/settings/places",
  },
  {
    key: "security",
    label: "Login & Security",
    description: "Password, permissions, and account data",
    icon: "shield-checkmark-outline",
    route: "/(tabs)/settings/security",
  },
] as const;

export default function SettingsScreen() {
  const router = useRouter();

  const [profile, setProfile] = useState<UserProfile>({
    firstName: "",
    lastName: "",
    phone: "",
    photoURL: "",
  });
  const [loading, setLoading] = useState(true);

  const loadUserProfile = async () => {
    try {
      const user = auth.currentUser;

      if (!user) {
        setProfile({
          firstName: "",
          lastName: "",
          phone: "",
          photoURL: "",
        });
        return;
      }

      const userRef = doc(db, "users", user.uid);
      const snapshot = await getDoc(userRef);

      if (snapshot.exists()) {
        const data = snapshot.data();

        setProfile({
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          phone: data.phone || "",
          photoURL: data.photoURL || "",
        });
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadUserProfile();
    }, [])
  );

  const handleLogout = async () => {
    try {
      await logOut();
      router.replace("/login");
    } catch (error) {
      console.error("Logout error:", error);
      Alert.alert("Error", "Unable to log out right now.");
    }
  };

  const fullName =
    `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() ||
    "No Name";
  const phoneText = profile.phone || "No phone number";

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHeader}>PROFILE</Text>
        <View style={styles.profileCard}>
          <View style={styles.profileTopRow}>
            <View style={styles.avatarWrap}>
              {profile.photoURL ? (
                <Image
                  source={{ uri: profile.photoURL }}
                  style={styles.avatarImage}
                />
              ) : (
                <Ionicons name="person" size={28} color={ORANGE} />
              )}
            </View>

            <View style={styles.profileTextWrap}>
              <Text style={styles.name}>{loading ? "Loading..." : fullName}</Text>
              <Text style={styles.phone}>{loading ? "" : phoneText}</Text>
            </View>
          </View>

          <Pressable
            onPress={() => router.push("/(tabs)/settings/editprofile")}
            style={({ pressed }) => [
              styles.editButton,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.editText}>Edit Profile</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionHeader, styles.sectionSpacing]}>ACCOUNT</Text>
        <View style={styles.card}>
          {SETTINGS_ROWS.map((item, index) => (
            <View key={item.key}>
              {index > 0 && <View style={styles.divider} />}
              <Pressable
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.88 },
                ]}
                onPress={() => router.push(item.route as never)}
              >
                <View style={styles.rowLeft}>
                  <View style={styles.iconWrap}>
                    <Ionicons name={item.icon} size={16} color={ORANGE} />
                  </View>
                  <View style={styles.rowTextWrap}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Text style={styles.rowDescription}>{item.description}</Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={MUTED} />
              </Pressable>
            </View>
          ))}
        </View>

        <Text style={[styles.sectionHeader, styles.sectionSpacing]}>SESSION</Text>
        <View style={styles.card}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.88 }]}
            onPress={handleLogout}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconWrap, styles.iconWrapDanger]}>
                <Ionicons name="log-out-outline" size={16} color={RED} />
              </View>
              <View style={styles.rowTextWrap}>
                <Text style={[styles.rowLabel, styles.dangerText]}>Log Out</Text>
                <Text style={styles.rowDescription}>
                  Sign out of your account on this device
                </Text>
              </View>
            </View>
          </Pressable>
        </View>
      </ScrollView>
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
  headerSpacer: {
    width: 38,
    height: 38,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT,
    letterSpacing: -0.3,
  },

  scrollContent: {
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
  sectionSpacing: {
    marginTop: 24,
  },

  profileCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: ORANGE_LIGHT,
    borderWidth: 1,
    borderColor: ORANGE_MID,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  profileTextWrap: {
    flex: 1,
    marginLeft: 14,
  },
  name: {
    fontSize: 17,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 4,
  },
  phone: {
    fontSize: 13,
    color: MUTED,
    lineHeight: 18,
  },
  editButton: {
    alignSelf: "flex-start",
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ORANGE_MID,
    backgroundColor: ORANGE_LIGHT,
  },
  editText: {
    fontSize: 13,
    fontWeight: "700",
    color: ORANGE,
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 14,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ORANGE_LIGHT,
    borderWidth: 1,
    borderColor: ORANGE_MID,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapDanger: {
    backgroundColor: RED_LIGHT,
    borderColor: RED_MID,
  },
  rowTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 3,
  },
  rowDescription: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 16,
  },
  dangerText: {
    color: RED,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: 16,
  },
});
