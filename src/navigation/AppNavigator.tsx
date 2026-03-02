// ============================================
// APP NAVIGATOR - Production Ready
// ============================================

import React, { useRef } from 'react';
import { NavigationContainer, NavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Context
import { useAuth } from '../context/AuthContext';
import { ChatNotificationProvider, useChatNotification } from '../context/ChatNotificationContext';
import { useTheme } from '../context/ThemeContext';

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

// ============================================
// Stack Navigators
// ============================================
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

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
        component={ChatListScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName={focused ? 'chatbubbles' : 'chatbubbles-outline'} label="ข้อความ" badgeCount={unreadCount} />
          ),
        }}
      />
      <Tab.Screen
        name="PostJob"
        component={PostJobScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} iconName={focused ? 'add-circle' : 'add-circle-outline'} label="ลงประกาศ" />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
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
        component={ChatRoomScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Favorites */}
      <RootStack.Screen 
        name="Favorites" 
        component={FavoritesScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Settings */}
      <RootStack.Screen 
        name="Settings" 
        component={SettingsScreen}
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
        component={VerificationScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Notifications */}
      <RootStack.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Documents */}
      <RootStack.Screen 
        name="Documents" 
        component={DocumentsScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* My Posts - ประกาศของฉัน */}
      <RootStack.Screen 
        name="MyPosts" 
        component={MyPostsScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Shop - ร้านค้า */}
      <RootStack.Screen 
        name="Shop" 
        component={ShopScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Applicants (Hospital only) */}
      <RootStack.Screen 
        name="Applicants" 
        component={ApplicantsScreen}
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

      {/* User Feedback */}
      <RootStack.Screen 
        name="Feedback" 
        component={FeedbackScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />

      {/* Payment (mock for testing) */}
      <RootStack.Screen
        name="Payment"
        component={PaymentScreen}
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
        component={NearbyJobAlertScreen}
        options={{
          animation: 'slide_from_right',
        }}
      />
      {/* Onboarding Survey - แบบสำรวจหลังสมัคร */}
      <RootStack.Screen
        name="OnboardingSurvey"
        component={OnboardingSurveyScreen}
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
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={COLORS.primary} />
      <Text style={styles.loadingText}>กำลังโหลด...</Text>
    </View>
  );
}

// ============================================
// APP NAVIGATOR (Main Export)
// ============================================
export default function AppNavigator() {
  const { isInitialized } = useAuth();
  const navigationRef = useRef<NavigationContainerRef<any>>(null);

  if (!isInitialized) {
    return <LoadingScreen />;
  }

  return (
    <ErrorBoundary>
      <NavigationContainer ref={navigationRef}>
        <ChatNotificationProvider navigation={navigationRef.current}>
          <RootNavigator />
        </ChatNotificationProvider>
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
