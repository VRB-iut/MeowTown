import { Stack } from 'expo-router';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          // Aceasta este linia magică:
          contentStyle: { backgroundColor: '#000' }, 
          headerShown: false,
        }}
      />
    </View>
  );
}