// ============================================
// APP NAVIGATOR - Production Ready
// ============================================

import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer, NavigationContainerRef, DefaultTheme, LinkingOptions, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Context
import { useAuth } from '../context/AuthContext';
import { ChatNotificationProvider, useChatNotification } from '../context/ChatNotificationContext';
import { NotificationProvider } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { useOnboardingSurveyEnabled } from '../hooks/useOnboardingSurveyEnabled';

// Components
import { ErrorBoundary } from '../components/common';

// Types
import { RootStackParamList, AuthStackParamList, MainTabParamList } from '../types';

// Auth Screens
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';
import PhoneLoginScreen from '../screens/auth/PhoneLoginScreen';
import EmailVerificationScreen from '../screens/auth/EmailVerificationScreen';
import OTPVerificationScreen from '../screens/auth/OTPVerificationScreen';
import ChooseRoleScreen from '../screens/auth/ChooseRoleScreen';
import CompleteRegistrationScreen from '../screens/auth/CompleteRegistrationScreen';
import OnboardingSurveyScreen from '../screens/auth/OnboardingSurveyScreen';

// Main Screens
import HomeScreen from '../screens/home/HomeScreen';
import JobDetailScreen from '../screens/job/JobDetailScreen';
import PostJobScreen from '../screens/job/PostJobScreenNew';
import ProfileScreen from '../screens/profile/ProfileScreen';
import UserProfileScreen from '../screens/profile/UserProfileScreen';
import { ChatListScreen, ChatRoomScreen } from '../screens/chat/ChatScreens';

// New Feature Screens
import FavoritesScreen from '../screens/favorites/FavoritesScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import NotificationsScreen from '../screens/notifications/NotificationsScreen';
import DocumentsScreen from '../screens/documents/DocumentsScreen';
import MyPostsScreen from '../screens/myposts/MyPostsScreen';
import ApplicantsScreen from '../screens/applicants/ApplicantsScreen';
import ReviewsScreen from '../screens/reviews/ReviewsScreen';
import HelpScreen from '../screens/help/HelpScreen';
import MapJobsScreen from '../screens/map/MapJobsScreen';
import TermsScreen from '../screens/legal/TermsScreen';
import PrivacyScreen from '../screens/legal/PrivacyScreen';
import VerificationScreen from '../screens/verification/VerificationScreen';
import ShopScreen from '../screens/shop/ShopScreen';
import ThemeSelectionScreen from '../screens/settings/ThemeSelectionScreen';

// Admin Screens
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import AdminVerificationScreen from '../screens/admin/AdminVerificationScreen';
import AdminReportsScreen from '../screens/admin/AdminReportsScreen';
import AdminFeedbackScreen from '../screens/admin/AdminFeedbackScreen';

// Feature Screens
import FeedbackScreen from '../screens/feedback/FeedbackScreen';
import PaymentScreen from '../screens/payment/PaymentScreen';
import NearbyJobAlertScreen from '../screens/notifications/NearbyJobAlertScreen';

// Theme
import { COLORS, SPACING, FONT_SIZES } from '../theme';
import { trackScreenView } from '../services/analyticsService';

function getActiveRouteName(state: any): string {
  const route = state?.routes?.[state.index ?? 0];
  if (!route) return 'Unknown';
  if (route.state) return getActiveRouteName(route.state);
  return route.name || 'Unknown';
}

// ============================================
// Stack Navigators
// ============================================
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const expoPrefix = ExpoLinking.createURL('/');
const PUBLIC_DOMAIN = 'nursego.co';
const PUBLIC_WWW_DOMAIN = `www.${PUBLIC_DOMAIN}`;

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [expoPrefix, 'nursego://', `https://${PUBLIC_DOMAIN}`, `https://${PUBLIC_WWW_DOMAIN}`],
  config: {
    screens: {
      Main: {
        screens: {
          Home: 'home',
          Chat: 'chat',
          PostJob: 'post-job',
          Profile: 'profile',
        },
      },
      JobDetail: 'job/:jobId',
      NearbyJobAlert: 'nearby-jobs',
      Notifications: 'notifications',
      Favorites: 'favorites',
      Settings: 'settings',
    },
  },
};

