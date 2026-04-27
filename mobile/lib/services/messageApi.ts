import { auth } from '@/lib/firebaseConfig';

const BASE_URL = 'http://54.193.8.1:8000';

const getToken = async (): Promise<string> => {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Not authenticated');
  return token;
};


// --- Chats --- 

// POST /api/v1/chats
// creates or returns existing chat between current user and other_uid
export const createOrGetChat = async (otherUid: string): Promise<string> => {
  const token = await getToken();

  const res = await fetch(`${BASE_URL}/api/v1/chats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ other_uid: otherUid }),
  });

  if (!res.ok) throw new Error('Failed to create or get chat');

  const data = await res.json();
  return data.chat_id;
};

// GET /api/v1/chats
// returns all chats for the current user
export const fetchChats = async (): Promise<any[]> => {
  const token = await getToken();

  const res = await fetch(`${BASE_URL}/api/v1/chats`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) throw new Error('Failed to fetch chats');

  const data = await res.json();
  return data.chats;
};



// --- Messaging --- 

// GET /api/v1/messages/{chatId}
// fetches message history once on chat screen load
export const fetchMessageHistory = async (chatId: string): Promise<any[]> => {
  const token = await getToken();

  const res = await fetch(`${BASE_URL}/api/v1/messages/${chatId}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) throw new Error('Failed to fetch message history');

  const data = await res.json();
  return data.messages;
};

// calls POST /api/v1/messages
// sends a message to an existing chat
export const sendMessage = async (chatId: string, text: string) => {
  const token = await auth.currentUser?.getIdToken();

  const res = await fetch(`${BASE_URL}/api/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ chat_id: chatId, text: text })
  });

  if (!res.ok) throw new Error('Failed to send message');

  return res.json();
};

// --- Websocket --- 

// WS /ws/{chatId}
// opens a WebSocket connection for real-time message delivery
// returns the WebSocket instance so the caller can close it on unmount
export const connectWebSocket = async (
  chatId: string,
  onMessage: (message: any) => void,
  onClose?: () => void,
): Promise<WebSocket> => {

  // parse the websocket url 
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
    if (onClose) onClose();
  };

  ws.onerror = (err) => {
    console.log('WebSocket error:', err);
  };

  return ws;
};


// --- Users --- 

// GET /api/v1/users
// returns all users for the new message search screen
export const fetchUsers = async (): Promise<any[]> => {
  const token = await getToken();

  const res = await fetch(`${BASE_URL}/api/v1/users`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) throw new Error('Failed to fetch users');

  const data = await res.json();
  return data.users;
};

// GET /api/v1/users/me
// returns the current user's profile
export const fetchCurrentUser = async (): Promise<any> => {
  const token = await getToken();

  const res = await fetch(`${BASE_URL}/api/v1/users/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!res.ok) throw new Error('Failed to fetch current user');

  return res.json();
};
