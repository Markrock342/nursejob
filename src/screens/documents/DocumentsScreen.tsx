// ============================================
// DOCUMENTS SCREEN - Production Ready
// ============================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  Platform,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { WebView } from 'react-native-webview';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Loading, EmptyState, ModalContainer } from '../../components/common';
import {
  getUserDocuments,
  uploadDocument,
  deleteDocument,
  Document,
  DocumentType,
  getDocumentTypeLabel,
  formatFileSize,
} from '../../services/documentsService';
import { readUriAsBlob } from '../../services/storageService';
import { formatDate } from '../../utils/helpers';

const documentTypes: { type: DocumentType; icon: string }[] = [
  { type: 'resume', icon: 'document-text' },
  { type: 'license', icon: 'ribbon' },
  { type: 'certificate', icon: 'medal' },
  { type: 'education', icon: 'school' },
  { type: 'training', icon: 'book' },
  { type: 'id_card', icon: 'card' },
  { type: 'photo', icon: 'camera' },
  { type: 'other', icon: 'folder' },
];

export default function DocumentsScreen() {
  const { user, requireAuth } = useAuth();
  const navigation = useNavigation();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const headerBackground = colors.surface;
  const statusBarStyle = isDark ? 'light-content' : 'dark-content';
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);

  const loadDocuments = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const data = await getUserDocuments(user.uid);
      setDocuments(data);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadDocuments();
  };

  const handleSelectType = (type: DocumentType) => {
    setSelectedType(type);
    setShowTypeModal(false);

    if (type === 'photo') {
      pickImage();
    } else {
      pickDocument();
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const file = result.assets[0];
        await handleUpload(file.uri, file.name, file.mimeType || 'application/pdf', file.size || 0);
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถเลือกเอกสารได้');
    }
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('ต้องการสิทธิ์', 'กรุณาอนุญาตการเข้าถึงรูปภาพ');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        const image = result.assets[0];
        const fileName = `photo_${Date.now()}.jpg`;
        await handleUpload(image.uri, fileName, 'image/jpeg', image.fileSize || 0);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถเลือกรูปภาพได้');
    }
  };

  const handleUpload = async (uri: string, fileName: string, mimeType: string, fileSize: number) => {
    if (!user?.uid || !selectedType) return;

    // Check file size (max 10MB)
    if (fileSize > 10 * 1024 * 1024) {
      Alert.alert('ไฟล์ใหญ่เกินไป', 'ขนาดไฟล์สูงสุด 10MB');
      return;
    }

    setIsUploading(true);

    try {
      const blob = await readUriAsBlob(uri, mimeType);

      const doc = await uploadDocument(
        user.uid,
        selectedType,
        getDocumentTypeLabel(selectedType),
        blob,
        fileName,
        mimeType
      );

      setDocuments(prev => [doc, ...prev]);
      Alert.alert('สำเร็จ', 'อัพโหลดเอกสารเรียบร้อยแล้ว');
    } catch (error) {
      console.error('Error uploading:', error);
      Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถอัพโหลดได้ กรุณาลองใหม่');
    } finally {
      setIsUploading(false);
      setSelectedType(null);
    }
  };

  const handleDelete = (doc: Document) => {
    Alert.alert(
      doc.status === 'pending' ? 'ยกเลิกคำขอ' : 'ลบเอกสาร',
      doc.status === 'pending'
        ? `ต้องการยกเลิกคำขอสำหรับ "${doc.name}" หรือไม่?`
        : `ต้องการลบ "${doc.name}" หรือไม่?`,
      [
        { text: 'ยกเลิก', style: 'cancel' },
        {
          text: doc.status === 'pending' ? 'ยืนยัน' : 'ลบ',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDocument(doc.id, doc.fileUrl, doc.storagePath);
              setDocuments(prev => prev.filter(d => d.id !== doc.id));
              if (previewDocument?.id === doc.id) {
                setPreviewDocument(null);
              }
            } catch (error) {
              Alert.alert('เกิดข้อผิดพลาด', 'ไม่สามารถลบได้');
            }
          },
        },
      ]
    );
  };

  const isImageDocument = (doc: Document) => doc.mimeType?.startsWith('image/');

  const getStatusMeta = (doc: Document) => {
    if (doc.status === 'approved' || doc.isVerified) {
      return {
        icon: 'checkmark-circle' as const,
        text: 'อนุมัติแล้ว',
        color: colors.success,
      };
    }
    if (doc.status === 'rejected') {
      return {
        icon: 'close-circle' as const,
        text: 'ไม่ผ่านการตรวจสอบ',
        color: colors.error,
      };
    }
    return {
      icon: 'time' as const,
      text: 'รอการตรวจสอบ',
      color: colors.warning,
    };
  };

  // Not logged in
  if (!user) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: headerBackground }]} edges={['top']}>
        <StatusBar barStyle={statusBarStyle} backgroundColor={headerBackground} translucent={false} />
        <EmptyState
          icon="documents-outline"
          title="เข้าสู่ระบบเพื่อจัดการเอกสาร"
          subtitle="อัพโหลด Resume, ใบประกอบวิชาชีพ และเอกสารอื่นๆ"
          actionLabel="เข้าสู่ระบบ"
          onAction={() => requireAuth(() => {})}
        />
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return <Loading message="กำลังโหลด..." />;
  }

  const renderDocument = ({ item }: { item: Document }) => {
    const typeInfo = documentTypes.find(t => t.type === item.type);
    const statusMeta = getStatusMeta(item);

    return (
      <TouchableOpacity style={styles.documentCard} activeOpacity={0.9} onPress={() => setPreviewDocument(item)}>
        <View style={styles.documentIcon}>
          <Ionicons
            name={(typeInfo?.icon || 'document') as any}
            size={24}
            color={colors.primary}
          />
        </View>
        <View style={styles.documentInfo}>
          <Text style={styles.documentName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.documentMeta}>
            {getDocumentTypeLabel(item.type)} • {formatFileSize(item.fileSize)}
          </Text>
          <View style={styles.documentStatus}>
            <View style={styles.verifiedBadge}>
              <Ionicons name={statusMeta.icon} size={14} color={statusMeta.color} />
              <Text style={[styles.verifiedText, { color: statusMeta.color }]}>{statusMeta.text}</Text>
            </View>
            <Text style={styles.documentDate}>{formatDate(item.createdAt)}</Text>
          </View>
          {item.rejectionReason ? (
            <Text style={styles.rejectionText} numberOfLines={2}>เหตุผล: {item.rejectionReason}</Text>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDelete(item)}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: headerBackground }]} edges={['top']}>
      <StatusBar barStyle={statusBarStyle} backgroundColor={headerBackground} translucent={false} />
      <View style={[styles.header, { backgroundColor: headerBackground }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>เอกสารของฉัน</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowTypeModal(true)}
          disabled={Boolean(isUploading)}
        >
          {isUploading ? (
            <Text style={styles.addButtonText}>กำลังอัพโหลด...</Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="add" size={20} color={colors.white} />
              <Text style={styles.addButtonText}>เพิ่มเอกสาร</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <FlatList
        data={documents}
        keyExtractor={(item) => item.id}
        renderItem={renderDocument}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="documents-outline"
            title="ยังไม่มีเอกสาร"
            subtitle="เพิ่มเอกสารเพื่อเพิ่มโอกาสในการสมัครงาน"
            actionLabel="เพิ่มเอกสาร"
            onAction={() => setShowTypeModal(true)}
          />
        }
      />

      {/* Document Type Selection Modal */}
      <Modal
        visible={showTypeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTypeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>เลือกประเภทเอกสาร</Text>
              <TouchableOpacity onPress={() => setShowTypeModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.typeGrid}>
              {documentTypes.map((item) => (
                <TouchableOpacity
                  key={item.type}
                  style={styles.typeItem}
                  onPress={() => handleSelectType(item.type)}
                >
                  <View style={styles.typeIcon}>
                    <Ionicons name={item.icon as any} size={28} color={colors.primary} />
                  </View>
                  <Text style={styles.typeLabel}>{getDocumentTypeLabel(item.type)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <ModalContainer
        visible={Boolean(previewDocument)}
        onClose={() => setPreviewDocument(null)}
        title={previewDocument?.name || 'ดูเอกสาร'}
        fullScreen
      >
        {previewDocument ? (
          <View style={styles.previewContent}>
            <View style={styles.previewMetaCard}>
              <Text style={styles.previewMetaTitle}>{getDocumentTypeLabel(previewDocument.type)}</Text>
              <Text style={styles.previewMetaText}>{previewDocument.fileName}</Text>
              <Text style={styles.previewMetaText}>สถานะ: {getStatusMeta(previewDocument).text}</Text>
              {previewDocument.rejectionReason ? (
                <Text style={styles.previewRejectText}>เหตุผลที่ไม่ผ่าน: {previewDocument.rejectionReason}</Text>
              ) : null}
            </View>

            <View style={styles.previewFrame}>
              {isImageDocument(previewDocument) ? (
                <Image source={{ uri: previewDocument.fileUrl }} style={styles.previewImage} resizeMode="contain" />
              ) : (
                <WebView source={{ uri: previewDocument.fileUrl }} style={styles.previewWebview} />
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.previewActionButton,
                { backgroundColor: previewDocument.status === 'pending' ? colors.warning : colors.error },
              ]}
              onPress={() => handleDelete(previewDocument)}
            >
              <Ionicons name={previewDocument.status === 'pending' ? 'close-circle-outline' : 'trash-outline'} size={18} color="#FFF" />
              <Text style={styles.previewActionText}>{previewDocument.status === 'pending' ? 'ยกเลิกคำขอ' : 'ลบเอกสาร'}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
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
    padding: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.md,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.xs,
  },
  addButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: FONT_SIZES.sm,
  },
  list: {
    padding: SPACING.md,
    paddingBottom: 100,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.sm,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: COLORS.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  documentMeta: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  documentStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: SPACING.sm,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  verifiedText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.success,
    fontWeight: '500',
  },
  pendingText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.warning,
  },
  rejectionText: {
    marginTop: 6,
    fontSize: FONT_SIZES.xs,
    color: COLORS.error,
  },
  documentDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  deleteButton: {
    padding: SPACING.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '600',
    color: COLORS.text,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.md,
  },
  typeItem: {
    width: '25%',
    alignItems: 'center',
    padding: SPACING.md,
  },
  typeIcon: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.lg,
    backgroundColor: COLORS.primaryBackground,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  typeLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.text,
    textAlign: 'center',
  },
  previewContent: {
    flex: 1,
    gap: SPACING.md,
  },
  previewMetaCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    gap: 4,
  },
  previewMetaTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  previewMetaText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  previewRejectText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.error,
    marginTop: SPACING.xs,
  },
  previewFrame: {
    flex: 1,
    minHeight: 420,
    backgroundColor: '#0F172A',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewWebview: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  previewActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  previewActionText: {
    color: '#FFF',
    fontSize: FONT_SIZES.sm,
    fontWeight: '700',
  },
});

