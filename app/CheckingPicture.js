import React, { useEffect, useState } from "react";
import { View, Image, StyleSheet, TouchableOpacity, Text, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

import CustomLoading from "./CustomLoading";

import COLOR from "../global_vars/COLOR";
import IP from "../global_vars/IP";

export default function CheckingPicture({ imageUri, goBack }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [verdict, setVerdict] = useState(null);
  const [location, setLocation] = useState(null);
  const [darkMode, setDarkMode] = useState(COLOR.light);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    analyzePhoto();
    getLocation();
    toggleDarkMode();
  }, []);

  const getLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permisiune refuzată", "Nu putem obține locația.");
        return;
      }

      let loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      console.log("LOCATION:", loc.coords);
    } catch (err) {
      console.log("Eroare locație:", err);

      let lastLoc = await Location.getLastKnownPositionAsync({});
      if (lastLoc) {
        setLocation({
          latitude: lastLoc.coords.latitude,
          longitude: lastLoc.coords.longitude,
        });
      }
    }
  };

  const analyzePhoto = async (retryCount = 0) => {
  setIsAnalyzing(true);

  const formData = new FormData();
  formData.append("file", {
    uri: imageUri,
    name: "detection.jpg",
    type: "image/jpeg",
  });

  try {
    const response = await fetch(`http://${IP}:3000/check`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Server error");
    }

    const data = await response.json();

    setVerdict(data.isCat ? true : false);

  } catch (err) {
    console.log("Eroare analyze:", err);

    if (retryCount < 2) {
      console.log(`Retry... (${retryCount + 1})`);

      setTimeout(() => {
        analyzePhoto(retryCount + 1);
      }, 1000);

      return;}

    Alert.alert("Eroare", "Nu s-a putut analiza poza.");
    setVerdict(false);
  } finally {
    setIsAnalyzing(false);
  }
};

  const saveData = async () => {
    try {
      if (!location) {
        Alert.alert("Așteaptă", "Se obține locația...");
        return;
      }

      setIsAnalyzing(true);

      const userId = await AsyncStorage.getItem("userId");

      if (!userId || userId === "null") {
        await AsyncStorage.removeItem("userId");
        goBack();
        return;
      }

      const formData = new FormData();
      formData.append("userId", userId);
      formData.append("latitude", location.latitude.toString());
      formData.append("longitude", location.longitude.toString());

      formData.append("file", {
        uri: imageUri, 
        name: `post_${Date.now()}.jpg`,
        type: "image/jpeg",
      });

      const response = await fetch(`http://${IP}:3000/post`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        console.log("Server error:", text);
        throw new Error("Server error");
      }

      const data = await response.json();

      if (data.success) {
        goBack();
      } else {
        Alert.alert("Eroare", data.error || "Nu s-a putut salva.");
      }

    } catch (err) {
      console.log("Eroare post:", err);
      Alert.alert("Eroare", "Conexiune eșuată.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleDarkMode = async () => {
    try{
      const data = await fetch(`http://${IP}:3000/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: await AsyncStorage.getItem("userId"),
        }),
      });
      if (!data.ok) {
        throw new Error("Server error");
      }else {
        const json = await data.json();
        setDarkMode(!!json.users.darkMode);
      }
    }
    catch(err){
      console.log("Eroare toggle dark mode:", err);
    }
  };

  const theme = darkMode ? COLOR.dark : COLOR.light;

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.imageContainer, {borderColor: theme.secondary}]}>
        <Image source={{ uri: imageUri }} style={[styles.image, {borderColor: theme.secondary}]} resizeMode="contain" />
      </View>


            
      <View style={styles.resultArea}>

        {isAnalyzing ? (
          <View style={{ alignItems: "center" }}>
            <CustomLoading />
          </View>
        ) : verdict ? (
          <View style={{ width: '100%', height: '200%'}}>
            <View style={{ position: 'relative', width: '100%', marginBottom: 40 }}>
              <TouchableOpacity
                style={[styles.backButton]}
                onPress={goBack}
              >
                <Ionicons name="arrow-back" size={32} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.btn} onPress={saveData}>
                <Text style={styles.btnText}>Post</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={{ width: '100%', height: '200%'}}>
            <View style={{ position: 'relative', width: '100%' }}>
              <TouchableOpacity
                style={[styles.backButton]}
                onPress={goBack}
              >
                <Ionicons name="arrow-back" size={32} color="#fff" />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.tryAgainButton, { backgroundColor: "#e74c3c"}]} 
                onPress={analyzePhoto}
              >
                <Text >Try Again</Text>
              </TouchableOpacity>
            </View>
            <Text style={{ color: 'white', fontSize: 18, fontWeight: "bold", alignSelf: 'center', marginTop: 20 }}>No CAT detected!</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  imageContainer: {
    width: "90%",
    height: '56%',
    marginTop: '20%',
    alignSelf: 'center',
    borderWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 5,
    borderTopWidth: 0,
    borderRadius: 30,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: '100%',
    borderRadius: 50,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 5,
    borderColor: 'white',
  },
  backButton: {
    marginLeft: '5%',
    width: 55,
    height: 55,
    zIndex: 10,
    padding: 10,
    backgroundColor: "red",
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#fff",
  },
  resultArea: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    alignItems: "center",
  },
  btn: {
    position: 'absolute',
    justifyContent: 'center',
    alignSelf: 'center',
    alignContent : 'center',  
    backgroundColor: "#2ecc71",
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  btnText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  tryAgainButton: {
    position: 'absolute',
    justifyContent: 'center',
    alignSelf: 'center',
    alignContent : 'center',
    padding: 15,
    backgroundColor: "red",
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#fff",
  },
});