import { getAuth, User } from 'firebase/auth';

export function assertAuthUser(expectedUid?: string, mismatchMessage?: string): User {
  const currentUser = getAuth().currentUser;
  if (!currentUser) {
    throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  }
  if (expectedUid && currentUser.uid !== expectedUid) {
    throw new Error(mismatchMessage || 'ไม่สามารถดำเนินการแทนผู้ใช้อื่นได้');
  }
  return currentUser;
}

export function getAuthUid(): string | null {
  return getAuth().currentUser?.uid || null;
}

export function isAuthUser(uid: string): boolean {
  const currentUser = getAuth().currentUser;
  return !!currentUser && currentUser.uid === uid;
}
