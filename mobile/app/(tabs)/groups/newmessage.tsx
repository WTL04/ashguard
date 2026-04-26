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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebaseConfig';
import { getOrCreateChat } from '@/lib/services/chatService';

const GROUP_MEMBERS_KEY = 'emergency_group_members';

type SavedContact = {
  id: string;
  name: string;
  phoneNumber?: string;
};

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
  return digits.length === 11 && digits.startsWith('1')
    ? digits.slice(1)
    : digits;
};

export default function NewMessageScreen() {
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState('');
  const [matchedUsers, setMatchedUsers] = useState<AppUser[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<AppUser | null>(null);

  useEffect(() => {
    loadUsersForMessaging();
    loadCurrentUserProfile();
  }, []);

  const loadCurrentUserProfile = async () => {
    try {
      const currentUid = auth.currentUser?.uid;
      if (!currentUid) return;

      const currentUserRef = doc(db, 'users', currentUid);
      const currentUserSnap = await getDoc(currentUserRef);

      if (currentUserSnap.exists()) {
        setCurrentUserProfile(currentUserSnap.data() as AppUser);
      }
    } catch (error) {
      console.log('Error loading current user profile:', error);
    }
  };

  const loadUsersForMessaging = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const allUsers = snapshot.docs.map((doc) => doc.data() as AppUser);

      // TEMPORARY EMULATOR VERSION:
      // Show all Firestore users directly, including self for testing.
      const allowedUsers = allUsers.filter((user) => !!user.uid);

      setMatchedUsers(allowedUsers);

      /*
      ORIGINAL CONTACT-MATCHING VERSION (KEEP FOR REAL DEVICE USE LATER)

      const currentUid = auth.currentUser?.uid;

      const contactsRaw = await AsyncStorage.getItem(GROUP_MEMBERS_KEY);
      const savedContacts: SavedContact[] = contactsRaw ? JSON.parse(contactsRaw) : [];

      const contactPhoneSet = new Set(
        savedContacts
          .map((contact) => normalizePhone(contact.phoneNumber))
          .filter(Boolean)
      );

      const allowedUsers = allUsers.filter((user) => {
        const normalizedUserPhone = normalizePhone(user.phone);
        const isSelf = user.uid === currentUid;
        const isInSavedContacts = contactPhoneSet.has(normalizedUserPhone);

        return isSelf || isInSavedContacts;
      });

      setMatchedUsers(allowedUsers);
      */
    } catch (error) {
      console.log('Error loading users for messaging:', error);
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

  const renderUser = ({ item }: { item: AppUser }) => {
    const isSelf = item.uid === auth.currentUser?.uid;

    return (
      <TouchableOpacity
        style={styles.contactRow}
        onPress={async () => {
          if (!auth.currentUser || !currentUserProfile) return;

          const currentUser = {
            uid: currentUserProfile.uid,
            firstName: currentUserProfile.firstName,
            lastName: currentUserProfile.lastName,
            username: currentUserProfile.username || '',
            photoURL: currentUserProfile.photoURL || '',
          };

          const otherUser = item;

          try {
            const chatId = await getOrCreateChat(currentUser, otherUser);

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
        }}
      >
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

            {filteredUsers.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="create-outline" size={52} color="#C9C9C9" />
                <Text style={styles.emptyTitle}>No contacts yet</Text>
                <Text style={styles.emptySubtitle}>
                  Your contacts will appear here
                </Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F3F3',
  },
  screen: {
    flex: 1,
  },
  header: {
    backgroundColor: '#F58500',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 20,
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
    marginRight: 26,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchBar: {
    height: 42,
    borderRadius: 22,
    backgroundColor: '#EEE3D2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 6,
    fontSize: 14,
    color: '#111',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111',
    marginTop: 12,
  },
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
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DDD',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
  },
  contactSubtext: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  avatarImage: {
  width: 34,
  height: 34,
  borderRadius: 17,
  marginRight: 10,
},
});