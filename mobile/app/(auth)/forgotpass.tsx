import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [focused, setFocused] = useState(false);
  // Simulates the "email sent" success state without real Firebase
  const [sent, setSent] = useState(false);

  // ── Temporary: simulate sending a reset email ─────────────────────────────
  // When Firebase is wired up, replace setSent(true) with:
  //   await resetPassword(email.trim())
  const handleReset = () => {
    if (!email.trim()) return;
    setSent(true);
  };

  return (
    <LinearGradient
      colors={[Colors.bgGradientStart, Colors.bgGradientEnd]}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.3, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.inner}>
          <View style={styles.card}>

            {sent ? (
              // ── Success state ──
              <View style={styles.sentState}>
                <Ionicons name="mail-outline" size={56} color={Colors.primary} />
                <Text style={styles.title}>Check Your Email</Text>
                <Text style={styles.subtitle}>
                  A password reset link has been sent to{'\n'}
                  <Text style={styles.emailHighlight}>{email}</Text>
                </Text>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => router.replace('/(auth)/login')}
                >
                  <Text style={styles.primaryBtnText}>Back to Login</Text>
                </TouchableOpacity>
              </View>

            ) : (
              // ── Form state ──
              <>
                <TouchableOpacity
                  style={styles.backBtn}
                  onPress={() => router.back()}
                >
                  <Ionicons name="chevron-back" size={20} color={Colors.textSecondary} />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>

                <Text style={styles.title}>Forgot Password?</Text>
                <Text style={styles.subtitle}>
                  Enter your email and we'll send you a reset link.
                </Text>

                <TextInput
                  style={[styles.input, focused && styles.inputFocused]}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="exampleuser@gmail.com"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                />

                <TouchableOpacity
                  style={[styles.primaryBtn, !email.trim() && styles.primaryBtnDisabled]}
                  onPress={handleReset}
                  disabled={!email.trim()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryBtnText}>Send Reset Link</Text>
                </TouchableOpacity>
              </>
            )}

          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },

  sentState: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  emailHighlight: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },

  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 20,
  },
  backText: { color: Colors.textSecondary, fontSize: 14 },

  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 22,
    lineHeight: 20,
  },

  input: {
    height: 48,
    backgroundColor: Colors.bgInput,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 16,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF7ED',
  },

  primaryBtn: {
    height: 50,
    backgroundColor: '#4B6BFB',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#4B6BFB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});