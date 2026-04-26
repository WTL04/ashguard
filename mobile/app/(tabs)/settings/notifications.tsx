import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Switch,
  Modal,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { useAuthState } from "react-firebase-hooks/auth";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebaseConfig";

const ORANGE = "#F58500";
const ORANGE_LIGHT = "#FFF4E6";
const ORANGE_MID = "#FFE0B2";
const BG = "#FAF8F5";
const CARD = "#FFFFFF";
const BORDER = "#F0EBE3";
const TEXT = "#1A1614";
const MUTED = "#9B9189";
const TEAL = "#0F9D94";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: ORANGE,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  if (!projectId) throw new Error("Missing Expo projectId.");

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

function SettingRow({
  icon,
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  icon: string;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIconWrap}>
        <Ionicons name={icon as any} size={16} color={ORANGE} />
      </View>
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#E8E2DA", true: ORANGE }}
        thumbColor={value ? "#fff" : "#fff"}
        disabled={disabled}
        style={Platform.OS === "ios" ? { transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] } : undefined}
      />
    </View>
  );
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [user] = useAuthState(auth);

  const [distance, setDistance] = useState(50);
  const [editingDistance, setEditingDistance] = useState(false);
  const [tempDistance, setTempDistance] = useState(50);

  const [phone, setPhone] = useState(true);
  const [dm, setDm] = useState(true);
  const [forum, setForum] = useState(false);

  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingForum, setSavingForum] = useState(false);

  useEffect(() => {
    const loadPrefs = async () => {
      if (!user?.uid) { setLoadingPrefs(false); return; }
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setForum(!!data.officialNoticeNotificationsEnabled);
        }
      } catch (e) {
        console.log("Failed to load notification prefs", e);
      } finally {
        setLoadingPrefs(false);
      }
    };
    loadPrefs();
  }, [user?.uid]);

  const handleForumToggle = async (nextValue: boolean) => {
    if (!user?.uid) {
      Alert.alert("Not signed in", "You need to be signed in to change notification settings.");
      return;
    }
    if (savingForum) return;
    const previousValue = forum;
    setForum(nextValue);
    setSavingForum(true);
    try {
      const userRef = doc(db, "users", user.uid);
      if (!nextValue) {
        await setDoc(userRef, { officialNoticeNotificationsEnabled: false, notificationPreferencesUpdatedAt: serverTimestamp() }, { merge: true });
        return;
      }
      const expoPushToken = await registerForPushNotificationsAsync();
      if (!expoPushToken) {
        setForum(previousValue);
        Alert.alert("Permission required", "Push notification permission was not granted.");
        return;
      }
      await setDoc(userRef, {
        officialNoticeNotificationsEnabled: true,
        expoPushToken,
        pushPlatform: Platform.OS,
        pushTokenUpdatedAt: serverTimestamp(),
        notificationPreferencesUpdatedAt: serverTimestamp(),
      }, { merge: true });
    } catch (err: any) {
      setForum(previousValue);
      Alert.alert("Error", err?.message || "Could not update notification settings.");
    } finally {
      setSavingForum(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Distance card */}
        <Pressable style={styles.distanceCard} onPress={() => { setTempDistance(distance); setEditingDistance(true); }}>
          <View style={styles.distanceLeft}>
            <View style={styles.distanceIconRing}>
              <Ionicons name="navigate" size={17} color={ORANGE} />
            </View>
            <View>
              <Text style={styles.distanceLabel}>Alert Radius</Text>
              <Text style={styles.distanceValue}>{distance} miles</Text>
            </View>
          </View>
          <View style={styles.distanceEditBtn}>
            <Text style={styles.distanceEditText}>Edit</Text>
            <Ionicons name="chevron-forward" size={14} color={ORANGE} />
          </View>
        </Pressable>

        {/* Section: Device */}
        <Text style={styles.sectionHeader}>DEVICE</Text>
        <View style={styles.card}>
          <SettingRow
            icon="phone-portrait-outline"
            label="Push Notifications"
            description="Alerts sent directly to your device"
            value={phone}
            onValueChange={setPhone}
          />
        </View>

        {/* Section: Community */}
        <Text style={styles.sectionHeader}>COMMUNITY</Text>
        <View style={styles.card}>
          <SettingRow
            icon="chatbubble-ellipses-outline"
            label="Direct Messages"
            description="Get notified when someone messages you"
            value={dm}
            onValueChange={setDm}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="megaphone-outline"
            label="Forum Notifications"
            description="Official notices and community alerts"
            value={forum}
            onValueChange={handleForumToggle}
            disabled={loadingPrefs || savingForum}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Distance modal */}
      <Modal
        visible={editingDistance}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingDistance(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setEditingDistance(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="navigate" size={22} color={ORANGE} />
            </View>
            <Text style={styles.modalTitle}>Alert Radius</Text>
            <Text style={styles.modalSub}>
              Only show alerts within this distance from you
            </Text>

            <View style={styles.distancePillLarge}>
              <Text style={styles.distancePillLargeText}>{tempDistance} mi</Text>
            </View>

            <Slider
              style={{ width: "100%", marginTop: 8 }}
              minimumValue={1}
              maximumValue={50}
              step={1}
              value={tempDistance}
              onValueChange={setTempDistance}
              minimumTrackTintColor={ORANGE}
              maximumTrackTintColor="#EDE8E0"
              thumbTintColor={ORANGE}
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>1 mi</Text>
              <Text style={styles.sliderLabel}>50 mi</Text>
            </View>

            <Pressable
              style={styles.modalSaveBtn}
              onPress={() => { setDistance(tempDistance); setEditingDistance(false); }}
            >
              <Text style={styles.modalSaveBtnText}>Save</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },

  // Distance card
  distanceCard: {
    backgroundColor: CARD,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  distanceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  distanceIconRing: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: ORANGE_MID,
    backgroundColor: ORANGE_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  distanceLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: MUTED,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  distanceValue: {
    fontSize: 22,
    fontWeight: "800",
    color: TEXT,
    letterSpacing: -0.5,
  },
  distanceEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: ORANGE_LIGHT,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  distanceEditText: {
    fontSize: 13,
    fontWeight: "700",
    color: ORANGE,
  },

  // Section headers
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
  },

  // Card
  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  // Setting row
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  settingIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ORANGE_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: ORANGE_MID,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
    marginBottom: 3,
  },
  settingDesc: {
    fontSize: 12,
    color: MUTED,
    lineHeight: 16,
  },

  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: 16,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: CARD,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  modalIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: ORANGE_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: ORANGE_MID,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT,
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 13,
    color: MUTED,
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 20,
  },
  distancePillLarge: {
    backgroundColor: ORANGE_LIGHT,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: ORANGE_MID,
    marginBottom: 16,
  },
  distancePillLargeText: {
    fontSize: 20,
    fontWeight: "800",
    color: ORANGE,
    letterSpacing: -0.5,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 4,
    marginBottom: 20,
  },
  sliderLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "600",
  },
  modalSaveBtn: {
    width: "100%",
    height: 50,
    backgroundColor: CARD,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  modalSaveBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.2,
  },
});