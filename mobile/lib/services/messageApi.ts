import { auth } from '@/lib/firebaseConfig';

const BASE_URL = 'http://54.193.8.1:8000';

const getToken = async (): Promise<string> => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');
  return token;
};

// --- Chats ---

export const createOrGetChat = async (otherUid: string): Promise<string> => {
  const token = await getToken();

  const res = await fetch(`${BASE_URL}/api/v1/chats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ other_uid: otherUid }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to create or get chat: ${text}`);
  }

  const data = await res.json();
  return data.chat_id;
};

export const fetchChats = async (): Promise<any[]> => {
  const token = await getToken();

  const res = await fetch(`${BASE_URL}/api/v1/chats`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch chats: ${text}`);
  }

  const data = await res.json();
  return data.chats;
};

// --- Messaging ---

export const fetchMessageHistory = async (chatId: string): Promise<any[]> => {
  const token = await getToken();

  const res = await fetch(`${BASE_URL}/api/v1/messages/${chatId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch message history: ${text}`);
  }

  const data = await res.json();
  return data.messages;
};

export const markChatAsRead = async (chatId: string) => {
  const token = await getToken();

  const res = await fetch(`${BASE_URL}/api/v1/chats/${chatId}/read`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to mark chat as read: ${text}`);
  }

  return res.json();
};

export const sendMessage = async (chatId: string, text: string) => {
  const token = await getToken();

  const res = await fetch(`${BASE_URL}/api/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!res.ok) {
    const textBody = await res.text();
    throw new Error(`Failed to send message: ${textBody}`);
  }

  return res.json();
};

// --- WebSocket ---

export const connectWebSocket = async (
  chatId: string,
  onMessage: (message: any) => void,
  onClose?: () => void,
): Promise<WebSocket> => {
  const token = await getToken();
  const wsBase = BASE_URL.replace('https://', 'wss://').replace('http://', 'ws://');
  const ws = new WebSocket(`${wsBase}/ws/${chatId}?token=${token}`);

  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);

      if (!message.id) {
        message.id = `ws-${message.senderId}-${message.createdAt}`;
      }

      onMessage(message);
    } catch (err) {
      console.log('Failed to parse WebSocket message:', err);
    }
  };

  ws.onclose = () => {
    onClose?.();
  };

  ws.onerror = (err) => {
    console.log('WebSocket error:', err);
  };

  return ws;
};

// --- Users ---

export const fetchUsers = async (): Promise<any[]> => {
  const token = await getToken();

  const res = await fetch(`${BASE_URL}/api/v1/users`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch users: ${text}`);
  }

  const data = await res.json();
  return data.users;
};

export const fetchCurrentUser = async (): Promise<any> => {
  const token = await getToken();

  const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch current user: ${text}`);
  }

  return res.json();
};