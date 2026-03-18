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
};

export default function AddMembersScreen() {
  const insets = useSafeAreaInsets();

  const [groupName, setGroupName] = useState('Name of Group');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [contacts, setContacts] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);

  useEffect(() => {
    loadGroupName();
    loadPhoneContacts();
  }, []);

  const loadGroupName = async () => {
    const saved = await AsyncStorage.getItem(GROUP_NAME_KEY);
    if (saved) setGroupName(saved);
  };

  const loadPhoneContacts = async () => {
    try {
      setLoading(true);

      const { status } = await Contacts.requestPermissionsAsync();

      if (status !== 'granted') {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      const response = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Image,
        ],
      });

      const formattedContacts: Member[] = (response.data || [])
        .filter((contact) => {
          const hasName =
            typeof contact.name === 'string' && contact.name.trim().length > 0;

          const hasPhone =
            Array.isArray(contact.phoneNumbers) &&
            contact.phoneNumbers.length > 0 &&
            !!contact.phoneNumbers[0]?.number;

          return hasName && hasPhone;
        })
        .map((contact) => ({
          id: String(contact.id),
          name: contact.name!.trim(),
          avatar:
            contact.imageAvailable && contact.image?.uri
              ? contact.image.uri
              : '',
          status: DEFAULT_STATUS, 
          phoneNumber: contact.phoneNumbers?.[0]?.number ?? '',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      setContacts(formattedContacts);
    } catch (error) {
      console.log('Error loading contacts:', error);
      Alert.alert('Error', 'Could not load contacts.');
    } finally {
      setLoading(false);
    }
  };

  const groupedContacts = useMemo(() => {
    const filtered = contacts.filter((contact) =>
      contact.name.toLowerCase().includes(search.toLowerCase())
    );

    const grouped: Record<string, Member[]> = {};

    filtered.forEach((contact) => {
      const firstChar = contact.name.charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(firstChar) ? firstChar : '#';

      if (!grouped[letter]) grouped[letter] = [];
      grouped[letter].push(contact);
    });

    return Object.keys(grouped)
      .sort()
      .map((letter) => ({
        title: letter,
        data: grouped[letter],
      }));
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
    } catch (error) {
      console.log('Error saving members:', error);
    }
  };

  const renderItem = ({ item }: { item: Member }) => {
    const selected = selectedIds.includes(item.id);

    return (
      <TouchableOpacity
        style={[styles.row, selected && styles.rowSelected]}
        onPress={() => toggleSelect(item.id)}
      >
        <View style={styles.left}>
          {item.avatar ? (
            <Image source={{ uri: item.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="person" size={14} color="#888" />
            </View>
          )}
          <Text style={[styles.name, selected && styles.nameSelected]}>
            {item.name}
          </Text>
        </View>

        {selected && <Ionicons name="checkmark" size={22} color="#fff" />}
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
              <Text style={styles.headerTitle}>{groupName}</Text>
            </View>
          </View>

          <View style={styles.content}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={16} color="#666" />
              <TextInput
                placeholder="Search"
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
              />
            </View>

            {loading ? (
              <Text style={styles.center}>Loading contacts...</Text>
            ) : permissionDenied ? (
              <Text style={styles.center}>Permission denied</Text>
            ) : (
              <SectionList
                sections={groupedContacts}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                renderSectionHeader={({ section: { title } }) => (
                  <Text style={styles.section}>{title}</Text>
                )}
              />
            )}

            <TouchableOpacity style={styles.fab} onPress={saveSelectedMembers}>
              <Ionicons
                name={selectedIds.length > 0 ? 'checkmark' : 'add'}
                size={28}
                color="#fff"
              />
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

  content: { flex: 1, padding: 16 },

  searchBar: {
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEE3D2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 10,
  },

  searchInput: { flex: 1, marginLeft: 6 },

  section: {
    fontSize: 13,
    fontWeight: '700',
    color: '#D17800',
    marginVertical: 6,
  },

  row: {
    backgroundColor: '#EEE3D2',
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  rowSelected: {
    backgroundColor: '#57D400',
  },

  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 10,
  },

  avatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#DDD',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  name: {
    fontSize: 15,
    fontWeight: '700',
  },

  nameSelected: {
    color: '#fff',
  },

  center: {
    textAlign: 'center',
    marginTop: 40,
  },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#F58500',
    alignItems: 'center',
    justifyContent: 'center',
  },
});