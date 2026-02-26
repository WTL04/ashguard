import React from 'react';
import { Tabs } from 'expo-router';
import { View, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';

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
        name="map"
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
          tabBarIcon: ({ focused }) => <TabIcon icon="people" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="forum"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon icon="chatbubble" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon icon="settings" focused={focused} />,
        }}
      />
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