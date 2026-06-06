import { FlatList, StyleSheet, Text, View, Image, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from "@expo/vector-icons";
import * as Location from 'expo-location';
import { useFocusEffect } from '@react-navigation/native';

import TakePicture from './TakePicture';
import ProfileScreen from './Profile';
import SearchScreen from './SearchScreen';
import CustomLoading from './CustomLoading';

import COLOR, { applyPureBlack } from '../global_vars/COLOR';
import IP from '../global_vars/IP';


const LeaderBoradScreen = ({ users, theme }) => {
  if (!users || users.length === 0) return null;

  const router = useRouter();

  console.log("Leaderboard users:", users);

  return (
    <View style={{ padding: 15, backgroundColor: theme.background }}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={users}
        keyExtractor={(item) => item.id?.toString() || item.userId?.toString()}
        renderItem={({ item }) => (
          <View style={{ marginRight: 25, alignItems: 'center' }}>
            <View style={styles.avatarContainer}>
              <TouchableOpacity onPress={() => router.push({ pathname: '/RandomProfile', params: { userId: item.id?.toString() } })}>   
                <Image
                  source={item.profilePictureUrl ? { uri: `http://${IP}:3000/${item.profilePictureUrl}` } : require('../assets/defaultProfilePicture.png')}
                  style={styles.profileTopPicture}
                />
              </TouchableOpacity>

              <View style={styles.badgeWrapper}>
                <Image 
                  source={require('../assets/catPoints.png')} 
                  style={styles.catPointsIcon} 
                />
                <Text style={[styles.catPointsText, { color: 'black' }]}>
                  {item.catPoints || 0}
                </Text>
              </View>
            </View>

            <Text style={{ color: theme.text, fontSize: 14, marginTop: 5, fontWeight: '500' }}>
              {item.username}
            </Text>
          </View> 
        )}
      />
      <View style={[styles.separatorHeader, { marginTop: 15, backgroundColor: theme.primary, borderColor: theme.primary }]} />
    </View>
  );
}

const PostItem = ({ item, handleLike, addressCache, getCountry, theme, userId }) => {
  const router = useRouter();
  const [catFound, setCatFound] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });


  useEffect(() => {
    if (item.latitude && item.longitude) {
      getCountry(item.latitude, item.longitude, item.id);
    }
  }, [item.latitude, item.longitude, item.id, getCountry]);

  const calculateDate = (createdAt) => {
    const postDate = new Date(createdAt);
    const now = new Date();
    const diffInSeconds = Math.floor((now - postDate) / 1000);

    if (diffInSeconds < 60) return `${diffInSeconds}sec ago`;
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes}min ago`;
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  const openMenu = (event) => {
    const { width, height } = Dimensions.get('window');
    const menuWidth = 150;
    const menuHeight = 62;
    const padding = 8;
    const x = Math.min(event.nativeEvent.pageX, width - menuWidth - padding);
    const y = Math.min(event.nativeEvent.pageY, height - menuHeight - padding);

    setMenuPosition({ x: Math.max(padding, x), y: Math.max(padding, y) });
    setMenuVisible(true);
  };

  return (
    <View style={[styles.postCard, { backgroundColor: theme.background }]}>
      <View>
        <View style={styles.postHeader}>
          <TouchableOpacity onPress={() => router.push({ pathname: '/RandomProfile', params: { userId: item.userId.toString() } })}>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'center' }}>
 
              <Image
                source={item.user?.profilePictureUrl ? { uri: item.user.profilePictureUrl } : require('../assets/defaultProfilePicture.png')}
                style={{ width: 40, height: 40, borderRadius: 20, marginRight: 10 }}
              />

              <View style={{ flexDirection: 'column', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <Text style={[styles.username, { color: theme.text }]}>
                  {item.user?.username || "Loading..."}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="location-outline" color={theme.gray} />
                  <Text style={{ color: theme.gray, fontSize: 12 }}>
                    {addressCache[item.id] || "Loading location..."}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.postMenuButton, { borderColor: theme.primary }]}
            onPress={openMenu}
          >
            <Ionicons name="ellipsis-vertical" size={16} color={theme.primary} />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        transparent
        visible={menuVisible}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.menuOverlay}
          onPress={() => setMenuVisible(false)}
        >
          <View
            style={[
              styles.menuContent,
              {
                backgroundColor: theme.background,
                left: menuPosition.x,
                top: menuPosition.y,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMenuVisible(false);
                console.log('Report post:', item.id);
              }}
            >
              <Text style={[styles.menuItemText, { color: 'red' }]}>Fake Cat</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <View>
        <Image
          source={{ uri: `http://${IP}:3000/${item.imageUrl}` }}
          style={[styles.postImage]}
          resizeMode="cover"
        />
        {item.sameCat && (
          console.log("Post with same cat detected:", item.id, "Same cat:", item.sameCat),
          catFound ? (
            <TouchableOpacity
              onPress={() => setCatFound(prev => !prev)}
              activeOpacity={0.8}
              style={[styles.sameCatBorderFound, { backgroundColor: theme.debugging }]}
            >
              <Text style={{ color: 'white', fontSize: 14, alignSelf: 'center', marginTop: 1 }}>
                Same cat already posted in the area by {item.byWho || 'unknown'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => setCatFound(prev => !prev)}
              activeOpacity={0.8}
              style={[styles.sameCatBorder, { backgroundColor: theme.debugging }]}
            />
          )
        )}
      </View>

      {userId == item.userId ? (
        <View style={styles.postOptions}>
          <Ionicons
          name='heart'
          size={40}
          color={theme.usersPost}
          />
          <Text style={[styles.likes, { color: theme.usersPost }]}>{item.likes}</Text>
        </View>
        ) : (
      <View style={styles.postOptions}>
        <TouchableOpacity onPress={() => handleLike(item.id)}>
          <Ionicons
            name={item.likedByUser ? 'heart' : 'heart-outline'}
            size={40}
            color={item.likedByUser ? theme.primaryDark : theme.primary}
          />
        </TouchableOpacity>
        <Text style={[styles.likes, { color: theme.primaryDark }]}>{item.likes}</Text>
      </View>
        )}


      <View style={{ marginLeft: '2%', marginBottom: 5 }}>
        <Text style={{ color: theme.gray }}>{calculateDate(item.createdAt)}</Text>
      </View>

      <View style={[styles.separator, { backgroundColor: theme.secondary, borderColor: theme.secondary }]} />
    </View>
  );
};