// ============================================
// AUTH NAVIGATOR
// ============================================
function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
      <AuthStack.Screen name="EmailVerification" component={EmailVerificationScreen} />
      <AuthStack.Screen name="OTPVerification" component={OTPVerificationScreen} />
      <AuthStack.Screen name="ChooseRole" component={ChooseRoleScreen} />
      <AuthStack.Screen name="CompleteRegistration" component={CompleteRegistrationScreen} />
      <AuthStack.Screen name="Terms" component={TermsScreen} />
      <AuthStack.Screen name="Privacy" component={PrivacyScreen} />
    </AuthStack.Navigator>
  );
}

function createGuardedScreen(
  Component: React.ComponentType<any>,
  options: {
    requiresAuth?: boolean;
    allowedRoles?: Array<'user' | 'nurse' | 'hospital' | 'admin'>;
  } = {}
) {
  function GuardedScreen(props: any) {
    const navigation = useNavigation<any>();
    const { user, isInitialized } = useAuth();
    const redirectedRef = useRef(false);

    const requiresAuth = options.requiresAuth === true;
    const roleAllowed = !user || !options.allowedRoles || user.role === 'admin' || options.allowedRoles.includes(user.role);

    useEffect(() => {
      if (!isInitialized || redirectedRef.current) return;

      if (requiresAuth && !user) {
        redirectedRef.current = true;
        requestAnimationFrame(() => {
          navigation.navigate('Auth');
        });
        return;
      }

      if (user && options.allowedRoles && !roleAllowed) {
        redirectedRef.current = true;
        requestAnimationFrame(() => {
          navigation.navigate('Main', { screen: 'Home' });
        });
      }
    }, [isInitialized, navigation, requiresAuth, roleAllowed, user]);

    if (!isInitialized) {
      return <LoadingScreen />;
    }

    if (requiresAuth && !user) {
      return <LoadingScreen />;
    }

    if (user && options.allowedRoles && !roleAllowed) {
      return <LoadingScreen />;
    }

    return <Component {...props} />;
  }

  GuardedScreen.displayName = `Guarded${Component.displayName || Component.name || 'Screen'}`;
  return GuardedScreen;
}

const GuardedChatListScreen = createGuardedScreen(ChatListScreen, { requiresAuth: true });
const GuardedPostJobScreen = createGuardedScreen(PostJobScreen, { requiresAuth: true });
const GuardedProfileScreen = createGuardedScreen(ProfileScreen, { requiresAuth: true });
const GuardedChatRoomScreen = createGuardedScreen(ChatRoomScreen, { requiresAuth: true });
const GuardedFavoritesScreen = createGuardedScreen(FavoritesScreen, { requiresAuth: true });
const GuardedSettingsScreen = createGuardedScreen(SettingsScreen, { requiresAuth: true });
const GuardedVerificationScreen = createGuardedScreen(VerificationScreen, { requiresAuth: true });
const GuardedNotificationsScreen = createGuardedScreen(NotificationsScreen, { requiresAuth: true });
const GuardedDocumentsScreen = createGuardedScreen(DocumentsScreen, { requiresAuth: true });
const GuardedMyPostsScreen = createGuardedScreen(MyPostsScreen, { requiresAuth: true });
const GuardedShopScreen = createGuardedScreen(ShopScreen, { requiresAuth: true });
const GuardedApplicantsScreen = createGuardedScreen(ApplicantsScreen, { requiresAuth: true, allowedRoles: ['hospital'] });
const GuardedFeedbackScreen = createGuardedScreen(FeedbackScreen, { requiresAuth: true });
const GuardedPaymentScreen = createGuardedScreen(PaymentScreen, { requiresAuth: true });
const GuardedNearbyJobAlertScreen = createGuardedScreen(NearbyJobAlertScreen, { requiresAuth: true });

function GuardedOnboardingSurveyScreen(props: any) {
  const navigation = useNavigation<any>();
  const onboardingSurveyEnabled = useOnboardingSurveyEnabled();

  useEffect(() => {
    if (!onboardingSurveyEnabled) {
      requestAnimationFrame(() => {
        if (navigation.canGoBack?.()) {
          navigation.goBack();
          return;
        }
        navigation.navigate('Main', { screen: 'Home' });
      });
    }
  }, [navigation, onboardingSurveyEnabled]);

  if (!onboardingSurveyEnabled) {
    return <LoadingScreen />;
  }

  return <OnboardingSurveyScreen {...props} />;
}

