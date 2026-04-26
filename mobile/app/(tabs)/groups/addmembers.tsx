import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SectionList,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Contacts from 'expo-contacts';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

const GROUP_NAME_KEY = 'emergency_group_name';
const GROUP_MEMBERS_KEY = 'emergency_group_members';

type SafetyStatus = 'SAFE' | 'NEED HELP!' | 'IN DANGER';
const DEFAULT_STATUS: SafetyStatus = 'SAFE';

type Member = {
  id: string;
  name: string;
  avatar: string;
  status: SafetyStatus;
  phoneNumber?: string;
  uid?: string;
  source: 'contact' | 'firestore';
};

const AVATAR_COLORS = ['#F58500', '#E07000', '#FB923C', '#C2410C', '#EA580C'];

const getAvatarColor = (name: string) =>
  AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export default function AddMembersScreen() {
  const insets = useSafeAreaInsets();

  const [groupName, setGroupName] = useState('Name of Group');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);

      const saved = await AsyncStorage.getItem(GROUP_NAME_KEY);
      if (saved) setGroupName(saved);

      const [phoneContacts, firestoreUsers] = await Promise.all([
        loadPhoneContacts(),
        loadFirestoreUsers(),
      ]);

      const map = new Map<string, Member>();
      [...phoneContacts, ...firestoreUsers].forEach((p) => map.set(p.id, p));

      setContacts(
        Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
      );
    } catch (e) {
      Alert.alert('Error', 'Could not load users');
    } finally {
      setLoading(false);
    }
  };

  const loadPhoneContacts = async (): Promise<Member[]> => {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') return [];

      const res = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Image],
      });

      return (res.data || [])
        .filter((c) => c.name && c.phoneNumbers && c.phoneNumbers[0]?.number)
        .map((c) => ({
          id: `contact-${c.id}`,
          name: c.name!,
          avatar: c.imageAvailable && c.image?.uri ? c.image.uri : '',
          status: DEFAULT_STATUS,
          phoneNumber: c.phoneNumbers?.[0]?.number ?? '',
          source: 'contact',
        }));
    } catch {
      return [];
    }
  };

  const loadFirestoreUsers = async (): Promise<Member[]> => {
    try {
      const snap = await getDocs(collection(db, 'users'));

      return snap.docs.map((doc) => {
        const d = doc.data();
        const uid = d.uid || doc.id;

        return {
          id: `firestore-${uid}`,
          uid,
          name: `${d.firstName || ''} ${d.lastName || ''}`.trim() || d.username || 'User',
          avatar: d.photoURL || '',
          status: DEFAULT_STATUS,
          phoneNumber: d.phone || '',
          source: 'firestore',
        };
      });
    } catch {
      return [];
    }
  };

  const groupedContacts = useMemo(() => {
    const filtered = contacts.filter((c) =>
      `${c.name} ${c.phoneNumber || ''}`.toLowerCase().includes(search.toLowerCase())
    );

    const grouped: Record<string, Member[]> = {};
    filtered.forEach((c) => {
      const firstChar = c.name.charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';
      if (!grouped[letter]) grouped[letter] = [];
      grouped[letter].push(c);
    });

    return Object.keys(grouped)
      .sort()
      .map((k) => ({ title: k, data: grouped[k] }));
  }, [contacts, search]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const saveSelectedMembers = async () => {
    try {
      const existingRaw = await AsyncStorage.getItem(GROUP_MEMBERS_KEY);
      const existing: Member[] = existingRaw ? JSON.parse(existingRaw) : [];

      const selected = contacts.filter((c) => selectedIds.includes(c.id));
      const merged = [...existing];

      selected.forEach((c) => {
        if (!merged.some((m) => m.id === c.id)) {
          merged.push(c);
        }
      });

      await AsyncStorage.setItem(GROUP_MEMBERS_KEY, JSON.stringify(merged));
      router.back();
    } catch {
      Alert.alert('Error', 'Could not save selected members.');
    }
  };

  const renderItem = ({ item }: { item: Member }) => {
    const selected = selectedIds.includes(item.id);

    return (
      <TouchableOpacity
        style={[styles.card, selected && styles.cardSelected]}
        onPress={() => toggleSelect(item.id)}
        activeOpacity={0.75}
      >
        {item.avatar ? (
          <Image source={{ uri: item.avatar }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatarFallback,
              { backgroundColor: getAvatarColor(item.name) },
            ]}
          >
            <Text style={styles.initials}>{getInitials(item.name)}</Text>
          </View>
        )}

        <View style={styles.textWrap}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {!!item.phoneNumber && (
            <Text style={styles.subText} numberOfLines={1}>
              {item.phoneNumber}
            </Text>
          )}
        </View>

        {selected && (
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={15} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <>
      <StatusBar style="light" backgroundColor="#F58500" />

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>{groupName}</Text>
            <Text style={styles.subtitle}>Add members</Text>
          </View>

          <View style={{ width: 36 }} />
        </View>

        <View style={styles.content}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={17} color="#9CA3AF" />
            <TextInput
              placeholder="Search by name or number"
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              style={styles.searchInput}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={17} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          {selectedIds.length > 0 && (
            <View style={styles.selectionChip}>
              <Ionicons name="checkmark-circle" size={13} color="#F58500" />
              <Text style={styles.selectionChipText}>{selectedIds.length} selected</Text>
            </View>
          )}

          {loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="hourglass-outline" size={36} color="#D1D5DB" />
              <Text style={styles.emptyText}>Loading contacts…</Text>
            </View>
          ) : (
            <SectionList
              sections={groupedContacts}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              renderSectionHeader={({ section: { title } }) => (
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLetter}>{title}</Text>
                  <View style={styles.sectionLine} />
                </View>
              )}
              contentContainerStyle={{ paddingBottom: 110, paddingTop: 4 }}
              showsVerticalScrollIndicator={false}
              stickySectionHeadersEnabled={false}
            />
          )}

          <TouchableOpacity
            style={styles.fab}
            onPress={saveSelectedMembers}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={32} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F4F1EC',
  },

  header: {
    backgroundColor: '#F58500',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 12,
    color: '#fff',
    opacity: 0.85,
    marginTop: 1,
  },

  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  searchBar: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 8,
    marginBottom: 10,
    shadowColor: '#C07020',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0E8DC',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },

  selectionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF0DE',
    borderWidth: 1,
    borderColor: '#FED7AA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 8,
  },
  selectionChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F58500',
  },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    marginBottom: 6,
  },
  sectionLetter: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F58500',
    width: 16,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EDE5D8',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#C07020',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F0E8DC',
  },
  cardSelected: {
    borderColor: '#F58500',
    backgroundColor: '#FFF7ED',
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 13,
    marginRight: 12,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 13,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },

  textWrap: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1C1410',
  },
  subText: {
    fontSize: 12,
    color: '#B07830',
    marginTop: 2,
  },
  sourceText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 3,
    fontWeight: '600',
  },

  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#F58500',
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: '#F58500',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F58500',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
});