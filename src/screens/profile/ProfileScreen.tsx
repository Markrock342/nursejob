// ============================================
// PROFILE SCREEN - Production Ready
// ============================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { KittenButton as Button, Avatar, Card, Loading, ModalContainer, Input, Badge, Divider, ConfirmModal, SuccessModal, ErrorModal, ProfileProgressBar } from '../../components/common';
import { sendOTP, verifyOTP } from '../../services/otpService';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS, POSITIONS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { getUserShiftContacts, deleteShiftContact } from '../../services/jobService';
import { getUserSubscription } from '../../services/subscriptionService';
import { getFavoritesCount } from '../../services/favoritesService';
import { getUnreadNotificationsCount } from '../../services/notificationsService';
import { getUserVerificationStatus, UserVerificationStatus } from '../../services/verificationService';
import { uploadProfilePhoto } from '../../services/storageService';
import { ShiftContact, MainTabParamList, RootStackParamList } from '../../types';
import { formatDate, formatRelativeTime } from '../../utils/helpers';

// ============================================
// Types
// ============================================
type ProfileScreenNavigationProp = NativeStackNavigationProp<MainTabParamList, 'Profile'>;

interface Props {
  navigation: ProfileScreenNavigationProp;
}

// ============================================
// Component
// ============================================
export default function ProfileScreen({ navigation }: Props) {
  // Auth context
  const { user, isAuthenticated, logout, updateUser, isLoading: isAuthLoading, isAdmin } = useAuth();
  const { colors, isDark } = useTheme();
  const nav = useNavigation<any>();
  const insets = useSafeAreaInsets();
  // Eva icons
  const EvaIcon: React.FC<{ name: string; size?: number; color?: string }> = ({ name, size = 24, color = colors.primary }) => (
    <Ionicons name={name as any} size={size} color={color} />
  );

  // State
  const [contacts, setContacts] = useState<ShiftContact[]>([]);
  const [showAllContacts, setShowAllContacts] = useState(false);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteContactModal, setShowDeleteContactModal] = useState(false);
  const [pendingDeleteContact, setPendingDeleteContact] = useState<{ id: string; title: string } | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  // OTP states
  const [otpValue, setOtpValue] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  // Phone OTP inline step: 'idle' | 'sending' | 'verify' | 'verified'
  const [phoneStep, setPhoneStep] = useState<'idle' | 'sending' | 'verify' | 'verified'>('idle');
  const [otpResendCountdown, setOtpResendCountdown] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState<UserVerificationStatus | null>(null);
  const [userPlan, setUserPlan] = useState<'free' | 'premium'>('free');
  const [editForm, setEditForm] = useState({
    displayName: '',
    phone: '',
    licenseNumber: '',
    experience: '',
    bio: '',
  });

  // Check if user is hospital (no longer used but kept for reference)
  const isHospital = user?.role === 'hospital';

  // Load data when screen is focused
  useFocusEffect(
    useCallback(() => {
      if (user?.uid) {
        loadAllData();
      }
    }, [user?.uid])
  );

  // Load all data
  const loadAllData = async () => {
    if (!user?.uid) return;
    
    setIsLoading(true);
    try {
      const [shiftsData, favCount, notifCount, verifyStatus] = await Promise.all([
        getUserShiftContacts(user.uid),
        getFavoritesCount(user.uid),
        getUnreadNotificationsCount(user.uid),
        getUserVerificationStatus(user.uid),
      ]);
      setContacts(shiftsData);
      setFavoritesCount(favCount);
      setUnreadNotifications(notifCount);
      setVerificationStatus(verifyStatus);
      try {
        const sub = await getUserSubscription(user.uid);
        setUserPlan(sub?.plan ?? 'free');
      } catch (err) {
        console.error('Error loading subscription in profile', err);
      }
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadAllData();
  };

  // Initialize edit form when modal opens
  useEffect(() => {
    if (showEditModal && user) {
      setEditForm({
        displayName: user.displayName || '',
        phone: user.phone || '',
        licenseNumber: user.licenseNumber || '',
        experience: user.experience?.toString() || '',
        bio: user.bio || '',
      });
      // Reset OTP/phone state on open
      setPhoneStep('idle');
      setOtpValue('');
      setOtpError('');
      setOtpResendCountdown(0);
    }
  }, [showEditModal, user]);

  // Delete contact from history
  const handleDeleteContact = (contactId: string, jobTitle: string) => {
    setPendingDeleteContact({ id: contactId, title: jobTitle });
    setShowDeleteContactModal(true);
  };

  const confirmDeleteContact = async () => {
    if (!pendingDeleteContact) return;
    setShowDeleteContactModal(false);
    setDeletingContactId(pendingDeleteContact.id);
    try {
      await deleteShiftContact(pendingDeleteContact.id);
      setContacts(prev => prev.filter(c => c.id !== pendingDeleteContact.id));
    } catch (e) {
      setModalTitle('เกิดข้อผิดพลาด');
      setModalMessage('ไม่สามารถลบได้ กรุณาลองใหม่');
      setShowErrorModal(true);
    } finally {
      setDeletingContactId(null);
      setPendingDeleteContact(null);
    }
  };

  // Get status config for contact history
  const getContactStatusConfig = (status: string) => {
    switch (status) {
      case 'confirmed': return { label: 'ยืนยันแล้ว', color: '#10B981', bg: '#ECFDF5', icon: 'checkmark-circle' as const };
      case 'cancelled': return { label: 'ยกเลิก', color: '#EF4444', bg: '#FEF2F2', icon: 'close-circle' as const };
      case 'expired': return { label: 'โพสต์ถูกลบ', color: '#94A3B8', bg: '#F1F5F9', icon: 'archive-outline' as const };
      default: return { label: 'สนใจ', color: '#F59E0B', bg: '#FFFBEB', icon: 'star-outline' as const };
    }
  };

  // Handle logout - show modal
  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  // Confirm logout
  const confirmLogout = async () => {
    setShowLogoutModal(false);
    try {
      await logout();
      // Don't show success modal - user will be logged out immediately
      // The ProfileScreen will unmount because isAuthenticated becomes false
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Handle photo change
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  
  const handleChangePhoto = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      setModalTitle('ไม่มีสิทธิ์');
      setModalMessage('กรุณาอนุญาตการเข้าถึงรูปภาพในการตั้งค่าของคุณ');
      setShowErrorModal(true);
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled && result.assets[0] && user?.uid) {
      setIsUploadingPhoto(true);
      try {
        // Upload to Firebase Storage
        const photoURL = await uploadProfilePhoto(user.uid, result.assets[0].uri);
        
        // Update user profile with new photo URL
        await updateUser({ photoURL });
        
        setModalTitle('สำเร็จ');
        setModalMessage('อัพโหลดรูปโปรไฟล์เรียบร้อยแล้ว');
        setShowSuccessModal(true);
      } catch (error: any) {
        console.error('Upload photo error:', error);
        setModalTitle('เกิดข้อผิดพลาด');
        setModalMessage(error.message || 'ไม่สามารถอัพโหลดรูปได้');
        setShowErrorModal(true);
      } finally {
        setIsUploadingPhoto(false);
      }
    }
  };

  // Start OTP countdown timer
  const startOtpCountdown = (seconds = 60) => {
    setOtpResendCountdown(seconds);
    const interval = setInterval(() => {
      setOtpResendCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // Send OTP for phone verification
  const handleSendPhoneOTP = async () => {
    const phone = editForm.phone.trim();
    if (!phone || phone.length < 9) {
      setOtpError('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง');
      return;
    }
    setPhoneStep('sending');
    setOtpError('');
    try {
      await sendOTP(phone);
      setPhoneStep('verify');
      setOtpValue('');
      startOtpCountdown(60);
    } catch (error: any) {
      setPhoneStep('idle');
      setOtpError(error.message || 'ส่งรหัส OTP ไม่สำเร็จ');
    }
  };

  // Verify OTP code
  const handleVerifyOTP = async () => {
    if (!otpValue || otpValue.length < 4) {
      setOtpError('กรุณากรอกรหัส OTP ให้ครบถ้วน');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    try {
      await verifyOTP(editForm.phone, otpValue);
      setPhoneStep('verified');
      setOtpError('');
    } catch (error: any) {
      setOtpError(error.message || 'รหัส OTP ไม่ถูกต้อง กรุณาลองใหม่');
    } finally {
      setOtpLoading(false);
    }
  };

  // Handle save profile
  const handleSaveProfile = async () => {
    const phoneChanged = editForm.phone.trim() !== (user?.phone || '').trim();
    const licenseChanged = editForm.licenseNumber.trim() !== (user?.licenseNumber || '').trim() && editForm.licenseNumber.trim() !== '';

    // Phone changed but not verified yet → trigger OTP
    if (phoneChanged && phoneStep !== 'verified') {
      await handleSendPhoneOTP();
      return;
    }

    try {
      const updates: any = {
        displayName: editForm.displayName,
        experience: parseInt(editForm.experience) || 0,
        bio: editForm.bio,
      };

      // Only update phone if verified (or unchanged)
      if (!phoneChanged || phoneStep === 'verified') {
        updates.phone = editForm.phone;
      }

      // License: save as pending for review, not directly active
      if (licenseChanged) {
        updates.pendingLicenseNumber = editForm.licenseNumber.trim();
        updates.licenseVerificationStatus = 'pending';
      }

      await updateUser(updates);
      setShowEditModal(false);
      setPhoneStep('idle');

      if (licenseChanged) {
        setModalTitle('บันทึกสำเร็จ');
        setModalMessage('ข้อมูลถูกบันทึกแล้ว\n\nเลขใบประกอบวิชาชีพที่กรอกใหม่จะรอการตรวจสอบจากผู้ดูแลระบบก่อนแสดงบนโปรไฟล์');
        setShowSuccessModal(true);
      } else {
        setModalTitle('สำเร็จ');
        setModalMessage('บันทึกข้อมูลเรียบร้อยแล้ว');
        setShowSuccessModal(true);
      }
    } catch (error: any) {
      setModalTitle('เกิดข้อผิดพลาด');
      setModalMessage(error.message || 'ไม่สามารถบันทึกข้อมูลได้');
      setShowErrorModal(true);
    }
  };

  // Legacy OTP confirm (kept for backward compat)
  const handleConfirmOTP = handleVerifyOTP;

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge text="รอพิจารณา" variant="warning" size="small" />;
      case 'reviewed':
        return <Badge text="กำลังพิจารณา" variant="info" size="small" />;
      case 'accepted':
        return <Badge text="ผ่านการคัดเลือก" variant="success" size="small" />;
      case 'rejected':
        return <Badge text="ไม่ผ่าน" variant="danger" size="small" />;
      case 'withdrawn':
        return <Badge text="ถอนใบสมัคร" variant="secondary" size="small" />;
      default:
        return <Badge text={status} variant="secondary" size="small" />;
    }
  };

  // Guest view
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.guestContainer}>
          <Ionicons name="person-circle-outline" size={80} color={colors.border} />
          <Text style={styles.guestTitle}>ยังไม่ได้เข้าสู่ระบบ</Text>
          <Text style={styles.guestDescription}>
            เข้าสู่ระบบเพื่อจัดการโปรไฟล์และดูประวัติการสมัครงาน
          </Text>
          <Button
            onPress={() => (navigation as any).navigate('Auth')}
            size="large"
            style={{ marginTop: SPACING.lg }}
          >
            <Text>เข้าสู่ระบบ</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={[styles.header, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 8, backgroundColor: colors.primary }]}> 
          <Text style={[styles.headerTitle, { fontWeight: 'bold', fontSize: 22, color: '#fff' }]}>โปรไฟล์</Text>
          <Button
            onPress={handleLogout}
            variant="danger"
            size="small"
            style={{ paddingHorizontal: 14, paddingVertical: 6 }}
          >
            <Ionicons name="log-out-outline" size={18} color="#fff" style={{ marginRight: 4 }} />
            <Text style={{ color: '#fff', fontWeight: '600' }}>ออกจากระบบ</Text>
          </Button>
        </View>

        {/* Profile Card Modern */}
        <Card style={{ alignItems: 'center', borderRadius: 20, margin: 0, marginBottom: 18, padding: 0, overflow: 'hidden', backgroundColor: colors.surface }}>
          <View style={{ width: '100%', alignItems: 'center', padding: 24, backgroundColor: colors.primary + '10' }}>
            <TouchableOpacity onPress={handleChangePhoto} disabled={isUploadingPhoto} style={{ marginBottom: 10 }}>
              <Avatar uri={user?.photoURL} name={user?.displayName || 'User'} size={96} />
              <View style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: colors.primary, borderRadius: 16, padding: 4 }}>
                <Ionicons name={isUploadingPhoto ? 'cloud-upload-outline' : 'camera-outline'} size={18} color="#fff" />
              </View>
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontWeight: 'bold', fontSize: 20, color: colors.text, marginBottom: 2 }}>{user?.displayName}</Text>
              {userPlan === 'premium' && (
                <View style={{ marginLeft: 8, backgroundColor: COLORS.premium, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 }}>
                  <Text style={{ color: COLORS.black, fontWeight: '700', fontSize: 12 }}>Premium</Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 15 }}>{user?.email}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
              <Badge
                text={user?.role === 'hospital' ? 'โรงพยาบาล' : user?.role === 'admin' ? 'แอดมิน' : user?.role === 'nurse' || user?.isVerified ? 'พยาบาล ✓' : 'ผู้ใช้งานทั่วไป'}
                variant={user?.isVerified ? 'success' : user?.role === 'admin' ? 'info' : 'primary'}
                style={{ marginRight: 8 }}
              />
              {user?.isVerified && <Ionicons name="shield-checkmark" size={18} color={colors.success} style={{ marginLeft: 2 }} />}
            </View>
            <Button
              onPress={() => setShowEditModal(true)}
              variant="outline"
              size="small"
              style={{ marginTop: 14, borderRadius: 8, paddingHorizontal: 18 }}
            >
              <Ionicons name="create-outline" size={16} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={{ color: colors.primary, fontWeight: '600' }}>แก้ไขโปรไฟล์</Text>
            </Button>
          </View>
        </Card>

        {/* Profile Progress Bar */}
        <ProfileProgressBar user={user as any} onPress={() => setShowEditModal(true)} />

        {/* Profile Info Modern */}
        <Card style={{ borderRadius: 16, marginBottom: 18 }}>
          <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>ข้อมูลส่วนตัว</Text>
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="call-outline" size={20} color={colors.primary} />
              <View>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>เบอร์โทรศัพท์</Text>
                <Text style={{ color: colors.text, fontWeight: '500', fontSize: 15 }}>{user?.phone || 'ยังไม่ระบุ'}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="medkit-outline" size={20} color={colors.primary} />
              <View>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>เลขใบประกอบวิชาชีพ</Text>
                <Text style={{ color: colors.text, fontWeight: '500', fontSize: 15 }}>{user?.licenseNumber || 'ยังไม่ระบุ'}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Ionicons name="briefcase-outline" size={20} color={colors.primary} />
              <View>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>ประสบการณ์</Text>
                <Text style={{ color: colors.text, fontWeight: '500', fontSize: 15 }}>{user?.experience ? `${user.experience} ปี` : 'ยังไม่ระบุ'}</Text>
              </View>
            </View>
            {user?.bio && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <Ionicons name="information-circle-outline" size={20} color={colors.primary} style={{ marginTop: 2 }} />
                <View>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>เกี่ยวกับฉัน</Text>
                  <Text style={{ color: colors.text, fontSize: 15 }}>{user.bio}</Text>
                </View>
              </View>
            )}
          </View>
        </Card>

        {/* Shift Contact History */}
        <View style={{ marginBottom: 18 }}>
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>ประวัติการติดต่องาน</Text>
              {contacts.length > 0 && (
                <View style={{ backgroundColor: colors.primary, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 }}>
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{contacts.length}</Text>
                </View>
              )}
            </View>
            <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
              ครั้งล่าสุด {contacts.length > 0 ? formatRelativeTime(contacts[0]?.contactedAt) : '-'}
            </Text>
          </View>

          {isLoading ? (
            <Loading text="กำลังโหลด..." />
          ) : contacts.length === 0 ? (
            <Card style={{ alignItems: 'center', paddingVertical: 28, borderRadius: 16 }}>
              <Ionicons name="document-text-outline" size={36} color={colors.textMuted} style={{ marginBottom: 8 }} />
              <Text style={{ color: colors.textMuted, fontSize: 15 }}>ยังไม่มีประวัติการติดต่อ</Text>
            </Card>
          ) : (
            <>
              {(showAllContacts ? contacts : contacts.slice(0, 5)).map((contact) => {
                const statusConfig = getContactStatusConfig(contact.status);
                const isDeleting = deletingContactId === contact.id;
                return (
                  <TouchableOpacity
                    key={contact.id}
                    activeOpacity={0.85}
                    onLongPress={() => handleDeleteContact(contact.id, contact.job?.title || 'งานนี้')}
                    onPress={() => {
                      if (contact.status === 'expired' || !contact.job) return;
                      const job = contact.job;
                      const serializedJob = {
                        ...job,
                        shiftDate: job.shiftDate
                          ? (job.shiftDate instanceof Date ? job.shiftDate.toISOString() : job.shiftDate)
                          : undefined,
                      } as any;
                      (navigation as any).navigate('JobDetail', { job: serializedJob });
                    }}
                    style={[
                      {
                        backgroundColor: colors.surface,
                        borderRadius: 14,
                        padding: 14,
                        marginBottom: 8,
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderWidth: 1,
                        borderColor: contact.status === 'expired' ? '#E2E8F0' : statusConfig.bg,
                        opacity: isDeleting ? 0.5 : contact.status === 'expired' ? 0.65 : 1,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.04,
                        shadowRadius: 6,
                        elevation: 2,
                      },
                    ]}
                  >
                    {/* Status icon */}
                    <View style={[{ width: 42, height: 42, borderRadius: 21, backgroundColor: statusConfig.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }]}>
                      <Ionicons name={statusConfig.icon} size={22} color={statusConfig.color} />
                    </View>

                    {/* Info */}
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontWeight: '700', color: colors.text, fontSize: 14, marginBottom: 2 }}>
                        {contact.job?.title || 'เวร (ถูกลบแล้ว)'}
                      </Text>
                      <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12 }}>
                        {contact.status === 'expired' ? 'โพสต์นี้ถูกลบไปแล้ว' : (contact.job?.posterName || 'ผู้โพสต์')}
                      </Text>
                      <Text style={{ color: colors.textSecondary, fontSize: 11, marginTop: 2 }}>
                        {formatRelativeTime(contact.contactedAt)}
                      </Text>
                    </View>

                    {/* Status badge */}
                    <View style={{ marginLeft: 8, alignItems: 'flex-end', gap: 4 }}>
                      <View style={{ backgroundColor: statusConfig.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                        <Text style={{ color: statusConfig.color, fontSize: 11, fontWeight: '700' }}>{statusConfig.label}</Text>
                      </View>
                      <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Show more / less */}
              {contacts.length > 5 && (
                <TouchableOpacity
                  onPress={() => setShowAllContacts(!showAllContacts)}
                  style={{ alignItems: 'center', paddingVertical: 10, flexDirection: 'row', justifyContent: 'center', gap: 4 }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>
                    {showAllContacts ? 'แสดงน้อยลง' : `ดูทั้งหมด (${contacts.length})`}
                  </Text>
                  <Ionicons
                    name={showAllContacts ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              )}

              {/* Hint */}
              <Text style={{ color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
                กดค้างเพื่อลบออกจากประวัติ
              </Text>
            </>
          )}
        </View>

        {/* Quick Links Modern */}
        <Card style={{ borderRadius: 16, marginBottom: 18 }}>
          <Text style={[styles.linksSectionTitle, { marginBottom: 8 }]}>เมนู</Text>
          <View style={{ gap: 2 }}>
            <TouchableOpacity style={[styles.linkItem, { gap: 12 }]} onPress={() => nav.navigate('Favorites')}>
              <Ionicons name="heart-outline" size={20} color={colors.primary} />
              <Text style={styles.linkText}>งานที่บันทึกไว้</Text>
              {favoritesCount > 0 && (
                <View style={[styles.countBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.countText}>{favoritesCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.linkItem, { gap: 12 }]} onPress={() => nav.navigate('Notifications')}>
              <Ionicons name="notifications-outline" size={20} color={colors.primary} />
              <Text style={styles.linkText}>การแจ้งเตือน</Text>
              {unreadNotifications > 0 && (
                <View style={[styles.countBadge, { backgroundColor: colors.danger }]}>
                  <Text style={styles.countText}>{unreadNotifications}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.linkItem, { gap: 12 }]} onPress={() => nav.navigate('Documents')}>
              <Ionicons name="document-outline" size={20} color={colors.primary} />
              <Text style={styles.linkText}>เอกสารของฉัน</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.linkItem, { gap: 12 }]} onPress={() => nav.navigate('Verification')}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
              <Text style={styles.linkText}>ยืนยันตัวตนพยาบาล</Text>
              {verificationStatus?.isVerified ? (
                <View style={[styles.countBadge, { backgroundColor: colors.success }]}>
                  <Ionicons name="checkmark" size={14} color="#fff" />
                </View>
              ) : verificationStatus?.pendingRequest ? (
                <View style={[styles.countBadge, { backgroundColor: colors.warning }]}>
                  <Text style={styles.countText}>รอ</Text>
                </View>
              ) : null}
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.linkItem, { gap: 12 }]} onPress={() => nav.navigate('MyPosts')}>
              <Ionicons name="list-outline" size={20} color={colors.primary} />
              <Text style={styles.linkText}>ประกาศของฉัน</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.linkItem, { gap: 12, backgroundColor: '#FFF8E1', borderRadius: 10 }]} onPress={() => nav.navigate('Shop')}>
              <Ionicons name="cart-outline" size={20} color="#FF8F00" />
              <Text style={[styles.linkText, { color: '#FF8F00' }]}>ร้านค้า / ซื้อบริการ</Text>
              <View style={{ backgroundColor: '#FFD700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                <Text style={{ fontSize: 10, color: '#000', fontWeight: '600' }}>Premium</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            {isHospital && (
              <TouchableOpacity style={[styles.linkItem, { gap: 12 }]} onPress={() => nav.navigate('Applicants')}>
                <Ionicons name="people-outline" size={20} color={colors.primary} />
                <Text style={styles.linkText}>จัดการผู้สมัคร</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.linkItem, { gap: 12 }]} onPress={() => nav.navigate('Settings')}>
              <Ionicons name="settings-outline" size={20} color={colors.primary} />
              <Text style={styles.linkText}>ตั้งค่า</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.linkItem, { gap: 12 }]} onPress={() => nav.navigate('Help')}>
              <Ionicons name="help-circle-outline" size={20} color={colors.primary} />
              <Text style={styles.linkText}>ช่วยเหลือ</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
            {isAdmin && (
              <TouchableOpacity style={[styles.linkItem, { gap: 12, backgroundColor: '#F3F4F6', borderRadius: 10 }]} onPress={() => nav.navigate('AdminDashboard')}>
                <Ionicons name="shield-outline" size={20} color={colors.info} />
                <Text style={[styles.linkText, { color: colors.info, fontWeight: 'bold' }]}>แผงควบคุม Admin</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
              </TouchableOpacity>
            )}
          </View>
        </Card>

        <View style={{ height: SPACING.xl * 2 }} />
      </ScrollView>

      {/* ─── Edit Profile Modal ─── */}
      <ModalContainer
        visible={showEditModal}
        onClose={() => { setShowEditModal(false); setPhoneStep('idle'); }}
        title="แก้ไขโปรไฟล์"
        fullScreen={true}
      >
        <ScrollView style={styles.editModalContent} showsVerticalScrollIndicator={false}>

          {/* ── SECTION: ข้อมูลส่วนตัว ── */}
          <View style={profileEditStyles.section}>
            <View style={profileEditStyles.sectionHeader}>
              <View style={[profileEditStyles.sectionDot, { backgroundColor: colors.primary }]} />
              <Text style={[profileEditStyles.sectionTitle, { color: colors.text }]}>ข้อมูลส่วนตัว</Text>
            </View>

            {/* ชื่อ-นามสกุล */}
            <View style={[profileEditStyles.fieldBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={profileEditStyles.fieldIcon}>
                <Ionicons name="person-outline" size={18} color={colors.primary} />
              </View>
              <View style={profileEditStyles.fieldContent}>
                <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary }]}>ชื่อ-นามสกุล</Text>
                <TextInput
                  style={[profileEditStyles.fieldInput, { color: colors.text }]}
                  value={editForm.displayName}
                  onChangeText={(t) => setEditForm({ ...editForm, displayName: t })}
                  placeholder="ชื่อจริง นามสกุล"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>

            {/* เบอร์โทรศัพท์ */}
            <View style={[profileEditStyles.fieldBox, { backgroundColor: colors.surface, borderColor: phoneStep === 'verify' ? colors.warning : phoneStep === 'verified' ? colors.success : editForm.phone !== (user?.phone || '') ? colors.warning : colors.border }]}>
              <View style={profileEditStyles.fieldIcon}>
                <Ionicons
                  name={phoneStep === 'verified' ? 'checkmark-circle' : 'call-outline'}
                  size={18}
                  color={phoneStep === 'verified' ? colors.success : phoneStep === 'verify' ? colors.warning : colors.primary}
                />
              </View>
              <View style={profileEditStyles.fieldContent}>
                <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary }]}>เบอร์โทรศัพท์</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TextInput
                    style={[profileEditStyles.fieldInput, { color: colors.text, flex: 1 }]}
                    value={editForm.phone}
                    onChangeText={(t) => {
                      setEditForm({ ...editForm, phone: t });
                      if (phoneStep !== 'idle') { setPhoneStep('idle'); setOtpValue(''); setOtpError(''); }
                    }}
                    placeholder="0xx-xxx-xxxx"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    editable={phoneStep !== 'verify'}
                  />
                  {phoneStep === 'verified' && (
                    <View style={[profileEditStyles.verifiedBadge, { backgroundColor: colors.success + '20' }]}>
                      <Text style={{ color: colors.success, fontSize: 11, fontWeight: '700' }}>ยืนยันแล้ว ✓</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Phone changed warning */}
            {editForm.phone.trim() !== (user?.phone || '').trim() && editForm.phone.trim() !== '' && phoneStep === 'idle' && (
              <View style={[profileEditStyles.infoBanner, { backgroundColor: '#FFF8E1', borderColor: '#F59E0B' }]}>
                <Ionicons name="warning-outline" size={16} color="#F59E0B" style={{ marginRight: 8 }} />
                <Text style={{ color: '#92400E', fontSize: 13, flex: 1 }}>
                  การเปลี่ยนเบอร์โทรศัพท์ต้องยืนยัน OTP ก่อนที่จะบันทึก
                </Text>
              </View>
            )}

            {/* OTP Inline Step */}
            {(phoneStep === 'verify' || phoneStep === 'sending') && (
              <View style={[profileEditStyles.otpBox, { backgroundColor: colors.background, borderColor: colors.warning }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Ionicons name="shield-checkmark-outline" size={20} color={colors.warning} />
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15, marginLeft: 8 }}>ยืนยัน OTP</Text>
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 14 }}>
                  กรอกรหัส 6 หลัก ที่ส่งไปยัง {'\n'}
                  <Text style={{ fontWeight: '700', color: colors.text }}>{editForm.phone}</Text>
                </Text>

                {/* OTP digit input */}
                <View style={[profileEditStyles.fieldBox, { backgroundColor: colors.surface, borderColor: otpError ? colors.danger : colors.border }]}>
                  <View style={profileEditStyles.fieldIcon}>
                    <Ionicons name="keypad-outline" size={18} color={colors.primary} />
                  </View>
                  <View style={profileEditStyles.fieldContent}>
                    <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary }]}>รหัส OTP</Text>
                    <TextInput
                      style={[profileEditStyles.fieldInput, { color: colors.text, letterSpacing: 8, fontSize: 20, fontWeight: '700' }]}
                      value={otpValue}
                      onChangeText={setOtpValue}
                      placeholder="------"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                    />
                  </View>
                </View>

                {otpError ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                    <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
                    <Text style={{ color: colors.danger, fontSize: 13, marginLeft: 6 }}>{otpError}</Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  onPress={handleVerifyOTP}
                  disabled={otpLoading || !otpValue}
                  style={[profileEditStyles.otpConfirmBtn, { backgroundColor: otpLoading || !otpValue ? colors.border : colors.primary }]}
                >
                  {otpLoading
                    ? <Text style={{ color: '#fff', fontWeight: '700' }}>กำลังยืนยัน…</Text>
                    : <Text style={{ color: '#fff', fontWeight: '700' }}>ยืนยันรหัส OTP</Text>
                  }
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
                  {otpResendCountdown > 0
                    ? <Text style={{ color: colors.textMuted, fontSize: 13 }}>ขอรหัสใหม่ได้อีกใน {otpResendCountdown} วินาที</Text>
                    : (
                      <TouchableOpacity onPress={handleSendPhoneOTP} disabled={phoneStep === 'sending'}>
                        <Text style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>
                          {phoneStep === 'sending' ? 'กำลังส่ง…' : '📨 ส่งรหัสใหม่'}
                        </Text>
                      </TouchableOpacity>
                    )
                  }
                </View>
              </View>
            )}
          </View>

          {/* ── SECTION: ข้อมูลวิชาชีพ ── */}
          <View style={profileEditStyles.section}>
            <View style={profileEditStyles.sectionHeader}>
              <View style={[profileEditStyles.sectionDot, { backgroundColor: '#7C3AED' }]} />
              <Text style={[profileEditStyles.sectionTitle, { color: colors.text }]}>ข้อมูลวิชาชีพ</Text>
            </View>

            {/* เลขใบประกอบวิชาชีพ */}
            <View style={[profileEditStyles.fieldBox, {
              backgroundColor: colors.surface,
              borderColor: editForm.licenseNumber !== (user?.licenseNumber || '') && editForm.licenseNumber !== '' ? '#7C3AED' : colors.border,
            }]}>
              <View style={profileEditStyles.fieldIcon}>
                <Ionicons name="ribbon-outline" size={18} color="#7C3AED" />
              </View>
              <View style={profileEditStyles.fieldContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary }]}>เลขใบประกอบวิชาชีพ</Text>
                  {(user as any)?.licenseVerificationStatus === 'pending' && (
                    <View style={{ backgroundColor: '#FFF3CD', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                      <Text style={{ color: '#856404', fontSize: 10, fontWeight: '700' }}>⏳ รอตรวจสอบ</Text>
                    </View>
                  )}
                  {(user as any)?.licenseVerificationStatus === 'approved' && (
                    <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                      <Text style={{ color: '#065F46', fontSize: 10, fontWeight: '700' }}>✓ ยืนยันแล้ว</Text>
                    </View>
                  )}
                  {(user as any)?.licenseVerificationStatus === 'rejected' && (
                    <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                      <Text style={{ color: '#B91C1C', fontSize: 10, fontWeight: '700' }}>✗ ไม่ผ่าน</Text>
                    </View>
                  )}
                </View>
                <TextInput
                  style={[profileEditStyles.fieldInput, { color: colors.text }]}
                  value={editForm.licenseNumber}
                  onChangeText={(t) => setEditForm({ ...editForm, licenseNumber: t })}
                  placeholder="เลขที่ใบอนุญาต เช่น ผ.12345"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {/* Pending license display */}
            {(user as any)?.pendingLicenseNumber && (user as any)?.licenseVerificationStatus === 'pending' && (
              <View style={[profileEditStyles.infoBanner, { backgroundColor: '#FFF8E1', borderColor: '#F59E0B' }]}>
                <Ionicons name="time-outline" size={16} color="#F59E0B" style={{ marginRight: 8 }} />
                <Text style={{ color: '#92400E', fontSize: 12, flex: 1 }}>
                  เลขที่รอตรวจสอบ: <Text style={{ fontWeight: '700' }}>{(user as any).pendingLicenseNumber}</Text>
                  {'\n'}จะแสดงบนโปรไฟล์หลังจากได้รับการอนุมัติ
                </Text>
              </View>
            )}

            {/* License changed info banner */}
            {editForm.licenseNumber.trim() !== (user?.licenseNumber || '').trim() && editForm.licenseNumber.trim() !== '' && (
              <View style={[profileEditStyles.infoBanner, { backgroundColor: '#EDE9FE', borderColor: '#7C3AED' }]}>
                <Ionicons name="information-circle-outline" size={16} color="#7C3AED" style={{ marginRight: 8 }} />
                <Text style={{ color: '#4C1D95', fontSize: 12, flex: 1 }}>
                  เลขใบประกอบวิชาชีพใหม่จะถูกส่งเพื่อรอการตรวจสอบจากผู้ดูแลระบบก่อนแสดงบนโปรไฟล์
                </Text>
              </View>
            )}

            {/* ประสบการณ์ */}
            <View style={[profileEditStyles.fieldBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={profileEditStyles.fieldIcon}>
                <Ionicons name="briefcase-outline" size={18} color="#059669" />
              </View>
              <View style={profileEditStyles.fieldContent}>
                <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary }]}>ประสบการณ์ทำงาน (ปี)</Text>
                <TextInput
                  style={[profileEditStyles.fieldInput, { color: colors.text }]}
                  value={editForm.experience}
                  onChangeText={(t) => setEditForm({ ...editForm, experience: t.replace(/[^0-9]/g, '') })}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          </View>

          {/* ── SECTION: เกี่ยวกับฉัน ── */}
          <View style={profileEditStyles.section}>
            <View style={profileEditStyles.sectionHeader}>
              <View style={[profileEditStyles.sectionDot, { backgroundColor: '#0EA5E9' }]} />
              <Text style={[profileEditStyles.sectionTitle, { color: colors.text }]}>เกี่ยวกับฉัน</Text>
            </View>
            <View style={[profileEditStyles.fieldBox, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'flex-start', minHeight: 100 }]}>
              <View style={[profileEditStyles.fieldIcon, { marginTop: 10 }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#0EA5E9" />
              </View>
              <View style={[profileEditStyles.fieldContent, { paddingTop: 10 }]}>
                <Text style={[profileEditStyles.fieldLabel, { color: colors.textSecondary, marginBottom: 4 }]}>บรรยายตัวเอง</Text>
                <TextInput
                  style={[profileEditStyles.fieldInput, { color: colors.text, minHeight: 80, textAlignVertical: 'top' }]}
                  value={editForm.bio}
                  onChangeText={(t) => setEditForm({ ...editForm, bio: t })}
                  placeholder="บอกเล่าเกี่ยวกับตัวคุณ ความเชี่ยวชาญ และสิ่งที่คุณมองหา..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                />
              </View>
            </View>
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>

        {/* Action Buttons */}
        <View style={[styles.editModalActions, { paddingBottom: Math.max(insets.bottom, 16) + SPACING.md }]}>
          <TouchableOpacity
            onPress={() => { setShowEditModal(false); setPhoneStep('idle'); }}
            style={[profileEditStyles.actionBtn, { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, marginRight: 10 }]}
          >
            <Text style={{ color: colors.text, fontWeight: '600', fontSize: 16 }}>ยกเลิก</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSaveProfile}
            disabled={isAuthLoading || phoneStep === 'sending' || phoneStep === 'verify'}
            style={[profileEditStyles.actionBtn, {
              backgroundColor: (isAuthLoading || phoneStep === 'sending' || phoneStep === 'verify') ? colors.border : colors.primary,
              flex: 1.5,
            }]}
          >
            {isAuthLoading
              ? <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>กำลังบันทึก…</Text>
              : phoneStep === 'verify' || phoneStep === 'sending'
                ? <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 14 }}>ยืนยัน OTP ก่อนบันทึก</Text>
                : editForm.phone.trim() !== (user?.phone || '').trim() && editForm.phone.trim() !== '' && phoneStep === 'idle'
                  ? <><Ionicons name="shield-outline" size={16} color="#fff" style={{ marginRight: 6 }} /><Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>ขอ OTP & บันทึก</Text></>
                  : <><Ionicons name="checkmark-circle-outline" size={16} color="#fff" style={{ marginRight: 6 }} /><Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>บันทึกข้อมูล</Text></>
            }
          </TouchableOpacity>
        </View>
      </ModalContainer>

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        visible={showLogoutModal}
        title="ออกจากระบบ"
        message="คุณต้องการออกจากระบบหรือไม่?"
        icon="🚪"
        confirmText="ออกจากระบบ"
        cancelText="ยกเลิก"
        type="danger"
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutModal(false)}
      />

      {/* Delete Contact Confirmation Modal */}
      <ConfirmModal
        visible={showDeleteContactModal}
        title="ลบออกจากประวัติ"
        message={pendingDeleteContact ? `ต้องการลบ "${pendingDeleteContact.title}" ออกจากประวัติการติดต่อ?` : ''}
        icon="🗑️"
        confirmText="ลบ"
        cancelText="ยกเลิก"
        type="danger"
        onConfirm={confirmDeleteContact}
        onCancel={() => { setShowDeleteContactModal(false); setPendingDeleteContact(null); }}
      />

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccessModal}
        title={modalTitle}
        message={modalMessage}
        onClose={() => setShowSuccessModal(false)}
      />

      {/* Error Modal */}
      <ErrorModal
        visible={showErrorModal}
        title={modalTitle}
        message={modalMessage}
        onClose={() => setShowErrorModal(false)}
      />
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

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  logoutText: {
    color: COLORS.danger,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  logoutButton: {
    padding: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#FEE2E2',
    borderRadius: BORDER_RADIUS.md,
  },

  // Profile Card
  profileCard: {
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.xl,
    ...SHADOWS.medium,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: SPACING.md,
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.surface,
  },
  editAvatarIcon: {
    fontSize: 16,
  },
  displayName: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  email: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    marginTop: SPACING.sm,
  },

  // Info Card
  infoCard: {
    margin: SPACING.md,
    marginTop: SPACING.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
    width: 30,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  infoValue: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    marginTop: 2,
  },

  // Section
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },

  // Applications
  applicationsSection: {
    padding: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  applicationCount: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  applicationCard: {
    marginBottom: SPACING.sm,
  },
  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  applicationInfo: {
    flex: 1,
  },
  applicationJobTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  applicationHospital: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  applicationDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },

  // Empty State
  emptyCard: {
    alignItems: 'center',
    padding: SPACING.lg,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },

  // Links Card
  linksCard: {
    margin: SPACING.md,
    padding: 0,
    overflow: 'hidden',
  },
  linksSectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    padding: SPACING.md,
    paddingBottom: SPACING.sm,
    backgroundColor: COLORS.background,
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
  },
  linkIcon: {
    fontSize: 20,
    marginRight: SPACING.sm,
    width: 30,
  },
  linkText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  linkArrow: {
    fontSize: 16,
    color: COLORS.textMuted,
  },
  adminLink: {
    backgroundColor: '#FEF3C7', // Light amber background
  },
  adminLinkText: {
    color: '#B45309', // Amber color for admin text
    fontWeight: '600',
  },
  countBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: SPACING.sm,
  },
  notificationBadge: {
    backgroundColor: COLORS.danger,
  },
  countText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },

  // Guest View
  guestContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  guestIcon: {
    fontSize: 80,
    marginBottom: SPACING.md,
  },
  guestTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  guestDescription: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },

  // Edit Modal
  editModalContent: {
    flex: 1,
    padding: SPACING.md,
  },
  bioInput: {
    marginBottom: SPACING.md,
  },
  bioLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  bioTextInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    minHeight: 100,
    backgroundColor: COLORS.surface,
  },
  editModalActions: {
    flexDirection: 'row',
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
});

// ── New Edit Modal Styles ──
const profileEditStyles = StyleSheet.create({
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionDot: {
    width: 4,
    height: 20,
    borderRadius: 2,
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  fieldIcon: {
    width: 32,
    alignItems: 'center',
    marginRight: 10,
  },
  fieldContent: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldInput: {
    fontSize: 15,
    fontWeight: '500',
    paddingVertical: 2,
  },
  verifiedBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: 8,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
    marginTop: -4,
  },
  otpBox: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    marginTop: -4,
  },
  otpConfirmBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 14,
  },
});

