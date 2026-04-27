import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebaseConfig';
import {
  fetchMessageHistory,
  sendMessage,
  connectWebSocket,
  markChatAsRead,
} from '@/lib/services/messageApi';

type Message = {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
};

function formatChatTimestamp(timestamp: any) {
  if (!timestamp) return '';

  if (timestamp?.toDate) {
    return timestamp.toDate().toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    });
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function ChatScreen() {
  const insets = useSafeAreaInsets();
  const { chatId, name } = useLocalSearchParams<{ chatId: string; name?: string }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [chatPhoto, setChatPhoto] = useState('');
  const flatListRef = useRef<FlatList<Message>>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const currentUid = auth.currentUser?.uid ?? null;

  const syncReadState = useCallback(async () => {
    if (!chatId) return;

    try {
      await markChatAsRead(String(chatId));
    } catch (err) {
      console.log('Failed to mark chat as read:', err);
    }
  }, [chatId]);

  useEffect(() => {
    if (!chatId) return;

    let mounted = true;

    fetchMessageHistory(String(chatId))
      .then(async (msgs) => {
        if (!mounted) return;
        setMessages(msgs);
        await syncReadState();
      })
      .catch((err) => console.log('History load failed:', err));

    connectWebSocket(
      String(chatId),
      async (message) => {
        if (!mounted) return;

        setMessages((prev) => [...prev, message]);

        if (message.senderId !== currentUid) {
          await syncReadState();
        }
      },
      () => console.log('WebSocket closed'),
    ).then((ws) => {
      if (!mounted) {
        ws.close();
        return;
      }
      wsRef.current = ws;
    });

    return () => {
      mounted = false;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [chatId, currentUid, syncReadState]);

  useEffect(() => {
    if (messages.length === 0) return;

    const timer = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    return () => clearTimeout(timer);
  }, [messages]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || !chatId) return;

    try {
      await sendMessage(String(chatId), trimmed);
      setInput('');
    } catch (err) {
      console.log('Send failed:', err);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.senderId === currentUid;
    const timeText = formatChatTimestamp(item.createdAt);

    return (
      <View
        style={[
          styles.messageRow,
          isMine ? styles.messageRowRight : styles.messageRowLeft,
        ]}
      >
        <View
          style={[
            styles.messageBubble,
            isMine ? styles.myMessageBubble : styles.otherMessageBubble,
          ]}
        >
          <Text
            style={[
              styles.messageText,
              isMine ? styles.myMessageText : styles.otherMessageText,
            ]}
          >
            {item.text}
          </Text>

          {timeText ? (
            <Text
              style={[
                styles.messageTime,
                isMine ? styles.myMessageTime : styles.otherMessageTime,
              ]}
            >
              {timeText}
            </Text>
          ) : null}
        </View>
      </View>
    );
  };

  useEffect(() => {
    const loadChatHeader = async () => {
      const uid = auth.currentUser?.uid;
      if (!chatId || !uid) return;

      try {
        const chatRef = doc(db, 'chats', String(chatId));
        const chatSnap = await getDoc(chatRef);

        if (!chatSnap.exists()) return;

        const chatData = chatSnap.data();
        const participantDetails = chatData.participantDetails || {};
        const entries = Object.entries(participantDetails) as [string, any][];

        const otherUserEntry = entries.find(([userId]) => userId !== uid);
        const otherUser = otherUserEntry ? otherUserEntry[1] : participantDetails[uid];

        setChatPhoto(otherUser?.photoURL || '');
      } catch (err) {
        console.log('Failed to load chat header:', err);
      }
    };

    loadChatHeader();
  }, [chatId]);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 10}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
            <Ionicons name="chevron-back" size={26} color="#111" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            {chatPhoto ? (
              <Image source={{ uri: chatPhoto }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatar}>
                <Ionicons name="person" size={20} color="#888" />
              </View>
            )}

            <Text style={styles.headerTitle} numberOfLines={1}>
              {name || 'Chat'}
            </Text>
          </View>

          <View style={styles.headerIcon} />
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
        />

        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor="#9AA0A6"
            value={input}
            onChangeText={setInput}
            multiline
          />

          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  flex: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 64,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    backgroundColor: '#fff',
  },
  headerIcon: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 8,
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 10,
    backgroundColor: '#F1F3F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  messagesList: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
  },
  messageRow: {
    marginBottom: 10,
    flexDirection: 'row',
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  myMessageBubble: {
    backgroundColor: '#1677FF',
    borderBottomRightRadius: 6,
  },
  otherMessageBubble: {
    backgroundColor: '#F1F3F4',
    borderBottomLeftRadius: 6,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#111',
  },
  messageTime: {
    marginTop: 4,
    fontSize: 11,
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'right',
  },
  otherMessageTime: {
    color: '#777',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: '#F5F6F7',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    color: '#111',
    marginRight: 8,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1677FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});