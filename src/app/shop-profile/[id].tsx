import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';

import { auth, db } from '../../../firebaseConfig';
import { EmptyState } from '@/components/ui/EmptyState';
import { Screen } from '@/components/ui/Screen';
import { colors } from '@/constants/rentify-theme';
import type { Booking, CartItem, Item, UserRole } from '@/types';

type ShopProfile = {
  shopName?: string;
  name?: string;
  photoUrl?: string;
  avatarUrl?: string;
  coverPhotoUrl?: string;
  rating?: number;
  averageRating?: number;
  followersCount?: number;
};

type ShopTab = 'Shop' | 'Products' | 'Categories' | 'Reviews';
type SortMode = 'Popular' | 'Latest' | 'Top Sales' | 'Price';

const shopTabs: ShopTab[] = ['Shop', 'Products', 'Categories', 'Reviews'];
const sortModes: SortMode[] = ['Popular', 'Latest', 'Top Sales', 'Price'];
const accent = colors.primary;

function money(value: number) {
  return `₱${Number.isFinite(value) ? value.toFixed(0) : '0'}`;
}

function getRentalCount(bookings: Booking[], itemId: string) {
  return bookings
    .filter((booking) => booking.status === 'returned')
    .reduce((count, booking) => {
      const hasItem =
        booking.itemId === itemId ||
        booking.items?.some((entry: CartItem) => entry.itemId === itemId) === true;
      return count + (hasItem ? 1 : 0);
    }, 0);
}

function timestampMillis(item: Item) {
  return item.createdAt?.toMillis() ?? 0;
}

