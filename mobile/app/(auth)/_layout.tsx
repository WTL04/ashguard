import { Stack } from 'expo-router';

// Simple stack navigator for auth screens.

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
      }}
    />
  );
}