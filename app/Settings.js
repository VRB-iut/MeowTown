import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import COLOR from '../global_vars/COLOR';
import IP from '../global_vars/IP';



export default function SettingsScreen() {
  const router = useRouter();
  const [darkModePressed, setDarkModePressed] = React.useState(false);

  const theme = darkModePressed ? COLOR.dark : COLOR.light;

  const handleLogout = async () => {
    await AsyncStorage.removeItem('userId');
    router.replace('/LogInScreen');
  };

  const getDarkModeStatus = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return false;
      const response = await fetch(`http://${IP}:3000/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      return data.user?.darkMode || false;
    } catch (error) {
      console.error('Error fetching dark mode status:', error);
      return false;
    }
  };

   React.useEffect(() => {
    const fetchDarkMode = async () => {
      const isDarkMode = await getDarkModeStatus();
      setDarkModePressed(isDarkMode);
    };
    fetchDarkMode();
  }, []);

  const handleToggleDarkMode = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) return;
      await fetch(`http://${IP}:3000/users/dark-mode`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      setDarkModePressed(!darkModePressed);
    } catch (error) {
      console.error('Error toggling dark mode:', error);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, {color: theme.primary,}]}>Settings</Text>

      <View style={{ borderBottomWidth: 2.5, borderBottomColor: theme.primary, width: '100%', margin: '2%' }} />

      <TouchableOpacity  style={styles.darkModeButtonContainer} onPress={handleToggleDarkMode} >
        <Text style={[styles.darkModeText, { color: theme.primary }]}>Toggle Dark Mode</Text>

        <View style={[styles.darkModeButton, { borderColor: theme.primary }]}>
          <View style={[darkModePressed && styles.darkModeButtonActive, {backgroundColor: theme.primary,}]} />
        </View>
      </TouchableOpacity>


      <View style={{ borderBottomWidth: 2.5, borderBottomColor: theme.primary, width: '100%', margin: '2%' }} />

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    marginBottom: 30,
    fontWeight: 'bold',
    alignSelf: 'center',
  },
  logoutButton: {
    backgroundColor: 'red',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 70,
  },
  logoutText: {
    alignSelf: 'center',
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  darkModeButtonContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
    paddingVertical: 15,
    marginTop: 30,
  },
  darkModeText: {
    alignSelf: 'flex-start',
    fontSize: 18,
    fontWeight: 'bold',
  },
  darkModeButton: {
    alignSelf: 'flex-end',
    borderWidth: 3,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  darkModeButtonActive: {
    width: 24,
    height: 24,
    borderRadius: 12,
  }

});