// ============================================
// TAB ICON COMPONENT
// ============================================
interface TabIconProps {
  focused: boolean;
  iconName: keyof typeof Ionicons.glyphMap;
  label: string;
  badgeCount?: number;
}

function TabIcon({ focused, iconName, label, badgeCount }: TabIconProps) {
  const { colors } = useTheme();
  
  return (
    <View style={styles.tabIconContainer}>
      <View>
        <Ionicons
          name={iconName}
          size={24}
          color={focused ? colors.primary : colors.textMuted}
        />
        {badgeCount !== undefined && badgeCount > 0 && (
          <View style={[styles.tabBadge, { backgroundColor: colors.error }]}>
            <Text style={styles.tabBadgeText}>
              {badgeCount > 9 ? '9+' : badgeCount}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.tabLabel, { color: focused ? colors.primary : colors.textMuted }]}>
        {label}
      </Text>
    </View>
  );
}

// ============================================
// MAIN TAB NAVIGATOR
// ============================================
function MainTabNavigator() {
  const { unreadCount } = useChatNotification();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 4,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName={focused ? 'home' : 'home-outline'} label="หน้าแรก" />
          ),
        }}
      />
      <Tab.Screen
        name="Chat"
        component={GuardedChatListScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName={focused ? 'chatbubbles' : 'chatbubbles-outline'} label="ข้อความ" badgeCount={unreadCount} />
          ),
        }}
      />
      <Tab.Screen
        name="PostJob"
        component={GuardedPostJobScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName={focused ? 'add-circle' : 'add-circle-outline'} label="โพสต์" />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={GuardedProfileScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName={focused ? 'person' : 'person-outline'} label="โปรไฟล์" />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

// ============================================
// ROOT NAVIGATOR
// ============================================
function RootNavigator() {
  const { isAuthenticated, showLoginModal, setShowLoginModal, isAdmin } = useAuth();

  return (
    <RootStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      {/* Main App */}
      <RootStack.Screen name="Main" component={MainTabNavigator} />
      
      {/* Job Detail - Full Screen Modal */}
      <RootStack.Screen 
        name="JobDetail" 
        component={JobDetailScreen}
        options={{
          animation: 'slide_from_bottom',
        }}
      />
      
      {/* Chat Room */}
      <RootStack.Screen 
        name="ChatRoom" 
        component={GuardedChatRoomScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Favorites */}
      <RootStack.Screen 
        name="Favorites" 
        component={GuardedFavoritesScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Settings */}
      <RootStack.Screen 
        name="Settings" 
        component={GuardedSettingsScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* User Profile - ดูโปรไฟล์คนอื่น */}
      <RootStack.Screen 
        name="UserProfile" 
        component={UserProfileScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Verification - ยืนยันตัวตน */}
      <RootStack.Screen 
        name="Verification" 
        component={GuardedVerificationScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Notifications */}
      <RootStack.Screen 
        name="Notifications" 
        component={GuardedNotificationsScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Documents */}
      <RootStack.Screen 
        name="Documents" 
        component={GuardedDocumentsScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* My Posts - ประกาศของฉัน */}
      <RootStack.Screen 
        name="MyPosts" 
        component={GuardedMyPostsScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Shop - ร้านค้า */}
      <RootStack.Screen 
        name="Shop" 
        component={GuardedShopScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Applicants (Hospital only) */}
      <RootStack.Screen 
        name="Applicants" 
        component={GuardedApplicantsScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Reviews */}
      <RootStack.Screen 
        name="Reviews" 
        component={ReviewsScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Help / FAQ */}
      <RootStack.Screen 
        name="Help" 
        component={HelpScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Terms of Service */}
      <RootStack.Screen 
        name="Terms" 
        component={TermsScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Privacy Policy */}
      <RootStack.Screen 
        name="Privacy" 
        component={PrivacyScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {isAdmin && (
        <>
          {/* Admin Dashboard (Admin only) */}
          <RootStack.Screen 
            name="AdminDashboard" 
            component={AdminDashboardScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />

          {/* Admin Verification (Admin only) */}
          <RootStack.Screen 
            name="AdminVerification" 
            component={AdminVerificationScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />

          {/* Admin Reports (Admin only) */}
          <RootStack.Screen 
            name="AdminReports" 
            component={AdminReportsScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />

          {/* Admin Feedback (Admin only) */}
          <RootStack.Screen 
            name="AdminFeedback" 
            component={AdminFeedbackScreen}
            options={{
              animation: 'slide_from_right',
            }}
          />
        </>
      )}

      {/* User Feedback */}
      <RootStack.Screen 
        name="Feedback" 
        component={GuardedFeedbackScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Payment / access status screen */}
      <RootStack.Screen
        name="Payment"
        component={GuardedPaymentScreen}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />

      {/* Auth Screens - Modal */}
      <RootStack.Screen
        name="Auth"
        component={AuthNavigator}
        options={{
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      {/* Theme Selection */}
      <RootStack.Screen 
        name="ThemeSelection" 
        component={ThemeSelectionScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      {/* Map Jobs */}
      <RootStack.Screen
        name="MapJobs"
        component={MapJobsScreen}
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
        }}
      />
      {/* Nearby Job Alert - ตั้งค่าแจ้งเตือนงานใกล้ตัว */}
      <RootStack.Screen
        name="NearbyJobAlert"
        component={GuardedNearbyJobAlertScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      {/* Onboarding Survey - แบบสำรวจหลังสมัคร */}
      <RootStack.Screen
        name="OnboardingSurvey"
        component={GuardedOnboardingSurveyScreen}
        options={{
          animation: 'slide_from_right',
          gestureEnabled: false,
        }}
      />
    </RootStack.Navigator>
  );
}

// ============================================
// LOADING SCREEN
// ============================================
function LoadingScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.loadingText, { color: colors.text }]}>กำลังโหลด...</Text>
    </View>
  );
}

// ============================================
// APP NAVIGATOR (Main Export)
// ============================================
export default function AppNavigator() {
  const { isInitialized, user, isAdmin } = useAuth();
  const { colors } = useTheme();
  const onboardingSurveyEnabled = useOnboardingSurveyEnabled();
  const [navigationReady, setNavigationReady] = useState(false);
  const navigationRef = useRef<NavigationContainerRef<any>>(null);
  const isNavigationReadyRef = useRef(false);
  const hasHandledOnboardingRef = useRef(false);
  const routeNameRef = useRef('');

  const navigationTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.error,
    },
  };

  useEffect(() => {
    if (!isInitialized || !isNavigationReadyRef.current) return;

    if (!onboardingSurveyEnabled || !user?.uid || isAdmin || user.onboardingCompleted) {
      hasHandledOnboardingRef.current = false;
      return;
    }

    if (hasHandledOnboardingRef.current) return;

    const currentRoute = navigationRef.current?.getCurrentRoute()?.name;
    if (currentRoute === 'OnboardingSurvey') {
      hasHandledOnboardingRef.current = true;
      return;
    }

    hasHandledOnboardingRef.current = true;
    requestAnimationFrame(() => {
      navigationRef.current?.navigate('OnboardingSurvey');
    });
  }, [isInitialized, isAdmin, onboardingSurveyEnabled, user?.uid, user?.onboardingCompleted]);

  if (!isInitialized) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <NavigationContainer
        ref={navigationRef}
        theme={navigationTheme}
        linking={linking}
        onReady={() => {
          isNavigationReadyRef.current = true;
          setNavigationReady(true);
          const currentRoute = navigationRef.current?.getCurrentRoute()?.name || 'Unknown';
          routeNameRef.current = currentRoute;
          trackScreenView(currentRoute);
        }}
        onStateChange={() => {
          const currentRoute = navigationRef.current?.getCurrentRoute()?.name
            || getActiveRouteName(navigationRef.current?.getRootState());

          if (currentRoute && currentRoute !== routeNameRef.current) {
            routeNameRef.current = currentRoute;
            trackScreenView(currentRoute);
          }
        }}
      >
        <NotificationProvider navigation={navigationRef} navigationReady={navigationReady}>
          <ChatNotificationProvider navigation={navigationRef}>
            <RootNavigator />
          </ChatNotificationProvider>
        </NotificationProvider>
      </NavigationContainer>
    </ErrorBoundary>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  // Tab Bar
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    height: Platform.OS === 'android' ? 56 : 85,
    paddingBottom: Platform.OS === 'android' ? 4 : 25,
    paddingTop: 4,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
  },
  tabLabel: {
    fontSize: 9,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  tabBadge: {
    position: 'absolute',
    top: -4,
    right: -12,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },

  // Loading Screen
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
});
