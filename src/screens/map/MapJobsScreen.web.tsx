// Web stub — react-native-maps ไม่รองรับ web
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MapJobsScreen({ navigation }: any) {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>แผนที่งาน</Text>
        <View style={{ width: 32 }} />
      </View>
      <View style={styles.body}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🗺️</Text>
        <Text style={styles.heading}>ดูแผนที่บนมือถือ</Text>
        <Text style={styles.sub}>ฟีเจอร์แผนที่ใช้งานได้บนแอป iOS / Android เท่านั้น</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#0EA5E9', paddingHorizontal: 16, paddingVertical: 14,
  },
  title: { fontSize: 18, fontWeight: '700', color: '#FFF', flex: 1, textAlign: 'center' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  heading: { fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  sub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 22 },
});
