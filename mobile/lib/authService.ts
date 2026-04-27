import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  UserCredential,
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc, query, where, getDocs, collection, serverTimestamp } from 'firebase/firestore';
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

//export const logOut = (): Promise<void> => signOut(auth);
export const logOut = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error during logout:", error);
    throw error;
  }
};

export const isFieldTaken = async (fieldName: string, value: string, currentUid: string) => {
  const usersRef = collection(db, "users");
  const q = query(usersRef, where(fieldName, "==", value));
  const querySnapshot = await getDocs(q);
  
  const conflict = querySnapshot.docs.find(doc => doc.id !== currentUid);
  return !!conflict; 
};

export const updateUserProfile = async (uid: string, data: any) => {
  try {
    const userRef = doc(db, "users", uid);
    await updateDoc(userRef, data);
    return { success: true };
  } catch (error) {
    console.error("Update Error:", error);
    return { success: false, error };
  }
};
