import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { View, Image, StyleSheet, TouchableOpacity, Text, Alert, Animated, PanResponder } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

import CustomLoading from "./CustomLoading";

import COLOR from "../global_vars/COLOR";
import IP from "../global_vars/IP";

export default function CheckingPicture({ imageUri, goBack }) {
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [verdict, setVerdict] = useState(null);
  const [checkResult, setCheckResult] = useState(null);
  const [sameCatLocked, setSameCatLocked] = useState(false);
  const [location, setLocation] = useState(null);
  const [darkMode, setDarkMode] = useState(COLOR.light);
  const [backButtonPossition, setBackButtonPossition] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    const init = async () => {
      const currentLocation = await getLocation();
      await analyzePhoto(0, currentLocation);
    };

    init();
    toggleDarkMode();
    getBackButtonPosition();
  }, []);

  const getBackButtonPosition = async () => {
    try {
      const userId = await AsyncStorage.getItem("userId");
      if (!userId) return;

      const response = await fetch(`http://${IP}:3000/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      setBackButtonPossition(!!data.user?.backButtonPossition);
    } catch (error) {
      console.error("Error fetching back button position:", error);
    }
  };

  const getLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permisiune refuzată", "Nu putem obține locația.");
        return null;
      }

      let loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };

      setLocation(coords);

      console.log("LOCATION:", loc.coords);
      return coords;
    } catch (err) {
      console.log("Eroare locație:", err);

      let lastLoc = await Location.getLastKnownPositionAsync({});
      if (lastLoc) {
        const coords = {
          latitude: lastLoc.coords.latitude,
          longitude: lastLoc.coords.longitude,
        };

        setLocation(coords);
        return coords;
      }

      return null;
    }
  };

  const analyzePhoto = async (retryCount = 0, providedLocation = null) => {
  setIsAnalyzing(true);


  const formData = new FormData();
  formData.append("file", {
    uri: imageUri,
    name: "detection.jpg",
    type: "image/jpeg",
  });

  const targetLocation = providedLocation || location;
  if (targetLocation?.latitude && targetLocation?.longitude) {
    formData.append("latitude", targetLocation.latitude.toString());
    formData.append("longitude", targetLocation.longitude.toString());
  }

  try {
    const response = await fetch(`http://${IP}:3000/check`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Server error");
    }

    const data = await response.json();
    const nextSameCat = !!data.isSameCat || sameCatLocked;

    if (nextSameCat && !sameCatLocked) {
      setSameCatLocked(true);
    }

    setVerdict(!!data.isCat);
    setCheckResult((prev) => ({
      ...(prev || {}),
      ...data,
      isSameCat: nextSameCat,
    }));

  } catch (err) {
    console.log("Eroare analyze:", err);

    if (retryCount < 2) {
      console.log(`Retry... (${retryCount + 1})`);

      setTimeout(() => {
        analyzePhoto(retryCount + 1, targetLocation);
      }, 1000);

      return;}

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
      if (checkResult?.embedding) {
        formData.append("embedding", checkResult.embedding);
      }

      formData.append("file", {
        uri: imageUri,
        name: `post_${Date.now()}.jpg`,
        type: "image/jpeg",
      });

      const response = await fetch(`http://${IP}:3000/post`, {
        method: "POST",
        body: formData,
        isSameCat: checkResult?.isSameCat || false,
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


  const sliderWidth = 180;
  const knobSize = 47;
  const maxSlide = sliderWidth - knobSize - 4;
  const slideX = useRef(new Animated.Value(0)).current;

  const resetSlider = useCallback(() => {
    Animated.spring(slideX, {
      toValue: 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 8,
    }).start();
  }, [slideX]);

  const triggerBack = useCallback(() => {
    setIsAnalyzing(false);
    goBack();
    slideX.setValue(0);
  }, [goBack, slideX]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          gestureState.dx < -3 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_, gestureState) => {
          const clampedX = Math.max(-maxSlide, Math.min(gestureState.dx, 0));
          slideX.setValue(clampedX);
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx <= -maxSlide * 0.7) {
            triggerBack();
          } else {
            resetSlider();
          }
        },
        onPanResponderTerminate: resetSlider,
      }),
    [maxSlide, resetSlider, slideX, triggerBack]
  );


  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.imageContainer, {borderColor: theme.secondary}]}>
        <Image source={{ uri: imageUri }} style={[styles.image, {borderColor: theme.secondary}]} resizeMode="contain" />
      </View>

      {backButtonPossition ? (
        <TouchableOpacity
          style={[
            styles.backButtonTop,
            {
              marginTop: insets.top + 10,
              marginLeft: "5%",
            },
          ]}
          onPress={triggerBack}
        >
          <Ionicons name="chevron-back" size={24} color="white" />
        </TouchableOpacity>
      ) : (
        <View
          style={[
            styles.slideBackContainer,
            {
              bottom: '17.5%',
              right: '0%',
            },
          ]}
        >
          <Animated.View
            style={[
              styles.slideKnob,
              {
                width: knobSize * 4,
                height: knobSize,
                backgroundColor: theme.primary,
                borderColor: 'white',
                transform: [{ translateX: slideX }],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <Ionicons style={{ marginLeft: 5 }} name="arrow-back" size={24} color={'white'} />
          </Animated.View>
        </View>
      )}
            
      <View style={styles.resultArea}>

        {isAnalyzing ? (
          <View style={{ alignItems: "center" }}>
            <CustomLoading />
          </View>
        ) : verdict ? (
          <View style={{ width: '100%', height: '200%'}}>
            <View style={{ position: 'relative', width: '100%', marginBottom: 40 }}>
              <TouchableOpacity style={styles.btn} onPress={saveData}>
                <Text style={styles.btnText}>Post</Text>
              </TouchableOpacity>
              {checkResult?.isSameCat && (
                <Text style={{ color: theme.primary, fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginTop: 20 }}>
                  Same cat already posted in the area!
                </Text>
              )}
            </View>
          </View>
        ) : (
          <View style={{ width: '100%', height: '200%'}}>
            <View style={{ position: 'relative', width: '100%' }}>
              <TouchableOpacity 
                style={[styles.tryAgainButton, { backgroundColor: "#e74c3c"}]} 
                onPress={() => analyzePhoto()}
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
    justifyContent: 'center',
    alignSelf: 'center',
    alignContent : 'center',
    padding: 15,
    backgroundColor: "red",
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#fff",
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
    borderWidth: 2,
    borderTopLeftRadius: 21,
    borderBottomLeftRadius: 21,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backButtonTop: {
    position: 'absolute',
    zIndex: 10,
  }
});