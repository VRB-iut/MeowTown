import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, Image, FlatList, StyleSheet, TouchableOpacity, Animated, PanResponder } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import CustomLoading from './CustomLoading';
import COLOR from '../global_vars/COLOR';
import IP from '../global_vars/IP';

export default function RandomProfile() {
  const [loading, setLoading] = useState(true);
  const [darkModePressed, setDarkModePressed] = useState(false);

  const params = useLocalSearchParams();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const [userData, setUserData] = useState(null);

  const fetchUserData = async () => {
    if (!userId) {
      setUserData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`http://${IP}:3000/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      const data = await response.json();
      if (data.success && data.user) {
        setUserData(data.user);
      } else {
        setUserData(null);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      setUserData(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUserTheme = async () => {
    try {
      const currentId = await AsyncStorage.getItem('userId');
      if (!currentId) return;

      const response = await fetch(`http://${IP}:3000/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentId }),
      });

      const data = await response.json();
      if (data.success && data.user) {
        setDarkModePressed(!!data.user.darkMode);
      }
    } catch (error) {
      console.error('Error fetching current user ID:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUserData();
      fetchCurrentUserTheme();
    }, [userId])
  );



  const theme = darkModePressed ? COLOR.dark : COLOR.light;
  const insets = useSafeAreaInsets();
  const router = useRouter();

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
    router.back();
    slideX.setValue(0);
  }, [router, slideX]);

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


  if (loading) return <CustomLoading />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      
      <View
        style={[
          styles.slideBackContainer,
          {
            bottom: '12.5%',
            right: '0%',
            borderColor: theme.secondary,
            backgroundColor: theme.background,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.slideKnob,
            {
              width: knobSize * 4,
              height: knobSize,
              backgroundColor: '#ff3232',
              transform: [{ translateX: slideX }],
            },
          ]}
          {...panResponder.panHandlers}
        >
          <Ionicons style={{ marginLeft: 5 }} name="arrow-back" size={24} color={theme.background} />
        </Animated.View>
      </View>

      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <Text style={[styles.username, { color: theme.primary, borderColor: theme.primary }]}>{userData?.username}</Text>
        <View style={styles.ProfileInfo}>
          <View style={{ backgroundColor: theme.primary, width: 100, height: 100, position: 'absolute', left: '5%' }} />
          <Image
            source={userData?.profilePictureUrl ? { uri: userData.profilePictureUrl } : require('../assets/defaultProfilePicture.png')}
            style={styles.profilePic}
          />
          <View style={styles.PointsContainer}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={require('../assets/catPoints.png')} style={{ width: 32, height: 32 }} />
              <Text style={[styles.pointsText, { color: theme.primary }]}>: {userData?.catPoints || 0}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Image source={require('../assets/dogPoints.png')} style={{ width: 32, height: 32 }} />
              <Text style={[styles.pointsText, { color: theme.primary }]}>: {userData?.dogPoints || 0}</Text>
            </View>
          </View>
        </View>
        <Text style={[styles.stats, { color: theme.secondary }]}>{userData?.posts?.length || 0} Posts</Text>
      </View>

      <View style={[styles.divider, { borderBottomColor: theme.secondary }]} />
 
      <FlatList
        data={userData?.posts}
        keyExtractor={(item) => item.id.toString()}
        numColumns={3}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.gridImageContainer}>
            <Image source={{ uri: `http://${IP}:3000/${item.imageUrl}` }} style={styles.gridImage} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={[styles.emptyListText, { color: theme.secondary }]}>Nu are nicio postare încă.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  divider: {
    borderBottomWidth: 2,
    marginVertical: 1,
    alignSelf: 'center',
    width: '95%',
  },
  header: {
    padding: 20,
    paddingBottom: 1,
  },
  ProfileInfo: {
    position: 'relative',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: 100,
    marginBottom: 15,
  },
  profilePic: {
    position: 'absolute',
    alignSelf: 'center',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#eee',
  },
  PointsContainer: {
    position: 'absolute',
    right: '15%',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pointsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginVertical: 2,
  },
  username: {
    alignSelf: 'center',
    fontWeight: 'bold',
    fontSize: 32,
    marginBottom: 15,
    borderBottomWidth: 2,
  },
  stats: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  gridImageContainer: {
    width: '33.33%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  emptyState: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 16,
  },
  emptyListText: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: 16,
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
});