export default function ShopProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = auth.currentUser;
  const [role, setRole] = useState<UserRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<ShopTab>('Products');
  const [sortMode, setSortMode] = useState<SortMode>('Popular');
  const [priceAscending, setPriceAscending] = useState(true);
  const [following, setFollowing] = useState(false);
  const [showStickyTabs, setShowStickyTabs] = useState(false);
  const [tabsOffset, setTabsOffset] = useState(Number.MAX_SAFE_INTEGER);

  useEffect(() => {
    if (!user) {
      router.replace('/');
      return;
    }
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        const accountRole = snapshot.data()?.role;
        if (accountRole === 'customer' || accountRole === 'shop') {
          setRole(accountRole);
        } else {
          setRole(null);
        }
        setRoleLoading(false);
      },
      (error) => {
        console.error('Could not check shop profile access:', error);
        setRoleLoading(false);
        Alert.alert('Profile unavailable', 'We could not verify your account role.');
      },
    );
  }, [user]);

  useEffect(() => {
    if (!roleLoading && role && role !== 'customer') {
      router.replace('/(tabs)/(shop)/dashboard');
    }
  }, [role, roleLoading]);

  useEffect(() => {
    if (!id || role !== 'customer') return;
    const unsubscribeShop = onSnapshot(
      doc(db, 'users', id),
      (snapshot) => {
        setShop(snapshot.exists() ? (snapshot.data() as ShopProfile) : null);
      },
      (error) => {
        console.error('Could not load shop profile:', error);
        Alert.alert('Shop unavailable', 'We could not load this shop profile.');
      },
    );
    const unsubscribeItems = onSnapshot(
      query(collection(db, 'items'), where('shopId', '==', id)),
      (snapshot) => {
        setItems(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Item));
        setLoading(false);
      },
      (error) => {
        console.error('Could not load shop products:', error);
        setLoading(false);
        Alert.alert('Products unavailable', 'We could not load this shop’s listings.');
      },
    );
    const unsubscribeBookings = onSnapshot(
      query(collection(db, 'bookings'), where('shopId', '==', id)),
      (snapshot) => {
        setBookings(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }) as Booking));
      },
      (error) => {
        console.error('Could not load shop rental totals:', error);
      },
    );
    return () => {
      unsubscribeShop();
      unsubscribeItems();
      unsubscribeBookings();
    };
  }, [id, role]);

  const shopName = shop?.shopName || shop?.name || 'Rental shop';
  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const results = items.filter((item) => {
      if (activeTab === 'Categories' && search.trim()) {
        return `${item.type} ${item.name}`.toLowerCase().includes(normalizedSearch);
      }
      return (
        !normalizedSearch ||
        `${item.name} ${item.type} ${item.color ?? ''}`.toLowerCase().includes(normalizedSearch)
      );
    });

    return [...results].sort((left, right) => {
      if (sortMode === 'Latest') return timestampMillis(right) - timestampMillis(left);
      if (sortMode === 'Top Sales') {
        return getRentalCount(bookings, right.id) - getRentalCount(bookings, left.id);
      }
      if (sortMode === 'Price') {
        return priceAscending ? left.price - right.price : right.price - left.price;
      }
      return getRentalCount(bookings, right.id) - getRentalCount(bookings, left.id);
    });
  }, [activeTab, bookings, items, priceAscending, search, sortMode]);

  const onScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      setShowStickyTabs(event.nativeEvent.contentOffset.y >= tabsOffset);
    },
    [tabsOffset],
  );

  const chooseSort = (mode: SortMode) => {
    if (mode === 'Price') {
      if (sortMode === 'Price') setPriceAscending((current) => !current);
      else {
        setSortMode('Price');
        setPriceAscending(true);
      }
    } else {
      setSortMode(mode);
    }
  };

  const renderTabs = (sticky = false) => (
    <View style={[styles.tabs, sticky && styles.stickyTabs]}>
      {shopTabs.map((tab) => {
        const active = activeTab === tab;
        return (
          <Pressable
            key={tab}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, active && styles.activeTab]}
          >
            <View style={styles.tabLabelRow}>
              <Text style={[styles.tabText, active && styles.activeTabText]}>{tab}</Text>
              {tab === 'Products' ? (
                <View style={styles.newBadge}>
                  <Text style={styles.newBadgeText}>NEW</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );

  if (roleLoading) {
    return (
      <Screen style={styles.centered}>
        <ActivityIndicator size="large" color={accent} />
      </Screen>
    );
  }

  if (role !== 'customer') {
    return (
      <Screen style={styles.centered}>
        <EmptyState
          icon="lock-closed-outline"
          title="Customer access only"
          description="Sign in with a customer account to view shop profiles."
        />
      </Screen>
    );
  }

  if (!id) {
    return (
      <Screen style={styles.centered}>
        <EmptyState
          icon="storefront-outline"
          title="Shop not found"
          description="This shop profile link is invalid."
        />
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <FlatList
        data={activeTab === 'Reviews' ? [] : filteredItems}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
        ListHeaderComponent={
          <View>
            <ImageBackground
              source={shop?.coverPhotoUrl ? { uri: shop.coverPhotoUrl } : undefined}
              style={styles.cover}
              imageStyle={styles.coverImage}
            >
              <View style={styles.coverOverlay} />
              <View style={styles.topBar}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                  onPress={() => router.back()}
                  style={styles.headerIconButton}
                >
                  <Ionicons name="arrow-back" size={22} color="#FFF" />
                </Pressable>
                <View style={styles.searchBar}>
                  <Ionicons name="search-outline" size={17} color={colors.muted} />
                  <TextInput
                    accessibilityLabel="Search in shop"
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search in shop"
                    placeholderTextColor={colors.muted}
                    returnKeyType="search"
                    style={styles.searchInput}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="More shop options"
                  onPress={() =>
                    Alert.alert(shopName, 'More shop options will be available soon.')
                  }
                  style={styles.headerIconButton}
                >
                  <Ionicons name="ellipsis-vertical" size={21} color="#FFF" />
                </Pressable>
              </View>

              <View style={styles.shopInfo}>
                {shop?.avatarUrl || shop?.photoUrl ? (
                  <Image
                    source={{ uri: shop.avatarUrl || shop.photoUrl }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Ionicons name="storefront" size={28} color={accent} />
                  </View>
                )}
                <View style={styles.shopIdentity}>
                  <Text style={styles.shopName} numberOfLines={1}>{shopName}</Text>
                  <Text style={styles.shopMetrics}>
                    {typeof shop?.followersCount === 'number'
                      ? `${shop.followersCount.toLocaleString()} Followers`
                      : 'New shop'}
                    {'  ·  '}
                    <Ionicons name="star" size={12} color="#FFD66B" />
                    {' '}
                    {(shop?.averageRating ?? shop?.rating)?.toFixed(1) ?? '—'}
                  </Text>
                </View>
              </View>
              <View style={styles.shopActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setFollowing((current) => !current)}
                  style={[styles.actionButton, following && styles.followingButton]}
                >
                  <Ionicons
                    name={following ? 'checkmark' : 'add'}
                    size={16}
                    color={following ? '#FFF' : accent}
                  />
                  <Text style={[styles.actionText, following && styles.followingText]}>
                    {following ? 'Following' : 'Follow'}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    Alert.alert('Chat', 'Shop chat is not available yet.')
                  }
                  style={[styles.actionButton, styles.chatButton]}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={15} color="#FFF" />
                  <Text style={styles.chatText}>Chat</Text>
                </Pressable>
              </View>
            </ImageBackground>

            <View
              onLayout={(event) => setTabsOffset(event.nativeEvent.layout.y)}
            >
              {renderTabs()}
            </View>

            {activeTab === 'Categories' ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                {['All', ...new Set(items.map((item) => item.type).filter(Boolean))].map(
                  (category) => (
                    <Pressable
                      key={category}
                      onPress={() => setSearch(category === 'All' ? '' : category)}
                      style={styles.categoryChip}
                    >
                      <Text style={styles.categoryText}>{category}</Text>
                    </Pressable>
                  ),
                )}
              </ScrollView>
            ) : null}

            <View style={styles.filterBar}>
              {sortModes.map((mode) => {
                const active = sortMode === mode;
                return (
                  <Pressable
                    key={mode}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => chooseSort(mode)}
                    style={[styles.filterChip, active && styles.activeFilterChip]}
                  >
                    <Text style={[styles.filterText, active && styles.activeFilterText]}>
                      {mode}
                    </Text>
                    {mode === 'Price' ? (
                      <Ionicons
                        name={priceAscending ? 'arrow-up' : 'arrow-down'}
                        size={12}
                        color={active ? accent : colors.muted}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={accent} style={styles.loader} />
          ) : (
            <View style={styles.empty}>
              <EmptyState
                icon={activeTab === 'Reviews' ? 'star-outline' : 'shirt-outline'}
                title={activeTab === 'Reviews' ? 'Reviews coming soon' : 'No products found'}
                description={
                  activeTab === 'Reviews'
                    ? 'Customer reviews will appear here when available.'
                    : 'Try another search or check back later for new listings.'
                }
              />
            </View>
          )
        }
        renderItem={({ item }) => {
          const rating =
            typeof (item as Item & { averageRating?: number; rating?: number }).averageRating ===
            'number'
              ? (item as Item & { averageRating: number }).averageRating
              : (item as Item & { rating?: number }).rating;
          const reviewCount =
            (item as Item & { reviewCount?: number }).reviewCount ?? 0;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`View ${item.name}`}
              onPress={() => router.push({ pathname: '/item/[id]', params: { id: item.id } })}
              style={styles.productWrap}
            >
              <View style={styles.productCard}>
                <View style={styles.productImageWrap}>
                  {item.photoUrl ? (
                    <Image
                      source={{ uri: item.photoUrl }}
                      style={styles.productImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.productImage, styles.productFallback]}>
                      <Ionicons name="shirt-outline" size={38} color={accent} />
                    </View>
                  )}
                  <View style={styles.shopTag}>
                    <Text style={styles.shopTagText} numberOfLines={1}>{shopName}</Text>
                  </View>
                </View>
                <View style={styles.productDetails}>
                  <Text style={styles.productTitle} numberOfLines={2}>{item.name}</Text>
                  <View style={styles.priceRow}>
                    <Text style={styles.price}>{money(item.price)}</Text>
                    <Text style={styles.discount}>RENT</Text>
                  </View>
                  <View style={styles.productMetrics}>
                    <Ionicons name="star" size={12} color="#E5A323" />
                    <Text style={styles.productMetricText}>
                      {typeof rating === 'number' ? rating.toFixed(1) : '—'}
                    </Text>
                    <Text style={styles.productMetricText}>·</Text>
                    <Text style={styles.productMetricText}>
                      {getRentalCount(bookings, item.id)} rented
                    </Text>
                  </View>
                  {reviewCount > 0 ? (
                    <Text style={styles.reviewCount}>{reviewCount} reviews</Text>
                  ) : null}
                </View>
              </View>
            </Pressable>
          );
        }}
      />
      {showStickyTabs ? (
        <View style={styles.stickyTabsOverlay}>{renderTabs(true)}</View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingHorizontal: 0, backgroundColor: colors.background },
  centered: { alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingBottom: 24, flexGrow: 1, backgroundColor: colors.background },
  cover: {
    minHeight: 268,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 16,
    backgroundColor: '#322B3B',
  },
  coverImage: { opacity: 0.6 },
  coverOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(20, 14, 20, 0.53)',
  },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIconButton: {
    width: 38,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flex: 1,
    height: 38,
    borderRadius: 20,
    backgroundColor: colors.peach,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  searchInput: { flex: 1, paddingVertical: 0, color: colors.text, fontSize: 13 },
  shopInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 21 },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  shopIdentity: { flex: 1, gap: 5 },
  shopName: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' },
  shopMetrics: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  shopActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 9, marginTop: 15 },
  actionButton: {
    minWidth: 94,
    minHeight: 38,
    borderRadius: 20,
    paddingHorizontal: 15,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  followingButton: { backgroundColor: 'rgba(255,255,255,0.24)' },
  actionText: { color: accent, fontSize: 13, fontWeight: '700' },
  followingText: { color: '#FFFFFF' },
  chatButton: { backgroundColor: accent },
  chatText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  tabs: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  stickyTabs: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: accent },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  tabText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  activeTabText: { color: accent, fontWeight: '800' },
  newBadge: { backgroundColor: '#E83D3D', borderRadius: 5, paddingHorizontal: 3, paddingVertical: 1 },
  newBadgeText: { color: '#FFFFFF', fontSize: 7, fontWeight: '900' },
  categoryRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  categoryChip: {
    minHeight: 34,
    paddingHorizontal: 13,
    borderRadius: 18,
    justifyContent: 'center',
    backgroundColor: colors.peach,
  },
  categoryText: { color: colors.text, fontSize: 12, fontWeight: '600' },
  filterBar: {
    height: 49,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  filterChip: {
    minHeight: 30,
    paddingHorizontal: 11,
    borderRadius: 16,
    backgroundColor: colors.peach,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  activeFilterChip: { backgroundColor: colors.peach },
  filterText: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  activeFilterText: { color: accent, fontWeight: '800' },
  gridRow: { paddingHorizontal: 9, gap: 9 },
  productWrap: { flex: 1, maxWidth: '50%', paddingBottom: 10 },
  productCard: {
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  productImageWrap: { height: 174, backgroundColor: colors.background },
  productImage: { width: '100%', height: '100%' },
  productFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  shopTag: {
    position: 'absolute',
    top: 8,
    left: 7,
    maxWidth: '80%',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: '#218A66',
  },
  shopTagText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
  productDetails: { padding: 9, gap: 5 },
  productTitle: { minHeight: 34, color: colors.text, fontSize: 12, lineHeight: 16, fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { color: accent, fontSize: 17, fontWeight: '800' },
  discount: {
    color: accent,
    fontSize: 8,
    fontWeight: '800',
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.peach,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  productMetrics: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  productMetricText: { color: colors.muted, fontSize: 10 },
  reviewCount: { color: colors.muted, fontSize: 9 },
  loader: { marginTop: 44 },
  empty: { paddingHorizontal: 20, paddingTop: 22 },
  stickyTabsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 5,
    backgroundColor: '#FFFFFF',
  },
});
