import { getAuth, onAuthStateChanged, User } from 'firebase/auth';

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

export async function waitForAuthUser(timeoutMs: number = 4000): Promise<User> {
  const auth = getAuth();
  if (auth.currentUser) {
    return auth.currentUser;
  }

  return await new Promise<User>((resolve, reject) => {
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'));
    }, timeoutMs);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve(user);
    });
  });
}
