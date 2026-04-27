import React, { useCallback, useEffect, useRef, useState } from 'react';
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
import { router, useFocusEffect } from 'expo-router';
import { auth } from '@/lib/firebaseConfig';
import { fetchChats, connectWebSocket } from '@/lib/services/messageApi';

function formatMessageTime(isoString: string | null): string {
  if (!isoString) return '';

  const date = new Date(isoString);
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

type Chat = {
  id: string;
  participants: string[];
  participantDetails: Record<string, any>;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageSenderId: string | null;
  unreadCounts: Record<string, number>;
  createdAt: string;
};

export default function GroupsScreen() {
  const insets = useSafeAreaInsets();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState('');
  const wsRefs = useRef<WebSocket[]>([]);
  const currentUid = auth.currentUser?.uid ?? null;

  const loadChats = useCallback(async () => {
    try {
      const data = await fetchChats();
      setChats(data);
    } catch (err) {
      console.log('Failed to load chats:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      const run = async () => {
        try {
          const data = await fetchChats();
          if (!cancelled) {
            setChats(data);
            setLoading(false);
          }
        } catch (err) {
          console.log('Failed to load chats:', err);
          if (!cancelled) setLoading(false);
        }
      };

      run();

      return () => {
        cancelled = true;
      };
    }, [])
  );

  useEffect(() => {
    let active = true;

    const setupSockets = async () => {
      try {
        const data = await fetchChats();
        if (!active) return;

        setChats(data);
        setLoading(false);

        wsRefs.current.forEach((ws) => ws.close());
        wsRefs.current = [];

        for (const chat of data) {
          const ws = await connectWebSocket(chat.id, async () => {
            if (!active) return;
            await loadChats();
          });

          if (!active) {
            ws.close();
            continue;
          }

          wsRefs.current.push(ws);
        }
      } catch (err) {
        console.log('Failed to setup inbox sockets:', err);
        if (active) setLoading(false);
      }
    };

    setupSockets();

    return () => {
      active = false;
      wsRefs.current.forEach((ws) => ws.close());
      wsRefs.current = [];
    };
  }, [loadChats]);

  const filteredChats = chats.filter((chat) => {
    const participantDetails = chat.participantDetails || {};
    const entries = Object.entries(participantDetails) as [string, any][];
    const otherEntry = entries.find(([uid]) => uid !== currentUid);
    const displayUser = otherEntry ? otherEntry[1] : participantDetails[currentUid || ''];

    const displayName = displayUser
      ? `${displayUser.firstName || ''} ${displayUser.lastName || ''}`.trim()
      : 'Unknown User';

    return displayName.toLowerCase().includes(searchText.toLowerCase());
  });

  const totalUnreadCount = chats.reduce((sum, chat) => {
    return sum + (chat?.unreadCounts?.[currentUid || ''] || 0);
  }, 0);

  const renderChat = ({ item }: { item: Chat }) => {
    const participantDetails = item.participantDetails || {};
    const entries = Object.entries(participantDetails) as [string, any][];
    const otherEntry = entries.find(([uid]) => uid !== currentUid);
    const displayUser = otherEntry ? otherEntry[1] : participantDetails[currentUid || ''];

    const displayName = displayUser
      ? `${displayUser.firstName || ''} ${displayUser.lastName || ''}`.trim()
      : 'Unknown User';

    const displayPhoto = displayUser?.photoURL || '';
    const previewText = item.lastMessage?.trim() || 'Start a conversation';
    const timeText = formatMessageTime(item.lastMessageAt);
    const unreadCount = item?.unreadCounts?.[currentUid || ''] || 0;
    const hasUnread = unreadCount > 0;

    return (
      <TouchableOpacity
        style={styles.messageRow}
        onPress={() => {
          setChats((prev) =>
            prev.map((chat) =>
              chat.id === item.id
                ? {
                    ...chat,
                    unreadCounts: {
                      ...chat.unreadCounts,
                      [currentUid || '']: 0,
                    },
                  }
                : chat
            )
          );

          router.push({
            pathname: '/(tabs)/groups/chat',
            params: { chatId: item.id, name: displayName },
          });
        }}
      >
        <View style={styles.avatarWrap}>
          {displayPhoto ? (
            <Image source={{ uri: displayPhoto }} style={styles.avatar} />
          ) : (
            <View style={styles.avatar}>
              <Ionicons name="person" size={24} color="#888" />
            </View>
          )}
          {hasUnread && <View style={styles.unreadDot} />}
        </View>

        <View style={styles.messageContent}>
          <Text style={styles.messageName} numberOfLines={1}>
            {displayName}
          </Text>
          <Text
            style={[styles.messagePreview, hasUnread && styles.messagePreviewUnread]}
            numberOfLines={1}
          >
            {previewText}
          </Text>
        </View>

        <View style={styles.rightSide}>
          <Text style={styles.messageTime}>{timeText}</Text>
          {hasUnread && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <View style={[styles.container, { paddingTop: insets.top + 6 }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Messages</Text>
          <TouchableOpacity
            style={styles.composeButton}
            onPress={() => router.push('/(tabs)/groups/newmessage')}
          >
            <Ionicons name="create-outline" size={22} color="#111" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search" size={18} color="#777" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search messages"
            placeholderTextColor="#9AA0A6"
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>
            {totalUnreadCount > 0
              ? `${totalUnreadCount} unread message${totalUnreadCount === 1 ? '' : 's'}`
              : 'No unread messages'}
          </Text>
        </View>

        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          renderItem={renderChat}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            filteredChats.length === 0 ? styles.emptyListContent : undefined
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-ellipses-outline" size={34} color="#999" />
              <Text style={styles.emptyTitle}>
                {loading ? 'Loading conversations...' : 'No conversations yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                Start a new chat to see messages here.
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111',
  },
  composeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },
  searchWrap: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F5F6F7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111',
  },
  summaryRow: {
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatarWrap: {
    width: 56,
    height: 56,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F1F3F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadDot: {
    position: 'absolute',
    top: 6,
    right: 3,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1677FF',
    borderWidth: 2,
    borderColor: '#fff',
  },
  messageContent: {
    flex: 1,
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
    color: '#777',
  },
  messagePreviewUnread: {
    color: '#111',
    fontWeight: '600',
  },
  rightSide: {
    alignItems: 'flex-end',
    minWidth: 68,
  },
  messageTime: {
    fontSize: 12,
    color: '#888',
    marginBottom: 6,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: '#1677FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  emptySubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#777',
    textAlign: 'center',
  },
});