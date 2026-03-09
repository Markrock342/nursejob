// ============================================
// USER PROFILE SCREEN - ดูโปรไฟล์คนอื่น
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { Loading, EmptyState, Avatar, KittenButton as Button } from '../../components/common';
import { JobCard } from '../../components/job/JobCard';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { JobPost } from '../../types';
import { getUserPosts } from '../../services/jobService';
import { canUserReviewTarget, getReviewsForTarget, getTargetRating, Review } from '../../services/reviewsService';
import { getRoleIconName, getRoleLabel, getRoleTagColors, getVerificationTagText } from '../../utils/verificationTag';
import { getPremiumTagColors, getPremiumTagText, hasPremiumTag, hasRoleTag } from '../../utils/verificationTag';
import {
  getCareTypeThaiLabel,
  getHiringUrgencyThaiLabel,
  getOrgTypeThaiLabel,
  getStaffTypeThaiLabel,
  getThaiLabels,
  getWorkStyleThaiLabel,
} from '../../utils/profileLabels';

// ============================================
// Types
// ============================================
type UserProfileRouteParams = {
  UserProfile: {
    userId: string;
    userName?: string;
    userPhoto?: string;
  };
};

interface UserData {
  uid: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  role?: string;
  orgType?: string;
  staffType?: string;
  experience?: number;
  skills?: string[];
  interestedStaffTypes?: string[];
  workStyle?: string[];
  careNeeds?: string[];
  careTypes?: string[];
  hiringUrgency?: string;
  department?: string;
  hospital?: string;
  province?: string;
  licenseNumber?: string;
  isVerified?: boolean;
  subscriptionPlan?: string;
  createdAt?: Date;
  privacy?: {
    profileVisible?: boolean;
    showOnlineStatus?: boolean;
  };
  isOnline?: boolean;
  lastActiveAt?: Date;
  // Stats
  totalPosts?: number;
  responseRate?: number;
  avgRating?: number;
  reviewCount?: number;
  phone?: string;
}

function isPermissionDeniedError(error: any): boolean {
  const code = error?.code;
  const message = String(error?.message || '');
  return code === 'permission-denied' || message.includes('Missing or insufficient permissions');
}

