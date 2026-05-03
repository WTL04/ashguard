import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  UserCredential,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  query,
  where,
  getDocs,
  collection,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UserProfile {
  username: string;
  firstName: string;
  lastName: string;
  dob: string;
  phone: string;
}

const createUserProfileIfNeeded = async (uid: string, email: string, profile: UserProfile) => {
  const ref = doc(db, 'users', uid);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    await setDoc(ref, {
      uid,
      email,
      username: profile.username,
      firstName: profile.firstName,
      lastName: profile.lastName,
      dob: profile.dob,
      phone: profile.phone,
      photoURL: '',
      location: '',
      createdAt: serverTimestamp(),
    });
  }
};

export const signUp = async (
  email: string,
  password: string,
  profile: UserProfile
): Promise<UserCredential> => {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await createUserProfileIfNeeded(result.user.uid, email, profile);
  return result;
};

export const signIn = (email: string, password: string): Promise<UserCredential> =>
  signInWithEmailAndPassword(auth, email, password);

export const resetPassword = (email: string): Promise<void> =>
  sendPasswordResetEmail(auth, email);

export const logOut = async (): Promise<void> => {
  await signOut(auth);
  await AsyncStorage.removeItem('user_logged_in');
};

export const isFieldTaken = async (fieldName: string, value: string, currentUid: string) => {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where(fieldName, "==", value));
  const querySnapshot = await getDocs(q);
  
  const conflict = querySnapshot.docs.find(doc => doc.id !== currentUid);
  return !!conflict; 
};

const syncUserProfileToChats = async (uid: string, data: any) => {
  const chatsRef = collection(db, 'chats');
  const chatsQuery = query(chatsRef, where('participants', 'array-contains', uid));
  const snapshot = await getDocs(chatsQuery);

  if (snapshot.empty) return;

  const batch = writeBatch(db);

  snapshot.docs.forEach((chatDoc) => {
    batch.update(chatDoc.ref, {
      [`participantDetails.${uid}.firstName`]: data.firstName || '',
      [`participantDetails.${uid}.lastName`]: data.lastName || '',
      [`participantDetails.${uid}.username`]: data.username || '',
      [`participantDetails.${uid}.photoURL`]: data.photoURL || '',
    });
  });

  await batch.commit();
};

export const updateUserProfile = async (uid: string, data: any) => {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, data);

    await syncUserProfileToChats(uid, data);

    return { success: true };
  } catch (error) {
    console.error("Update Error:", error);
    return { success: false, error };
  }
};