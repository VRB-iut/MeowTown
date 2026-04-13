import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

import BackButtonPossition from './backButton';
import CustomLoading from './CustomLoading'; 
import COLOR from '../global_vars/COLOR';
import IP from '../global_vars/IP';

const PostItem = ({ item, owner, handleLike, addressCache, getCountry, theme, currentUserId, cardHeight }) => {
	const image = `http://${IP}:3000/${item.imageUrl}`;

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

	return (
		<View style={[styles.postCard, { backgroundColor: theme.background, height: cardHeight }]}>
			<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
				<Image
					source={owner?.profilePictureUrl ? { uri: owner.profilePictureUrl } : require('../assets/defaultProfilePicture.png')}
					style={styles.avatar}
				/>
				<View style={{ flexDirection: 'column', alignItems: 'flex-start', flexShrink: 1 }}>
					<Text style={[styles.username, { color: theme.text }]}>{owner?.username || 'Loading...'}</Text>
					<View style={{ flexDirection: 'row', alignItems: 'center' }}>
						<Ionicons name="location-outline" color={theme.gray} />
						<Text style={{ color: theme.gray, fontSize: 12 }}>
							{addressCache[item.id] || 'Loading location...'}
						</Text>
					</View>
				</View>
			</View>

			<Image source={{ uri: image }} style={[styles.postImage, { height: cardHeight * 0.72 }]} resizeMode="cover" />

			{currentUserId == item.userId ? (
				<View style={styles.postOptions}>
					<Ionicons name="heart" size={40} color={theme.usersPost} />
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

		</View>
	);
};

export default function RandomPicture() {
	const [userData, setUserData] = useState(null);
	const [loading, setLoading] = useState(true);
	const [darkModePressed, setDarkModePressed] = useState(false);
	const [currentUserId, setCurrentUserId] = useState(null);
	const [addressCache, setAddressCache] = useState({});

	const params = useLocalSearchParams();
	const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
	const postId = Array.isArray(params.postId) ? params.postId[0] : params.postId;

	const listRef = useRef(null);
	const addressCacheRef = useRef({});
	const { width: screenWidth } = useWindowDimensions();
	const cardHeight = useMemo(() => Math.max(520, Math.round(screenWidth * 1.35)), [screenWidth]);

	const theme = darkModePressed ? COLOR.dark : COLOR.light;

	const fetchUserData = useCallback(async () => {
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
	}, [userId]);

	const fetchCurrentUserTheme = useCallback(async () => {
		try {
			const storedUserId = await AsyncStorage.getItem('userId');
			setCurrentUserId(storedUserId);
			if (!storedUserId) return;

			const response = await fetch(`http://${IP}:3000/users`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: storedUserId }),
			});

			const data = await response.json();
			if (data.success && data.user) {
				setDarkModePressed(!!data.user.darkMode);
			}
		} catch (error) {
			console.error('Error fetching current user theme:', error);
		}
	}, []);

	useFocusEffect(
		useCallback(() => {
			fetchUserData();
			fetchCurrentUserTheme();
		}, [fetchUserData, fetchCurrentUserTheme])
	);

	useEffect(() => {
		addressCacheRef.current = addressCache;
	}, [addressCache]);

	const getCountry = useCallback(async (lat, lon, imageId) => {
		if (!lat || !lon || addressCacheRef.current[imageId]) return;

		try {
			const result = await Location.reverseGeocodeAsync({
				latitude: lat,
				longitude: lon,
			});

			if (result.length > 0) {
				const locationName = `${result[0].city || ''}, ${result[0].country || ''}`;
				setAddressCache((prev) => {
					const nextCache = { ...prev, [imageId]: locationName };
					addressCacheRef.current = nextCache;
					return nextCache;
				});
			}
		} catch (error) {
			console.log('Eroare geocoding:', error);
		}
	}, []);

	const handleLike = useCallback(async (imageId) => {
		try {
			const storedUserId = await AsyncStorage.getItem('userId');
			const response = await fetch(`http://${IP}:3000/like`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ postId: imageId, userId: storedUserId }),
			});

			const data = await response.json();

			if (data.success) {
				setUserData((prev) => ({
					...prev,
					posts: prev.posts.map((post) =>
						post.id === imageId
							? { ...post, likes: data.likes, likedByUser: data.liked }
							: post
					),
				}));
			}
		} catch (error) {
			console.log('Eroare la like:', error);
		}
	}, []);

	useEffect(() => {
		if (!loading && userData?.posts?.length) {
			const selectedIndex = userData.posts.findIndex((item) => item.id.toString() === postId?.toString());
			if (selectedIndex >= 0) {
				const timer = setTimeout(() => {
					listRef.current?.scrollToIndex({ index: selectedIndex, animated: false });
				}, 0);
				return () => clearTimeout(timer);
			}
		}
		return undefined;
	}, [loading, postId, userData?.posts]);

	const getItemLayout = useCallback((_, index) => ({
		length: cardHeight,
		offset: cardHeight * index,
		index,
	}), [cardHeight]);

	if (loading) return <CustomLoading />;

	return (
		<SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
			<BackButtonPossition />

			<FlatList
				ref={listRef}
				data={userData?.posts || []}
				keyExtractor={(item) => item.id.toString()}
				renderItem={({ item }) => (
					<PostItem
						item={item}
						owner={userData}
						handleLike={handleLike}
						addressCache={addressCache}
						getCountry={getCountry}
						theme={theme}
						currentUserId={currentUserId ? currentUserId.toString() : null}
						cardHeight={cardHeight}
					/>
				)}
				contentContainerStyle={styles.listContent}
				ListEmptyComponent={<Text style={[styles.emptyListText, { color: theme.secondary }]}>Nu există postări pentru acest utilizator.</Text>}
				getItemLayout={getItemLayout}
				onScrollToIndexFailed={({ index }) => {
					requestAnimationFrame(() => {
						listRef.current?.scrollToIndex({ index, animated: false });
					});
				}}
			/>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		position: 'relative',
	},
	listContent: {
		paddingBottom: 24,
	},
	postCard: {
		width: '100%',
		paddingHorizontal: 12,
		paddingTop: 10,
		paddingBottom: 14,
	},
	avatar: {
		width: 42,
		height: 42,
		borderRadius: 21,
		marginRight: 10,
		backgroundColor: '#eee',
	},
	username: {
		fontSize: 18,
		fontWeight: '700',
	},
	postImage: {
		width: '100%',
		borderRadius: 18,
		backgroundColor: '#ddd',
		marginBottom: 10,
	},
	postOptions: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'flex-start',
		marginBottom: 6,
	},
	likes: {
		fontSize: 18,
		marginLeft: 8,
		fontWeight: '700',
	},
	separator: {
		height: 1,
		marginTop: 10,
		opacity: 0.45,
	},
	emptyListText: {
		textAlign: 'center',
		marginTop: 40,
		fontSize: 16,
	},
});