const HomeScreen = ({ theme }) => {
  const [dataPosts, setDataPosts] = useState([]);
  const [leaderboardUsers, setLeaderboardUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addressCache, setAddressCache] = useState({});
  const [currentUserId, setCurrentUserId] = useState(null);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const response = await fetch(`http://${IP}:3000/leaderboard`);
      const data = await response.json();

      if (data?.success && Array.isArray(data.users)) {
        setLeaderboardUsers(data.users);
      } else {
        setLeaderboardUsers([]);
      }
    } catch (err) {
      console.log("Eroare la fetch leaderboard:", err);
      setLeaderboardUsers([]);
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      setCurrentUserId(userId);
      const response = await fetch(`http://${IP}:3000/posts-for-dashboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await response.json();

      if (data.success) {
        setDataPosts(data.posts);
      } else {
        setDataPosts([]);
      }
    } catch (err) {
      console.log("Eroare la fetch posts:", err);
      setDataPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPosts();
      fetchLeaderboard();
    }, [fetchLeaderboard, fetchPosts])
  );

  const getCountry = async (lat, lon, postId) => {
    if (!lat || !lon) return;
    if (addressCache[postId]) return;

    try {
      let result = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lon
      });

      if (result.length > 0) {
        const locationName = `${result[0].city || ''}, ${result[0].country || ''}`;

        setAddressCache(prev => ({
          ...prev,
          [postId]: locationName
        }));
      }
    } catch (e) {
      console.log("Eroare geocoding:", e);
    }
  };

  const handleLike = async (postId) => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      const response = await fetch(`http://${IP}:3000/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, userId }),
      });

      const data = await response.json();

      if (data.success) {
        setDataPosts(prevPosts =>
          prevPosts.map(post =>
            post.id === postId
              ? { 
                  ...post, 
                  likes: data.likes,
                  likedByUser: data.liked
                }
              : post
          )
        );
      }
    } catch (err) {
      console.log("Eroare la like: ", err);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <CustomLoading />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={dataPosts}
        keyExtractor={(item) => item.id.toString()}
        onRefresh={async () => {
          await Promise.all([fetchPosts(), fetchLeaderboard()]);
        }}
        refreshing={loading}
        ListFooterComponent={
          <Text style={{ color: theme.gray, fontSize: 16, alignSelf: 'center', margin: 10 }}>I think you scrolled too much today!</Text>
        }
        ListHeaderComponent={
          <View>
            <LeaderBoradScreen users={leaderboardUsers} theme={theme} />
            <View style={[styles.Header, { borderColor: theme.secondary }]} />
          </View>
        }
        renderItem={({ item }) => (
          <PostItem
            item={item}
            handleLike={handleLike}
            addressCache={addressCache}
            getCountry={getCountry}
            theme={theme}
            userId={currentUserId? currentUserId.toString() : null}
          />
        )}
        
      />
    </SafeAreaView>
  );
};


