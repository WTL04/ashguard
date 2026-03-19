import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { auth } from "@/lib/firebaseConfig";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";

const BG = "#FFFFFF";
const TEXT = "#111111";
const INPUT_BG = "#F4E3DC";
const ORANGE = "#F59E0B";
const GRAYBTN = "#BDBDBD";

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

export default function ResetPassScreen() {
  const router = useRouter();

  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => {
    return (
      currentPass.trim().length > 0 &&
      newPass.trim().length >= 6 &&
      confirmPass.trim().length >= 6 &&
      newPass === confirmPass &&
      !loading
    );
  }, [currentPass, newPass, confirmPass, loading]);

  const onSubmit = async () => {
    try {
      if (!canSubmit) return;

      const user = auth.currentUser;
      if (!user) {
        Alert.alert("Not logged in", "Please log in again and try.");
        return;
      }

      if (!user.email) {
        Alert.alert("Account type not supported", "This account doesn’t use email/password.");
        return;
      }

      setLoading(true);

      // 1) Re-auth (required by Firebase for sensitive actions)
      const credential = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, credential);

      // 2) Update password
      await updatePassword(user, newPass);

      Alert.alert("Success", "Your password was updated.");
      router.back();
    } catch (e: any) {
      const code = e?.code as string | undefined;

      if (code === "auth/wrong-password") {
        Alert.alert("Wrong password", "Your current password is incorrect.");
      } else if (code === "auth/too-many-requests") {
        Alert.alert("Try again later", "Too many attempts. Please wait and try again.");
      } else if (code === "auth/requires-recent-login") {
        Alert.alert("Please log in again", "For security, log out and log back in, then retry.");
      } else {
        Alert.alert("Error", e?.message ?? "Failed to update password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <TopBar title="Reset Password" />

      <View style={styles.form}>
        <Text style={styles.label}>Current Password</Text>
        <TextInput
          value={currentPass}
          onChangeText={setCurrentPass}
          placeholder="Current Password"
          placeholderTextColor="#7B6F6A"
          secureTextEntry
          style={styles.input}
        />

        <Text style={[styles.label, { marginTop: 16 }]}>Enter New Password</Text>
        <TextInput
          value={newPass}
          onChangeText={setNewPass}
          placeholder="New Password"
          placeholderTextColor="#7B6F6A"
          secureTextEntry
          style={styles.input}
        />

        <Text style={[styles.label, { marginTop: 16 }]}>Confirm Password</Text>
        <TextInput
          value={confirmPass}
          onChangeText={setConfirmPass}
          placeholder="New Password"
          placeholderTextColor="#7B6F6A"
          secureTextEntry
          style={styles.input}
        />

        <Pressable
          style={[
            styles.btn,
            { backgroundColor: ORANGE, opacity: canSubmit ? 1 : 0.55 },
          ]}
          onPress={onSubmit}
          disabled={!canSubmit}
        >
          <Text style={[styles.btnText, { color: "white" }]}>
            {loading ? "Submitting..." : "Submit"}
          </Text>
        </Pressable>

        <Pressable style={[styles.btn, { backgroundColor: GRAYBTN }]} onPress={() => router.back()}>
          <Text style={[styles.btnText, { color: "#111" }]}>Cancel</Text>
        </Pressable>

        <Text style={styles.hint}>
          Password must be at least 6 characters.
        </Text>
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

  form: { marginTop: 18 },
  label: { fontSize: 12.5, fontWeight: "700", color: TEXT, marginBottom: 8 },

  input: {
    backgroundColor: INPUT_BG,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 13,
  },

  btn: {
    marginTop: 16,
    alignSelf: "center",
    width: 130,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: { fontSize: 12.5, fontWeight: "800" },

  hint: {
    marginTop: 14,
    fontSize: 11.5,
    color: "#6B7280",
    textAlign: "center",
  },
});