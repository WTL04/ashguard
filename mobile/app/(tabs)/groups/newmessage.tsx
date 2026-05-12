import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  fetchUsers,
  fetchCurrentUser,
  createOrGetChat,
} from '@/lib/services/messageApi';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppUser = {
  uid: string;
  firstName: string;
  lastName: string;
  username?: string;
  photoURL?: string;
  phone: string;
};

const normalizePhone = (phone?: string) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NewMessageScreen() {
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [matchedUsers, setMatchedUsers] = useState<AppUser[]>([]);
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Both calls hit the backend — no direct Firestore reads
      const [me, users] = await Promise.all([fetchCurrentUser(), fetchUsers()]);
      setCurrentUserUid(me.uid);
      setMatchedUsers(users.filter((u: AppUser) => !!u.uid));
    } catch (error) {
      console.log('Error loading users for messaging:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return matchedUsers;

    return matchedUsers.filter((user) => {
      const fullName = `${user.firstName} ${user.lastName}`.toLowerCase();
      const username = (user.username || '').toLowerCase();
      const phone = normalizePhone(user.phone);
      const digitsOnlyQuery = q.replace(/\D/g, '');

      return (
        fullName.includes(q) ||
        username.includes(q) ||
        (digitsOnlyQuery.length > 0 && phone.includes(digitsOnlyQuery))
      );
    });
  }, [matchedUsers, search]);

  const handleUserPress = async (item: AppUser) => {
    try {
      // POST /api/v1/chats — backend creates or returns existing chat
      // and sets up participantDetails + unreadCounts correctly
      const chatId = await createOrGetChat(item.uid);

      router.replace({
        pathname: '/(tabs)/groups/chat',
        params: {
          chatId,
          name: `${item.firstName} ${item.lastName}`,
        },
      });
    } catch (error) {
      console.log('Error creating/opening chat:', error);
    }
  };

  const renderUser = ({ item }: { item: AppUser }) => {
    const isSelf = item.uid === currentUserUid;

    return (
      <TouchableOpacity style={styles.contactRow} onPress={() => handleUserPress(item)}>
        <View style={styles.contactLeft}>
          {item.photoURL ? (
            <Image source={{ uri: item.photoURL }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="person" size={16} color="#888" />
            </View>
          )}

          <View>
            <Text style={styles.contactName}>
              {item.firstName} {item.lastName}
              {isSelf ? ' (You)' : ''}
            </Text>
            <Text style={styles.contactSubtext}>
              {item.phone || item.username || ''}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <StatusBar style="light" backgroundColor="#F58500" />

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.screen}>
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>New Message</Text>
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#666" />
              <TextInput
                placeholder="Search name or number"
                placeholderTextColor="#666"
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            {loading ? (
              <View style={styles.emptyState}>
                <Ionicons name="hourglass-outline" size={52} color="#C9C9C9" />
                <Text style={styles.emptyTitle}>Loading...</Text>
              </View>
            ) : filteredUsers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="create-outline" size={52} color="#C9C9C9" />
                <Text style={styles.emptyTitle}>No contacts yet</Text>
                <Text style={styles.emptySubtitle}>Your contacts will appear here</Text>
              </View>
            ) : (
              <FlatList
                data={filteredUsers}
                keyExtractor={(item) => item.uid}
                renderItem={renderUser}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F3F3' },
  screen: { flex: 1 },
  header: {
    backgroundColor: '#F58500',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  headerTitleWrap: { flex: 1, alignItems: 'center', marginRight: 26 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  content: { flex: 1, padding: 16 },
  searchBar: {
    height: 42,
    borderRadius: 22,
    backgroundColor: '#EEE3D2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: { flex: 1, marginLeft: 6, fontSize: 14, color: '#111' },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#111', marginTop: 12 },
  emptySubtitle: {
    fontSize: 14,
    color: '#8A8A8A',
    marginTop: 6,
    textAlign: 'center',
  },
  contactRow: {
    backgroundColor: '#EEE3D2',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  contactLeft: { flexDirection: 'row', alignItems: 'center' },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DDD',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: { width: 34, height: 34, borderRadius: 17, marginRight: 10 },
  contactName: { fontSize: 15, fontWeight: '700', color: '#111' },
  contactSubtext: { fontSize: 13, color: '#666', marginTop: 2 },
});