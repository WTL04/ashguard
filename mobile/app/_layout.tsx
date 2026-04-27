import 'react-native-gesture-handler';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChecklistProvider } from '@/context/checklistContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from "@/context/loginContext";
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

function InitialLayout() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  
  const [isCheckingFlag, setIsCheckingFlag] = useState(true);

  useEffect(() => {
    const checkNavigation = async () => {
      const hasFlag = await AsyncStorage.getItem('user_logged_in');
      setIsCheckingFlag(false); 

      if (loading) return;

      const inAuth = segments[0] === "(auth)";

      if (!user && hasFlag !== 'true' && !inAuth) {
        router.replace("/(auth)/login");
      } else if ((user || hasFlag === 'true') && inAuth) {
        router.replace("/(tabs)/map");
      }
    };

    checkNavigation();
  }, [user, loading, segments]);

  if (loading || isCheckingFlag) {
    return null; 
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ChecklistProvider>
          <StatusBar style="dark" />
          <InitialLayout />
        </ChecklistProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

// Root Layout
//export default function RootLayout() {
 // return (
//    <GestureHandlerRootView style={{ flex: 1 }}>
//      <ChecklistProvider>
//        <StatusBar style="dark" />
//        <Stack screenOptions={{ headerShown: false }}>
//          <Stack.Screen name="(auth)" />
//          <Stack.Screen name="(tabs)" />
//        </Stack>
//     </ChecklistProvider>
//    </GestureHandlerRootView>
//  );
//}