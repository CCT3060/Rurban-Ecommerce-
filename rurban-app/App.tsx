import React, { useRef, useEffect } from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  View, ActivityIndicator, Text, StyleSheet,
  TouchableOpacity, Animated,
} from 'react-native';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CartProvider, useCart } from './src/context/CartContext';
import { WishlistProvider } from './src/context/WishlistContext';
import { COLORS } from './src/lib/theme';

import HomeScreen           from './src/screens/HomeScreen';
import CategoriesScreen     from './src/screens/CategoriesScreen';
import CategoryDetailScreen from './src/screens/CategoryDetailScreen';
import CartScreen           from './src/screens/CartScreen';
import CheckoutScreen       from './src/screens/CheckoutScreen';
import OrderSuccessScreen   from './src/screens/OrderSuccessScreen';
import OrdersScreen         from './src/screens/OrdersScreen';
import ProfileScreen        from './src/screens/ProfileScreen';
import WishlistScreen       from './src/screens/WishlistScreen';
import AllProductsScreen      from './src/screens/AllProductsScreen';
import ProductDetailScreen   from './src/screens/ProductDetailScreen';
import LoginScreen           from './src/screens/LoginScreen';
import SignupScreen          from './src/screens/SignupScreen';

const Tab       = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const CatStack  = createNativeStackNavigator();
const CartStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

// ─── Navigators ───────────────────────────────────────────────────────────────

function HomeStackNav() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen name="HomeMain"      component={HomeScreen} />
      <HomeStack.Screen name="AllProducts"   component={AllProductsScreen} />
      <HomeStack.Screen name="Wishlist"      component={WishlistScreen} />
      <HomeStack.Screen name="ProductDetail" component={ProductDetailScreen} />
    </HomeStack.Navigator>
  );
}

function CategoriesStack() {
  return (
    <CatStack.Navigator screenOptions={{ headerShown: false }}>
      <CatStack.Screen name="CategoriesList" component={CategoriesScreen} />
      <CatStack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
      <CatStack.Screen name="ProductDetail"  component={ProductDetailScreen} />
    </CatStack.Navigator>
  );
}

function CartStackNav() {
  return (
    <CartStack.Navigator screenOptions={{ headerShown: false }}>
      <CartStack.Screen name="CartMain"     component={CartScreen} />
      <CartStack.Screen name="Checkout"     component={CheckoutScreen} />
      <CartStack.Screen name="OrderSuccess" component={OrderSuccessScreen} />
    </CartStack.Navigator>
  );
}

// ─── Animated "View Cart" floating bar ───────────────────────────────────────

function ViewCartBar() {
  const { totalQty, totalPrice } = useCart();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(200)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim   = useRef(new Animated.Value(1)).current;
  const prevQty     = useRef(0);

  useEffect(() => {
    const wasEmpty   = prevQty.current === 0;
    const isNowEmpty = totalQty === 0;

    if (!isNowEmpty && wasEmpty) {
      // First item — slide up + fade in together
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 58,
          friction: 10,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (isNowEmpty && !wasEmpty) {
      // Cart emptied — slide down + fade out
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 200,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }

    // Bounce pulse on every subsequent addition
    if (totalQty > prevQty.current && prevQty.current > 0) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.06, useNativeDriver: true, tension: 350, friction: 5 }),
        Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true, tension: 350, friction: 5 }),
      ]).start();
    }

    prevQty.current = totalQty;
  }, [totalQty]);

  return (
    <Animated.View
      style={[vc.bar, {
        bottom: insets.bottom + 68,
        opacity: opacityAnim,
        transform: [{ translateY }, { scale: scaleAnim }],
      }]}
      pointerEvents={totalQty === 0 ? 'none' : 'auto'}
    >
      <View style={vc.left}>
        <View style={vc.badge}>
          <Text style={vc.badgeText}>{totalQty}</Text>
        </View>
        <Text style={vc.itemsText}>{totalQty} item{totalQty !== 1 ? 's' : ''}</Text>
      </View>
      <Text style={vc.priceText}>Rs.{totalPrice}</Text>
      <TouchableOpacity
        style={vc.btn}
        onPress={() => navigation.navigate('Cart')}
        activeOpacity={0.85}
      >
        <Text style={vc.btnText}>View Cart</Text>
        <Ionicons name="arrow-forward" size={14} color="#fff" style={{ marginLeft: 6 }} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const vc = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 12,
    right: 12,
    backgroundColor: '#152318',
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 13,
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    justifyContent: 'space-between',
  },
  left:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge:     { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  itemsText: { color: '#bbf7d0', fontSize: 13, fontWeight: '600' },
  priceText: { color: '#fff', fontSize: 15, fontWeight: '800', flex: 1, textAlign: 'center' },
  btn:       { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, borderRadius: 13, paddingHorizontal: 14, paddingVertical: 9 },
  btnText:   { color: '#fff', fontSize: 13, fontWeight: '800' },
});

// ─── Main tabs (no Cart tab) ──────────────────────────────────────────────────

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, [string, string]> = {
            Home:       ['home',    'home-outline'],
            Categories: ['grid',    'grid-outline'],
            Orders:     ['receipt', 'receipt-outline'],
            Profile:    ['person',  'person-outline'],
          };
          const [on, off] = icons[route.name] ?? ['ellipse', 'ellipse-outline'];
          return <Ionicons name={(focused ? on : off) as any} size={size} color={color} />;
        },
        tabBarActiveTintColor:   '#111111',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.08,
          shadowRadius: 6,
          backgroundColor: '#fff',
        },
      })}
    >
      <Tab.Screen name="Home"       component={HomeStackNav} />
      <Tab.Screen name="Categories" component={CategoriesStack} />
      <Tab.Screen name="Orders"     component={OrdersScreen} />
      <Tab.Screen name="Profile"    component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// ─── Main screen: tabs + floating cart bar overlay ───────────────────────────

function MainWithOverlay() {
  return (
    <View style={{ flex: 1 }}>
      <MainTabs />
      <ViewCartBar />
    </View>
  );
}

// ─── Auth Navigator ───────────────────────────────────────────────────────────

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login"  component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

// ─── Root Navigator ───────────────────────────────────────────────────────────

function RootNavigator() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
        <ActivityIndicator size="large" color="#111111" />
      </View>
    );
  }
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <>
          {/* Main app + floating cart bar */}
          <RootStack.Screen name="Main" component={MainWithOverlay} />
          {/* Cart pushed as a full screen over the tabs */}
          <RootStack.Screen name="Cart" component={CartStackNav} />
        </>
      ) : (
        <RootStack.Screen name="Auth" component={AuthNavigator} />
      )}
    </RootStack.Navigator>
  );
}

// ─── App Entry ────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <NavigationContainer>
              <StatusBar style="dark" />
              <RootNavigator />
            </NavigationContainer>
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
