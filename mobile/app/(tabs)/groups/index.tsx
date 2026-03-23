import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const messages = [
  {
    id: '1',
    name: 'First Name Last Name',
    message: 'Supporting line text lorem ipsum',
    time: 'Now',
    unread: true,
    avatar: 'https://via.placeholder.com/56',
  },
  {
    id: '2',
    name: 'First Name Last Name',
    message: 'Supporting line text lorem ipsum',
    time: '26 min ago',
    unread: false,
    avatar: 'https://via.placeholder.com/56',
  },
  {
    id: '3',
    name: 'First Name Last Name',
    message: 'Supporting line text lorem ipsum',
    time: '1 hour ago',
    unread: false,
    avatar: 'https://via.placeholder.com/56',
  },
  {
    id: '4',
    name: 'First Name Last Name',
    message: 'Supporting line text lorem ipsum',
    time: '4 hours ago',
    unread: false,
    avatar: 'https://via.placeholder.com/56',
  },
  {
    id: '5',
    name: 'First Name Last Name',
    message: 'Supporting line text lorem ipsum',
    time: '2 days ago',
    unread: false,
    avatar: 'https://via.placeholder.com/56',
  },
];

export default function GroupsScreen() {
  const insets = useSafeAreaInsets();

  const renderMessage = ({ item }) => (
    <TouchableOpacity style={styles.messageRow}>
      <View style={styles.avatarWrap}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        {item.unread && <View style={styles.unreadDot} />}
      </View>

      <View style={styles.messageContent}>
        <Text style={styles.messageName}>{item.name}</Text>
        <Text style={styles.messagePreview}>{item.message}</Text>
      </View>

      <Text style={styles.messageTime}>{item.time}</Text>
    </TouchableOpacity>
  );

  return (
    <>
      <StatusBar style="light" backgroundColor="#F58500" />

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              {/* ORANGE HEADER */}
              <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <View style={styles.searchRow}>
                  <View style={styles.searchBar}>
                    <Ionicons name="search" size={18} color="#555" />
                    <TextInput
                      placeholder="Search"
                      placeholderTextColor="#555"
                      style={styles.searchInput}
                    />
                  </View>

                  <TouchableOpacity style={styles.composeButton}>
                    <Ionicons name="create-outline" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* TITLE SECTION */}
              <View style={styles.titleSection}>
                <Text style={styles.title}>Messages</Text>
                <Text style={styles.subtitle}>You have 1 unread message</Text>
              </View>

              {/* EMERGENCY GROUP CARD */}
              <TouchableOpacity
                style={styles.groupCard}
                onPress={() => router.push('/(tabs)/groups/emergency')}
              >
                <View style={styles.groupAccent} />

                <View style={styles.groupInner}>
                  <Ionicons
                    name="people-outline"
                    size={22}
                    color="#F58500"
                    style={{ marginRight: 10 }}
                  />

                  <View style={styles.avatarStack}>
                    <Image
                      source={{ uri: 'https://via.placeholder.com/40/8ec5ff' }}
                      style={[styles.stackAvatar, { top: 0, left: 10 }]}
                    />
                    <Image
                      source={{ uri: 'https://via.placeholder.com/40/ffd36e' }}
                      style={[styles.stackAvatar, { top: 12, left: 16 }]}
                    />
                    <Image
                      source={{ uri: 'https://via.placeholder.com/40/ff9f7a' }}
                      style={[styles.stackAvatar, { top: 24, left: 4 }]}
                    />
                  </View>

                  <Text style={styles.groupText}>View Emergency Group</Text>

                  <Ionicons name="chevron-forward" size={22} color="#111" />
                </View>
              </TouchableOpacity>
            </>
          }
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F7',
  },

  header: {
    backgroundColor: '#F58500',
    paddingHorizontal: 16,
    paddingBottom: 20,
  },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  searchBar: {
    flex: 1,
    height: 42,
    borderRadius: 24,
    backgroundColor: '#FFF4E8',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },

  searchInput: {
    flex: 1,
    marginLeft: 6,
    fontSize: 14,
  },

  composeButton: {
    width: 40,
    height: 40,
    marginLeft: 10,
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  titleSection: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#F58500',
  },

  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },

  groupCard: {
    flexDirection: 'row',
    backgroundColor: '#F5DFC2',
    minHeight: 88,
  },

  groupAccent: {
    width: 4,
    backgroundColor: '#F58500',
  },

  groupInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },

  avatarStack: {
    width: 40,
    height: 56,
    marginRight: 12,
    position: 'relative',
  },

  stackAvatar: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F5DFC2',
  },

  groupText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },

  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },

  avatarWrap: {
    marginRight: 12,
    position: 'relative',
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#DDD',
  },

  unreadDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#32CD32',
    borderWidth: 2,
    borderColor: '#fff',
  },

  messageContent: {
    flex: 1,
  },

  messageName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },

  messagePreview: {
    fontSize: 14,
    color: '#666',
  },

  messageTime: {
    fontSize: 13,
    color: '#666',
  },
});