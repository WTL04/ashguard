import { auth } from '@/lib/firebaseConfig';

const BASE_URL = 'http://54.193.8.1:8000';

// calls POST /api/v1/messages
export const sendMessage = async (chatId: string, text: string) => {
    const token = await auth.currentUser?.getIdToken();

    const res = await fetch(`${API_URL}/api/v1/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ chat_id: chatId, text_body: text })
    });

    if (!res.ok) throw new Error('Failed to send message');

    return res.json();
};
