import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  UserCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

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

export const logOut = (): Promise<void> => signOut(auth);