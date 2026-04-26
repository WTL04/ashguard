<<<<<<< HEAD
import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChecklistProvider } from '@/context/checklistContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // allows react native to detech gestures (like swipes and drags)
=======
import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
>>>>>>> 0670bd0 (Push notification and settings design overhaul)

export default function RootLayout() {
  useEffect(() => {
    const handleNotificationTap = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;

      console.log('🔔 TAP RESPONSE FULL:', JSON.stringify(response, null, 2));
      console.log('🔔 TAP DATA:', JSON.stringify(data, null, 2));

      const screen =
        typeof data?.screen === 'string' ? data.screen : null;
      const threadId =
        typeof data?.threadId === 'string' ? data.threadId : null;

      if (screen) {
        console.log('➡️ PUSHING SCREEN:', screen);
        router.push(screen as any);
        return;
      }

      if (threadId) {
        const route = `/forum/${threadId}`;
        console.log('➡️ PUSHING THREAD ROUTE:', route);
        router.push(route as any);
      }
    };

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        console.log('🟡 FOUND LAST NOTIFICATION RESPONSE');
        handleNotificationTap(response);
      } else {
        console.log('⚪ NO LAST NOTIFICATION RESPONSE');
      }
    });

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log('🟢 NOTIFICATION TAPPED WHILE APP OPEN/BACKGROUND');
      handleNotificationTap(response);
    });

    return () => sub.remove();
  }, []);

  return (
<<<<<<< HEAD
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ChecklistProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
        </Stack>
      </ChecklistProvider>
    </GestureHandlerRootView>
=======
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="forum" />
      </Stack>
    </>
>>>>>>> 0670bd0 (Push notification and settings design overhaul)
  );
}
