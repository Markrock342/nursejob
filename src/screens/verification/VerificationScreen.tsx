// ============================================
// VERIFICATION SCREEN - ยืนยันตัวตนพยาบาล
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../theme';
import { KittenButton as Button, Card, Input, ModalContainer } from '../../components/common';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { 
  pickImage, 
  takePhoto, 
  pickDocument,
  uploadLicenseDocument,
  uploadIdCard,
  uploadProfilePhoto,
} from '../../services/storageService';
import {
  submitVerificationRequest,
  getUserVerificationStatus,
  getPendingVerificationRequest,
  LICENSE_TYPES,
  UserVerificationStatus,
  VerificationRequest,
} from '../../services/verificationService';
import { CalendarPicker } from '../../components/common';
import CustomAlert, { AlertState, initialAlertState, createAlert } from '../../components/common/CustomAlert';

interface Props {
  navigation: any;
}

export default function VerificationScreen({ navigation }: Props) {
  const { user, isInitialized } = useAuth();
  const { colors } = useTheme();
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<UserVerificationStatus | null>(null);
  const [pendingRequest, setPendingRequest] = useState<VerificationRequest | null>(null);
  
  // Form state
  const [firstName, setFirstName] = useState((user as any)?.firstName || '');
  const [lastName, setLastName] = useState((user as any)?.lastName || '');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseType, setLicenseType] = useState<string>('nurse');
  const [licenseExpiry, setLicenseExpiry] = useState(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
  const [licenseDocUri, setLicenseDocUri] = useState<string | null>(null);
  const [idCardUri, setIdCardUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  
  // Modals
  const [showLicenseTypeModal, setShowLicenseTypeModal] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [currentImageType, setCurrentImageType] = useState<'license' | 'idcard' | 'selfie'>('license');
  const [alert, setAlert] = useState<AlertState>(initialAlertState);
  const closeAlert = () => setAlert(initialAlertState);

  useEffect(() => {
    if (user?.uid && isInitialized) {
      loadVerificationStatus();
    }
  }, [user?.uid, isInitialized]);

  useEffect(() => {
    if ((user as any)?.firstName && !firstName) {
      setFirstName((user as any).firstName);
    }
    if ((user as any)?.lastName && !lastName) {
      setLastName((user as any).lastName);
    }
  }, [user, firstName, lastName]);

  const loadVerificationStatus = async () => {
    if (!user?.uid) return;
    
    setIsLoading(true);
    try {
      const status = await getUserVerificationStatus(user.uid);
      setVerificationStatus(status);
      
      if (status.pendingRequest) {
        const pending = await getPendingVerificationRequest(user.uid);
        setPendingRequest(pending);
      }
    } catch (error) {
      console.error('Error loading verification status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickImage = async (type: 'license' | 'idcard' | 'selfie') => {
    setCurrentImageType(type);
    setShowImagePickerModal(true);
  };

  const selectFromGallery = async () => {
    setShowImagePickerModal(false);
    try {
      const uri = await pickImage();
      if (uri) {
        switch (currentImageType) {
          case 'license':
            setLicenseDocUri(uri);
            break;
          case 'idcard':
            setIdCardUri(uri);
            break;
          case 'selfie':
            setSelfieUri(uri);
            break;
        }
      }
    } catch (error: any) {
      setAlert({ ...createAlert.error('ข้อผิดพลาด', error.message) } as AlertState);
    }
  };

  const takePhotoCamera = async () => {
    setShowImagePickerModal(false);
    try {
      const uri = await takePhoto();
      if (uri) {
        switch (currentImageType) {
          case 'license':
            setLicenseDocUri(uri);
            break;
          case 'idcard':
            setIdCardUri(uri);
            break;
          case 'selfie':
            setSelfieUri(uri);
            break;
        }
      }
    } catch (error: any) {
      setAlert({ ...createAlert.error('ข้อผิดพลาด', error.message) } as AlertState);
    }
  };

  const handlePickDocument = async () => {
    try {
      const doc = await pickDocument();
      if (doc) {
        setLicenseDocUri(doc.uri);
      }
    } catch (error: any) {
      setAlert({ ...createAlert.error('ข้อผิดพลาด', error.message) } as AlertState);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    // Validation
    if (!firstName.trim()) {
      setAlert({ ...createAlert.warning('ข้อผิดพลาด', 'กรุณากรอกชื่อจริง') } as AlertState);
      return;
    }
    if (!lastName.trim()) {
      setAlert({ ...createAlert.warning('ข้อผิดพลาด', 'กรุณากรอกนามสกุล') } as AlertState);
      return;
    }
    if (!licenseNumber.trim()) {
      setAlert({ ...createAlert.warning('ข้อผิดพลาด', 'กรุณากรอกเลขที่ใบอนุญาต') } as AlertState);
      return;
    }
    if (!licenseDocUri) {
      setAlert({ ...createAlert.warning('ข้อผิดพลาด', 'กรุณาอัพโหลดรูปใบประกอบวิชาชีพ') } as AlertState);
      return;
    }
    
    setIsSubmitting(true);
    try {
      // Upload documents
      const licenseUrl = await uploadLicenseDocument(user.uid, licenseDocUri, 'license.jpg');
      
      let idCardUrl: string | undefined;
      if (idCardUri) {
        idCardUrl = await uploadIdCard(user.uid, idCardUri);
      }
      
      let selfieUrl: string | undefined;
      if (selfieUri) {
        selfieUrl = await uploadProfilePhoto(user.uid, selfieUri);
      }
      
      // Submit request
      const verificationPayload: Parameters<typeof submitVerificationRequest>[0] = {
        userId: user.uid,
        userName: user.displayName || 'ไม่ระบุชื่อ',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        userEmail: user.email || '',
        licenseNumber: licenseNumber.trim(),
        licenseType: licenseType as any,
        licenseExpiry,
        licenseDocumentUrl: licenseUrl,
      };
      // only include optional fields when they have real values (Firestore rejects undefined)
      if (user.phone) verificationPayload.userPhone = user.phone;
      if (idCardUrl) verificationPayload.idCardUrl = idCardUrl;
      if (selfieUrl) verificationPayload.selfieUrl = selfieUrl;

      await submitVerificationRequest(verificationPayload);
      
      setAlert({
        ...createAlert.success('ส่งคำขอสำเร็จ', 'คำขอยืนยันตัวตนของคุณถูกส่งแล้ว ทีมงานจะตรวจสอบภายใน 1-3 วันทำการ'),
        onConfirm: () => { closeAlert(); navigation.goBack(); },
      } as AlertState);
    } catch (error: any) {
      setAlert({ ...createAlert.error('ข้อผิดพลาด', error.message) } as AlertState);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>กำลังโหลด...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (user?.role !== 'nurse') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ยืนยันตัวตน</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.pendingContainer}>
          <View style={styles.pendingBadge}>
            <Ionicons name="lock-closed-outline" size={80} color={colors.textSecondary} />
          </View>
          <Text style={styles.pendingTitle}>ฟีเจอร์นี้สำหรับพยาบาลเท่านั้น</Text>
          <Text style={styles.pendingSubtitle}>
            การยื่นใบประกอบวิชาชีพเพื่อยืนยันตัวตน ใช้สำหรับบัญชี role พยาบาลเท่านั้น
          </Text>

          <Button
            title="กลับ"
            onPress={() => navigation.goBack()}
            variant="outline"
            style={{ marginTop: SPACING.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Already verified
  if (verificationStatus?.isVerified) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ยืนยันตัวตน</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.verifiedContainer}>
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={80} color="#4ADE80" />
          </View>
          <Text style={styles.verifiedTitle}>ยืนยันตัวตนแล้ว ✓</Text>
          <Text style={styles.verifiedSubtitle}>
            บัญชีของคุณได้รับการยืนยันเป็นพยาบาลวิชาชีพแล้ว
          </Text>
          
          <Card style={styles.licenseCard}>
            <View style={styles.licenseRow}>
              <Text style={styles.licenseLabel}>ประเภท:</Text>
              <Text style={styles.licenseValue}>
                {LICENSE_TYPES.find(t => t.value === verificationStatus.licenseType)?.label || verificationStatus.licenseType}
              </Text>
            </View>
            <View style={styles.licenseRow}>
              <Text style={styles.licenseLabel}>เลขที่ใบอนุญาต:</Text>
              <Text style={styles.licenseValue}>{verificationStatus.licenseNumber}</Text>
            </View>
            {verificationStatus.licenseExpiry && (
              <View style={styles.licenseRow}>
                <Text style={styles.licenseLabel}>วันหมดอายุ:</Text>
                <Text style={styles.licenseValue}>
                  {verificationStatus.licenseExpiry.toLocaleDateString('th-TH')}
                </Text>
              </View>
            )}
          </Card>
          
          <Button
            title="กลับ"
            onPress={() => navigation.goBack()}
            variant="outline"
            style={{ marginTop: SPACING.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Pending request
  if (pendingRequest) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ยืนยันตัวตน</Text>
          <View style={{ width: 24 }} />
        </View>
        
        <View style={styles.pendingContainer}>
          <View style={styles.pendingBadge}>
            <Ionicons name="time-outline" size={80} color={colors.warning} />
          </View>
          <Text style={styles.pendingTitle}>รอการตรวจสอบ</Text>
          <Text style={styles.pendingSubtitle}>
            คำขอยืนยันตัวตนของคุณอยู่ระหว่างการตรวจสอบ{'\n'}
            โดยปกติจะใช้เวลา 1-3 วันทำการ
          </Text>
          
          <Card style={styles.pendingCard}>
            <Text style={styles.pendingCardTitle}>รายละเอียดคำขอ</Text>
            <View style={styles.licenseRow}>
              <Text style={styles.licenseLabel}>ชื่อ-นามสกุล:</Text>
              <Text style={styles.licenseValue}>{pendingRequest.firstName} {pendingRequest.lastName}</Text>
            </View>
            <View style={styles.licenseRow}>
              <Text style={styles.licenseLabel}>เลขที่ใบอนุญาต:</Text>
              <Text style={styles.licenseValue}>{pendingRequest.licenseNumber}</Text>
            </View>
            <View style={styles.licenseRow}>
              <Text style={styles.licenseLabel}>ส่งเมื่อ:</Text>
              <Text style={styles.licenseValue}>
                {pendingRequest.submittedAt.toLocaleDateString('th-TH')}
              </Text>
            </View>
          </Card>
          
          <Button
            title="กลับ"
            onPress={() => navigation.goBack()}
            variant="outline"
            style={{ marginTop: SPACING.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Show form
  return (
    <SafeAreaView style={styles.container}>
      <CustomAlert {...alert} onClose={closeAlert} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ยืนยันตัวตน</Text>
        <View style={{ width: 24 }} />
      </View>
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <Card style={styles.infoBanner}>
          <View style={styles.infoBannerContent}>
            <Ionicons name="shield-checkmark" size={40} color={colors.primary} />
            <View style={styles.infoBannerText}>
              <Text style={styles.infoBannerTitle}>ยืนยันตัวตนเพื่อเพิ่มความน่าเชื่อถือ</Text>
              <Text style={styles.infoBannerSubtitle}>
                โปรไฟล์ที่ได้รับการยืนยันจะแสดง ✓ หลังชื่อ{'\n'}
                ทำให้ผู้ว่าจ้างมั่นใจมากขึ้น
              </Text>
            </View>
          </View>
        </Card>

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>ข้อมูลผู้ยื่นคำขอ</Text>

          <Input
            label="ชื่อจริง *"
            placeholder="กรอกชื่อจริง"
            value={firstName}
            onChangeText={setFirstName}
          />

          <Input
            label="นามสกุล *"
            placeholder="กรอกนามสกุล"
            value={lastName}
            onChangeText={setLastName}
          />
        </Card>

        {/* License Number */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>ข้อมูลใบอนุญาต</Text>
          
          <Input
            label="เลขที่ใบประกอบวิชาชีพ *"
            placeholder="เช่น ก.12345"
            value={licenseNumber}
            onChangeText={setLicenseNumber}
          />
          
          {/* License Type */}
          <Text style={styles.inputLabel}>ประเภทใบอนุญาต *</Text>
          <TouchableOpacity
            style={styles.selectButton}
            onPress={() => setShowLicenseTypeModal(true)}
          >
            <Text style={styles.selectButtonText}>
              {LICENSE_TYPES.find(t => t.value === licenseType)?.label || 'เลือกประเภท'}
            </Text>
            <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          
          {/* License Expiry */}
          <CalendarPicker
            label="วันหมดอายุใบอนุญาต *"
            value={licenseExpiry}
            onChange={setLicenseExpiry}
            minDate={new Date()}
          />
        </Card>

        {/* Document Upload */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>อัพโหลดเอกสาร</Text>
          
          {/* License Document */}
          <Text style={styles.inputLabel}>รูปใบประกอบวิชาชีพ *</Text>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => handlePickImage('license')}
          >
            {licenseDocUri ? (
              <Image source={{ uri: licenseDocUri }} style={styles.uploadPreview} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="document-outline" size={40} color={colors.textMuted} />
                <Text style={styles.uploadText}>แตะเพื่ออัพโหลด</Text>
              </View>
            )}
          </TouchableOpacity>
          
          {/* ID Card (optional) */}
          <Text style={styles.inputLabel}>รูปบัตรประชาชน (ไม่บังคับ)</Text>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => handlePickImage('idcard')}
          >
            {idCardUri ? (
              <Image source={{ uri: idCardUri }} style={styles.uploadPreview} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="card-outline" size={40} color={colors.textMuted} />
                <Text style={styles.uploadText}>แตะเพื่ออัพโหลด</Text>
              </View>
            )}
          </TouchableOpacity>
          
          {/* Selfie (optional) */}
          <Text style={styles.inputLabel}>รูปถ่ายหน้าตรง (ไม่บังคับ)</Text>
          <TouchableOpacity
            style={styles.uploadButton}
            onPress={() => handlePickImage('selfie')}
          >
            {selfieUri ? (
              <Image source={{ uri: selfieUri }} style={styles.uploadPreview} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="person-circle-outline" size={40} color={colors.textMuted} />
                <Text style={styles.uploadText}>แตะเพื่ออัพโหลด</Text>
              </View>
            )}
          </TouchableOpacity>
        </Card>

        {/* Privacy Notice */}
        <Card style={{...styles.section, ...styles.privacyCard}}>
          <View style={styles.privacyContent}>
            <Ionicons name="lock-closed-outline" size={24} color={colors.primary} />
            <Text style={styles.privacyText}>
              ข้อมูลและเอกสารของคุณจะถูกเก็บรักษาอย่างปลอดภัย
              และใช้เพื่อการตรวจสอบเท่านั้น
            </Text>
          </View>
        </Card>

        {/* Submit Button */}
        <Button
          title={isSubmitting ? 'กำลังส่ง...' : 'ส่งคำขอยืนยัน'}
          onPress={handleSubmit}
          loading={isSubmitting}
          style={{ marginVertical: SPACING.lg }}
        />
      </ScrollView>

      {/* License Type Modal */}
      <ModalContainer
        visible={showLicenseTypeModal}
        onClose={() => setShowLicenseTypeModal(false)}
        title="เลือกประเภทใบอนุญาต"
      >
        {LICENSE_TYPES.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={styles.modalItem}
            onPress={() => {
              setLicenseType(type.value);
              setShowLicenseTypeModal(false);
            }}
          >
            <Text style={[
              styles.modalItemText,
              licenseType === type.value && styles.modalItemTextSelected
            ]}>
              {type.label}
            </Text>
            {licenseType === type.value && (
              <Ionicons name="checkmark" size={20} color={colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </ModalContainer>

      {/* Image Picker Modal */}
      <ModalContainer
        visible={showImagePickerModal}
        onClose={() => setShowImagePickerModal(false)}
        title="เลือกรูปภาพ"
      >
        <TouchableOpacity style={styles.modalItem} onPress={selectFromGallery}>
          <Ionicons name="images-outline" size={24} color={colors.primary} />
          <Text style={styles.modalItemText}>เลือกจากคลังรูปภาพ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modalItem} onPress={takePhotoCamera}>
          <Ionicons name="camera-outline" size={24} color={colors.primary} />
          <Text style={styles.modalItemText}>ถ่ายรูป</Text>
        </TouchableOpacity>
        {currentImageType === 'license' && (
          <TouchableOpacity style={styles.modalItem} onPress={handlePickDocument}>
            <Ionicons name="document-outline" size={24} color={colors.primary} />
            <Text style={styles.modalItemText}>เลือกไฟล์ PDF</Text>
          </TouchableOpacity>
        )}
      </ModalContainer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  headerTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  content: {
    flex: 1,
    padding: SPACING.md,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
  },
  
  // Info Banner
  infoBanner: {
    backgroundColor: COLORS.primaryLight,
    marginBottom: SPACING.md,
  },
  infoBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  infoBannerText: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 4,
  },
  infoBannerSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  
  // Section
  section: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  inputLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
  },
  selectButtonText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  
  // Upload
  uploadButton: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  uploadPlaceholder: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background,
  },
  uploadText: {
    marginTop: SPACING.sm,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textMuted,
  },
  uploadPreview: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  
  // Privacy
  privacyCard: {
    backgroundColor: COLORS.background,
  },
  privacyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  privacyText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  
  // Verified State
  verifiedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  verifiedBadge: {
    marginBottom: SPACING.lg,
  },
  verifiedTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: '#4ADE80',
    marginBottom: SPACING.sm,
  },
  verifiedSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  licenseCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
  },
  licenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  licenseLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  licenseValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },
  
  // Pending State
  pendingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  pendingBadge: {
    marginBottom: SPACING.lg,
  },
  pendingTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.warning,
    marginBottom: SPACING.sm,
  },
  pendingSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.lg,
    lineHeight: 24,
  },
  pendingCard: {
    width: '100%',
    backgroundColor: COLORS.surface,
  },
  pendingCardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  
  // Modal
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  modalItemText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  modalItemTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
});

