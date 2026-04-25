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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import { useAuthState } from "react-firebase-hooks/auth";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebaseConfig";

const ORANGE = "#F59E0B";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Row({
  left,
  right,
  onPress,
}: {
  left: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.row}>
      <View style={styles.rowLeft}>{left}</View>
      <View style={styles.rowRight}>{right}</View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}>
      {content}
    </Pressable>
  );
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#F59E0B",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    throw new Error("Missing Expo projectId. Check app config / EAS project setup.");
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [user] = useAuthState(auth);

  const [distance, setDistance] = useState(50);
  const [editingDistance, setEditingDistance] = useState(false);

  const [county, setCounty] = useState(true);
  const [phone, setPhone] = useState(true);
  const [air, setAir] = useState(false);

  const [communityOpen, setCommunityOpen] = useState(false);
  const [dm, setDm] = useState(true);
  const [forum, setForum] = useState(false);
  const [comment, setComment] = useState(false);

  const [loadingPrefs, setLoadingPrefs] = useState(true);
  const [savingForum, setSavingForum] = useState(false);

  useEffect(() => {
    const loadPrefs = async () => {
      if (!user?.uid) {
        setLoadingPrefs(false);
        return;
      }

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
        await setDoc(
          userRef,
          {
            officialNoticeNotificationsEnabled: false,
            notificationPreferencesUpdatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        return;
      }

      const expoPushToken = await registerForPushNotificationsAsync();

      if (!expoPushToken) {
        setForum(previousValue);
        Alert.alert("Permission required", "Push notification permission was not granted.");
        return;
      }

      await setDoc(
        userRef,
        {
          officialNoticeNotificationsEnabled: true,
          expoPushToken,
          pushPlatform: Platform.OS,
          pushTokenUpdatedAt: serverTimestamp(),
          notificationPreferencesUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      console.log("Push token saved:", expoPushToken);
    } catch (err) {
      console.error("Error saving notification settings:", err);
      setForum(previousValue);
      Alert.alert("Error", "Could not update forum notification settings.");
    } finally {
      setSavingForum(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color="#111" />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.content}>
        <Card>
          <Row
            left={<Text style={styles.rowText}>Notification Distance - {distance} miles</Text>}
            right={
              <Pressable onPress={() => setEditingDistance(true)} hitSlop={10}>
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
            }
          />
        </Card>

        <Card>
          <Row
            left={<Text style={styles.rowText}>County Notifications</Text>}
            right={
              <Switch value={county} onValueChange={setCounty} trackColor={{ true: ORANGE }} />
            }
          />
        </Card>

        <Card>
          <Row
            left={<Text style={styles.rowText}>Phone Notifications</Text>}
            right={
              <Switch value={phone} onValueChange={setPhone} trackColor={{ true: ORANGE }} />
            }
          />
        </Card>

        <Card>
          <Row
            left={<Text style={styles.rowText}>Air Quality Notifications</Text>}
            right={
              <Switch value={air} onValueChange={setAir} trackColor={{ true: ORANGE }} />
            }
          />
        </Card>

        <Card style={{ paddingBottom: communityOpen ? 10 : 0 }}>
          <Row
            onPress={() => setCommunityOpen((v) => !v)}
            left={<Text style={styles.rowText}>Community Notifications</Text>}
            right={
              <Ionicons
                name={communityOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color="#111"
              />
            }
          />

          {communityOpen ? (
            <View style={styles.communityBox}>
              <Row
                left={<Text style={styles.subRowText}>Direct Messages Notifications</Text>}
                right={<Switch value={dm} onValueChange={setDm} trackColor={{ true: ORANGE }} />}
              />

              <Row
                left={
                  <View>
                    <Text style={styles.subRowText}>Forum Notifications</Text>
                    <Text style={styles.helperText}>Official notice alerts</Text>
                  </View>
                }
                right={
                  <Switch
                    value={forum}
                    onValueChange={handleForumToggle}
                    trackColor={{ true: ORANGE }}
                    disabled={loadingPrefs || savingForum}
                  />
                }
              />

              <Row
                left={<Text style={styles.subRowText}>Comment Notifications</Text>}
                right={
                  <Switch
                    value={comment}
                    onValueChange={setComment}
                    trackColor={{ true: ORANGE }}
                  />
                }
              />
            </View>
          ) : null}
        </Card>
      </View>

      <Modal
        visible={editingDistance}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingDistance(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setEditingDistance(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Set Notification Distance Area</Text>

            <View style={{ marginTop: 14 }}>
              <Slider
                minimumValue={1}
                maximumValue={50}
                step={1}
                value={distance}
                onValueChange={setDistance}
                minimumTrackTintColor="#111"
                maximumTrackTintColor="#D1D5DB"
                thumbTintColor="#111"
              />

              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>1 mi</Text>
                <Text style={styles.sliderLabel}>50 mi</Text>
              </View>

              <View style={styles.distancePill}>
                <Text style={styles.distancePillText}>{distance} mi</Text>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F3F4F6" },

  header: {
    height: 52,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#111" },

  content: { paddingHorizontal: 16, paddingTop: 10, gap: 10 },

  card: {
    backgroundColor: "#F7F7F7",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },

  row: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: { flex: 1 },
  rowRight: { marginLeft: 12 },

  rowText: { fontSize: 14, fontWeight: "600", color: "#111" },
  editText: { fontSize: 14, fontWeight: "600", color: "#111" },

  communityBox: {
    marginHorizontal: 12,
    marginTop: 6,
    borderRadius: 8,
    backgroundColor: "#FDEBD8",
    paddingVertical: 6,
  },
  subRowText: { fontSize: 13, fontWeight: "500", color: "#111" },
  helperText: { fontSize: 11, color: "#6B7280", marginTop: 2 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
  },
  modalTitle: { fontSize: 15, fontWeight: "700", textAlign: "center", color: "#111" },

  sliderLabels: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  sliderLabel: { fontSize: 11, color: "#6B7280" },

  distancePill: {
    marginTop: 10,
    alignSelf: "center",
    backgroundColor: "#E5E7EB",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  distancePillText: { fontSize: 13, fontWeight: "700", color: "#111" },
});