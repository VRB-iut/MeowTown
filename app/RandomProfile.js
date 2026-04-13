import { useCallback, useState } from 'react';
import { View, Text, Image, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

import BackButtonPossition from './backButton';
import CustomLoading from './CustomLoading';
import COLOR from '../global_vars/COLOR';
import IP from '../global_vars/IP';

export default function RandomProfile() {
  const router = useRouter();
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


  if (loading) return <CustomLoading />;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <BackButtonPossition />

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
          <TouchableOpacity
            style={styles.gridImageContainer}
            activeOpacity={0.85}
            onPress={() => router.push({
              pathname: '/RandomPicture',
              params: {
                userId: userData.id.toString(),
                postId: item.id.toString(),
              },
            })}
          >
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
});
