import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChecklistProvider } from '@/context/checklistContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // allows react native to detech gestures (like swipes and drags)

// Root Layout
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ChecklistProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ChecklistProvider>
    </GestureHandlerRootView>
  );
}