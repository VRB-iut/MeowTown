import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import CheckingPicture from './CheckingPicture';

import COLOR from '../global_vars/COLOR';
import IP from '../global_vars/IP';

export default function TakePicture({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const [screen, setScreen] = useState('camera');
  const [photoUri, setPhotoUri] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  const theme = darkMode ? COLOR.dark : COLOR.light;

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
    toggleDarkMode();
  }, [permission]);

  const toggleDarkMode = async () => {
    try {
      const id = await AsyncStorage.getItem("userId"); 
      if (!id) {
        router.replace("/LogInScreen");
        return;
      }

      const response = await fetch(`http://${IP}:3000/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id }),
      });
      const data = await response.json();
      if (data.success) {
        setDarkMode(data.user.darkMode);
      }
    } catch (error) {
      console.error("Error fetching dark mode status:", error);
    }


  }


  const takePhoto = async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 1, // Reducem puțin calitatea pentru viteză mai mare la upload
          skipProcessing: false,
          shutterSound: false,
        });
        
        // FOARTE IMPORTANT: Verificăm dacă avem uri
        if (photo && photo.uri) {
          setPhotoUri(photo.uri);
          setScreen('checking');
        }
      } catch (error) {
        console.error("Failed to take picture:", error);
      }
    }
  };

  if (!permission) return <View style={styles.container} />;

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ textAlign: 'center', color: '#fff' }}>Avem nevoie de permisiune pentru cameră</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.button}>
            <Text>Acordă Permisiune</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (screen === 'checking') {
    return <CheckingPicture imageUri={photoUri} goBack={() => setScreen('camera')} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <CameraView 
        style={[styles.camera, { borderColor: theme.primary || "#000" }]} 
        facing="back"
        ref={cameraRef} 
        muted={true}
      />
      <View style={styles.controls}>
        <TouchableOpacity onPress={takePhoto} style={styles.captureBtn}>
          <View style={styles.innerCircle} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { 
    flex: 1,
    borderRadius: 50,
    borderBottomWidth: 3,
    borderLeftWidth: 1.25,
    borderRightWidth: 1.25
   },
  controls: {
    height: 100,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#000',
  },
  button: {
    backgroundColor: '#fff',
    padding: 15,
    margin: 20,
    borderRadius: 10,
    alignItems: 'center'
  }
});