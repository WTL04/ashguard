import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

interface Fields {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  dob: string;
  phone: string;
  password: string;
}

type FieldKey = keyof Fields;

export default function SignupScreen() {
  const router = useRouter();

  const [fields, setFields] = useState<Fields>({
    username: '',
    firstName: '',
    lastName: '',
    email: '',
    dob: '',
    phone: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState<FieldKey | null>(null);

  const update = (key: FieldKey) => (val: string) =>
    setFields((prev) => ({ ...prev, [key]: val }));

  // Auto-format date → mm/dd/yyyy
  const handleDob = (val: string) => {
    const d = val.replace(/\D/g, '').slice(0, 8);
    let out = d;
    if (d.length > 4) out = `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
    else if (d.length > 2) out = `${d.slice(0, 2)}/${d.slice(2)}`;
    setFields((prev) => ({ ...prev, dob: out }));
  };

  // Auto-format phone → (XXX) XXX-XXXX
  const handlePhone = (val: string) => {
    const d = val.replace(/\D/g, '').slice(0, 10);
    let out = d;
    if (d.length > 6)      out = `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
    else if (d.length > 3) out = `(${d.slice(0, 3)}) ${d.slice(3)}`;
    else if (d.length > 0) out = `(${d}`;
    setFields((prev) => ({ ...prev, phone: out }));
  };

  // ── Temporary: skip auth and go straight to the app ──────────────────────
  // When Firebase is wired up, replace this with signUp() + Firestore profile
  // creation, and add proper validation error messages.
  const handleRegister = () => {
    router.replace('/(tabs)/map');
  };

  const inputStyle = (key: FieldKey) => [
    styles.input,
    focused === key && styles.inputFocused,
  ];
  const wrapStyle = (key: FieldKey) => [
    styles.inputWrapper,
    focused === key && styles.inputFocused,
  ];

  return (
    <LinearGradient
      colors={[Colors.bgGradientStart, Colors.bgGradientEnd]}
      style={styles.gradient}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.5, y: 1 }}
    >
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.kav}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>

              <Text style={styles.title}>Sign Up</Text>
              <Text style={styles.subtitle}>Create an account to continue!</Text>

              {/* Username */}
              <TextInput
                style={inputStyle('username')}
                value={fields.username}
                onChangeText={update('username')}
                placeholder="Username"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                onFocus={() => setFocused('username')}
                onBlur={() => setFocused(null)}
              />

              {/* First Name */}
              <TextInput
                style={inputStyle('firstName')}
                value={fields.firstName}
                onChangeText={update('firstName')}
                placeholder="First Name"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
                onFocus={() => setFocused('firstName')}
                onBlur={() => setFocused(null)}
              />

              {/* Last Name */}
              <TextInput
                style={inputStyle('lastName')}
                value={fields.lastName}
                onChangeText={update('lastName')}
                placeholder="Last Name"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="words"
                onFocus={() => setFocused('lastName')}
                onBlur={() => setFocused(null)}
              />

              {/* Email */}
              <TextInput
                style={inputStyle('email')}
                value={fields.email}
                onChangeText={update('email')}
                placeholder="exampleuser@gmail.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
              />

              {/* Date of Birth */}
              <View style={wrapStyle('dob')}>
                <TextInput
                  style={styles.inputInner}
                  value={fields.dob}
                  onChangeText={handleDob}
                  placeholder="mm/dd/yyyy"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="numeric"
                  onFocus={() => setFocused('dob')}
                  onBlur={() => setFocused(null)}
                />
                <Ionicons name="calendar-outline" size={18} color={Colors.textMuted} />
              </View>

              {/* Phone */}
              <View style={wrapStyle('phone')}>
                <View style={styles.countryCode}>
                  <Text style={styles.flagEmoji}>🇺🇸</Text>
                  <Ionicons name="chevron-down" size={12} color={Colors.textMuted} />
                  <Text style={styles.divider}>|</Text>
                </View>
                <TextInput
                  style={styles.inputInner}
                  value={fields.phone}
                  onChangeText={handlePhone}
                  placeholder="(XXX) XXX-XXXX"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                  onFocus={() => setFocused('phone')}
                  onBlur={() => setFocused(null)}
                />
              </View>

              {/* Password */}
              <View style={wrapStyle('password')}>
                <TextInput
                  style={styles.inputInner}
                  value={fields.password}
                  onChangeText={update('password')}
                  placeholder="••••••••"
                  placeholderTextColor={Colors.textMuted}
                  secureTextEntry={!showPassword}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused(null)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>

              {/* Register */}
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleRegister}
                activeOpacity={0.85}
              >
                <Text style={styles.primaryBtnText}>Register</Text>
              </TouchableOpacity>

              {/* Login link */}
              <View style={styles.footerRow}>
                <Text style={styles.footerPrompt}>Already have an account? </Text>
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity>
                    <Text style={styles.footerLink}>Login</Text>
                  </TouchableOpacity>
                </Link>
              </View>

            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
  kav: { flex: 1 },
  scroll: {
    flexGrow: 1,
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

  title: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },

  input: {
    height: 48,
    backgroundColor: Colors.bgWhite,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    fontSize: 14,
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF7ED',
  },
  inputWrapper: {
    height: 48,
    backgroundColor: Colors.bgWhite,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  inputInner: {
    flex: 1,
    fontSize: 14,
    color: Colors.textPrimary,
    height: '100%',
  },

  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginRight: 6,
  },
  flagEmoji: { fontSize: 18 },
  divider: {
    color: Colors.border,
    fontSize: 18,
    marginLeft: 4,
    lineHeight: 22,
  },

  primaryBtn: {
    height: 50,
    backgroundColor: '#4B6BFB',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    marginBottom: 18,
    shadowColor: '#4B6BFB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerPrompt: { fontSize: 13, color: Colors.textSecondary },
  footerLink: { fontSize: 13, color: Colors.textLink, fontWeight: '600' },
});