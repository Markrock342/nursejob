// ============================================
// ADMIN DASHBOARD - ศูนย์ควบคุมระบบ NurseGo
// ============================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  Animated,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS, SHADOWS } from '../../theme';
import { RootStackParamList } from '../../types';
import {
  getDashboardStats,
  getAllUsers,
  searchUsers,
  getAllJobs,
  getAllConversations,
  updateUserStatus,
  verifyUser,
  updateUserRole,
  deleteUser,
  updateJobStatus,
  deleteJob,
  deleteConversation,
  DashboardStats,
  AdminUser,
  AdminJob,
  AdminConversation,
} from '../../services/adminService';

type Nav = NativeStackNavigationProp<RootStackParamList>;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================
// Tab Type
// ============================================
type TabKey = 'overview' | 'users' | 'jobs' | 'chats';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'ภาพรวม', icon: 'grid-outline' },
  { key: 'users', label: 'ผู้ใช้', icon: 'people-outline' },
  { key: 'jobs', label: 'งาน', icon: 'briefcase-outline' },
  { key: 'chats', label: 'แชท', icon: 'chatbubbles-outline' },
];

// ============================================
// MAIN COMPONENT
// ============================================
export default function AdminDashboardScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  // State
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Data
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [chats, setChats] = useState<AdminConversation[]>([]);

  // Filters
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [jobStatusFilter, setJobStatusFilter] = useState<string>('all');

  // Modal
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userModalVisible, setUserModalVisible] = useState(false);
  const [selectedJob, setSelectedJob] = useState<AdminJob | null>(null);
  const [jobModalVisible, setJobModalVisible] = useState(false);

  // ============================================
  // Data Fetching
  // ============================================
  const fetchAll = useCallback(async () => {
    try {
      const [s, u, j, c] = await Promise.all([
        getDashboardStats(),
        getAllUsers(200),
        getAllJobs(100),
        getAllConversations(50),
      ]);
      setStats(s);
      setUsers(u);
      setJobs(j);
      setChats(c);
    } catch (err) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAll();
  }, [fetchAll]);

  // ============================================
  // User Actions
  // ============================================
  const handleToggleUserActive = async (user: AdminUser) => {
    const newStatus = !user.isActive;
    const action = newStatus ? 'เปิดใช้งาน' : 'ระงับ';
    Alert.alert(`${action}ผู้ใช้`, `ต้องการ${action} "${user.displayName}" ?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน',
        style: newStatus ? 'default' : 'destructive',
        onPress: async () => {
          try {
            await updateUserStatus(user.id, newStatus);
            setUsers((prev) =>
              prev.map((u) => (u.id === user.id ? { ...u, isActive: newStatus } : u))
            );
            setUserModalVisible(false);
          } catch (error: any) {
            Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถดำเนินการได้');
          }
        },
      },
    ]);
  };

  const handleVerifyUser = async (user: AdminUser) => {
    const newVerified = !user.isVerified;
    const action = newVerified ? 'ยืนยันตัวตน' : 'ยกเลิกการยืนยัน';
    Alert.alert(action, `${action} "${user.displayName}" ?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน',
        onPress: async () => {
          try {
            await verifyUser(user.id, newVerified);
            setUsers((prev) =>
              prev.map((u) =>
                u.id === user.id
                  ? { ...u, isVerified: newVerified, role: newVerified ? 'nurse' : 'user' }
                  : u
              )
            );
            setUserModalVisible(false);
          } catch (error: any) {
            Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถดำเนินการได้');
          }
        },
      },
    ]);
  };

  const handleChangeRole = async (user: AdminUser, role: 'user' | 'nurse' | 'hospital' | 'admin') => {
    if (user.role === role) return;
    Alert.alert('เปลี่ยน Role', `เปลี่ยน "${user.displayName}" เป็น ${role.toUpperCase()} ?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ยืนยัน',
        onPress: async () => {
          try {
            await updateUserRole(user.id, role);
            setUsers((prev) =>
              prev.map((u) =>
                u.id === user.id ? { ...u, role, isAdmin: role === 'admin' } : u
              )
            );
            setUserModalVisible(false);
          } catch (error: any) {
            Alert.alert('ผิดพลาด', error?.message || 'ไม่สามารถดำเนินการได้');
          }
        },
      },
    ]);
  };

  const handleDeleteUser = async (user: AdminUser) => {
    Alert.alert('ลบผู้ใช้', `ลบ "${user.displayName}" ถาวร? ข้อมูลจะหายไปทั้งหมด`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบถาวร',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteUser(user.id);
            setUsers((prev) => prev.filter((u) => u.id !== user.id));
            setUserModalVisible(false);
          } catch { Alert.alert('ผิดพลาด', 'ไม่สามารถลบได้'); }
        },
      },
    ]);
  };

  // ============================================
  // Job Actions
  // ============================================
  const handleChangeJobStatus = async (job: AdminJob, status: 'active' | 'closed' | 'urgent') => {
    try {
      await updateJobStatus(job.id, status);
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status } : j)));
      setJobModalVisible(false);
    } catch { Alert.alert('ผิดพลาด', 'ไม่สามารถเปลี่ยนสถานะได้'); }
  };

  const handleDeleteJob = async (job: AdminJob) => {
    Alert.alert('ลบงาน', `ลบ "${job.title}" ถาวร?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบถาวร',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteJob(job.id);
            setJobs((prev) => prev.filter((j) => j.id !== job.id));
            setJobModalVisible(false);
          } catch { Alert.alert('ผิดพลาด', 'ไม่สามารถลบได้'); }
        },
      },
    ]);
  };

  // ============================================
  // Chat Actions
  // ============================================
  const handleDeleteChat = async (chat: AdminConversation) => {
    Alert.alert('ลบการสนทนา', `ลบแชทนี้และข้อความทั้งหมดถาวร?`, [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบถาวร',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteConversation(chat.id);
            setChats((prev) => prev.filter((c) => c.id !== chat.id));
          } catch { Alert.alert('ผิดพลาด', 'ไม่สามารถลบได้'); }
        },
      },
    ]);
  };

  // ============================================
  // Filtered Data
  // ============================================
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      !userSearch ||
      u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.phone && u.phone.includes(userSearch));
    const matchRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchSearch && matchRole;
  });

  const filteredJobs = jobs.filter((j) => {
    return jobStatusFilter === 'all' || j.status === jobStatusFilter;
  });

  // ============================================
  // Helpers
  // ============================================
  const formatDate = (d?: Date) => {
    if (!d) return '-';
    return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' });
  };

  const formatDateTime = (d?: Date) => {
    if (!d) return '-';
    return d.toLocaleDateString('th-TH', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return { label: 'Admin', color: COLORS.error, bg: COLORS.errorLight };
      case 'nurse': return { label: 'พยาบาล', color: COLORS.primary, bg: COLORS.primaryBackground };
      case 'hospital': return { label: 'โรงพยาบาล', color: '#7C3AED', bg: '#F3E8FF' };
      default: return { label: 'ผู้ใช้', color: COLORS.textSecondary, bg: COLORS.backgroundSecondary };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return { label: 'เปิดรับ', color: COLORS.success, bg: COLORS.successLight };
      case 'urgent': return { label: 'ด่วน', color: COLORS.error, bg: COLORS.errorLight };
      case 'closed': return { label: 'ปิดแล้ว', color: COLORS.textLight, bg: COLORS.backgroundSecondary };
      default: return { label: status, color: COLORS.textSecondary, bg: COLORS.backgroundSecondary };
    }
  };

  // ============================================
  // LOADING STATE
  // ============================================
  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>กำลังโหลดข้อมูล...</Text>
      </View>
    );
  }

  // ============================================
  // RENDER
  // ============================================
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ====== HEADER ====== */}
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Admin Dashboard</Text>
            <Text style={styles.headerSubtitle}>ศูนย์ควบคุมระบบ NurseGo</Text>
          </View>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <Ionicons name="refresh-outline" size={22} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* ====== TABS ====== */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key)}
                style={[styles.tab, isActive && styles.tabActive]}
              >
                <Ionicons
                  name={tab.icon as any}
                  size={18}
                  color={isActive ? COLORS.primary : 'rgba(255,255,255,0.6)'}
                />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ====== CONTENT ====== */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'jobs' && renderJobs()}
        {activeTab === 'chats' && renderChats()}
      </ScrollView>

      {/* ====== MODALS ====== */}
      {renderUserModal()}
      {renderJobModal()}
    </View>
  );

  // ============================================
  // TAB: OVERVIEW
  // ============================================
  function renderOverview() {
    if (!stats) return null;

    return (
      <View>
        {/* Stats Cards Grid */}
        <Text style={styles.sectionTitle}>สถิติภาพรวม</Text>
        <View style={styles.statsGrid}>
          <StatCard
            icon="people"
            label="ผู้ใช้ทั้งหมด"
            value={stats.totalUsers}
            color={COLORS.primary}
            sub={`+${stats.todayNewUsers} วันนี้`}
          />
          <StatCard
            icon="briefcase"
            label="ประกาศงาน"
            value={stats.totalJobs}
            color="#7C3AED"
            sub={`${stats.activeJobs} เปิดรับ`}
          />
          <StatCard
            icon="checkmark-shield"
            label="รอตรวจสอบ"
            value={stats.pendingVerifications || 0}
            color={COLORS.accent}
            sub="ใบอนุญาต"
          />
          <StatCard
            icon="chatbubbles"
            label="การสนทนา"
            value={stats.totalConversations}
            color={COLORS.secondary}
            sub="ทั้งหมด"
          />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>การจัดการด่วน</Text>
        <View style={styles.quickActions}>
          <QuickAction
            icon="shield-checkmark-outline"
            label="ตรวจใบอนุญาต"
            color={COLORS.accent}
            badge={stats.pendingVerifications}
            onPress={() => navigation.navigate('AdminVerification')}
          />
          <QuickAction
            icon="flag-outline"
            label="รายงาน"
            color={COLORS.error}
            onPress={() => navigation.navigate('AdminReports')}
          />
          <QuickAction
            icon="chatbox-ellipses-outline"
            label="Feedback"
            color={COLORS.primary}
            onPress={() => navigation.navigate('AdminFeedback')}
          />
          <QuickAction
            icon="people-outline"
            label="จัดการผู้ใช้"
            color="#7C3AED"
            onPress={() => setActiveTab('users')}
          />
        </View>

        {/* User Breakdown */}
        <Text style={styles.sectionTitle}>สรุปผู้ใช้ตาม Role</Text>
        <View style={styles.card}>
          {(['nurse', 'hospital', 'admin', 'user'] as const).map((role) => {
            const count = users.filter((u) => u.role === role).length;
            const badge = getRoleBadge(role);
            const pct = users.length > 0 ? (count / users.length) * 100 : 0;
            return (
              <View key={role} style={styles.breakdownRow}>
                <View style={[styles.roleDot, { backgroundColor: badge.color }]} />
                <Text style={styles.breakdownLabel}>{badge.label}</Text>
                <View style={styles.breakdownBarBg}>
                  <View
                    style={[styles.breakdownBarFill, { width: `${pct}%`, backgroundColor: badge.color }]}
                  />
                </View>
                <Text style={styles.breakdownCount}>{count}</Text>
              </View>
            );
          })}
        </View>

        {/* Job Overview */}
        <Text style={styles.sectionTitle}>สรุปงานตามสถานะ</Text>
        <View style={styles.card}>
          {(['active', 'urgent', 'closed'] as const).map((status) => {
            const count = jobs.filter((j) => j.status === status).length;
            const badge = getStatusBadge(status);
            const pct = jobs.length > 0 ? (count / jobs.length) * 100 : 0;
            return (
              <View key={status} style={styles.breakdownRow}>
                <View style={[styles.roleDot, { backgroundColor: badge.color }]} />
                <Text style={styles.breakdownLabel}>{badge.label}</Text>
                <View style={styles.breakdownBarBg}>
                  <View
                    style={[styles.breakdownBarFill, { width: `${pct}%`, backgroundColor: badge.color }]}
                  />
                </View>
                <Text style={styles.breakdownCount}>{count}</Text>
              </View>
            );
          })}
        </View>

        {/* Recent Users */}
        <Text style={styles.sectionTitle}>ผู้ใช้ล่าสุด</Text>
        {users.slice(0, 5).map((u) => (
          <TouchableOpacity
            key={u.id}
            style={styles.listItem}
            onPress={() => { setSelectedUser(u); setUserModalVisible(true); }}
          >
            <View style={[styles.avatar, { backgroundColor: getRoleBadge(u.role).bg }]}>
              <Text style={[styles.avatarText, { color: getRoleBadge(u.role).color }]}>
                {u.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.listItemTitle}>{u.displayName}</Text>
              <Text style={styles.listItemSub}>{u.email}</Text>
            </View>
            <Badge {...getRoleBadge(u.role)} />
          </TouchableOpacity>
        ))}
        {users.length > 5 && (
          <TouchableOpacity style={styles.seeAllBtn} onPress={() => setActiveTab('users')}>
            <Text style={styles.seeAllText}>ดูทั้งหมด ({users.length})</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {/* Recent Jobs */}
        <Text style={styles.sectionTitle}>งานล่าสุด</Text>
        {jobs.slice(0, 5).map((j) => (
          <TouchableOpacity
            key={j.id}
            style={styles.listItem}
            onPress={() => { setSelectedJob(j); setJobModalVisible(true); }}
          >
            <View style={[styles.avatar, { backgroundColor: getStatusBadge(j.status).bg }]}>
              <Ionicons name="briefcase" size={18} color={getStatusBadge(j.status).color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.listItemTitle} numberOfLines={1}>{j.title}</Text>
              <Text style={styles.listItemSub}>{j.posterName} · {formatDate(j.createdAt)}</Text>
            </View>
            <Badge {...getStatusBadge(j.status)} />
          </TouchableOpacity>
        ))}
        {jobs.length > 5 && (
          <TouchableOpacity style={styles.seeAllBtn} onPress={() => setActiveTab('jobs')}>
            <Text style={styles.seeAllText}>ดูทั้งหมด ({jobs.length})</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </View>
    );
  }

  // ============================================
  // TAB: USERS
  // ============================================
  function renderUsers() {
    return (
      <View>
        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textLight} />
          <TextInput
            style={styles.searchInput}
            placeholder="ค้นหาชื่อ, อีเมล, เบอร์โทร..."
            placeholderTextColor={COLORS.textLight}
            value={userSearch}
            onChangeText={setUserSearch}
          />
          {userSearch.length > 0 && (
            <TouchableOpacity onPress={() => setUserSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          )}
        </View>

        {/* Role Filter Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {[{ key: 'all', label: 'ทั้งหมด' }, { key: 'nurse', label: 'พยาบาล' }, { key: 'hospital', label: 'โรงพยาบาล' }, { key: 'admin', label: 'Admin' }, { key: 'user', label: 'ผู้ใช้ทั่วไป' }].map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setUserRoleFilter(f.key)}
              style={[styles.filterChip, userRoleFilter === f.key && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, userRoleFilter === f.key && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.resultCount}>
          แสดง {filteredUsers.length} จาก {users.length} คน
        </Text>

        {/* User List */}
        {filteredUsers.map((u) => (
          <TouchableOpacity
            key={u.id}
            style={styles.userCard}
            onPress={() => { setSelectedUser(u); setUserModalVisible(true); }}
            activeOpacity={0.7}
          >
            <View style={styles.userCardHeader}>
              <View style={[styles.avatar, { backgroundColor: getRoleBadge(u.role).bg }]}>
                <Text style={[styles.avatarText, { color: getRoleBadge(u.role).color }]}>
                  {u.displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.userCardName} numberOfLines={1}>{u.displayName}</Text>
                  {u.isVerified && (
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.verified} />
                  )}
                  {!u.isActive && (
                    <View style={styles.suspendedChip}>
                      <Text style={styles.suspendedChipText}>ระงับ</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.userCardEmail} numberOfLines={1}>{u.email}</Text>
              </View>
              <Badge {...getRoleBadge(u.role)} />
            </View>
            <View style={styles.userCardFooter}>
              <View style={styles.userCardMeta}>
                <Ionicons name="calendar-outline" size={12} color={COLORS.textLight} />
                <Text style={styles.userCardMetaText}>สมัคร {formatDate(u.createdAt)}</Text>
              </View>
              {u.phone && (
                <View style={styles.userCardMeta}>
                  <Ionicons name="call-outline" size={12} color={COLORS.textLight} />
                  <Text style={styles.userCardMetaText}>{u.phone}</Text>
                </View>
              )}
              {u.licenseNumber && (
                <View style={styles.userCardMeta}>
                  <Ionicons name="document-text-outline" size={12} color={COLORS.textLight} />
                  <Text style={styles.userCardMetaText}>{u.licenseNumber}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        ))}

        {filteredUsers.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>ไม่พบผู้ใช้ที่ตรงเงื่อนไข</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </View>
    );
  }

  // ============================================
  // TAB: JOBS
  // ============================================
  function renderJobs() {
    return (
      <View>
        {/* Status Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          {[{ key: 'all', label: 'ทั้งหมด' }, { key: 'active', label: 'เปิดรับ' }, { key: 'urgent', label: 'ด่วน' }, { key: 'closed', label: 'ปิดแล้ว' }].map((f) => (
            <TouchableOpacity
              key={f.key}
              onPress={() => setJobStatusFilter(f.key)}
              style={[styles.filterChip, jobStatusFilter === f.key && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, jobStatusFilter === f.key && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.resultCount}>
          แสดง {filteredJobs.length} จาก {jobs.length} งาน
        </Text>

        {/* Jobs List */}
        {filteredJobs.map((j) => (
          <TouchableOpacity
            key={j.id}
            style={styles.jobCard}
            onPress={() => { setSelectedJob(j); setJobModalVisible(true); }}
            activeOpacity={0.7}
          >
            <View style={styles.jobCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.jobCardTitle} numberOfLines={1}>{j.title}</Text>
                <Text style={styles.jobCardPoster}>{j.posterName}</Text>
              </View>
              <Badge {...getStatusBadge(j.status)} />
            </View>

            <View style={styles.jobCardBody}>
              {j.department ? (
                <View style={styles.jobCardTag}>
                  <Ionicons name="medical-outline" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.jobCardTagText}>{j.department}</Text>
                </View>
              ) : null}
              {j.province ? (
                <View style={styles.jobCardTag}>
                  <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.jobCardTagText}>{j.province}</Text>
                </View>
              ) : null}
              {j.shiftRate > 0 && (
                <View style={styles.jobCardTag}>
                  <Ionicons name="cash-outline" size={12} color={COLORS.textSecondary} />
                  <Text style={styles.jobCardTagText}>฿{j.shiftRate.toLocaleString()}</Text>
                </View>
              )}
            </View>

            <View style={styles.jobCardFooter}>
              <Text style={styles.jobCardFooterText}>
                {formatDate(j.createdAt)}
                {j.shiftDate ? ` · กะ ${formatDate(j.shiftDate)}` : ''}
                {j.shiftTime ? ` ${j.shiftTime}` : ''}
              </Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={styles.jobCardStat}>
                  <Ionicons name="eye-outline" size={12} color={COLORS.textLight} />
                  <Text style={styles.jobCardStatText}>{j.viewsCount}</Text>
                </View>
                <View style={styles.jobCardStat}>
                  <Ionicons name="people-outline" size={12} color={COLORS.textLight} />
                  <Text style={styles.jobCardStatText}>{j.applicantsCount}</Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {filteredJobs.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="briefcase-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>ไม่พบงานที่ตรงเงื่อนไข</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </View>
    );
  }

  // ============================================
  // TAB: CHATS
  // ============================================
  function renderChats() {
    return (
      <View>
        <Text style={styles.resultCount}>{chats.length} การสนทนา</Text>

        {chats.map((c) => {
          const names = c.participantDetails?.map((p) => p.displayName || p.name).join(' ↔ ') || c.participants.join(', ');
          return (
            <View key={c.id} style={styles.chatCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.chatParticipants} numberOfLines={1}>{names}</Text>
                {c.jobTitle && (
                  <Text style={styles.chatJob} numberOfLines={1}>
                    <Ionicons name="briefcase-outline" size={11} color={COLORS.textLight} /> {c.jobTitle}
                  </Text>
                )}
                <Text style={styles.chatLastMsg} numberOfLines={1}>{c.lastMessage || '(ไม่มีข้อความ)'}</Text>
                <Text style={styles.chatTime}>{formatDateTime(c.lastMessageAt)}</Text>
              </View>
              <TouchableOpacity
                onPress={() => handleDeleteChat(c)}
                style={styles.chatDeleteBtn}
              >
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              </TouchableOpacity>
            </View>
          );
        })}

        {chats.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={48} color={COLORS.textLight} />
            <Text style={styles.emptyText}>ยังไม่มีการสนทนา</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </View>
    );
  }

  // ============================================
  // MODAL: USER DETAIL
  // ============================================
  function renderUserModal() {
    if (!selectedUser) return null;
    const u = selectedUser;
    const badge = getRoleBadge(u.role);

    return (
      <Modal visible={userModalVisible} transparent animationType="slide" onRequestClose={() => setUserModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            {/* Header */}
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>ข้อมูลผู้ใช้</Text>
              <TouchableOpacity onPress={() => setUserModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Profile */}
              <View style={styles.modalProfileRow}>
                <View style={[styles.avatarLg, { backgroundColor: badge.bg }]}>
                  <Text style={[styles.avatarLgText, { color: badge.color }]}>
                    {u.displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalProfileName}>{u.displayName}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Badge {...badge} />
                    {u.isVerified && (
                      <View style={[styles.miniChip, { backgroundColor: COLORS.successLight }]}>
                        <Ionicons name="checkmark-circle" size={12} color={COLORS.success} />
                        <Text style={[styles.miniChipText, { color: COLORS.success }]}>ยืนยันแล้ว</Text>
                      </View>
                    )}
                    {!u.isActive && (
                      <View style={[styles.miniChip, { backgroundColor: COLORS.errorLight }]}>
                        <Text style={[styles.miniChipText, { color: COLORS.error }]}>ระงับแล้ว</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>

              {/* Info Rows */}
              <View style={styles.infoSection}>
                <InfoRow icon="mail-outline" label="อีเมล" value={u.email} />
                <InfoRow icon="call-outline" label="โทรศัพท์" value={u.phone || '-'} />
                <InfoRow icon="document-text-outline" label="เลขใบอนุญาต" value={u.licenseNumber || '-'} />
                <InfoRow icon="calendar-outline" label="สมัครเมื่อ" value={formatDate(u.createdAt)} />
                <InfoRow icon="time-outline" label="เข้าใช้ล่าสุด" value={formatDateTime(u.lastLoginAt)} />
                <InfoRow icon="finger-print-outline" label="UID" value={u.uid} mono />
              </View>

              {/* Role Change */}
              <Text style={styles.modalSectionTitle}>เปลี่ยน Role</Text>
              <View style={styles.roleGrid}>
                {(['user', 'nurse', 'hospital', 'admin'] as const).map((role) => {
                  const rb = getRoleBadge(role);
                  const isCurrentRole = u.role === role;
                  return (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleBtn,
                        { borderColor: rb.color },
                        isCurrentRole && { backgroundColor: rb.bg },
                      ]}
                      onPress={() => handleChangeRole(u, role)}
                      disabled={isCurrentRole}
                    >
                      <Text style={[styles.roleBtnText, { color: rb.color }]}>{rb.label}</Text>
                      {isCurrentRole && <Ionicons name="checkmark" size={14} color={rb.color} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Actions */}
              <Text style={styles.modalSectionTitle}>การดำเนินการ</Text>
              <View style={styles.actionList}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: u.isVerified ? COLORS.warningLight : COLORS.successLight }]}
                  onPress={() => handleVerifyUser(u)}
                >
                  <Ionicons name={u.isVerified ? 'close-circle-outline' : 'shield-checkmark-outline'} size={20} color={u.isVerified ? COLORS.accent : COLORS.success} />
                  <Text style={[styles.actionBtnText, { color: u.isVerified ? COLORS.accent : COLORS.success }]}>
                    {u.isVerified ? 'ยกเลิกยืนยัน' : 'ยืนยันตัวตน'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: u.isActive ? COLORS.warningLight : COLORS.successLight }]}
                  onPress={() => handleToggleUserActive(u)}
                >
                  <Ionicons name={u.isActive ? 'ban-outline' : 'checkmark-circle-outline'} size={20} color={u.isActive ? COLORS.accent : COLORS.success} />
                  <Text style={[styles.actionBtnText, { color: u.isActive ? COLORS.accent : COLORS.success }]}>
                    {u.isActive ? 'ระงับผู้ใช้' : 'เปิดใช้งาน'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: COLORS.errorLight }]}
                  onPress={() => handleDeleteUser(u)}
                >
                  <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                  <Text style={[styles.actionBtnText, { color: COLORS.error }]}>ลบผู้ใช้ถาวร</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }

  // ============================================
  // MODAL: JOB DETAIL
  // ============================================
  function renderJobModal() {
    if (!selectedJob) return null;
    const j = selectedJob;
    const badge = getStatusBadge(j.status);

    return (
      <Modal visible={jobModalVisible} transparent animationType="slide" onRequestClose={() => setJobModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>รายละเอียดงาน</Text>
              <TouchableOpacity onPress={() => setJobModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.jobModalHeaderRow}>
                <Text style={styles.jobModalTitle}>{j.title}</Text>
                <Badge {...badge} />
              </View>

              <View style={styles.infoSection}>
                <InfoRow icon="person-outline" label="ผู้ประกาศ" value={j.posterName} />
                <InfoRow icon="medical-outline" label="แผนก" value={j.department || '-'} />
                <InfoRow icon="people-outline" label="ประเภท" value={j.staffType || '-'} />
                <InfoRow icon="location-outline" label="จังหวัด" value={j.province || '-'} />
                <InfoRow icon="business-outline" label="สถานที่" value={j.hospital || '-'} />
                <InfoRow icon="cash-outline" label="ค่าตอบแทน" value={j.shiftRate > 0 ? `฿${j.shiftRate.toLocaleString()}` : '-'} />
                <InfoRow icon="calendar-outline" label="วันกะ" value={j.shiftDate ? formatDate(j.shiftDate) : '-'} />
                <InfoRow icon="time-outline" label="เวลากะ" value={j.shiftTime || '-'} />
                <InfoRow icon="create-outline" label="ประกาศเมื่อ" value={formatDate(j.createdAt)} />
              </View>

              {/* Stats */}
              <View style={styles.jobModalStats}>
                <View style={styles.jobModalStatItem}>
                  <Ionicons name="eye" size={20} color={COLORS.primary} />
                  <Text style={styles.jobModalStatValue}>{j.viewsCount}</Text>
                  <Text style={styles.jobModalStatLabel}>เข้าชม</Text>
                </View>
                <View style={styles.jobModalStatItem}>
                  <Ionicons name="people" size={20} color="#7C3AED" />
                  <Text style={styles.jobModalStatValue}>{j.applicantsCount}</Text>
                  <Text style={styles.jobModalStatLabel}>สมัคร</Text>
                </View>
                <View style={styles.jobModalStatItem}>
                  <Ionicons name="chatbubble" size={20} color={COLORS.secondary} />
                  <Text style={styles.jobModalStatValue}>{j.contactsCount}</Text>
                  <Text style={styles.jobModalStatLabel}>ติดต่อ</Text>
                </View>
              </View>

              {/* Status Change */}
              <Text style={styles.modalSectionTitle}>เปลี่ยนสถานะ</Text>
              <View style={styles.roleGrid}>
                {(['active', 'urgent', 'closed'] as const).map((status) => {
                  const sb = getStatusBadge(status);
                  const isCurrent = j.status === status;
                  return (
                    <TouchableOpacity
                      key={status}
                      style={[styles.roleBtn, { borderColor: sb.color }, isCurrent && { backgroundColor: sb.bg }]}
                      onPress={() => handleChangeJobStatus(j, status)}
                      disabled={isCurrent}
                    >
                      <Text style={[styles.roleBtnText, { color: sb.color }]}>{sb.label}</Text>
                      {isCurrent && <Ionicons name="checkmark" size={14} color={sb.color} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Delete */}
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: COLORS.errorLight, marginTop: 16 }]}
                onPress={() => handleDeleteJob(j)}
              >
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                <Text style={[styles.actionBtnText, { color: COLORS.error }]}>ลบงานถาวร</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }
}

// ============================================
// SUB-COMPONENTS
// ============================================

function StatCard({ icon, label, value, color, sub }: {
  icon: string; label: string; value: number; color: string; sub: string;
}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIconBg, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.statValue}>{value.toLocaleString()}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statSub, { color }]}>{sub}</Text>
    </View>
  );
}

function QuickAction({ icon, label, color, badge, onPress }: {
  icon: string; label: string; color: string; badge?: number; onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.quickActionBtn} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.quickActionIcon, { backgroundColor: color + '18' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
        {badge != null && badge > 0 && (
          <View style={styles.quickActionBadge}>
            <Text style={styles.quickActionBadgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function Badge({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value, mono }: {
  icon: string; label: string; value: string; mono?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoRowLeft}>
        <Ionicons name={icon as any} size={16} color={COLORS.textLight} />
        <Text style={styles.infoRowLabel}>{label}</Text>
      </View>
      <Text style={[styles.infoRowValue, mono && { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

// ============================================
// STYLES
// ============================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textSecondary,
    fontSize: FONT_SIZES.md,
  },

  // Header
  header: {
    backgroundColor: COLORS.primaryDark,
    paddingBottom: 0,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.white,
  },
  headerSubtitle: {
    fontSize: FONT_SIZES.xs,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: 4,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.full,
  },
  tabActive: {
    backgroundColor: COLORS.white,
  },
  tabLabel: {
    fontSize: FONT_SIZES.sm,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: '600',
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: SPACING.lg,
  },

  // Section
  sectionTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 20,
    marginBottom: 12,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    width: (SCREEN_WIDTH - SPACING.lg * 2 - 10) / 2,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    borderLeftWidth: 3,
    ...SHADOWS.sm,
  },
  statIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statSub: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    marginTop: 4,
  },

  // Quick Actions
  quickActions: {
    flexDirection: 'row',
    gap: 10,
  },
  quickActionBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 16,
    ...SHADOWS.sm,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
    color: COLORS.text,
    textAlign: 'center',
  },
  quickActionBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  quickActionBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.white,
  },

  // Card
  card: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: 16,
    ...SHADOWS.sm,
  },

  // Breakdown Row
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  roleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  breakdownLabel: {
    width: 80,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  breakdownBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: 3,
    overflow: 'hidden',
  },
  breakdownBarFill: {
    height: '100%',
    borderRadius: 3,
    minWidth: 2,
  },
  breakdownCount: {
    width: 32,
    textAlign: 'right',
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.text,
  },

  // List Item
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    ...SHADOWS.sm,
  },
  listItemTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  listItemSub: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: 2,
  },

  // Avatar
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
  },
  avatarLg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLgText: {
    fontSize: 24,
    fontWeight: '700',
  },

  // See All Button
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 4,
  },
  seeAllText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.primary,
  },

  // Search
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
    ...SHADOWS.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONT_SIZES.md,
    color: COLORS.text,
    height: '100%',
  },

  // Filter
  filterRow: {
    marginTop: 10,
    marginBottom: 4,
  },
  filterChip: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: COLORS.white,
  },

  resultCount: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginVertical: 10,
  },

  // User Card
  userCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    marginBottom: 10,
    ...SHADOWS.sm,
  },
  userCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userCardName: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    flexShrink: 1,
  },
  userCardEmail: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: 2,
  },
  userCardFooter: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  userCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  userCardMetaText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
  },
  suspendedChip: {
    backgroundColor: COLORS.errorLight,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  suspendedChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.error,
  },

  // Job Card
  jobCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    marginBottom: 10,
    ...SHADOWS.sm,
  },
  jobCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  jobCardTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  jobCardPoster: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: 2,
  },
  jobCardBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  jobCardTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  jobCardTagText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textSecondary,
  },
  jobCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  jobCardFooterText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
  },
  jobCardStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  jobCardStatText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
  },

  // Chat Card
  chatCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    ...SHADOWS.sm,
  },
  chatParticipants: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
  },
  chatJob: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: 2,
  },
  chatLastMsg: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  chatTime: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
    marginTop: 4,
  },
  chatDeleteBtn: {
    justifyContent: 'center',
    padding: 8,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.textLight,
  },

  // Badge
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BORDER_RADIUS.full,
  },
  badgeText: {
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    maxHeight: '85%',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  modalProfileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  modalProfileName: {
    fontSize: FONT_SIZES.lg,
    fontWeight: '700',
    color: COLORS.text,
  },
  miniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.xs,
  },
  miniChipText: {
    fontSize: 10,
    fontWeight: '600',
  },

  // Info Section
  infoSection: {
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    padding: 14,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoRowLabel: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.textSecondary,
  },
  infoRowValue: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '500',
    color: COLORS.text,
    maxWidth: '55%',
    textAlign: 'right',
  },

  // Modal Section
  modalSectionTitle: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 10,
  },

  // Role Grid
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  roleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1.5,
    borderRadius: BORDER_RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  roleBtnText: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },

  // Action List
  actionList: {
    gap: 8,
    marginBottom: 20,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionBtnText: {
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },

  // Job Modal
  jobModalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 16,
  },
  jobModalTitle: {
    flex: 1,
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  jobModalStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: COLORS.backgroundSecondary,
    borderRadius: BORDER_RADIUS.md,
    paddingVertical: 16,
    marginBottom: 20,
  },
  jobModalStatItem: {
    alignItems: 'center',
    gap: 4,
  },
  jobModalStatValue: {
    fontSize: FONT_SIZES.xl,
    fontWeight: '700',
    color: COLORS.text,
  },
  jobModalStatLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.textLight,
  },
});
