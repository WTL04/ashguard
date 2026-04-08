import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChecklistProvider } from '@/context/checklistContext';

// Root Layout
export default function RootLayout() {
  return (
    <ChecklistProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </ChecklistProvider>
  );
}