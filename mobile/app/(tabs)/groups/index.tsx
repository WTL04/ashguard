import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, auth } from '@/lib/firebaseConfig';

function formatMessageTime(timestamp: any) {
  if (!timestamp?.toDate) return '';

  const date = timestamp.toDate();
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes} min ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export default function GroupsScreen() {
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState<any[]>([]);

  useEffect(() => {
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUid),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setChats(chatList);
    });

    return unsubscribe;
  }, []);

  const renderMessage = ({ item }: any) => {
    const currentUid = auth.currentUser?.uid;
    const participantDetails = item.participantDetails || {};
    const entries = Object.entries(participantDetails) as [string, any][];

    let displayUser: any = null;

    const otherUserEntry = entries.find(([uid]) => uid !== currentUid);

    if (otherUserEntry) {
      displayUser = otherUserEntry[1];
    } else {
      displayUser = participantDetails[currentUid || ''];
    }

    const displayName = displayUser
      ? `${displayUser.firstName || ''} ${displayUser.lastName || ''}`.trim()
      : 'Unknown User';

    const previewText = item.lastMessage?.trim()
      ? item.lastMessage
      : 'Start a conversation';

    const timeText = formatMessageTime(item.lastMessageAt);

    return (
      <TouchableOpacity
        style={styles.messageRow}
        onPress={() =>
          router.push({
            pathname: '/(tabs)/groups/chat',
            params: {
              chatId: item.id,
              name: displayName,
            },
          })
        }
      >
        <View style={styles.avatarWrap}>
          <View style={styles.avatar} />
        </View>

        <View style={styles.messageContent}>
          <Text style={styles.messageName} numberOfLines={1}>
            {displayName}
          </Text>

          <Text style={styles.messagePreview} numberOfLines={1}>
            {previewText}
          </Text>
        </View>

        <Text style={styles.messageTime}>
          {timeText}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={54} color="#C9C9C9" />
      <Text style={styles.emptyTitle}>No messages yet</Text>
      <Text style={styles.emptySubtitle}>Start a conversation</Text>
    </View>
  );

  return (
    <>
      <StatusBar style="light" backgroundColor="#F58500" />

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.listContent,
            chats.length === 0 && styles.listContentEmpty,
          ]}
          ListHeaderComponent={
            <>
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

                  <TouchableOpacity
                    style={styles.composeButton}
                    onPress={() => router.push('/(tabs)/groups/newmessage')}
                  >
                    <Ionicons name="create-outline" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.titleSection}>
                <Text style={styles.title}>Messages</Text>
                <Text style={styles.subtitle}>
                  {chats.length > 0 ? 'Your conversations' : 'No conversations yet'}
                </Text>
              </View>

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

                  <Text style={styles.groupText}>View Emergency Group</Text>

                  <Ionicons name="chevron-forward" size={22} color="#111" />
                </View>
              </TouchableOpacity>
            </>
          }
          ListEmptyComponent={renderEmptyState}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F3F3',
  },

  listContent: {
    paddingBottom: 24,
  },

  listContentEmpty: {
    flexGrow: 1,
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
    backgroundColor: '#F3F3F3',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
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

  groupText: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
  },

  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F3F3',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },

  avatarWrap: {
    marginRight: 12,
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#D8D8D8',
  },

  messageContent: {
    flex: 1,
    justifyContent: 'center',
    marginRight: 10,
  },

  messageName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },

  messagePreview: {
    fontSize: 14,
    color: '#666',
  },

  messageTime: {
    fontSize: 13,
    color: '#666',
    alignSelf: 'flex-start',
    marginTop: 4,
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 80,
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111',
    marginTop: 14,
  },

  emptySubtitle: {
    fontSize: 14,
    color: '#8A8A8A',
    marginTop: 6,
    textAlign: 'center',
  },
});