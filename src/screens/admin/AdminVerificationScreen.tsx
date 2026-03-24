// ============================================
// ADMIN VERIFICATION SCREEN - ตรวจสอบการยืนยันตัวตน
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { Avatar, Button, Card, ModalContainer } from '../../components/common';
import {
  getAllPendingVerifications,
  approveVerificationRequest,
  getVerificationTypeLabel,
  rejectVerificationRequest,
  VerificationRequest,
  LICENSE_TYPES,
} from '../../services/verificationService';
import { AdminPendingDocument, getAllPendingDocuments } from '../../services/adminService';
import { rejectDocument, verifyDocument } from '../../services/documentsService';
import { formatRelativeTime } from '../../utils/helpers';

type AdminReviewTab = 'verification' | 'documents';

function toDisplayDate(value?: Date | { toDate?: () => Date } | null) {
  if (!value) return '-';
  const date = value instanceof Date ? value : value.toDate?.();
  return date ? date.toLocaleDateString('th-TH') : '-';
}

export default function AdminVerificationScreen() {
  const navigation = useNavigation();
  const { user, isAdmin } = useAuth();
  
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [documents, setDocuments] = useState<AdminPendingDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<AdminPendingDocument | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminReviewTab>('verification');

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const [verificationData, documentData] = await Promise.all([
        getAllPendingVerifications(),
        getAllPendingDocuments(),
      ]);
      setRequests(verificationData);
      setDocuments(documentData);
    } catch (error) {
      console.error('Error loading verifications:', error);
      Alert.alert('โหลดข้อมูลไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadRequests();
  };

  const handleApprove = async () => {
    if (!selectedRequest || !user?.uid) return;
    
    setIsProcessing(true);
    try {
      await approveVerificationRequest(selectedRequest.id!, user.uid);
      setRequests(prev => prev.filter(r => r.id !== selectedRequest.id));
      setShowDetailModal(false);
      setSelectedRequest(null);
      Alert.alert('✅ อนุมัติสำเร็จ', 'ผู้ใช้ได้รับการยืนยันตัวตนแล้ว');
    } catch (error: any) {
      Alert.alert('ข้อผิดพลาด', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveDocument = async () => {
    if (!selectedDocument || !user?.uid) return;

    setIsProcessing(true);
    try {
      await verifyDocument(selectedDocument.id, user.uid);
      setDocuments((prev) => prev.filter((item) => item.id !== selectedDocument.id));
      setShowDetailModal(false);
      setSelectedDocument(null);
      Alert.alert('✅ อนุมัติสำเร็จ', 'เอกสารถูกอนุมัติเรียบร้อยแล้ว');
    } catch (error: any) {
      setShowDetailModal(false);
      Alert.alert('ข้อผิดพลาด', error.message || 'ไม่สามารถอนุมัติเอกสารได้');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectDocument = async () => {
    if (!selectedDocument || !user?.uid) return;

    if (!rejectReason.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาระบุเหตุผลในการปฏิเสธ');
      return;
    }

    setIsProcessing(true);
    try {
      await rejectDocument(selectedDocument.id, user.uid, rejectReason.trim());
      setDocuments((prev) => prev.filter((item) => item.id !== selectedDocument.id));
      setSelectedDocument(null);
      setRejectReason('');
      setShowRejectModal(false);
      setShowDetailModal(false);
      Alert.alert('❌ ปฏิเสธแล้ว', 'เอกสารถูกปฏิเสธเรียบร้อย');
    } catch (error: any) {
      setShowRejectModal(false);
      setShowDetailModal(false);
      Alert.alert('ข้อผิดพลาด', error.message || 'ไม่สามารถปฏิเสธเอกสารได้');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !user?.uid) return;
    
    if (!rejectReason.trim()) {
      Alert.alert('ข้อผิดพลาด', 'กรุณาระบุเหตุผลในการปฏิเสธ');
      return;
    }
    
    setIsProcessing(true);
    try {
      await rejectVerificationRequest(selectedRequest.id!, user.uid, rejectReason);
      setRequests(prev => prev.filter(r => r.id !== selectedRequest.id));
      setSelectedRequest(null);
      setRejectReason('');
      setShowRejectModal(false);
      setShowDetailModal(false);
      Alert.alert('❌ ปฏิเสธแล้ว', 'คำขอถูกปฏิเสธเรียบร้อย');
    } catch (error: any) {
      setShowRejectModal(false);
      setShowDetailModal(false);
      Alert.alert('ข้อผิดพลาด', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const openDocument = (url: string) => {
    Linking.openURL(url).catch(() => {
      Alert.alert('ข้อผิดพลาด', 'ไม่สามารถเปิดเอกสารได้');
    });
  };

  const openTNMCVerification = () => {
    Linking.openURL('https://verifynm.tnmc.or.th/verify');
  };

  const getLicenseTypeLabel = (type?: string) => {
    if (!type) return '-';
    const found = LICENSE_TYPES.find(t => t.value === type);
    return found?.label || type;
  };

  const renderRequest = ({ item }: { item: VerificationRequest }) => (
    <TouchableOpacity
      style={styles.requestCard}
      onPress={() => {
        setSelectedRequest(item);
        setSelectedDocument(null);
        setShowDetailModal(true);
      }}
    >
      <View style={styles.requestHeader}>
        <Avatar uri={item.userPhotoURL} name={item.userName} size={50} />
        <View style={styles.requestInfo}>
          <Text style={styles.requestName}>{item.userName}</Text>
          <Text style={styles.requestEmail}>{item.firstName} {item.lastName}</Text>
          <Text style={styles.requestEmail}>{item.userEmail}</Text>
          <Text style={styles.requestDate}>
            ส่งเมื่อ {formatRelativeTime(item.submittedAt)}
          </Text>
        </View>
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>รอตรวจ</Text>
        </View>
      </View>
      
      <View style={styles.requestDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>ประเภทการยืนยัน:</Text>
          <Text style={styles.detailValue}>{getVerificationTypeLabel(item.verificationType)}</Text>
        </View>
        {item.licenseNumber ? (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>เลขที่เอกสาร:</Text>
            <Text style={styles.detailValue}>{item.licenseNumber}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );

  const renderDocument = ({ item }: { item: AdminPendingDocument }) => (
    <TouchableOpacity
      style={styles.requestCard}
      onPress={() => {
        setSelectedDocument(item);
        setSelectedRequest(null);
        setShowDetailModal(true);
      }}
    >
      <View style={styles.requestHeader}>
        <Avatar uri={item.userPhotoURL} name={item.userName} size={50} />
        <View style={styles.requestInfo}>
          <Text style={styles.requestName}>{item.userName}</Text>
          <Text style={styles.requestEmail}>{item.userEmail || item.userId}</Text>
          <Text style={styles.requestDate}>ส่งเมื่อ {formatRelativeTime(item.createdAt)}</Text>
        </View>
        <View style={styles.pendingBadge}>
          <Text style={styles.pendingText}>รอตรวจ</Text>
        </View>
      </View>

      <View style={styles.requestDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>ประเภทเอกสาร:</Text>
          <Text style={styles.detailValue}>{item.name}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>ไฟล์:</Text>
          <Text style={styles.detailValue}>{item.fileName}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.accessDenied}>
          <Ionicons name="lock-closed" size={64} color={COLORS.error} />
          <Text style={styles.accessDeniedText}>ไม่มีสิทธิ์เข้าถึง</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>กำลังโหลด...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectedDocumentIsImage = Boolean(selectedDocument?.mimeType?.startsWith('image/'));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ตรวจสอบการยืนยันตัวตน</Text>
        <TouchableOpacity onPress={openTNMCVerification}>
          <Ionicons name="globe-outline" size={24} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      {/* Quick Link to TNMC */}
      <TouchableOpacity style={styles.tnmcBanner} onPress={openTNMCVerification}>
        <Ionicons name="open-outline" size={20} color="#FFF" />
        <Text style={styles.tnmcBannerText}>
          เปิดเว็บสภาการพยาบาล เพื่อตรวจสอบข้อมูล
        </Text>
      </TouchableOpacity>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{requests.length + documents.length}</Text>
          <Text style={styles.statLabel}>รอตรวจสอบทั้งหมด</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'verification' && styles.tabButtonActive]}
          onPress={() => setActiveTab('verification')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'verification' && styles.tabButtonTextActive]}>
            คำขอยืนยันตัวตน ({requests.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'documents' && styles.tabButtonActive]}
          onPress={() => setActiveTab('documents')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'documents' && styles.tabButtonTextActive]}>
            เอกสารของผู้ใช้ ({documents.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Requests List */}
      {activeTab === 'verification' && requests.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={64} color={COLORS.success} />
          <Text style={styles.emptyText}>ไม่มีคำขอที่รอตรวจสอบ</Text>
        </View>
      ) : (
        activeTab === 'verification' ? (
          <FlatList
            data={requests}
            renderItem={renderRequest}
            keyExtractor={(item) => item.id!}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
            }
          />
        ) : documents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color={COLORS.success} />
            <Text style={styles.emptyText}>ไม่มีเอกสารผู้ใช้ที่รอตรวจสอบ</Text>
          </View>
        ) : (
          <FlatList
            data={documents}
            renderItem={renderDocument}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
            }
          />
        )
      )}

      {/* Detail Modal */}
      <ModalContainer
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="รายละเอียดคำขอ"
        fullScreen
      >
        {selectedRequest ? (
          <View style={styles.modalShell}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              <Card style={styles.modalCard}>
                <View style={styles.modalUserHeader}>
                  <Avatar uri={selectedRequest.userPhotoURL} name={selectedRequest.userName} size={60} />
                  <View style={styles.modalUserInfo}>
                    <Text style={styles.modalUserName}>{selectedRequest.userName}</Text>
                    <Text style={styles.modalUserEmail}>{selectedRequest.firstName} {selectedRequest.lastName}</Text>
                    <Text style={styles.modalUserEmail}>{selectedRequest.userEmail}</Text>
                    {selectedRequest.userPhone && (
                      <Text style={styles.modalUserPhone}>📱 {selectedRequest.userPhone}</Text>
                    )}
                  </View>
                </View>
              </Card>

              <Card style={styles.modalCard}>
                <Text style={styles.modalSectionTitle}>ข้อมูลผู้ยื่นคำขอ</Text>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>ชื่อจริง:</Text>
                  <Text style={styles.modalInfoValue}>{selectedRequest.firstName}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>นามสกุล:</Text>
                  <Text style={styles.modalInfoValue}>{selectedRequest.lastName}</Text>
                </View>
              </Card>

              <Card style={styles.modalCard}>
                <Text style={styles.modalSectionTitle}>ข้อมูลการยืนยัน</Text>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>ประเภทการยืนยัน:</Text>
                  <Text style={styles.modalInfoValue}>{getVerificationTypeLabel(selectedRequest.verificationType)}</Text>
                </View>
                {selectedRequest.licenseType ? (
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>ประเภทใบอนุญาต:</Text>
                    <Text style={styles.modalInfoValue}>{getLicenseTypeLabel(selectedRequest.licenseType)}</Text>
                  </View>
                ) : null}
                {selectedRequest.licenseNumber ? (
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>เลขที่เอกสาร:</Text>
                    <Text style={styles.modalInfoValue}>{selectedRequest.licenseNumber}</Text>
                  </View>
                ) : null}
                {selectedRequest.licenseExpiry ? (
                  <View style={styles.modalInfoRow}>
                    <Text style={styles.modalInfoLabel}>วันหมดอายุ:</Text>
                    <Text style={styles.modalInfoValue}>{toDisplayDate(selectedRequest.licenseExpiry)}</Text>
                  </View>
                ) : null}
              </Card>

              <Card style={styles.modalCard}>
                <Text style={styles.modalSectionTitle}>เอกสารแนบ</Text>
                {selectedRequest.licenseDocumentUrl ? (
                  <TouchableOpacity
                    style={styles.documentButton}
                    onPress={() => openDocument(selectedRequest.licenseDocumentUrl!)}
                  >
                    <Ionicons name="document-text" size={24} color={COLORS.primary} />
                    <Text style={styles.documentButtonText}>ดูเอกสารใบอนุญาต</Text>
                    <Ionicons name="open-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                ) : null}

                {selectedRequest.employeeCardUrl ? (
                  <TouchableOpacity
                    style={styles.documentButton}
                    onPress={() => openDocument(selectedRequest.employeeCardUrl!)}
                  >
                    <Ionicons name="bag-outline" size={24} color={COLORS.primary} />
                    <Text style={styles.documentButtonText}>ดูบัตรพนักงาน / เอกสารสังกัด</Text>
                    <Ionicons name="open-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                ) : null}

                {selectedRequest.idCardUrl && (
                  <TouchableOpacity
                    style={styles.documentButton}
                    onPress={() => openDocument(selectedRequest.idCardUrl!)}
                  >
                    <Ionicons name="card" size={24} color={COLORS.primary} />
                    <Text style={styles.documentButtonText}>ดูบัตรประชาชน</Text>
                    <Ionicons name="open-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                )}

                {selectedRequest.selfieUrl && (
                  <TouchableOpacity
                    style={styles.documentButton}
                    onPress={() => openDocument(selectedRequest.selfieUrl!)}
                  >
                    <Ionicons name="person" size={24} color={COLORS.primary} />
                    <Text style={styles.documentButtonText}>ดูรูปถ่าย</Text>
                    <Ionicons name="open-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </Card>

              {selectedRequest.verificationType === 'nurse' ? (
                <TouchableOpacity style={styles.verifyButton} onPress={openTNMCVerification}>
                  <Ionicons name="shield-checkmark" size={24} color="#FFF" />
                  <Text style={styles.verifyButtonText}>ตรวจสอบกับสภาการพยาบาล</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>

            <View style={styles.modalFooter}>
              <View style={styles.actionButtons}>
                <Button
                  title="❌ ปฏิเสธ"
                  variant="outline"
                  onPress={() => setShowRejectModal(true)}
                  style={styles.actionButton}
                  disabled={isProcessing}
                />
                <Button
                  title="✅ อนุมัติ"
                  onPress={handleApprove}
                  style={styles.actionButton}
                  loading={isProcessing}
                />
              </View>
            </View>
          </View>
        ) : selectedDocument ? (
          <View style={styles.modalShell}>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              <Card style={styles.modalCard}>
                <View style={styles.modalUserHeader}>
                  <Avatar uri={selectedDocument.userPhotoURL} name={selectedDocument.userName} size={60} />
                  <View style={styles.modalUserInfo}>
                    <Text style={styles.modalUserName}>{selectedDocument.userName}</Text>
                    <Text style={styles.modalUserEmail}>{selectedDocument.userEmail || selectedDocument.userId}</Text>
                  </View>
                </View>
              </Card>

              <Card style={styles.modalCard}>
                <Text style={styles.modalSectionTitle}>ข้อมูลเอกสาร</Text>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>ประเภท:</Text>
                  <Text style={styles.modalInfoValue}>{selectedDocument.name}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>ชื่อไฟล์:</Text>
                  <Text style={styles.modalInfoValue}>{selectedDocument.fileName}</Text>
                </View>
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>ส่งเมื่อ:</Text>
                  <Text style={styles.modalInfoValue}>{formatRelativeTime(selectedDocument.createdAt)}</Text>
                </View>
              </Card>

              <Card style={styles.modalCard}>
                <Text style={styles.modalSectionTitle}>ไฟล์แนบ</Text>
                <View style={styles.documentPreviewWrap}>
                  {selectedDocumentIsImage ? (
                    <Image source={{ uri: selectedDocument.fileUrl }} style={styles.documentPreviewImage} resizeMode="contain" />
                  ) : (
                    <WebView
                      source={{ uri: selectedDocument.fileUrl }}
                      style={styles.documentPreviewWebview}
                      originWhitelist={['https:']}
                      javaScriptEnabled={false}
                      allowFileAccess={false}
                    />
                  )}
                </View>
                <TouchableOpacity
                  style={styles.documentButton}
                  onPress={() => openDocument(selectedDocument.fileUrl)}
                >
                  <Ionicons name="open-outline" size={24} color={COLORS.primary} />
                  <Text style={styles.documentButtonText}>เปิดภายนอกหากเอกสารนี้ต้องดูแบบเต็มจอ</Text>
                  <Ionicons name="open-outline" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              </Card>
            </ScrollView>

            <View style={styles.modalFooter}>
              <View style={styles.actionButtons}>
                <Button
                  title="❌ ปฏิเสธเอกสาร"
                  variant="outline"
                  onPress={() => setShowRejectModal(true)}
                  style={styles.actionButton}
                  disabled={isProcessing}
                />
                <Button
                  title="✅ อนุมัติเอกสาร"
                  onPress={handleApproveDocument}
                  style={styles.actionButton}
                  loading={isProcessing}
                />
              </View>
            </View>
          </View>
        ) : null}
      </ModalContainer>

      {/* Reject Modal */}
      <ModalContainer
        visible={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="ปฏิเสธคำขอ"
      >
        <View style={styles.rejectContent}>
          <Text style={styles.rejectLabel}>เหตุผลในการปฏิเสธ:</Text>
          <TouchableOpacity
            style={styles.rejectOption}
            onPress={() => setRejectReason('เอกสารไม่ชัดเจน กรุณาอัพโหลดใหม่')}
          >
            <Text style={styles.rejectOptionText}>เอกสารไม่ชัดเจน</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectOption}
            onPress={() => setRejectReason('ข้อมูลเอกสารไม่ถูกต้องหรือไม่ตรงกัน')}
          >
            <Text style={styles.rejectOptionText}>ข้อมูลเอกสารไม่ถูกต้อง</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectOption}
            onPress={() => setRejectReason('เอกสารหมดอายุหรือไม่สามารถใช้ยืนยันได้')}
          >
            <Text style={styles.rejectOptionText}>เอกสารหมดอายุ / ใช้งานไม่ได้</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectOption}
            onPress={() => setRejectReason('ข้อมูลไม่ตรงกับหน่วยงานหรือแหล่งอ้างอิงที่ตรวจสอบ')}
          >
            <Text style={styles.rejectOptionText}>ข้อมูลไม่ตรงกับแหล่งตรวจสอบ</Text>
          </TouchableOpacity>
          
          <View style={styles.rejectActions}>
            <Button
              title="ยกเลิก"
              variant="outline"
              onPress={() => {
                setShowRejectModal(false);
                setRejectReason('');
              }}
            />
            <Button
              title="ปฏิเสธ"
              variant="danger"
              onPress={selectedDocument ? handleRejectDocument : handleReject}
              loading={isProcessing}
              disabled={!rejectReason}
            />
          </View>
        </View>
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
    fontWeight: '700',
    color: COLORS.text,
  },
  tnmcBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  tnmcBannerText: {
    color: '#FFF',
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: '700',
    color: COLORS.warning,
  },
  statLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  tabRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  tabButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabButtonText: {
    textAlign: 'center',
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  tabButtonTextActive: {
    color: '#FFF',
  },
  listContent: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  requestCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.small,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  requestInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  requestName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  requestEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  requestDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  pendingText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: '#D97706',
  },
  requestDetails: {
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  detailRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  detailLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    width: 100,
  },
  detailValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  accessDenied: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accessDeniedText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZES.lg,
    color: COLORS.error,
    fontWeight: '600',
  },
  modalContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  modalShell: {
    flex: 1,
  },
  modalScroll: {
    flex: 1,
  },
  modalCard: {
    marginBottom: SPACING.md,
  },
  modalUserHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalUserInfo: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  modalUserName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalUserEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  modalUserPhone: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
    marginTop: 4,
  },
  modalSectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  modalInfoRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  modalInfoLabel: {
    width: 100,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  modalInfoValue: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text,
  },
  documentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  documentButtonText: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.primary,
    fontWeight: '500',
  },
  documentPreviewWrap: {
    height: 300,
    backgroundColor: '#0F172A',
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
    marginBottom: SPACING.sm,
  },
  documentPreviewImage: {
    width: '100%',
    height: '100%',
  },
  documentPreviewWebview: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  verifyButtonText: {
    color: '#FFF',
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  modalFooter: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionButton: {
    flex: 1,
  },
  rejectContent: {
    padding: SPACING.md,
  },
  rejectLabel: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.md,
  },
  rejectOption: {
    padding: SPACING.md,
    backgroundColor: COLORS.background,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
  },
  rejectOptionText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
  },
  rejectActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginTop: SPACING.md,
  },
});