const SettingsScreen = ({ theme }) => {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
      <Text style={{ color: theme.text }}>Work in progress</Text>
    </SafeAreaView>
  );
};


export default function Dashboard() {
  const router = useRouter();
  const [userId, setUserId] = useState(null);
  const [isValidating, setIsValidating] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [pureBlack, setPureBlack] = useState(false);

  const effectiveTheme = darkMode
    ? (pureBlack ? { ...COLOR.dark, background: '#000000', tabBar: '#000000' } : COLOR.dark)
    : COLOR.light;

  const theme = effectiveTheme;

  const handleLogout = useCallback(async () => {
    await AsyncStorage.removeItem("userId");
    router.replace("/LogInScreen");
  }, [router]);

  const checkUser = useCallback(async () => {
    setIsValidating(true);
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

      if (data && data.success && data.user) {
        setUserId(id);
        setDarkMode(!!data.user.darkMode);
        setPureBlack(!!data.user.pureBlack);
        applyPureBlack(!!data.user.pureBlack);
        setIsValidating(false);
      } else {
        await handleLogout();
      }
    } catch (err) {
      console.log("Eroare validare user:", err);
      await handleLogout();
    }
  }, [handleLogout, router]);

  useFocusEffect(
    useCallback(() => {
      checkUser();
    }, [checkUser])
  );

  if (isValidating) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}> 
        <CustomLoading />
      </View>
    );
  }
  const Tab = createBottomTabNavigator();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          borderTopColor: theme.secondary,
          borderTopWidth: 0.75,
          backgroundColor: theme.tabBar,
        },
        tabBarActiveTintColor: theme.selected,
        tabBarInactiveTintColor: theme.unselected,
      }}
    >
      <Tab.Screen 
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" color={color} size={26} />
          ),
          tabBarShowLabel: false,
        }}
        name="Home">{() => <HomeScreen theme={theme} />}</Tab.Screen>

      <Tab.Screen 
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search-sharp" color={color} size={26} />
          ),
          tabBarShowLabel: false,
        }}
        name="Search">{() => <SearchScreen theme={theme} />}</Tab.Screen>

      <Tab.Screen 
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan" color={color} size={30} />
          ),
          tabBarShowLabel: false,
        }}
        name="Take Picture" component={TakePicture} />
      <Tab.Screen 
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="switch" color={color} size={26} />
          ),
          tabBarShowLabel: false,
        }}
        name="Switch">{() => <SettingsScreen theme={theme} />}</Tab.Screen>

      <Tab.Screen 
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" color={color} size={26} />
          ),
          tabBarShowLabel: false,
        }}
        name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  Header: {
    alignSelf: 'center',
    borderBottomWidth: 2.5,
    width: '95%',
  },
  postCard: {
    width: '100%',
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginHorizontal: '2%',
    marginBottom: '2%',
    width: '96%',
  },
  postMenuButton: {
    marginTop: 5,
    width: 30,
    height: 30,
    top: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuOverlay: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 90,
    paddingRight: 14,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  menuContent: {
    position: 'absolute',
    minWidth: 140,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  menuItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '400',
  },
  username: {
    fontWeight: 'bold',
    fontSize: 20,
  },
  postImage: {
    width: '95%',
    aspectRatio: 1,
    alignSelf: 'center',
    borderRadius: 20,
  },
  sameCatBorder: {
    borderRadius: 10,
    width: '90%',
    alignSelf: 'center',
    height: 7,
    marginTop: 10,
  },
  sameCatBorderFound: {
    borderRadius: 10,
    width: '90%',
    alignSelf: 'center',
    height: 25,
    marginTop: 10,
  },
  postImageWrapper: {
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
    borderBottomWidth: 0,
  },
  postOptions: {
    marginLeft: '1%',
    flexDirection: "row",
    alignItems: 'center',
    padding: 10,
  },
  likes: {
    marginLeft: 5,
    fontSize: 18,
  },
  separator: {
    borderWidth: 1,
    width: '95%',
    alignSelf: 'center',
  },
  avatarContainer: {
    width: 75,
    height: 75,
    position: 'relative'
  },
  profileTopPicture: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  badgeWrapper: {
    position: 'absolute',
    bottom: -5,
    right: -10,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catPointsIcon: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  }, 
  catPointsText: {
    color: 'white',
    top: 2,
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: '#2efffc',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 1,
  },
});