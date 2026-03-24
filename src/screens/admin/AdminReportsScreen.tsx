// ============================================
// ADMIN REPORTS SCREEN - ดูรายงาน
// ============================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import { Avatar, KittenButton as Button, Card, ModalContainer } from '../../components/common';
import {
  getAllReports,
  getPendingReports,
  updateReportStatus,
  Report,
  ReportStatus,
  REPORT_REASONS,
  REPORT_STATUS_LABELS,
} from '../../services/reportService';
import { formatRelativeTime } from '../../utils/helpers';

type FilterType = 'all' | 'pending' | 'reviewed' | 'resolved' | 'dismissed';

export default function AdminReportsScreen() {
  const navigation = useNavigation();
  const { user, isAdmin } = useAuth();
  
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('pending');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    applyFilter();
  }, [reports, filter]);

  const loadReports = async () => {
    try {
      const data = await getAllReports(100);
      setReports(data);
    } catch (error) {
      console.error('Error loading reports:', error);
      Alert.alert('โหลดข้อมูลไม่สำเร็จ', 'กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const applyFilter = () => {
    if (filter === 'all') {
      setFilteredReports(reports);
    } else {
      setFilteredReports(reports.filter(r => r.status === filter));
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadReports();
  };

  const handleUpdateStatus = async (status: ReportStatus, actionTaken?: string) => {
    if (!selectedReport || !user?.uid) return;
    
    setIsProcessing(true);
    try {
      await updateReportStatus(
        selectedReport.id!,
        status,
        user.uid,
        undefined,
        actionTaken
      );
      
      setReports(prev => prev.map(r => 
        r.id === selectedReport.id 
          ? { ...r, status, reviewedBy: user.uid, reviewedAt: new Date() }
          : r
      ));
      
      setShowDetailModal(false);
      setSelectedReport(null);
      
      const statusText = REPORT_STATUS_LABELS[status];
      Alert.alert('✅ สำเร็จ', `เปลี่ยนสถานะเป็น "${statusText}" แล้ว`);
    } catch (error: any) {
      Alert.alert('ข้อผิดพลาด', error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'job': return 'briefcase';
      case 'user': return 'person';
      case 'message': return 'chatbubble';
      default: return 'alert-circle';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'job': return 'ประกาศ';
      case 'user': return 'ผู้ใช้';
      case 'message': return 'ข้อความ';
      default: return type;
    }
  };

  const getReasonLabel = (reason: string) => {
    const found = REPORT_REASONS.find(r => r.value === reason);
    return found?.label || reason;
  };

  const getStatusColor = (status: ReportStatus) => {
    switch (status) {
      case 'pending': return '#EAB308';
      case 'reviewed': return COLORS.info;
      case 'resolved': return COLORS.success;
      case 'dismissed': return COLORS.textMuted;
      default: return COLORS.text;
    }
  };

  const renderReport = ({ item }: { item: Report }) => (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={() => {
        setSelectedReport(item);
        setShowDetailModal(true);
      }}
    >
      <View style={styles.reportHeader}>
        <View style={[styles.typeIcon, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Ionicons 
            name={getTypeIcon(item.type) as any} 
            size={20} 
            color={getStatusColor(item.status)} 
          />
        </View>
        <View style={styles.reportInfo}>
          <Text style={styles.reportTitle}>
            รายงาน{getTypeLabel(item.type)}: {item.targetName || item.targetId}
          </Text>
          <Text style={styles.reportReason}>
            เหตุผล: {getReasonLabel(item.reason)}
          </Text>
          <Text style={styles.reportReporter}>
            โดย: {item.reporterName}
          </Text>
          <Text style={styles.reportDate}>
            {formatRelativeTime(item.createdAt)}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {REPORT_STATUS_LABELS[item.status]}
          </Text>
        </View>
      </View>
      
      {item.reasonText && (
        <Text style={styles.reportDescription} numberOfLines={2}>
          {item.reasonText}
        </Text>
      )}
    </TouchableOpacity>
  );

  const FilterButton = ({ type, label }: { type: FilterType; label: string }) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === type && styles.filterButtonActive]}
      onPress={() => setFilter(type)}
    >
      <Text style={[styles.filterButtonText, filter === type && styles.filterButtonTextActive]}>
        {label}
      </Text>
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

  const pendingCount = reports.filter(r => r.status === 'pending').length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>รายงานทั้งหมด</Text>
        <View style={styles.headerRight}>
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCount}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        <FilterButton type="pending" label={`รอตรวจ (${reports.filter(r => r.status === 'pending').length})`} />
        <FilterButton type="reviewed" label="กำลังดำเนินการ" />
        <FilterButton type="resolved" label="แก้ไขแล้ว" />
        <FilterButton type="all" label="ทั้งหมด" />
      </View>

      {/* Reports List */}
      {filteredReports.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="checkmark-circle-outline" size={64} color={COLORS.success} />
          <Text style={styles.emptyText}>
            {filter === 'pending' ? 'ไม่มีรายงานที่รอตรวจสอบ' : 'ไม่มีรายงาน'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredReports}
          renderItem={renderReport}
          keyExtractor={(item) => item.id!}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        />
      )}

      {/* Detail Modal */}
      <ModalContainer
        visible={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title="รายละเอียดรายงาน"
        fullScreen
      >
        {selectedReport && (
          <View style={styles.modalContent}>
            {/* Report Info */}
            <Card style={styles.modalCard}>
              <Text style={styles.modalSectionTitle}>ข้อมูลรายงาน</Text>
              
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>ประเภท:</Text>
                <View style={styles.modalInfoValue}>
                  <Ionicons 
                    name={getTypeIcon(selectedReport.type) as any} 
                    size={16} 
                    color={COLORS.primary} 
                  />
                  <Text style={styles.modalInfoText}>{getTypeLabel(selectedReport.type)}</Text>
                </View>
              </View>
              
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>เหตุผล:</Text>
                <Text style={styles.modalInfoText}>{getReasonLabel(selectedReport.reason)}</Text>
              </View>
              
              <View style={styles.modalInfoRow}>
                <Text style={styles.modalInfoLabel}>เป้าหมาย:</Text>
                <Text style={styles.modalInfoText}>{selectedReport.targetName || selectedReport.targetId}</Text>
              </View>
              
              {selectedReport.reasonText && (
                <View style={styles.modalInfoRow}>
                  <Text style={styles.modalInfoLabel}>รายละเอียด:</Text>
                  <Text style={styles.modalInfoText}>{selectedReport.reasonText}</Text>
                </View>
              )}
            </Card>

            {/* Reporter Info */}
            <Card style={styles.modalCard}>
              <Text style={styles.modalSectionTitle}>ผู้รายงาน</Text>
              
              <View style={styles.reporterRow}>
                <Avatar name={selectedReport.reporterName} size={40} />
                <View style={styles.reporterInfo}>
                  <Text style={styles.reporterName}>{selectedReport.reporterName}</Text>
                  <Text style={styles.reporterEmail}>{selectedReport.reporterEmail}</Text>
                </View>
              </View>
              
              <Text style={styles.reportedAt}>
                รายงานเมื่อ: {formatRelativeTime(selectedReport.createdAt)}
              </Text>
            </Card>

            {/* Status */}
            <Card style={styles.modalCard}>
              <Text style={styles.modalSectionTitle}>สถานะ</Text>
              <View style={[styles.currentStatus, { backgroundColor: getStatusColor(selectedReport.status) + '20' }]}>
                <Text style={[styles.currentStatusText, { color: getStatusColor(selectedReport.status) }]}>
                  {REPORT_STATUS_LABELS[selectedReport.status]}
                </Text>
              </View>
              
              {selectedReport.reviewedBy && (
                <Text style={styles.reviewedBy}>
                  ตรวจสอบโดย: {selectedReport.reviewedBy}
                </Text>
              )}
            </Card>

            {/* Actions */}
            {selectedReport.status === 'pending' && (
              <View style={styles.actionButtons}>
                <Text style={styles.actionTitle}>ดำเนินการ:</Text>
                
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: COLORS.info }]}
                  onPress={() => handleUpdateStatus('reviewed')}
                  disabled={isProcessing}
                >
                  <Ionicons name="eye" size={20} color="#FFF" />
                  <Text style={styles.actionButtonText}>กำลังตรวจสอบ</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: COLORS.success }]}
                  onPress={() => handleUpdateStatus('resolved', 'ดำเนินการแก้ไขแล้ว')}
                  disabled={isProcessing}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                  <Text style={styles.actionButtonText}>แก้ไขแล้ว</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: COLORS.textMuted }]}
                  onPress={() => handleUpdateStatus('dismissed', 'ไม่พบความผิดปกติ')}
                  disabled={isProcessing}
                >
                  <Ionicons name="close-circle" size={20} color="#FFF" />
                  <Text style={styles.actionButtonText}>ยกเลิก</Text>
                </TouchableOpacity>
              </View>
            )}

            {selectedReport.status === 'reviewed' && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: COLORS.success }]}
                  onPress={() => handleUpdateStatus('resolved', 'ดำเนินการแก้ไขแล้ว')}
                  disabled={isProcessing}
                >
                  <Ionicons name="checkmark-circle" size={20} color="#FFF" />
                  <Text style={styles.actionButtonText}>แก้ไขแล้ว</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
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
    fontWeight: '700',
    color: COLORS.text,
  },
  headerRight: {
    width: 24,
    alignItems: 'flex-end',
  },
  badge: {
    backgroundColor: COLORS.error,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.xs,
  },
  filterButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    backgroundColor: COLORS.background,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#FFF',
  },
  listContent: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  reportCard: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    ...SHADOWS.small,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportInfo: {
    flex: 1,
    marginLeft: SPACING.sm,
  },
  reportTitle: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  reportReason: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.primary,
    marginBottom: 2,
  },
  reportReporter: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  reportDate: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.full,
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  reportDescription: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
  },
  modalCard: {
    marginBottom: SPACING.md,
  },
  modalSectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  modalInfoRow: {
    flexDirection: 'row',
    marginBottom: SPACING.xs,
  },
  modalInfoLabel: {
    width: 80,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  modalInfoValue: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  modalInfoText: {
    flex: 1,
    fontSize: FONT_SIZES.sm,
    color: COLORS.text,
  },
  reporterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  reporterInfo: {
    marginLeft: SPACING.sm,
  },
  reporterName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  reporterEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  reportedAt: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textMuted,
  },
  currentStatus: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: BORDER_RADIUS.full,
    marginBottom: SPACING.sm,
  },
  currentStatusText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  reviewedBy: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  actionButtons: {
    gap: SPACING.sm,
  },
  actionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  actionButtonText: {
    color: '#FFF',
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});
