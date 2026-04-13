import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import IonIcons from '@expo/vector-icons/Ionicons';

import BackButtonPossition from './backButton';
import CustomLoading from './CustomLoading';

import COLOR from '../global_vars/COLOR';
import IP from '../global_vars/IP';



export default function SettingsScreen() {
  const router = useRouter();
  const [darkModePressed, setDarkModePressed] = React.useState(true);
  const [backButtonPossition, setBackButtonPossition] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

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

    const getBackButtonPosition = async () => {
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
      return !!data.user?.backButtonPossition;
    } catch (error) {
      console.error('Error fetching back button position:', error);
      return false;
    }
  };

   React.useEffect(() => {
    const fetchSettings = async () => {
      const isDarkMode = await getDarkModeStatus();
      const backButtonPos = await getBackButtonPosition();
      setDarkModePressed(isDarkMode);
      setBackButtonPossition(backButtonPos);
      setLoading(false);
    };
    fetchSettings();
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

  const handleBackButtonPossition = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if( !userId) return;

      const response = await fetch(`http://${IP}:3000/users/back-button`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      if (data?.success) {
        setBackButtonPossition(!!data.backButtonPossition);
      }
    } catch (error) {
      console.error('Error toggling back button position:', error);
    }
  }


  if (loading) {
    return (
      <CustomLoading />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      
      <BackButtonPossition onBack={'Profile'} />

      <Text style={[styles.title, {color: theme.primary,}]}>Settings</Text>

      <View style={{ borderBottomWidth: 2.5, borderBottomColor: theme.primary, width: '100%', margin: '2%' }} />

      <TouchableOpacity  style={styles.darkModeButtonContainer} onPress={handleToggleDarkMode} >
        <Text style={[styles.darkModeText, { color: theme.primary }]}>Toggle Dark Mode</Text>

        <View style={[styles.darkModeButton, { borderColor: theme.primary }]}>
          <View style={[darkModePressed && styles.darkModeButtonActive, {backgroundColor: theme.primary,}]} />
        </View>
      </TouchableOpacity>


      <View style={{ borderBottomWidth: 2.5, borderBottomColor: theme.primaryDark, width: '95%', margin: '2%', alignSelf: 'center' }} />

      <View  style={styles.darkModeButtonContainer}>
        <Text style={[styles.darkModeText, { color: theme.primary }]}>Change back button position</Text>

        <View style = {[styles.buttonPossitionContainer, { flexDirection: 'row' }]}>
          <TouchableOpacity style={[styles.buttonPossitionUp, backButtonPossition ? { 
              backgroundColor: theme.primary,
              borderTopLeftRadius: 10,
              borderBottomLeftRadius: 10,
              borderWidth: 1,
              borderColor: darkModePressed ? 'white' : 'black',
            } : {
              borderWidth: 1,
              borderColor: darkModePressed ? 'white' : 'black',
            }]} onPress={backButtonPossition ? undefined : handleBackButtonPossition}>
            <IonIcons name="chevron-up" size={24} color={backButtonPossition ? 'white' : theme.primary} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.buttonPossitionDown, !backButtonPossition ? { 
              backgroundColor: theme.primary,
              borderTopRightRadius: 10,
              borderBottomRightRadius: 10,
              borderWidth: 1,
              borderColor: darkModePressed ? 'white' : 'black', 
            } : {
              borderWidth: 1,
              borderColor: darkModePressed ? 'white' : 'black',
            }]} onPress={!backButtonPossition ? undefined : handleBackButtonPossition}>
            <IonIcons name="chevron-down" size={24} color={!backButtonPossition ? 'white' : theme.primary} />
          </TouchableOpacity>
        </View>
      </View>


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
    marginBottom: '5%',
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
    marginTop: '5%',
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
  },
  buttonPossitionContainer: {
    width: '25%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonPossitionUp: {
    alignItems: 'center',
    width: '50%',
    padding: 2.5,
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
  },
  buttonPossitionDown: {
    alignItems: 'center',
    width: '50%',
    padding: 2.5,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  slideBackContainer: {
    position: 'absolute',
    width: 180,
    height: 66,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  slideKnob: {
    position: 'absolute',
    right: -47 * 3,
    borderWidth: 3,
    borderTopLeftRadius: 21,
    borderBottomLeftRadius: 21,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backButtonTop: {
    position: 'absolute',
    zIndex: 10,
  },

});