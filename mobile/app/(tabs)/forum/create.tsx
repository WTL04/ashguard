import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '@/lib/firebaseConfig';
import { Colors } from '@/constants/colors';
import { createThread } from '@/lib/forumData';

// ── Tag options ───────────────────────────────────────────────────────────────

const TAG_OPTIONS = ['Question', 'Self Report', 'Resources', 'Update', 'Official'];
const MAX_TAGS = 3;

// ── Screen ────────────────────────────────────────────────────────────────────

export default function CreateThreadScreen() {
  const router = useRouter();
  const [user] = useAuthState(auth);

  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [body, setBody] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tag)) return prev.filter((t) => t !== tag);
      if (prev.length >= MAX_TAGS) return prev;
      return [...prev, tag];
    });
  };

  const canPost = title.trim().length > 0 && body.trim().length > 0 && !submitting;

  const handlePost = async () => {
    if (!canPost) return;
    setSubmitting(true);
    try {
      await createThread({
        title: title.trim(),
        address: address.trim(),
        body: body.trim(),
        tags: selectedTags,
        authorId: user?.uid ?? 'anonymous',
        authorUsername: user?.displayName ?? user?.email ?? 'Anonymous',
        avatarColor: Colors.primary,
      });
      // Navigate back — onSnapshot on index.tsx will pick up the new thread automatically
      router.back();
    } catch (err) {
      Alert.alert('Error', 'Failed to post thread. Please try again.');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Community</Text>
          <View style={{ width: 34 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Accent bar */}
          <View style={styles.accentBar} />

          {/* Form */}
          <View style={styles.form}>
            <Text style={styles.label}>Title:</Text>
            <TextInput
              style={styles.input}
              placeholder="Add your title"
              placeholderTextColor="#A0896C"
              value={title}
              onChangeText={setTitle}
              returnKeyType="next"
            />

            <Text style={styles.label}>Address:</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter Address (Street, City, State, and Zip Code)"
              placeholderTextColor="#A0896C"
              value={address}
              onChangeText={setAddress}
              returnKeyType="next"
            />

            <Text style={styles.label}>Body:</Text>
            <TextInput
              style={[styles.input, styles.bodyInput]}
              placeholder="Add your context"
              placeholderTextColor="#A0896C"
              value={body}
              onChangeText={setBody}
              multiline
              textAlignVertical="top"
            />

            <Text style={styles.label}>Select Tags (Up to 3):</Text>

            {/* Selected tag pills */}
            {selectedTags.length > 0 && (
              <View style={styles.selectedTagsRow}>
                {selectedTags.map((tag) => (
                  <View key={tag} style={styles.selectedTagPill}>
                    <Text style={styles.selectedTagText}>{tag}</Text>
                    <TouchableOpacity
                      onPress={() => toggleTag(tag)}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="close" size={13} color="#374151" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Dropdown trigger */}
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setDropdownOpen((o) => !o)}
              activeOpacity={0.8}
            >
              <Text style={styles.dropdownText}>Tag</Text>
              <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#374151" />
            </TouchableOpacity>

            {/* Dropdown options */}
            {dropdownOpen && (
              <View style={styles.dropdownMenu}>
                {TAG_OPTIONS.map((option) => {
                  const selected = selectedTags.includes(option);
                  const disabled = !selected && selectedTags.length >= MAX_TAGS;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={styles.dropdownItem}
                      onPress={() => !disabled && toggleTag(option)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dropdownItemText, disabled && styles.dropdownItemDisabled]}>
                        {option}
                      </Text>
                      {selected && <Ionicons name="checkmark" size={16} color={Colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Post button */}
            <TouchableOpacity
              style={[styles.postBtn, !canPost && styles.postBtnDisabled]}
              onPress={handlePost}
              activeOpacity={0.85}
              disabled={!canPost}
            >
              {submitting
                ? <ActivityIndicator color="#FFF" />
                : <Text style={styles.postBtnText}>Post Thread</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '800', color: Colors.primary, letterSpacing: -0.5 },
  scrollContent: { paddingBottom: 40 },
  accentBar: { height: 44, backgroundColor: Colors.primary, marginHorizontal: 16, borderRadius: 8, marginBottom: 24 },
  form: { paddingHorizontal: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#111827', marginBottom: 6, marginTop: 2 },
  input: { backgroundColor: '#FAF5EE', borderWidth: 1, borderColor: '#E0D5C5', borderRadius: 6, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 11 : 9, fontSize: 14, color: '#374151', marginBottom: 16 },
  bodyInput: { height: 130, paddingTop: Platform.OS === 'ios' ? 11 : 9 },
  selectedTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  selectedTagPill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#FAF5EE' },
  selectedTagText: { fontSize: 13, color: '#374151', fontWeight: '500' },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FAF5EE', borderWidth: 1, borderColor: '#E0D5C5', borderRadius: 6, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 12 : 10, marginBottom: 4 },
  dropdownText: { fontSize: 14, color: '#374151', fontWeight: '500' },
  dropdownMenu: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, marginBottom: 8, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4, overflow: 'hidden' },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  dropdownItemText: { fontSize: 14, color: '#374151' },
  dropdownItemDisabled: { color: '#C4B9A8' },
  postBtn: { backgroundColor: Colors.primary, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  postBtnDisabled: { opacity: 0.45 },
  postBtnText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 },
});