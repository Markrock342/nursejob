import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { KittenButton as Button, Card, Input, ModalContainer } from '../../components/common';
import CalendarPicker from '../../components/common/CalendarPicker';
import CustomAlert, { AlertState, createAlert, initialAlertState } from '../../components/common/CustomAlert';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { BORDER_RADIUS, COLORS, FONT_SIZES, SPACING } from '../../theme';
import {
  pickImage,
  takePhoto,
  uploadIdCard,
  uploadLicenseDocument,
  uploadVerificationDocument,
} from '../../services/storageService';
import {
  getLicenseTypeLabel,
  getPendingVerificationRequest,
  getUserVerificationStatus,
  getVerificationFlowConfig,
  LICENSE_TYPES,
  submitVerificationRequest,
  validateLicenseNumber,
  UserVerificationStatus,
  VerificationRequest,
} from '../../services/verificationService';
import { getSurveySelectionTags } from '../../utils/verificationTag';

interface Props {
  navigation: any;
}

type DocumentKey = 'license' | 'employeeCard' | 'idCard' | 'declaration';

export default function VerificationScreen({ navigation }: Props) {
  const { user, isInitialized } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const headerBackground = colors.surface;
  const statusBarStyle = isDark ? 'light-content' : 'dark-content';

  const flow = useMemo(
    () => getVerificationFlowConfig(user?.role, (user as any)?.orgType),
    [user?.role, (user as any)?.orgType]
  );
  const surveyTags = useMemo(
    () => getSurveySelectionTags({
      role: user?.role,
      orgType: (user as any)?.orgType,
      staffType: (user as any)?.staffType,
      staffTypes: (user as any)?.staffTypes,
    }),
    [user?.role, (user as any)?.orgType, (user as any)?.staffType, (user as any)?.staffTypes]
  );

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<UserVerificationStatus | null>(null);
  const [pendingRequest, setPendingRequest] = useState<VerificationRequest | null>(null);
  const [firstName, setFirstName] = useState((user as any)?.firstName || '');
  const [lastName, setLastName] = useState((user as any)?.lastName || '');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseType, setLicenseType] = useState<string>('nurse');
  const [licenseExpiry, setLicenseExpiry] = useState(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
  const [documentUris, setDocumentUris] = useState<Record<DocumentKey, string | null>>({
    license: null,
    employeeCard: null,
    idCard: null,
    declaration: null,
  });
  const [showLicenseTypeModal, setShowLicenseTypeModal] = useState(false);
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [currentDocumentKey, setCurrentDocumentKey] = useState<DocumentKey>('license');
  const [alert, setAlert] = useState<AlertState>(initialAlertState);

  const closeAlert = () => setAlert(initialAlertState);

  useEffect(() => {
    if (!user?.uid || !isInitialized) return;

    const loadVerificationStatus = async () => {
      setIsLoading(true);
      try {
        const status = await getUserVerificationStatus(user.uid);
        setVerificationStatus(status);
        if (status.pendingRequest) {
          const pending = await getPendingVerificationRequest(user.uid);
          setPendingRequest(pending);
        } else {
          setPendingRequest(null);
        }
      } catch (error) {
        console.error('Error loading verification status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    void loadVerificationStatus();
  }, [isInitialized, user?.uid]);

  const openDocumentPicker = (key: DocumentKey) => {
    setCurrentDocumentKey(key);
    setShowImagePickerModal(true);
  };

  const assignDocumentUri = (uri: string | null) => {
    if (!uri) return;
    setDocumentUris((prev) => ({ ...prev, [currentDocumentKey]: uri }));
  };

  const selectFromGallery = async () => {
    setShowImagePickerModal(false);
    try {
      assignDocumentUri(await pickImage());
    } catch (error: any) {
      setAlert(createAlert.error('ข้อผิดพลาด', error.message) as AlertState);
    }
  };

  const takePhotoCamera = async () => {
    setShowImagePickerModal(false);
    try {
      assignDocumentUri(await takePhoto());
    } catch (error: any) {
      setAlert(createAlert.error('ข้อผิดพลาด', error.message) as AlertState);
    }
  };

  const validateForm = () => {
    if (!firstName.trim()) return 'กรุณากรอกชื่อจริง';
    if (!lastName.trim()) return 'กรุณากรอกนามสกุล';
    if (flow.requiresLicenseInfo) {
      if (!licenseNumber.trim()) return 'กรุณากรอกเลขที่ใบอนุญาต';
      const licenseValidation = validateLicenseNumber(licenseNumber, licenseType);
      if (!licenseValidation.valid) return licenseValidation.error || 'รูปแบบเลขใบอนุญาตไม่ถูกต้อง';
      if (!documentUris.license) return 'กรุณาอัปโหลดใบประกอบวิชาชีพ';
    }
    if (flow.requiresEmployeeCard && !documentUris.employeeCard) return 'กรุณาอัปโหลดบัตรพนักงาน';
    if (flow.requiresIdCard && !documentUris.idCard) return 'กรุณาอัปโหลดบัตรประชาชน';
    if (flow.requiresDeclaration && !documentUris.declaration) return 'กรุณาอัปโหลดเอกสารเซ็นกำกับว่าใช้กับ NurseGo';
    return null;
  };

  const uploadDocuments = async () => {
    if (!user?.uid) return {};

    const results: Record<string, string | undefined> = {};
    if (documentUris.license) {
      results.licenseDocumentUrl = await uploadLicenseDocument(user.uid, documentUris.license, 'license.jpg');
    }
    if (documentUris.employeeCard) {
      results.employeeCardUrl = await uploadVerificationDocument(user.uid, documentUris.employeeCard, 'employee_card', 'employee-card.jpg');
    }
    if (documentUris.idCard) {
      results.idCardUrl = await uploadIdCard(user.uid, documentUris.idCard);
    }
    if (documentUris.declaration) {
      results.declarationDocumentUrl = await uploadVerificationDocument(user.uid, documentUris.declaration, 'declaration', 'declaration.jpg');
    }
    return results;
  };

  const handleSubmit = async () => {
    if (!user) return;

    const validationError = validateForm();
    if (validationError) {
      setAlert(createAlert.warning('ข้อมูลไม่ครบ', validationError) as AlertState);
      return;
    }

    setIsSubmitting(true);
    try {
      const uploadedDocuments = await uploadDocuments();
      const normalizedLicenseNumber = flow.requiresLicenseInfo
        ? validateLicenseNumber(licenseNumber, licenseType).normalizedNumber || licenseNumber.trim()
        : undefined;
      const payload: Parameters<typeof submitVerificationRequest>[0] = {
        userId: user.uid,
        userName: user.displayName || 'ไม่ระบุชื่อ',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        userEmail: user.email || '',
        userPhone: user.phone || undefined,
        role: user.role,
        orgType: (user as any)?.orgType,
        staffType: (user as any)?.staffType,
        staffTypes: (user as any)?.staffTypes || ((user as any)?.staffType ? [(user as any).staffType] : []),
        verificationType: flow.type,
        ...(flow.requiresLicenseInfo
          ? {
              licenseNumber: normalizedLicenseNumber,
              licenseType: licenseType as any,
              licenseExpiry,
            }
          : {}),
        ...uploadedDocuments,
      };

      await submitVerificationRequest(payload);
      setAlert({
        ...createAlert.success('ส่งคำขอสำเร็จ', 'คำขอยืนยันตัวตนของคุณถูกส่งแล้ว ทีมงานจะตรวจสอบภายใน 1-3 วันทำการ'),
        onConfirm: () => {
          closeAlert();
          navigation.goBack();
        },
      } as AlertState);
    } catch (error: any) {
      setAlert(createAlert.error('ข้อผิดพลาด', error.message || 'ไม่สามารถส่งคำขอยืนยันตัวตนได้') as AlertState);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderDocumentPicker = (key: DocumentKey, label: string, description: string) => {
    const uri = documentUris[key];
    return (
      <View style={styles.documentWrapper}>
        <Text style={styles.inputLabel}>{label}</Text>
        <Text style={styles.helperText}>{description}</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={() => openDocumentPicker(key)}>
          {uri ? (
            <Image source={{ uri }} style={styles.uploadPreview} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Ionicons name="document-outline" size={32} color={colors.textMuted} />
              <Text style={styles.uploadText}>แตะเพื่ออัปโหลด</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: headerBackground }]} edges={['top']}>
        <StatusBar barStyle={statusBarStyle} backgroundColor={headerBackground} translucent={false} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>กำลังโหลด...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (verificationStatus?.isVerified) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: headerBackground }]} edges={['top']}>
        <StatusBar barStyle={statusBarStyle} backgroundColor={headerBackground} translucent={false} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{flow.title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.stateContainer}>
          <Ionicons name="checkmark-circle" size={84} color={colors.success} />
          <Text style={styles.stateTitle}>{flow.verifiedTitle}</Text>
          <Text style={styles.stateSubtitle}>{flow.verifiedSubtitle}</Text>

          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>ประเภทการยืนยัน</Text>
              <Text style={styles.summaryValue}>{flow.menuLabel}</Text>
            </View>
            {verificationStatus.licenseType ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>ประเภทใบอนุญาต</Text>
                <Text style={styles.summaryValue}>{getLicenseTypeLabel(verificationStatus.licenseType)}</Text>
              </View>
            ) : null}
            {verificationStatus.licenseNumber ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>เลขที่เอกสาร</Text>
                <Text style={styles.summaryValue}>{verificationStatus.licenseNumber}</Text>
              </View>
            ) : null}
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  if (pendingRequest) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: headerBackground }]} edges={['top']}>
        <StatusBar barStyle={statusBarStyle} backgroundColor={headerBackground} translucent={false} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{flow.title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.stateContainer}>
          <Ionicons name="time-outline" size={84} color={colors.warning} />
          <Text style={styles.stateTitle}>รอการตรวจสอบ</Text>
          <Text style={styles.stateSubtitle}>คำขอยืนยันตัวตนของคุณอยู่ระหว่างการตรวจสอบ ทีมงานจะตรวจสอบภายใน 1-3 วันทำการ</Text>

          <Card style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>ประเภทการยืนยัน</Text>
              <Text style={styles.summaryValue}>{flow.menuLabel}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>ชื่อผู้ยื่น</Text>
              <Text style={styles.summaryValue}>{pendingRequest.firstName} {pendingRequest.lastName}</Text>
            </View>
            {pendingRequest.licenseNumber ? (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>เลขที่เอกสาร</Text>
                <Text style={styles.summaryValue}>{pendingRequest.licenseNumber}</Text>
              </View>
            ) : null}
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: headerBackground }]} edges={['top']}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={headerBackground} translucent={false} />
      <CustomAlert {...alert} onClose={closeAlert} />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{flow.title}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.infoBanner}>
          <View style={styles.infoBannerContent}>
            <Ionicons name="shield-checkmark" size={36} color={colors.primary} />
            <View style={styles.infoBannerTextWrap}>
              <Text style={styles.infoBannerTitle}>{flow.menuLabel}</Text>
              <Text style={styles.infoBannerSubtitle}>{flow.subtitle}</Text>
            </View>
          </View>
        </Card>

        {surveyTags.length > 0 ? (
          <Card style={styles.tagsCard}>
            <Text style={styles.sectionTitle}>Tag จาก role / survey</Text>
            <View style={styles.tagWrap}>
              {surveyTags.map((tag) => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>{tag}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>ข้อมูลผู้ยื่นคำขอ</Text>
          <Input label="ชื่อจริง" value={firstName} onChangeText={setFirstName} placeholder="กรอกชื่อจริง" required />
          <Input label="นามสกุล" value={lastName} onChangeText={setLastName} placeholder="กรอกนามสกุล" required />
        </Card>

        {flow.requiresLicenseInfo ? (
          <Card style={styles.section}>
            <Text style={styles.sectionTitle}>ข้อมูลใบอนุญาต</Text>
            <Input label="เลขที่ใบอนุญาต" value={licenseNumber} onChangeText={setLicenseNumber} placeholder="เช่น ว.12345" required />
            <Text style={styles.inputLabel}>ประเภทใบอนุญาต</Text>
            <TouchableOpacity style={styles.selectButton} onPress={() => setShowLicenseTypeModal(true)}>
              <Text style={styles.selectButtonText}>{LICENSE_TYPES.find((item) => item.value === licenseType)?.label || 'เลือกประเภท'}</Text>
              <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <CalendarPicker label="วันหมดอายุใบอนุญาต" value={licenseExpiry} onChange={setLicenseExpiry} minDate={new Date()} />
          </Card>
        ) : null}

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>เอกสารประกอบ</Text>
          {flow.requiresLicenseInfo ? renderDocumentPicker('license', 'ใบประกอบวิชาชีพ', 'อัปโหลดรูปใบประกอบวิชาชีพที่ใช้ตรวจสอบ') : null}
          {flow.requiresEmployeeCard ? renderDocumentPicker('employeeCard', 'บัตรพนักงาน / เอกสารสังกัด', 'ใช้ยืนยันว่าคุณเป็นผู้แทนของหน่วยงานนี้จริง') : null}
          {flow.requiresIdCard ? renderDocumentPicker('idCard', 'บัตรประชาชน', 'อัปโหลดเฉพาะข้อมูลที่ใช้ยืนยันตัวตนได้ชัดเจน') : null}
          {flow.requiresDeclaration ? renderDocumentPicker('declaration', 'เอกสารเซ็นกำกับว่าใช้กับ NurseGo', 'เช่น เขียนกำกับบนเอกสารว่า ใช้ยืนยันตัวตนกับ NurseGo พร้อมลายเซ็น') : null}
        </Card>

        <Card style={styles.privacyCard}>
          <View style={styles.privacyContent}>
            <Ionicons name="lock-closed-outline" size={24} color={colors.primary} />
            <Text style={styles.privacyText}>เอกสารทั้งหมดใช้เพื่อการตรวจสอบตัวตนและความน่าเชื่อถือของผู้โพสต์งานเท่านั้น</Text>
          </View>
        </Card>

        <Button title={isSubmitting ? 'กำลังส่ง...' : 'ส่งคำขอยืนยัน'} onPress={handleSubmit} loading={isSubmitting} style={styles.submitButton} />
      </ScrollView>

      <ModalContainer visible={showLicenseTypeModal} onClose={() => setShowLicenseTypeModal(false)} title="เลือกประเภทใบอนุญาต">
        {LICENSE_TYPES.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={styles.modalItem}
            onPress={() => {
              setLicenseType(type.value);
              setShowLicenseTypeModal(false);
            }}
          >
            <Text style={[styles.modalItemText, licenseType === type.value ? styles.modalItemTextSelected : null]}>{type.label}</Text>
            {licenseType === type.value ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
          </TouchableOpacity>
        ))}
      </ModalContainer>

      <ModalContainer visible={showImagePickerModal} onClose={() => setShowImagePickerModal(false)} title="เลือกรูปเอกสาร">
        <TouchableOpacity style={styles.modalItem} onPress={selectFromGallery}>
          <Ionicons name="images-outline" size={24} color={colors.primary} />
          <Text style={styles.modalItemText}>เลือกจากคลังรูปภาพ</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modalItem} onPress={takePhotoCamera}>
          <Ionicons name="camera-outline" size={24} color={colors.primary} />
          <Text style={styles.modalItemText}>ถ่ายรูป</Text>
        </TouchableOpacity>
      </ModalContainer>
    </SafeAreaView>
  );
}

const createStyles = (COLORS: any) => StyleSheet.create({
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
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSpacer: {
    width: 24,
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
  infoBanner: {
    marginBottom: SPACING.md,
    backgroundColor: COLORS.primaryLight,
  },
  infoBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  infoBannerTextWrap: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '700',
    color: COLORS.primary,
    marginBottom: 4,
  },
  infoBannerSubtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  tagsCard: {
    marginBottom: SPACING.md,
  },
  section: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: '#E0E7FF',
  },
  tagChipText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
    color: '#4338CA',
  },
  inputLabel: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  helperText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    lineHeight: 18,
    marginBottom: 8,
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
  documentWrapper: {
    marginBottom: SPACING.md,
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
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
    height: 180,
    resizeMode: 'cover',
  },
  privacyCard: {
    backgroundColor: COLORS.backgroundSecondary,
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
  submitButton: {
    marginVertical: SPACING.lg,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    gap: 10,
  },
  modalItemText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  modalItemTextSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  stateContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  stateTitle: {
    marginTop: SPACING.lg,
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  stateSubtitle: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  summaryCard: {
    width: '100%',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    flex: 1,
  },
  summaryValue: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
});

