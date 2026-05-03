import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/lib/firebaseConfig';

const loginContext = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Real Firebase session restored — use it
        setUser(firebaseUser);
        await AsyncStorage.setItem('user_logged_in', 'true');
      } else {
        // No Firebase session — check the flag
        const hasFlag = await AsyncStorage.getItem('user_logged_in');
        if (hasFlag === 'true') {
          // Flag says they were logged in, keep them in until Firebase catches up
          // Don't clear the user — leave whatever state it's in
        } else {
          // Genuinely logged out
          setUser(null);
        }
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <loginContext.Provider value={{ user, loading }}>
      {children}
    </loginContext.Provider>
  );
};

export const useAuth = () => useContext(loginContext);