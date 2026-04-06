import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

type AppUser = {
  uid: string;
  firstName: string;
  lastName: string;
  username?: string;
  photoURL?: string;
};

export async function getOrCreateChat(
  currentUser: AppUser,
  otherUser: AppUser
) {
  const chatId =
    currentUser.uid < otherUser.uid
      ? `${currentUser.uid}_${otherUser.uid}`
      : `${otherUser.uid}_${currentUser.uid}`;

  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);

  if (!chatSnap.exists()) {
    await setDoc(chatRef, {
      participants: [currentUser.uid, otherUser.uid],
      participantDetails: {
        [currentUser.uid]: {
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          username: currentUser.username || '',
          photoURL: currentUser.photoURL || '',
        },
        [otherUser.uid]: {
          firstName: otherUser.firstName,
          lastName: otherUser.lastName,
          username: otherUser.username || '',
          photoURL: otherUser.photoURL || '',
        },
      },
      lastMessage: '',
      lastMessageAt: serverTimestamp(),
      lastMessageSenderId: '',
      createdAt: serverTimestamp(),
    });
  }

  return chatId;
}