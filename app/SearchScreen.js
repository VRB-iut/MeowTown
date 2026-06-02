import { StyleSheet, View, Text, Image, FlatList, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { use, useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import CustomLoading from './CustomLoading';

import IP from '../global_vars/IP';

const EmptyComponent = ({ theme, leaderBoard, router }) => {
  
  return (
    <ScrollView styles = {styles.emptyContainer}>
      <Text style={[styles.emptyText, { color: theme.gray }]}>Top Users</Text>
      <FlatList
        data={leaderBoard}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.resultCard, { borderColor: theme.text, backgroundColor: theme.background }]}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/RandomProfile', params: { userId: item.id.toString() } })}
          >
            <Image
              source={item.profilePictureUrl ? { uri: `http://${IP}:3000/${item.profilePictureUrl}` } : require('../assets/defaultProfilePicture.png')}
              style={styles.avatar}
            />
            <Text style={[styles.username, { color: theme.text }]}>{item.username}</Text>
          </TouchableOpacity>
        )}
      />
    </ScrollView>
  );
};

export default function SearchScreen({ theme }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [leaderboardUsers, setLeaderboardUsers] = useState([]);

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

  useFocusEffect(
    useCallback(() => {
      fetchLeaderboard();
    }, [fetchLeaderboard])
  );

  const resolveAvatarUri = useCallback((profilePictureUrl) => {
    if (!profilePictureUrl) return null;

    const rawValue = String(profilePictureUrl).trim();
    if (!rawValue) return null;

    if (/^https?:\/\//i.test(rawValue)) {
      return rawValue;
    }

    return `http://${IP}:3000/${rawValue.replace(/^\/+/, '')}`;
  }, []);

  const fetchSearchResults = useCallback(async (searchValue) => {
    const trimmedQuery = searchValue.trim();

    if (!trimmedQuery) {
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`http://${IP}:3000/search?q=${encodeURIComponent(trimmedQuery)}`);
      const data = await response.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (error) {
      console.error('Error fetching search results:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChangeText = useCallback((text) => {
    setQuery(text);
    fetchSearchResults(text);
  }, [fetchSearchResults]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      <View style={styles.content}>
        <TextInput
          style={[
            styles.searchInput,
            {
              borderColor: theme.text,
              color: theme.text,
            },
          ]}
          placeholder="Search by username..."
          placeholderTextColor={theme.gray}
          value={query}
          onChangeText={handleChangeText}
          autoCapitalize="none"
          autoCorrect={false}
        />

        {loading ? (
          <CustomLoading />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.resultsList}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <EmptyComponent theme={theme} leaderBoard = {leaderboardUsers} router={router} />
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.resultCard, { borderColor: theme.secondary, backgroundColor: theme.background }]}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/RandomProfile', params: { userId: item.id.toString() } })}
              >
                <Image
                  source={resolveAvatarUri(item.profilePictureUrl) ? { uri: resolveAvatarUri(item.profilePictureUrl) } : require('../assets/defaultProfilePicture.png')}
                  style={styles.avatar}
                />
                <View style={styles.userInfo}>
                  <Text style={[styles.username, { color: theme.text }]}>{item.username}</Text>
                  <Text style={[styles.points, { color: theme.gray }]}>Cat points: {item.catPoints || 0}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  resultsList: {
    paddingBottom: 24,
  },
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    marginRight: 12,
    backgroundColor: '#eee',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  points: {
    fontSize: 13,
  },
  emptyText: {
    textAlign: 'center',
    margin: 24,
    fontSize: 15,
  },
});