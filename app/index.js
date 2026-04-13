import AsyncStorage from '@react-native-async-storage/async-storage';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import * as Location from 'expo-location'; // Importă locația
import { Camera } from 'expo-camera'; // Importă camera

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(null);
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  useEffect(() => {
    const prepareApp = async () => {
      await requestAllPermissions();
      await checkLoginStatus();
    };

    prepareApp();
  }, []);

  const requestAllPermissions = async () => {
    try {
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();

      if (cameraStatus !== 'granted' || locationStatus !== 'granted') {
        Alert.alert(
          "Permisiuni necesare",
          "Aplicația are nevoie de acces la cameră și locație pentru a funcționa corect."
        );
        setPermissionsGranted(false);
      } else {
        setPermissionsGranted(true);
      }
    } catch (err) {
      console.warn("Eroare la cererea permisiunilor:", err);
    }
  };

  const checkLoginStatus = async () => {
    const userId = await AsyncStorage.getItem('userId');
    if (!userId || userId === "null") {
      setIsLoggedIn(false);
    } else { 
      setIsLoggedIn(true);
    }
  };

  if (isLoggedIn === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return isLoggedIn ? <Redirect href="/Dashboard" /> : <Redirect href="/LogInScreen" />;
}