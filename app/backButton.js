import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Animated, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import IonIcons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

import IP from '../global_vars/IP';
import COLOR from '../global_vars/COLOR';

export default function BackButton({
  onBack, 
  sliderBottom = '17.5%',
  sliderRight = '0%',
  topMargin = 10,
  leftMargin = '5%',
}) {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [backButtonPossition, setBackButtonPossition] = useState(false);
  const [darkModePressed, setDarkMode] = useState(false);

  const fetchUserData = useCallback(async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      if (!userId) {
        setDarkMode(false);
        setBackButtonPossition(false);
        return;
      }

      const response = await fetch(`http://${IP}:3000/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();
      setDarkMode(!!data.user?.darkMode);
      setBackButtonPossition(!!data.user?.backButtonPossition);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setDarkMode(false);
      setBackButtonPossition(false);
    }
  }, []);

  const theme = darkModePressed ? COLOR.dark : COLOR.light;

  const sliderWidth = 180;
  const knobSize = 47;
  const maxSlide = sliderWidth - knobSize - 4;
  const slideX = useRef(new Animated.Value(0)).current;

  const triggerBack = useCallback(() => {
    Animated.timing(slideX, {
    toValue: 0,
    duration: 0,
    useNativeDriver: true,
  }).start();
  if (onBack && typeof onBack === 'string') {
    navigation.navigate('Dashboard', { screen: onBack.replace(/^\//, '').trim() });
  } else {
    router.back();
  }
  }, [navigation, onBack, router, slideX]);

  const resetSlider = useCallback(() => {
    Animated.spring(slideX, {
      toValue: 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 8,
    }).start();
  }, [slideX]);

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

  useEffect(() => {
    fetchUserData();

    const intervalId = setInterval(fetchUserData, 1500);
    return () => clearInterval(intervalId);
  }, [fetchUserData]);

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
    }, [fetchUserData])
  );

  const iconColor = darkModePressed ? 'white' : theme.primary;
  const sliderBackground = theme?.primary;
  const sliderIconColor = 'white';
  const sliderContainerBorder = 'white';
  const sliderContainerBackground = 'transparent';

  if (backButtonPossition) {
    return (
      <TouchableOpacity
        style={[
          styles.backButtonTop,
          {
            marginTop: insets.top + topMargin,
            marginLeft: leftMargin,
          },
        ]}
        onPress={triggerBack}
      >
        <IonIcons name="chevron-back" size={30} color={theme.primary} />
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.slideBackContainer,
        {
          bottom: sliderBottom,
          right: sliderRight,
          borderColor: sliderContainerBorder,
          backgroundColor: sliderContainerBackground,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.slideKnob,
          {
            width: knobSize * 4,
            height: knobSize,
            backgroundColor: sliderBackground,
            transform: [{ translateX: slideX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <IonIcons style={{ marginLeft: 5 }} name="arrow-back" size={24} color={sliderIconColor} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  slideBackContainer: {
    position: 'absolute',
    width: 180,
    height: '17.5%',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  slideKnob: {
    position: 'absolute',
    right: -47 * 3,
    borderWidth: 3,
    borderColor: 'white',
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
