// ============================================
// DOCUMENTS SERVICE - Production Ready
// ============================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { assertAuthUser, isAuthUser } from './security/authGuards';

const DOCUMENTS_COLLECTION = 'documents';

export type DocumentType = 
  | 'resume'              // Resume/CV
  | 'license'             // ใบประกอบวิชาชีพ
  | 'certificate'         // ใบรับรอง/Certificate
  | 'education'           // วุฒิการศึกษา
  | 'training'            // ใบอบรม
  | 'id_card'             // บัตรประชาชน
  | 'photo'               // รูปถ่าย
  | 'other';              // อื่นๆ

export interface Document {
  id: string;
  userId: string;
  type: DocumentType;
  name: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  isVerified: boolean;
  verifiedAt?: Date;
  verifiedBy?: string;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}

// Upload document
export async function uploadDocument(
  userId: string,
  type: DocumentType,
  name: string,
  file: Blob,
  fileName: string,
  mimeType: string
): Promise<Document> {
  try {
    assertAuthUser(userId, 'ไม่สามารถอัปโหลดเอกสารแทนผู้ใช้อื่นได้');

    // Generate unique file path
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `documents/${userId}/${type}/${timestamp}_${safeName}`;
    
    // Upload to Firebase Storage
    const storageRef = ref(storage, filePath);
    await uploadBytes(storageRef, file, { contentType: mimeType });
    const fileUrl = await getDownloadURL(storageRef);
    
    // Save document metadata to Firestore
    const docData = {
      userId,
      type,
      name,
      fileName,
      fileUrl,
      fileSize: file.size,
      mimeType,
      isVerified: false,
      createdAt: serverTimestamp(),
    };
    
    const docRef = await addDoc(collection(db, DOCUMENTS_COLLECTION), docData);
    
    return {
      id: docRef.id,
      ...docData,
      createdAt: new Date(),
    } as Document;
  } catch (error) {
    console.error('Error uploading document:', error);
    throw error;
  }
}

// Get user documents
export async function getUserDocuments(userId: string): Promise<Document[]> {
  try {
    if (!isAuthUser(userId)) return [];

    const q = query(
      collection(db, DOCUMENTS_COLLECTION),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
      updatedAt: (doc.data().updatedAt as Timestamp)?.toDate(),
      verifiedAt: (doc.data().verifiedAt as Timestamp)?.toDate(),
      expiresAt: (doc.data().expiresAt as Timestamp)?.toDate(),
    })) as Document[];
  } catch (error) {
    console.error('Error getting documents:', error);
    return [];
  }
}

// Get documents by type
export async function getDocumentsByType(userId: string, type: DocumentType): Promise<Document[]> {
  try {
    if (!isAuthUser(userId)) return [];

    const q = query(
      collection(db, DOCUMENTS_COLLECTION),
      where('userId', '==', userId),
      where('type', '==', type)
    );
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: (doc.data().createdAt as Timestamp)?.toDate() || new Date(),
    })) as Document[];
  } catch (error) {
    console.error('Error getting documents by type:', error);
    return [];
  }
}

// Update document
export async function updateDocument(
  documentId: string,
  updates: Partial<Pick<Document, 'name' | 'expiresAt'>>
): Promise<void> {
  try {
    await updateDoc(doc(db, DOCUMENTS_COLLECTION, documentId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
}

// Delete document
export async function deleteDocument(documentId: string, fileUrl: string): Promise<void> {
  try {
    // Delete from Storage
    try {
      const storageRef = ref(storage, fileUrl);
      await deleteObject(storageRef);
    } catch (storageError) {
      console.warn('Error deleting file from storage:', storageError);
    }
    
    // Delete from Firestore
    await deleteDoc(doc(db, DOCUMENTS_COLLECTION, documentId));
  } catch (error) {
    console.error('Error deleting document:', error);
    throw error;
  }
}

// Verify document (admin only)
export async function verifyDocument(
  documentId: string,
  verifiedBy: string
): Promise<void> {
  try {
    await updateDoc(doc(db, DOCUMENTS_COLLECTION, documentId), {
      isVerified: true,
      verifiedAt: serverTimestamp(),
      verifiedBy,
    });
  } catch (error) {
    console.error('Error verifying document:', error);
    throw error;
  }
}

// Get document type label in Thai
export function getDocumentTypeLabel(type: DocumentType): string {
  const labels: Record<DocumentType, string> = {
    resume: 'Resume/CV',
    license: 'ใบประกอบวิชาชีพ',
    certificate: 'ใบรับรอง',
    education: 'วุฒิการศึกษา',
    training: 'ใบอบรม',
    id_card: 'บัตรประชาชน',
    photo: 'รูปถ่าย',
    other: 'อื่นๆ',
  };
  return labels[type] || type;
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