// ============================================
// Component
// ============================================
export default function UserProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<UserProfileRouteParams, 'UserProfile'>>();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { userId, userName, userPhoto } = route.params;
  const surfaceBackground = isDark ? colors.surface : colors.white;
  const elevatedBackground = isDark ? colors.card : colors.white;
  const statsTones = {
    posts: { background: colors.primaryBackground, text: colors.primaryDark },
    rating: { background: colors.warningLight, text: colors.warning },
    response: { background: colors.successLight, text: colors.success },
  };
  const reviewWriteTone = { background: colors.accentLight, text: colors.accentDark };

  const [userData, setUserData] = useState<UserData | null>(null);
  const [userPosts, setUserPosts] = useState<JobPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'posts'>('info');
  const [receivedReviews, setReceivedReviews] = useState<Review[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user data
  const fetchUserData = useCallback(async () => {
    try {
      setError(null);
      const userDoc = await getDoc(doc(db, 'users', userId));
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        
        // Check privacy settings
        if (data.privacy?.profileVisible === false) {
          setError('ผู้ใช้นี้ตั้งค่าโปรไฟล์เป็นส่วนตัว');
          setUserData(null);
          return;
        }
        
        setUserData({
          uid: userId,
          displayName: data.displayName || userName || 'ไม่ระบุชื่อ',
          photoURL: data.photoURL || userPhoto,
          bio: data.bio,
          role: data.role,
          orgType: data.orgType,
          staffType: data.staffType,
          experience: data.experience,
          skills: data.skills,
          interestedStaffTypes: data.interestedStaffTypes,
          workStyle: data.workStyle,
          careNeeds: data.careNeeds,
          careTypes: data.careTypes,
          hiringUrgency: data.hiringUrgency,
          department: data.department,
          hospital: data.hospital,
          province: data.province || data.location?.province || data.preferredProvince,
          licenseNumber: data.licenseNumber,
          isVerified: data.isVerified,
          subscriptionPlan: data.subscription?.plan,
          createdAt: data.createdAt?.toDate?.(),
          privacy: data.privacy,
          isOnline: data.isOnline,
          lastActiveAt: data.lastActiveAt?.toDate?.(),
          totalPosts: data.totalPosts || 0,
          responseRate: data.responseRate,
          avgRating: data.avgRating,
          reviewCount: data.reviewCount || 0,
          phone: data.phone,
        });
      } else {
        // If user not found in Firestore, use passed data
        setUserData({
          uid: userId,
          displayName: userName || 'ไม่ระบุชื่อ',
          photoURL: userPhoto,
        });
      }
    } catch (err: any) {
      if (!isPermissionDeniedError(err)) {
        console.error('Error fetching user data:', err);
      }
      // Fallback to passed data
      setUserData({
        uid: userId,
        displayName: userName || 'ไม่ระบุชื่อ',
        photoURL: userPhoto,
      });
    }
  }, [userId, userName, userPhoto]);

  // Fetch user's posts
  const fetchUserPosts = useCallback(async () => {
    try {
      // getUserPosts uses the correct 'shifts' collection with proper index
      const posts = await getUserPosts(userId);
      // Only show active/urgent posts on public profile
      const filtered = posts.filter(p => p.status === 'active' || p.status === 'urgent');
      setUserPosts(filtered);
    } catch (err) {
      console.error('Error fetching user posts:', err);
      setUserPosts([]);
    }
  }, [userId]);

  const fetchReviewData = useCallback(async () => {
    try {
      const [rating, reviews, eligibility] = await Promise.all([
        getTargetRating(userId, 'user'),
        getReviewsForTarget(userId, 'user'),
        user?.uid && user.uid !== userId ? canUserReviewTarget(user.uid, userId) : Promise.resolve(null),
      ]);

      setReceivedReviews(reviews);
      setCanReview(Boolean(eligibility?.canReview));
      setUserData((prev) => prev ? {
        ...prev,
        avgRating: rating.averageRating,
        reviewCount: rating.totalReviews,
      } : prev);
    } catch (err) {
      console.error('Error fetching review data:', err);
      setReceivedReviews([]);
      setCanReview(false);
    }
  }, [user?.uid, userId]);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchUserData(), fetchUserPosts(), fetchReviewData()]);
      setIsLoading(false);
    };
    loadData();
  }, [fetchUserData, fetchUserPosts, fetchReviewData]);

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchUserData(), fetchUserPosts(), fetchReviewData()]);
    setIsRefreshing(false);
  };

  // Navigate to job detail
  const handleJobPress = (job: JobPost) => {
    const serializedJob = {
      ...job,
      shiftDate: job.shiftDate ? (job.shiftDate instanceof Date ? job.shiftDate.toISOString() : job.shiftDate) : undefined,
      shiftDateEnd: (job as any).shiftDateEnd ? ((job as any).shiftDateEnd instanceof Date ? (job as any).shiftDateEnd.toISOString() : (job as any).shiftDateEnd) : undefined,
    } as any;
    (navigation as any).navigate('JobDetail', { job: serializedJob });
  };

  // Format date
  const formatDate = (date: Date | undefined) => {
    if (!date) return 'ไม่ระบุ';
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
    });
  };

  // Format last active
  const formatLastActive = (date: Date | undefined) => {
    if (!date) return '';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 5) return 'เพิ่งใช้งาน';
    if (minutes < 60) return `ใช้งานเมื่อ ${minutes} นาทีที่แล้ว`;
    if (hours < 24) return `ใช้งานเมื่อ ${hours} ชั่วโมงที่แล้ว`;
    return `ใช้งานเมื่อ ${days} วันที่แล้ว`;
  };

  const handleOpenReviews = () => {
    (navigation as any).navigate('Reviews', {
      targetUserId: userId,
      targetName: userData?.displayName || userName,
      targetRole: userData?.role,
    });
  };

  const renderRoleInfo = () => {
    if (!userData) return null;

    const workStyleLabels = getThaiLabels(userData.workStyle || [], getWorkStyleThaiLabel);
    const interestedStaffTypeLabels = getThaiLabels(userData.interestedStaffTypes || [], getStaffTypeThaiLabel);
    const careNeedLabels = getThaiLabels(userData.careNeeds || userData.careTypes || [], getCareTypeThaiLabel);

    if (userData.role === 'nurse') {
      return (
        <>
          {userData.staffType && (
            <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
              <Ionicons name="medkit-outline" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>วิชาชีพ</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{getStaffTypeThaiLabel(userData.staffType)}</Text>
              </View>
            </View>
          )}
          {userData.department && (
            <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
              <Ionicons name="medical-outline" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>แผนกที่ถนัด</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{userData.department}</Text>
              </View>
            </View>
          )}
          {userData.experience && (
            <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
              <Ionicons name="time-outline" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>ประสบการณ์</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{userData.experience} ปี</Text>
              </View>
            </View>
          )}
          {userData.isVerified && userData.licenseNumber && (
            <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
              <Ionicons name="card-outline" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>เลขใบประกอบวิชาชีพ</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{userData.licenseNumber.slice(0, 4)}****</Text>
              </View>
            </View>
          )}
          {workStyleLabels.length > 0 && (
            <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}> 
              <Ionicons name="options-outline" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>รูปแบบงานที่สนใจ</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{workStyleLabels.join(', ')}</Text>
              </View>
            </View>
          )}
          {userData.skills && userData.skills.length > 0 && (
            <View style={[styles.skillsSection, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.skillsTitle, { color: colors.textSecondary }]}>ทักษะ</Text>
              <View style={styles.skillsTags}>
                {userData.skills.map((skill, index) => (
                  <View key={index} style={[styles.skillTag, { backgroundColor: colors.primaryBackground }]}> 
                    <Text style={[styles.skillTagText, { color: colors.primary }]}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      );
    }

    if (userData.role === 'hospital') {
      return (
        <>
          <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
            <Ionicons name="business-outline" size={20} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>ประเภทองค์กร</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{getOrgTypeThaiLabel(userData.orgType) || roleLabel}</Text>
            </View>
          </View>
          {userData.hospital && (
            <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
              <Ionicons name="home-outline" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>ชื่อสถานพยาบาล</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{userData.hospital}</Text>
              </View>
            </View>
          )}
          {userData.province && (
            <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
              <Ionicons name="location-outline" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>พื้นที่รับสมัคร</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{userData.province}</Text>
              </View>
            </View>
          )}
          {interestedStaffTypeLabels.length > 0 && (
            <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}> 
              <Ionicons name="people-outline" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>บุคลากรที่กำลังมองหา</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{interestedStaffTypeLabels.join(', ')}</Text>
              </View>
            </View>
          )}
          {userData.hiringUrgency && (
            <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}> 
              <Ionicons name="flash-outline" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>ความเร่งด่วน</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{getHiringUrgencyThaiLabel(userData.hiringUrgency)}</Text>
              </View>
            </View>
          )}
          <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
            <Ionicons name="briefcase-outline" size={20} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>ประกาศที่เปิดอยู่</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{userPosts.length} รายการ</Text>
            </View>
          </View>
        </>
      );
    }

    return (
      <>
        {interestedStaffTypeLabels.length > 0 && (
          <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}> 
            <Ionicons name="people-outline" size={20} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>บุคลากรที่ต้องการติดต่อ</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{interestedStaffTypeLabels.join(', ')}</Text>
            </View>
          </View>
        )}
        {careNeedLabels.length > 0 && (
          <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}> 
            <Ionicons name="heart-outline" size={20} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>ลักษณะการดูแลที่ต้องการ</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{careNeedLabels.join(', ')}</Text>
            </View>
          </View>
        )}
        {userData.province && (
          <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
            <Ionicons name="location-outline" size={20} color={colors.primary} />
            <View style={styles.infoContent}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>จังหวัด</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>{userData.province}</Text>
            </View>
          </View>
        )}
        <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
          <Ionicons name="document-text-outline" size={20} color={colors.primary} />
          <View style={styles.infoContent}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>ประกาศที่เปิดอยู่</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{userPosts.length} รายการ</Text>
          </View>
        </View>
      </>
    );
  };

  // Loading state
  if (isLoading) {
    return <Loading fullScreen />;
  }

  const verificationTagText = getVerificationTagText({
    isVerified: userData?.isVerified,
    role: userData?.role,
    orgType: userData?.orgType,
  });

  const roleLabel = getRoleLabel(userData?.role, userData?.orgType, userData?.staffType);
  const showRoleTag = hasRoleTag(userData?.role, userData?.orgType, userData?.staffType);
  const roleTagColors = getRoleTagColors(userData?.role);
  const premiumTagText = getPremiumTagText(userData?.subscriptionPlan);
  const premiumTagColors = getPremiumTagColors();

  // Error state (private profile)
  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={[styles.header, { backgroundColor: surfaceBackground, borderBottomColor: colors.border }]}> 
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>โปรไฟล์</Text>
          <View style={{ width: 40 }} />
        </View>
        
        <EmptyState
          icon="lock-closed"
          title="โปรไฟล์ส่วนตัว"
          description={error}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: surfaceBackground, borderBottomColor: colors.border }]}> 
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>โปรไฟล์</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header */}
        <View style={[styles.profileHeader, { backgroundColor: surfaceBackground, borderBottomColor: colors.border }]}> 
          <View style={styles.avatarContainer}>
            <Avatar
              uri={userData?.photoURL}
              name={userData?.displayName}
              size={100}
            />
            {userData?.isVerified && (
              <View style={[styles.verifiedBadge, { backgroundColor: surfaceBackground }]}> 
                <Ionicons name="checkmark-circle" size={24} color={colors.success} />
              </View>
            )}
            {/* Online status */}
            {userData?.privacy?.showOnlineStatus !== false && (
              <View style={[
                styles.onlineStatus,
                { borderColor: surfaceBackground },
                userData?.isOnline ? styles.online : styles.offline
              ]} />
            )}
          </View>

          <View style={styles.userNameRow}>
            <Text style={[styles.userName, { color: colors.text }]}>{userData?.displayName}</Text>
            {showRoleTag ? (
              <View style={[styles.inlineNameTag, { backgroundColor: roleTagColors.backgroundColor }]}>
                <Ionicons 
                  name={getRoleIconName(userData?.role)} 
                  size={13} 
                  color={roleTagColors.textColor} 
                />
                <Text style={[styles.inlineNameTagText, { color: roleTagColors.textColor }]}>{roleLabel}</Text>
              </View>
            ) : null}
            {hasPremiumTag(userData?.subscriptionPlan) ? (
              <View style={[styles.inlineNameTag, { backgroundColor: premiumTagColors.backgroundColor }]}>
                <Ionicons name="diamond" size={13} color={premiumTagColors.textColor} />
                <Text style={[styles.inlineNameTagText, { color: premiumTagColors.textColor }]}>{premiumTagText}</Text>
              </View>
            ) : null}
            {verificationTagText ? (
              <View style={[styles.inlineNameTag, styles.nameVerifiedTag]}>
                <Ionicons name="checkmark-circle" size={13} color={colors.primary} />
                <Text style={styles.nameVerifiedTagText}>{verificationTagText}</Text>
              </View>
            ) : null}
          </View>

          {/* Online status text */}
          {userData?.privacy?.showOnlineStatus !== false && (
            <Text style={[styles.lastActiveText, { color: colors.textSecondary }]}>
              {userData?.isOnline ? '🟢 ออนไลน์' : formatLastActive(userData?.lastActiveAt)}
            </Text>
          )}

          {userData?.bio && (
            <Text style={[styles.bio, { color: colors.textSecondary }]}>{userData.bio}</Text>
          )}
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: surfaceBackground, borderBottomColor: colors.border }]}> 
          <TouchableOpacity
            style={[styles.tab, activeTab === 'info' && styles.tabActive, activeTab === 'info' && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab('info')}
          >
            <Ionicons 
              name="person" 
              size={20} 
              color={activeTab === 'info' ? colors.primary : colors.textSecondary} 
            />
            <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'info' && styles.tabTextActive, activeTab === 'info' && { color: colors.primary }]}>
              ข้อมูล
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.tab, activeTab === 'posts' && styles.tabActive, activeTab === 'posts' && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab('posts')}
          >
            <Ionicons 
              name="document-text" 
              size={20} 
              color={activeTab === 'posts' ? colors.primary : colors.textSecondary} 
            />
            <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'posts' && styles.tabTextActive, activeTab === 'posts' && { color: colors.primary }]}>
              ประกาศ({userPosts.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'info' ? (
          <View style={[styles.infoSection, { backgroundColor: surfaceBackground }]}>
            {/* Stats Cards */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: statsTones.posts.background }]}> 
                <Text style={[styles.statValue, { color: statsTones.posts.text }]}> 
                  {userPosts.length}
                </Text>
                <Text style={[styles.statLabel, { color: statsTones.posts.text }]}>ประกาศ</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: statsTones.rating.background }]}> 
                <Text style={[styles.statValue, { color: statsTones.rating.text }]}> 
                  {userData?.avgRating ? userData.avgRating.toFixed(1) : '-'}
                </Text>
                <Text style={[styles.statLabel, { color: statsTones.rating.text }]}>คะแนน ({userData?.reviewCount || 0})</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: statsTones.response.background }]}> 
                <Text style={[styles.statValue, { color: statsTones.response.text }]}> 
                  {userData?.responseRate ? `${userData.responseRate}%` : '-'}
                </Text>
                <Text style={[styles.statLabel, { color: statsTones.response.text }]}>ตอบกลับ</Text>
              </View>
            </View>
            
            {renderRoleInfo()}

            <View style={styles.reviewActionsRow}>
              <TouchableOpacity style={[styles.reviewActionButton, { backgroundColor: colors.primaryBackground }]} onPress={handleOpenReviews}>
                <Ionicons name="star-outline" size={18} color={colors.primary} />
                <Text style={[styles.reviewActionText, { color: colors.primary }]}>ดูรีวิวทั้งหมด</Text>
              </TouchableOpacity>
              {user?.uid && user.uid !== userId && canReview ? (
                <TouchableOpacity style={[styles.reviewActionButton, { backgroundColor: reviewWriteTone.background }]} onPress={handleOpenReviews}>
                  <Ionicons name="create-outline" size={18} color={reviewWriteTone.text} />
                  <Text style={[styles.reviewActionText, { color: reviewWriteTone.text }]}>เขียนรีวิว</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {receivedReviews.length > 0 ? (
              <View style={styles.reviewsPreviewSection}>
                <Text style={[styles.skillsTitle, { color: colors.textSecondary }]}>รีวิวล่าสุด</Text>
                {receivedReviews.slice(0, 2).map((review) => (
                  <View key={review.id} style={[styles.reviewPreviewCard, { backgroundColor: elevatedBackground, borderColor: colors.borderLight }]}> 
                    <View style={styles.reviewPreviewHeader}>
                      <Text style={[styles.reviewPreviewName, { color: colors.text }]}>{review.userName}</Text>
                      <Text style={[styles.reviewPreviewRating, { color: colors.accentDark }]}>★ {review.rating.toFixed(1)}</Text>
                    </View>
                    <Text style={[styles.reviewPreviewTitle, { color: colors.text }]}>{review.title}</Text>
                    <Text style={[styles.reviewPreviewContent, { color: colors.textSecondary }]} numberOfLines={2}>{review.content}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Member since */}
            <View style={[styles.infoRow, { borderBottomColor: colors.borderLight }]}>
              <Ionicons name="calendar" size={20} color={colors.primary} />
              <View style={styles.infoContent}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>เป็นสมาชิกตั้งแต่</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{formatDate(userData?.createdAt)}</Text>
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.postsSection}>
            {userPosts.length === 0 ? (
              <EmptyState
                icon="document-text-outline"
                title="ยังไม่มีประกาศ"
                description="ผู้ใช้นี้ยังไม่มีประกาศที่เปิดอยู่"
              />
            ) : (
              userPosts.map((post) => (
                <JobCard
                  key={post.id}
                  job={post}
                  onPress={() => handleJobPress(post)}
                />
              ))
            )}
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================
// Styles
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  backButton: {
    padding: SPACING.xs,
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 2,
  },
  onlineStatus: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  online: {
    backgroundColor: '#10B981',
  },
  offline: {
    backgroundColor: COLORS.textMuted,
  },
  userNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.md,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  userName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 0,
  },
  inlineNameTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.border + '66',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
    maxWidth: '100%',
  },
  inlineNameTagText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  nameVerifiedTag: {
    backgroundColor: COLORS.primaryBackground,
  },
  nameVerifiedTagText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    fontWeight: '600',
  },
  lastActiveText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  bio: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
    marginTop: SPACING.sm,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  tabTextActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: COLORS.white,
    padding: SPACING.lg,
    marginTop: SPACING.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: SPACING.lg,
    gap: SPACING.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  statValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    marginTop: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  infoContent: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  infoLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    fontWeight: '500',
  },
  skillsSection: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  skillsTitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  skillsTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  skillTag: {
    backgroundColor: COLORS.primaryBackground,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
  },
  skillTagText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.primary,
    fontWeight: '500',
  },
  postsSection: {
    padding: SPACING.md,
  },
  reviewActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
  },
  reviewActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
  },
  reviewActionText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
  reviewsPreviewSection: {
    marginBottom: SPACING.md,
  },
  reviewPreviewCard: {
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
  },
  reviewPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reviewPreviewName: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: COLORS.text,
  },
  reviewPreviewRating: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: '#D97706',
  },
  reviewPreviewTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  reviewPreviewContent: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
});

