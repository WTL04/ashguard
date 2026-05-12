import React, { useMemo, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { auth } from "@/lib/firebaseConfig";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";

const ORANGE = "#F58500";
const ORANGE_LIGHT = "#FFF4E6";
const ORANGE_MID = "#FFE0B2";
const BG = "#FAF8F5";
const CARD = "#FFFFFF";
const BORDER = "#F0EBE3";
const TEXT = "#1A1614";
const MUTED = "#9B9189";

type FieldConfig = {
  key: string;
  label: string;
  placeholder: string;
  icon: string;
};

const FIELDS: FieldConfig[] = [
  { key: "current", label: "Current Password", placeholder: "Enter current password", icon: "lock-closed-outline" },
  { key: "new", label: "New Password", placeholder: "At least 6 characters", icon: "key-outline" },
  { key: "confirm", label: "Confirm New Password", placeholder: "Re-enter new password", icon: "checkmark-circle-outline" },
];

export default function ResetPassScreen() {
  const router = useRouter();
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState<Record<string, boolean>>({ current: false, new: false, confirm: false });

  const values: Record<string, string> = { current: currentPass, new: newPass, confirm: confirmPass };
  const setters: Record<string, (v: string) => void> = {
    current: setCurrentPass, new: setNewPass, confirm: setConfirmPass,
  };

  const mismatch = confirmPass.length > 0 && newPass !== confirmPass;

  const canSubmit = useMemo(() =>
    currentPass.trim().length > 0 &&
    newPass.trim().length >= 6 &&
    confirmPass.trim().length >= 6 &&
    newPass === confirmPass &&
    !loading,
    [currentPass, newPass, confirmPass, loading]
  );

  const onSubmit = async () => {
    if (!canSubmit) return;
    const user = auth.currentUser;
    if (!user) { Alert.alert("Not logged in", "Please log in again and try."); return; }
    if (!user.email) { Alert.alert("Account type not supported", "This account doesn't use email/password."); return; }
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPass);
      Alert.alert("Success", "Your password was updated.");
      router.back();
    } catch (e: any) {
      const code = e?.code as string | undefined;
      if (code === "auth/wrong-password") Alert.alert("Wrong password", "Your current password is incorrect.");
      else if (code === "auth/too-many-requests") Alert.alert("Try again later", "Too many attempts. Please wait.");
      else if (code === "auth/requires-recent-login") Alert.alert("Please log in again", "Log out and back in, then retry.");
      else Alert.alert("Error", e?.message ?? "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={TEXT} />
        </Pressable>
        <Text style={styles.headerTitle}>Reset Password</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.content}>
        {/* Icon hero */}
        <View style={styles.heroWrap}>
          <View style={styles.heroIcon}>
            <Ionicons name="lock-closed" size={28} color={ORANGE} />
          </View>
          <Text style={styles.heroText}>Choose a strong password with at least 6 characters.</Text>
        </View>

        <Text style={styles.sectionHeader}>CHANGE PASSWORD</Text>
        <View style={styles.card}>
          {FIELDS.map((field, index) => (
            <View key={field.key}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.fieldWrap}>
                <View style={styles.fieldIconWrap}>
                  <Ionicons name={field.icon as any} size={15} color={ORANGE} />
                </View>
                <View style={styles.fieldInner}>
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      value={values[field.key]}
                      onChangeText={setters[field.key]}
                      placeholder={field.placeholder}
                      placeholderTextColor={MUTED}
                      secureTextEntry={!showPass[field.key]}
                      style={styles.input}
                      autoCapitalize="none"
                    />
                    <Pressable onPress={() => setShowPass((p) => ({ ...p, [field.key]: !p[field.key] }))} hitSlop={8}>
                      <Ionicons name={showPass[field.key] ? "eye-off-outline" : "eye-outline"} size={18} color={MUTED} />
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        {mismatch && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={15} color="#EF4444" />
            <Text style={styles.errorText}>Passwords don't match</Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [styles.submitBtn, !canSubmit && styles.submitBtnDisabled, pressed && canSubmit && { opacity: 0.85 }]}
          onPress={onSubmit}
          disabled={!canSubmit}
        >
          {loading
            ? <Text style={styles.submitBtnText}>Updating...</Text>
            : <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Update Password</Text>
              </>
          }
        </Pressable>
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

  heroWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: ORANGE_LIGHT,
    borderWidth: 1,
    borderColor: ORANGE_MID,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
  },
  heroIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: CARD,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: ORANGE_MID,
  },
  heroText: {
    flex: 1,
    fontSize: 13,
    color: TEXT,
    lineHeight: 19,
    fontWeight: "500",
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
    marginBottom: 14,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  fieldWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  fieldIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: ORANGE_LIGHT,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: ORANGE_MID,
    marginTop: 2,
  },
  fieldInner: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: MUTED,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: TEXT,
    paddingVertical: 0,
  },

  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginHorizontal: 16,
  },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
  },
  errorText: {
    fontSize: 13,
    color: "#EF4444",
    fontWeight: "600",
  },

  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: ORANGE,
    shadowColor: ORANGE,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: "#D1D5DB",
    shadowOpacity: 0,
    elevation: 0,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
});