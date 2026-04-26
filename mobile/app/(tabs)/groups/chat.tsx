import React, { useEffect, useRef, useState } from 'react';
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
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  updateDoc,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebaseConfig';

type Message = {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
};

function formatChatTimestamp(timestamp: any) {
  if (!timestamp?.toDate) return '';

  const date = timestamp.toDate();

  return date.toLocaleTimeString([], {
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

  useEffect(() => {
    if (!chatId) return;

    const q = query(
      collection(db, 'chats', String(chatId), 'messages'),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Message[];

      setMessages(msgs);
    });

    return unsubscribe;
  }, [chatId]);

  useEffect(() => {
    if (messages.length === 0) return;

    const timer = setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    return () => clearTimeout(timer);
  }, [messages]);

  // ✅ FIX: Clear unread whenever messages change while chat is open
  useEffect(() => {
    const clearUnreadForCurrentUser = async () => {
      const currentUid = auth.currentUser?.uid;
      if (!chatId || !currentUid) return;

      try {
        await updateDoc(doc(db, 'chats', String(chatId)), {
          [`unreadCounts.${currentUid}`]: 0,
        });
      } catch (error) {
        console.log('Error clearing unread count:', error);
      }
    };

    if (messages.length > 0) {
      clearUnreadForCurrentUser();
    }
  }, [chatId, messages]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    const currentUid = auth.currentUser?.uid;

    if (!trimmed || !chatId || !currentUid) return;

    try {
      const chatRef = doc(db, 'chats', String(chatId));
      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) return;

      const chatData = chatSnap.data();
      const participants: string[] = chatData.participants || [];

      const otherParticipantIds = participants.filter((uid) => uid !== currentUid);

      const unreadCounts = { ...(chatData.unreadCounts || {}) };

      otherParticipantIds.forEach((uid) => {
        unreadCounts[uid] = (unreadCounts[uid] || 0) + 1;
      });

      unreadCounts[currentUid] = 0;

      await addDoc(collection(db, 'chats', String(chatId), 'messages'), {
        text: trimmed,
        senderId: currentUid,
        createdAt: serverTimestamp(),
      });

      await updateDoc(chatRef, {
        lastMessage: trimmed,
        lastMessageAt: serverTimestamp(),
        lastMessageSenderId: currentUid,
        unreadCounts,
      });

      setInput('');
    } catch (error) {
      console.log('Error sending message:', error);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMine = item.senderId === auth.currentUser?.uid;
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
      const currentUid = auth.currentUser?.uid;
      if (!chatId || !currentUid) return;

      try {
        const chatRef = doc(db, 'chats', String(chatId));
        const chatSnap = await getDoc(chatRef);

        if (!chatSnap.exists()) return;

        const chatData = chatSnap.data();
        const participantDetails = chatData.participantDetails || {};
        const entries = Object.entries(participantDetails) as [string, any][];

        const otherUserEntry = entries.find(([uid]) => uid !== currentUid);
        const otherUser = otherUserEntry ? otherUserEntry[1] : null;

        setChatPhoto(otherUser?.photoURL || '');
      } catch (error) {
        console.log('Error loading chat header:', error);
      }
    };

    loadChatHeader();
  }, [chatId]);

  return (
    <>
      <StatusBar style="light" backgroundColor="#F58500" />

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.screen}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity
              onPress={() => router.dismissTo('/(tabs)/groups')}
              style={styles.backButton}
            >
              <Ionicons name="chevron-back" size={26} color="#fff" />
            </TouchableOpacity>

            <View style={styles.headerCenter}>
              <View style={styles.headerAvatar}>
                {chatPhoto ? (
                  <Image source={{ uri: chatPhoto }} style={styles.headerAvatarImage} />
                ) : (
                  <Ionicons name="person" size={22} color="#F58500" />
                )}
              </View>   

              <Text style={styles.headerTitle} numberOfLines={1}>
                {name || 'Chat'}
              </Text>
            </View>

            <View style={styles.headerRightSpacer} />
          </View>

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
          />

          <View style={styles.inputWrap}>
            <View style={styles.inputBar}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="Message"
                placeholderTextColor="#C08A45"
                style={styles.input}
              />

              <TouchableOpacity onPress={sendMessage} style={styles.sendButton}>
                <Ionicons name="send-outline" size={24} color="#444" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#EDEDED' },
  screen: { flex: 1 },

  header: {
    backgroundColor: '#F58500',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  backButton: { width: 32 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFD27A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    overflow: 'hidden',
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerRightSpacer: { width: 32 },

  messagesList: {
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 10,
  },

  messageRow: { marginBottom: 12, flexDirection: 'row' },
  messageRowLeft: { justifyContent: 'flex-start' },
  messageRowRight: { justifyContent: 'flex-end' },

  messageBubble: {
    maxWidth: '72%',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  myMessageBubble: {
    backgroundColor: '#F58500',
    borderBottomRightRadius: 6,
  },
  otherMessageBubble: {
    backgroundColor: '#F7D8A7',
    borderBottomLeftRadius: 6,
  },

  messageText: { fontSize: 14 },
  myMessageText: { color: '#fff' },
  otherMessageText: { color: '#A85A00' },

  messageTime: {
    fontSize: 11,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  myMessageTime: { color: 'rgba(255,255,255,0.8)' },
  otherMessageTime: { color: '#A85A00', opacity: 0.75 },

  inputWrap: {
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 8,
    backgroundColor: '#EDEDED',
  },
  inputBar: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#F7D8A7',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 10,
  },
  input: { flex: 1, fontSize: 14, color: '#8C4B00' },
  sendButton: { marginLeft: 8 },
});