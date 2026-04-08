import React, { useCallback, useState } from 'react';
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

export default function ContactMembersScreen() {
  const insets = useSafeAreaInsets();
  const [groupName, setGroupName] = useState('Name of Group');
  const [members, setMembers] = useState<Member[]>([]);

  const loadData = async () => {
    try {
      const savedGroupName = await AsyncStorage.getItem(GROUP_NAME_KEY);
      const savedMembers = await AsyncStorage.getItem(GROUP_MEMBERS_KEY);

      if (savedGroupName) setGroupName(savedGroupName);
      if (savedMembers) setMembers(JSON.parse(savedMembers));
      else setMembers([]);
    } catch (error) {
      console.log('Error loading members:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
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
      case 'SAFE':
        return { bg: '#57C61A', text: '#fff' };
      case 'NEED HELP!':
        return { bg: '#FFB300', text: '#fff' };
      case 'IN DANGER':
        return { bg: '#F15A3B', text: '#fff' };
      default:
        return { bg: '#57C61A', text: '#fff' };
    }
  };

  const renderAvatar = (item: Member) => {
    if (item.avatar) {
      return <Image source={{ uri: item.avatar }} style={styles.avatar} />;
    }

    return (
      <View style={styles.avatarFallback}>
        <Ionicons name="person" size={16} color="#888" />
      </View>
    );
  };

  const renderMember = ({ item }: { item: Member }) => {
    const style = getStatusStyle(item.status);

    return (
      <View style={styles.memberCard}>
        <View style={styles.memberTopRow}>
          <View style={styles.memberLeft}>
            {renderAvatar(item)}

            <Text style={styles.memberName} numberOfLines={1}>
              {item.name}
            </Text>
          </View>

          {/* READ-ONLY STATUS */}
          <View style={[styles.statusPill, { backgroundColor: style.bg }]}>
            <Text style={[styles.statusText, { color: style.text }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <View style={styles.memberActions}>
          <TouchableOpacity
            style={styles.removeButton}
            onPress={() => removeMember(item.id)}
          >
            <Text style={styles.removeText}>Remove</Text>
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
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerTitleWrap}>
              <Text style={styles.headerTitle}>{groupName}</Text>
            </View>
          </View>

          <View style={styles.content}>
            <Text style={styles.sectionTitle}>Members & Status</Text>

            {members.length === 0 ? (
              <View style={styles.empty}>
                <Ionicons name="people-outline" size={48} color="#C7C7C7" />
                <Text style={styles.emptyTitle}>No members yet</Text>
                <Text style={styles.emptySub}>
                  Add people to your emergency group
                </Text>
              </View>
            ) : (
              <FlatList
                data={members}
                keyExtractor={(item) => item.id}
                renderItem={renderMember}
                contentContainerStyle={{ gap: 14 }}
              />
            )}

            <TouchableOpacity
              style={styles.addButton}
              onPress={() => router.push('/(tabs)/groups/addmembers')}
            >
              <Text style={styles.addText}>Add Member</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </>
  );
}

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

  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  content: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 22,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#C76B00',
    marginBottom: 14,
  },

  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyTitle: {
    marginTop: 10,
    fontSize: 18,
    fontWeight: '700',
  },

  emptySub: {
    marginTop: 6,
    color: '#777',
  },

  memberCard: {
    backgroundColor: '#FFF8EF',
    borderRadius: 10,
    padding: 12,
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
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },

  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DDD',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  memberName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
  },

  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },

  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },

  memberActions: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },

  removeButton: {
    backgroundColor: '#F58500',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },

  removeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  addButton: {
    marginTop: 16,
    alignSelf: 'center',
    backgroundColor: '#F58500',
    minWidth: 200,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addText: {
    color: '#fff',
    fontWeight: '700',
  },
});