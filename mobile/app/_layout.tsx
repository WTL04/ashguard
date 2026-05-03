import "react-native-gesture-handler";
import { useEffect, useState } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { ChecklistProvider } from "@/context/checklistContext";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { AuthProvider, useAuth } from "@/context/loginContext";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
        router.replace("/(tabs)/map/maplibre");
      }
    };

    checkNavigation();
  }, [user, loading, segments]);

  useEffect(() => {
    const handleNotificationTap = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;

      console.log("🔔 TAP RESPONSE FULL:", JSON.stringify(response, null, 2));
      console.log("🔔 TAP DATA:", JSON.stringify(data, null, 2));

      const screen = typeof data?.screen === "string" ? data.screen : null;
      const threadId = typeof data?.threadId === "string" ? data.threadId : null;

      if (screen) {
        console.log("➡️ PUSHING SCREEN:", screen);
        router.push(screen as any);
        return;
      }

      if (threadId) {
        const route = `/forum/${threadId}`;
        console.log("➡️ PUSHING THREAD ROUTE:", route);
        router.push(route as any);
      }
    };

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        console.log("🟡 FOUND LAST NOTIFICATION RESPONSE");
        handleNotificationTap(response);
      } else {
        console.log("⚪ NO LAST NOTIFICATION RESPONSE");
      }
    });

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      console.log("🟢 NOTIFICATION TAPPED WHILE APP OPEN/BACKGROUND");
      handleNotificationTap(response);
    });

    return () => sub.remove();
  }, []);

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