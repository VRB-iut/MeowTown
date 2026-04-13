import { StyleSheet, View, Text, Image, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import CustomLoading from './CustomLoading';

import COLOR from '../global_vars/COLOR';
import IP from '../global_vars/IP';

export default function ProfileScreen() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkModePressed, setDarkModePressed] = useState(false);

  const theme = darkModePressed ? COLOR.dark : COLOR.light;

  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const fetchProfileData = useCallback(async () => {
    setLoading(true);
    try {
      const userId = await AsyncStorage.getItem("userId");
      if (!userId) {
        setUserData(null);
        return;
      }

      const response = await fetch(`http://${IP}:3000/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userId }),
      });

      const data = await response.json();

      if (data.success) {
        setUserData(data.user);
        setDarkModePressed(data.user.darkMode);
      } else {
        setUserData(null);
      }
    } catch (error) {
      console.error("Eroare la încărcarea profilului:", error);
      setUserData(null);
    } finally {
      setLoading(false);
    }
  }, []);


  useFocusEffect(
    useCallback(() => {
      fetchProfileData();
    }, [fetchProfileData])
  );

  if (loading) return <CustomLoading />;


  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.background }]}>
        <Text style={[styles.username, { color: theme.primary, borderColor: theme.primary }]}>  {userData?.username}  </Text>
        <View style={styles.ProfileInfo}>
          <View style={{backgroundColor: theme.debugging, width: 100, height: 100, position: 'absolute', left: '5%'}}></View>
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
              <Image source={require('../assets/dogPoints.png')} style={{ width: 32, height: 32}} />
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
        ListEmptyComponent={<Text style={[styles.emptyListText, { color: theme.secondary }]}>Nu ai nicio postare încă.</Text>}
      />

      <TouchableOpacity style={{ position: 'absolute', top: insets.top + 5, right: 15}}onPress={() => router.push('/Settings')}>
        <Ionicons name="settings-outline" size={28} color={theme.primary}  />
      </TouchableOpacity>
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
    fontSize: 22,
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
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: 8,
  },
  emptyListText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    color: '#999',
  }
});
