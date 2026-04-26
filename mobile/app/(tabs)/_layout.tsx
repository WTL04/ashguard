import React, { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import * as Location from 'expo-location';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { db } from '@/lib/firebaseConfig';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface TabIconProps {
  icon: IoniconName;
  focused: boolean;
}

function TabIcon({ icon, focused }: TabIconProps) {
  const outlineName = `${icon}-outline` as IoniconName;
  return (
    <View style={styles.iconContainer}>
      {focused ? (
        <View style={styles.activeWrap}>
          <Ionicons name={icon} size={22} color={Colors.navActive} />
        </View>
      ) : (
        <Ionicons name={outlineName} size={22} color={Colors.navInactive} />
      )}
    </View>
  );
}

export default function TabsLayout() {
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    const auth = getAuth();

    // Wait for Firebase Auth to restore the session before doing anything
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        startLocationTracking(user.uid);
      }
    });

    return () => {
      unsubscribeAuth();
      locationSubscription.current?.remove();
    };
  }, []);

  const startLocationTracking = async (uid: string) => {
    try {
      console.log('[Location] Starting tracking for uid:', uid);

      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('[Location] Permission status:', status);
      if (status !== 'granted') return;

      const userRef = doc(db, 'users', uid);
      console.log('[Location] User ref path:', userRef.path);

      // Try last known position first (instant, no GPS needed)
      // Fall back to getCurrentPositionAsync if nothing cached yet
      let initial = await Location.getLastKnownPositionAsync({
        maxAge: 5 * 60 * 1000, // accept if less than 5 minutes old
      });

      if (!initial) {
        console.log('[Location] No cached position, requesting current...');
        initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
      }

      console.log('[Location] Got coords:', initial.coords.latitude, initial.coords.longitude);

      await updateDoc(userRef, {
        location: {
          latitude: initial.coords.latitude,
          longitude: initial.coords.longitude,
        },
        locationUpdatedAt: serverTimestamp(),
        locationSharingEnabled: true,
      });
      console.log('[Location] ✅ Firestore updated successfully');

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          distanceInterval: 50,
          timeInterval: 30_000,
        },
        async (loc) => {
          try {
            await updateDoc(userRef, {
              location: {
                latitude: loc.coords.latitude,
                longitude: loc.coords.longitude,
              },
              locationUpdatedAt: serverTimestamp(),
            });
            console.log('[Location] 🔄 Watch update written to Firestore');
          } catch (e) {
            console.log('[Location] ❌ Watch update error:', e);
          }
        }
      );
    } catch (e) {
      console.log('[Location] ❌ Tracking error:', e);
    }
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: Colors.navActive,
        tabBarInactiveTintColor: Colors.navInactive,
      }}
    >
      <Tabs.Screen
        name="map/maplibre"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="map" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="checklist"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="list" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="chatbubble" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="forum"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="people" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="settings" focused={focused} />,
        }}
      />
      {/* Hide resourcesSlider from being a tab */}
      <Tabs.Screen name="map/resourcesSlider" options={{ href: null }} />
      <Tabs.Screen name="map/searchSheet" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.navBg,
    borderTopColor: Colors.navBorder,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 82 : 64,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 24 : 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 10,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.navActiveBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
});