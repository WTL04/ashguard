import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig';

const GROUP_NAME_KEY = 'emergency_group_name';
const GROUP_MEMBERS_KEY = 'emergency_group_members';

type SafetyStatus = 'SAFE' | 'NEED HELP!' | 'IN DANGER';

type Member = {
  id: string;
  name: string;
  avatar: string;
  status: SafetyStatus;
  phoneNumber?: string;
};

const AVATAR_COLORS = ['#F58500', '#E07000', '#FB923C', '#C2410C', '#EA580C'];
const getAvatarColor = (name: string) =>
  AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
const getInitials = (name: string) =>
  name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function ContactMembersScreen() {
  const insets = useSafeAreaInsets();
  const [groupName, setGroupName] = useState('Name of Group');
  const [members, setMembers] = useState<Member[]>([]);

  // Store unsubscribe functions so we can clean them up on blur
  const unsubscribesRef = useRef<(() => void)[]>([]);

  const loadData = async () => {
    try {
      const savedGroupName = await AsyncStorage.getItem(GROUP_NAME_KEY);
      const savedMembers = await AsyncStorage.getItem(GROUP_MEMBERS_KEY);

      if (savedGroupName) setGroupName(savedGroupName);

      const base: Member[] = savedMembers ? JSON.parse(savedMembers) : [];
      setMembers(base);

      // Clean up any existing listeners before setting up new ones
      unsubscribesRef.current.forEach((unsub) => unsub());
      unsubscribesRef.current = [];

      // Subscribe to each Firestore user's doc for live status updates.
      // Phone-only contacts (id starts with "contact-") don't have Firestore docs,
      // so we skip those — their status stays at whatever was last saved.
      base.forEach((member) => {
        if (!member.id.startsWith('firestore-')) return;

        const firestoreUid = member.id.replace('firestore-', '');

        const unsub = onSnapshot(doc(db, 'users', firestoreUid), (snap) => {
          if (!snap.exists()) return;

          const liveStatus = snap.data().safetyStatus as SafetyStatus | undefined;
          if (!liveStatus) return;

          setMembers((prev) =>
            prev.map((m) =>
              m.id === member.id ? { ...m, status: liveStatus } : m
            )
          );
        });

        unsubscribesRef.current.push(unsub);
      });
    } catch (error) {
      console.log('Error loading members:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
      return () => {
        // Unsubscribe all Firestore listeners when screen loses focus
        unsubscribesRef.current.forEach((unsub) => unsub());
        unsubscribesRef.current = [];
      };
    }, [])
  );

  const removeMember = async (memberId: string) => {
    const updated = members.filter((m) => m.id !== memberId);
    setMembers(updated);
    try {
      await AsyncStorage.setItem(GROUP_MEMBERS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.log('Error removing member:', error);
    }
  };

  const getStatusStyle = (status: SafetyStatus) => {
    switch (status) {
      case 'SAFE':        return { bg: '#57C61A', dot: '#3D9912', text: '#fff' };
      case 'NEED HELP!':  return { bg: '#FFB300', dot: '#CC8F00', text: '#fff' };
      case 'IN DANGER':   return { bg: '#F15A3B', dot: '#C03A20', text: '#fff' };
      default:            return { bg: '#57C61A', dot: '#3D9912', text: '#fff' };
    }
  };

  const renderAvatar = (item: Member) => {
    if (item.avatar) {
      return <Image source={{ uri: item.avatar }} style={styles.avatar} />;
    }
    return (
      <View style={[styles.avatarFallback, { backgroundColor: getAvatarColor(item.name) }]}>
        <Text style={styles.initials}>{getInitials(item.name)}</Text>
      </View>
    );
  };

  const renderMember = ({ item }: { item: Member }) => {
    const s = getStatusStyle(item.status);

    return (
      <View style={styles.memberCard}>
        <View style={styles.memberTopRow}>
          <View style={styles.memberLeft}>
            {renderAvatar(item)}
            <View style={styles.nameWrap}>
              <Text style={styles.memberName} numberOfLines={1}>{item.name}</Text>
              {!!item.phoneNumber && (
                <Text style={styles.phoneText} numberOfLines={1}>{item.phoneNumber}</Text>
              )}
            </View>
          </View>

          <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: s.dot }]} />
            <Text style={[styles.statusText, { color: s.text }]}>{item.status}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.memberActions}>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeMember(item.id)}
            activeOpacity={0.8}
          >
            <Ionicons name="trash-outline" size={16} color="#F58500" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <>
      <StatusBar style="light" backgroundColor="#F58500" />

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.screen}>

          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>{groupName}</Text>
            </View>
            <View style={{ width: 36 }} />
          </View>

          <View style={styles.content}>
            <View style={styles.sectionRow}>
              <Ionicons name="people" size={15} color="#F58500" />
              <Text style={styles.sectionTitle}>Members & Status</Text>
              {members.length > 0 && (
                <View style={styles.countBubble}>
                  <Text style={styles.countText}>{members.length}</Text>
                </View>
              )}
            </View>

            {members.length === 0 ? (
              <View style={styles.empty}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="people-outline" size={40} color="#F58500" />
                </View>
                <Text style={styles.emptyTitle}>No members yet</Text>
                <Text style={styles.emptySub}>Add people to your emergency group</Text>
              </View>
            ) : (
              <FlatList
                data={members}
                keyExtractor={(item) => item.id}
                renderItem={renderMember}
                contentContainerStyle={{ gap: 12, paddingBottom: 110 }}
                showsVerticalScrollIndicator={false}
              />
            )}

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/(tabs)/groups/addmembers')}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={30} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F1EC' },
  screen: { flex: 1 },

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
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.2,
  },

  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 22,
  },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#F58500',
    flex: 1,
  },
  countBubble: {
    backgroundColor: '#F58500',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontSize: 11, fontWeight: '800', color: '#fff' },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFF0DE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#333' },
  emptySub: { fontSize: 13, color: '#999' },

  memberCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 11,
    shadowColor: '#C07020',
    shadowOpacity: 0.09,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    borderWidth: 1,
    borderColor: '#F0E8DC',
  },
  memberTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  avatar: { width: 42, height: 42, borderRadius: 13, marginRight: 11 },
  avatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 13,
    marginRight: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 14, fontWeight: '800', color: '#fff' },
  nameWrap: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '800', color: '#1C1410' },
  phoneText: { fontSize: 12, color: '#B07830', marginTop: 2 },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.75 },
  statusText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },

  divider: { height: 1, backgroundColor: '#F0E8DC', marginVertical: 10 },

  memberActions: { flexDirection: 'row', alignItems: 'center' },
  removeButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FFF0DE',
    alignItems: 'center',
    justifyContent: 'center',
  },

  addButton: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
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