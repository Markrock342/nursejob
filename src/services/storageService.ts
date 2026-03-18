// ============================================
// STORAGE SERVICE - อัพโหลดรูป/เอกสาร
// ============================================

import { storage } from '../config/firebase';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

// ============================================
// Image Picker Functions
// ============================================

// Request permissions
export async function requestMediaPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return status === 'granted';
}

export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  return status === 'granted';
}

// Pick image from library
export async function pickImage(): Promise<string | null> {
  const hasPermission = await requestMediaPermission();
  if (!hasPermission) {
    throw new Error('กรุณาอนุญาตการเข้าถึงรูปภาพในการตั้งค่า');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return result.assets[0].uri;
}

// Take photo with camera
export async function takePhoto(): Promise<string | null> {
  const hasPermission = await requestCameraPermission();
  if (!hasPermission) {
    throw new Error('กรุณาอนุญาตการใช้กล้องในการตั้งค่า');
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return result.assets[0].uri;
}

// Pick document
export async function pickDocument(): Promise<{ uri: string; name: string; type: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/*', 'application/pdf'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  return {
    uri: result.assets[0].uri,
    name: result.assets[0].name,
    type: result.assets[0].mimeType || 'application/octet-stream',
  };
}

// ============================================
// Upload Functions
// ============================================

// Convert URI to blob
export async function readUriAsBlob(uri: string, mimeType = 'application/octet-stream'): Promise<Blob> {
  try {
    const response = await fetch(uri);
    return await response.blob();
  } catch (error) {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const dataUrl = `data:${mimeType};base64,${base64}`;
    const response = await fetch(dataUrl);
    return await response.blob();
  }
}

async function uriToBlob(uri: string, mimeType?: string): Promise<Blob> {
  return readUriAsBlob(uri, mimeType);
}

// Generate unique filename
function generateFileName(prefix: string, extension: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}_${timestamp}_${random}.${extension}`;
}

// Upload profile photo
export async function uploadProfilePhoto(userId: string, imageUri: string): Promise<string> {
  try {
    const blob = await uriToBlob(imageUri, 'image/jpeg');
    const fileName = generateFileName('profile', 'jpg');
    const storageRef = ref(storage, `users/${userId}/profile/${fileName}`);
    
    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);
    
    return downloadUrl;
  } catch (error) {
    console.error('Error uploading profile photo:', error);
    throw new Error('ไม่สามารถอัพโหลดรูปโปรไฟล์ได้');
  }
}

// Upload license document (ใบประกอบวิชาชีพ)
export async function uploadLicenseDocument(
  userId: string, 
  documentUri: string,
  documentName: string
): Promise<string> {
  try {
    const extension = documentName.split('.').pop() || 'pdf';
    const mimeType = extension.toLowerCase() === 'pdf' ? 'application/pdf' : `image/${extension.toLowerCase() === 'jpg' ? 'jpeg' : extension.toLowerCase()}`;
    const blob = await uriToBlob(documentUri, mimeType);
    const fileName = generateFileName('license', extension);
    const storageRef = ref(storage, `users/${userId}/documents/${fileName}`);
    
    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);
    
    return downloadUrl;
  } catch (error) {
    console.error('Error uploading license document:', error);
    throw new Error('ไม่สามารถอัพโหลดเอกสารได้');
  }
}

export async function uploadVerificationDocument(
  userId: string,
  documentUri: string,
  prefix: string,
  documentName = 'document.jpg'
): Promise<string> {
  try {
    const extension = documentName.split('.').pop() || 'jpg';
    const mimeType = extension.toLowerCase() === 'pdf' ? 'application/pdf' : `image/${extension.toLowerCase() === 'jpg' ? 'jpeg' : extension.toLowerCase()}`;
    const blob = await uriToBlob(documentUri, mimeType);
    const fileName = generateFileName(prefix, extension);
    const storageRef = ref(storage, `users/${userId}/documents/${fileName}`);

    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);

    return downloadUrl;
  } catch (error) {
    console.error('Error uploading verification document:', error);
    throw new Error('ไม่สามารถอัพโหลดเอกสารยืนยันตัวตนได้');
  }
}

// Upload ID card (บัตรประชาชน)
export async function uploadIdCard(userId: string, imageUri: string): Promise<string> {
  try {
    const blob = await uriToBlob(imageUri, 'image/jpeg');
    const fileName = generateFileName('idcard', 'jpg');
    const storageRef = ref(storage, `users/${userId}/documents/${fileName}`);
    
    await uploadBytes(storageRef, blob);
    const downloadUrl = await getDownloadURL(storageRef);
    
    return downloadUrl;
  } catch (error) {
    console.error('Error uploading ID card:', error);
    throw new Error('ไม่สามารถอัพโหลดบัตรประชาชนได้');
  }
}

// Delete file from storage
export async function deleteFile(fileUrl: string): Promise<void> {
  try {
    const fileRef = ref(storage, fileUrl);
    await deleteObject(fileRef);
  } catch (error) {
    console.error('Error deleting file:', error);
  }
}
