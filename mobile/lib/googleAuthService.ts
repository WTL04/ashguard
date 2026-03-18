import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  GoogleAuthProvider,
  signInWithCredential,
  UserCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';

// Required — completes the auth session on mobile
WebBrowser.maybeCompleteAuthSession();

export const useGoogleAuthRequest = () => {
  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  return { request, response, promptAsync };
};

export const signInWithGoogle = async (
  idToken: string,
  accessToken: string
): Promise<UserCredential> => {
  const credential = GoogleAuthProvider.credential(idToken, accessToken);
  const result = await signInWithCredential(auth, credential);

  // Auto-create Firestore profile if it's the user's first Google login
  const ref = doc(db, 'users', result.user.uid);
  const existing = await getDoc(ref);
  if (!existing.exists()) {
    const displayName = result.user.displayName ?? '';
    const [firstName, ...rest] = displayName.split(' ');
    await setDoc(ref, {
      uid: result.user.uid,
      email: result.user.email ?? '',
      username: result.user.email?.split('@')[0] ?? '',
      firstName: firstName ?? '',
      lastName: rest.join(' ') ?? '',
      dob: '',
      phone: '',
      photoURL: result.user.photoURL ?? '',
      location: '',
      createdAt: serverTimestamp(),
    });
  }

  return result;
};