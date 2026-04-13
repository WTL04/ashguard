import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Image,
  Alert,
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
      router.replace("/login"); // change route if your auth screen path is different
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
      <Text style={styles.title}>Settings</Text>

      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          {profile.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.avatarImage} />
          ) : (
            <Ionicons name="person" size={28} color="#111" />
          )}
        </View>

        <View style={{ marginLeft: 12, flex: 1 }}>
          <Text style={styles.name}>{loading ? "Loading..." : fullName}</Text>
          <Text style={styles.phone}>{loading ? "" : phoneText}</Text>

          <Pressable
            onPress={() => router.push("/(tabs)/settings/editprofile")}
            style={styles.editButton}
          >
            <Text style={styles.editText}>Edit Profile</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Pressable
          style={styles.row}
          onPress={() => router.push("/(tabs)/settings/notifications")}
        >
          <View style={styles.rowLeft}>
            <Ionicons name="notifications-outline" size={20} color="#111" />
            <Text style={styles.rowText}>Notifications</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          style={styles.row}
          onPress={() => router.push("/(tabs)/settings/places")}
        >
          <View style={styles.rowLeft}>
            <Ionicons name="home-outline" size={20} color="#111" />
            <Text style={styles.rowText}>Places</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>

        <View style={styles.divider} />

        <Pressable
          style={styles.row}
          onPress={() => router.push("/(tabs)/settings/security")}
        >
          <View style={styles.rowLeft}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#111" />
            <Text style={styles.rowText}>Login & Security</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </Pressable>
      </View>

      <View style={[styles.card, { marginTop: 18 }]}>
        <Pressable style={styles.row} onPress={handleLogout}>
          <View style={styles.rowLeft}>
            <Ionicons name="log-out-outline" size={20} color="#111" />
            <Text style={[styles.rowText, { fontWeight: "600" }]}>Log Out</Text>
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
    overflow: "hidden",
  },

  avatarImage: {
    width: "100%",
    height: "100%",
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