# NurseGo

แพลตฟอร์มประกาศงานและจับคู่งานสายสุขภาพแบบหลายบทบาท รองรับพยาบาล องค์กร/โรงพยาบาล และผู้ใช้งานทั่วไปที่ต้องการหาผู้ดูแลหรือบุคลากรสุขภาพ

![React Native](https://img.shields.io/badge/React_Native-0.79.2-blue)
![Expo](https://img.shields.io/badge/Expo-SDK_54-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore-orange)

## ✨ Features

### ระบบหลักของแอป
- Multi-role platform: `nurse`, `hospital`, `user`, `admin`
- ประกาศได้ 3 รูปแบบ: หาคนแทนเวร, รับสมัครบุคลากร, หาคนดูแลผู้ป่วย
- หน้า Home แบบรวมทุกประเภทงาน โดยเริ่มที่แท็บ `ทั้งหมด` สำหรับทุก role
- ค้นหา กรอง บันทึกงาน รายละเอียดงาน และแชร์ลิงก์งานได้
- ระบบแชทในแอป พร้อมการล็อกแชทอัตโนมัติเมื่อประกาศปิด/หมดอายุ
- โปรไฟล์สาธารณะ, รีวิว, ป้าย role, ป้าย verified, ป้าย premium
- ระบบแจ้งเตือนทั่วไป และแจ้งเตือนงานใกล้ฉันตามตำแหน่ง
- ร้านค้า/แพ็กเกจสมาชิก, ซื้อปุ่มด่วน, ต่ออายุโพสต์, referral

### สำหรับพยาบาล
- ลงประกาศหาคนแทนเวร
- ค้นหาและรับงานตามพื้นที่ แผนก และประเภทงาน
- ดูรีวิว โปรไฟล์ผู้โพสต์ และเริ่มแชทจากหน้าโพสต์
- ส่งเอกสาร ยืนยันตัวตน และสร้างความน่าเชื่อถือบนโปรไฟล์

### สำหรับองค์กร / โรงพยาบาล / คลินิก / เอเจนซี่
- ลงประกาศรับสมัครงานจริงพร้อมเงินเดือน สวัสดิการ และเวลางาน
- ดูผู้สมัคร/ผู้สนใจจาก Applicants
- แชทกับผู้สมัครในแอป
- จัดการประกาศของฉัน และติดตามประกาศที่ใกล้หมดอายุ

### สำหรับผู้ใช้งานทั่วไป
- ค้นหาผู้ดูแลหรือประกาศดูแลผู้ป่วย
- ดูโปรไฟล์ รีวิว และช่องทางติดต่อก่อนตัดสินใจ
- ลงประกาศหาผู้ดูแลใน flow เฉพาะ role ผู้ใช้ทั่วไป

### Onboarding และ UX ช่วยสอนการใช้งาน
- Onboarding แบบ role-aware 3 ขั้นหลังสมัคร/เข้าใช้งานครั้งแรก
- Auto redirect เข้าหน้าคู่มือเมื่อผู้ใช้ยังไม่จบ onboarding
- Contextual tips แบบ first-visit บน Home, Post Job, Chat, Profile
- เปิดดูคู่มือซ้ำได้จาก Profile, Settings และ Help

### ระบบแอดมินและความน่าเชื่อถือ
- Admin login และ admin dashboard
- ระบบยืนยันตัวตนพยาบาลและการตรวจคำขอ
- รีวิวผู้ใช้/องค์กรจากประวัติการทำงานที่เกี่ยวข้อง

## 🛠️ Highlighted Capabilities

- Deep linking และ share link สำหรับหน้า Job Detail
- Nearby jobs เรียงตามระยะทาง พร้อม radius setup
- Dark theme รองรับหลายหน้าหลักแล้ว
- รองรับ role metadata บนโพสต์และโปรไฟล์
- Fallback handling สำหรับ Firebase permission-denied บาง flow เพื่อไม่ให้แอปตันง่าย

## 🛠️ Tech Stack

- **Framework:** React Native + Expo SDK 54
- **Language:** TypeScript
- **Navigation:** React Navigation 7
- **Backend:** Firebase Auth, Firestore, Storage, Cloud Functions
- **State Management:** React Context + AsyncStorage
- **Notifications:** Expo Notifications
- **UI Components:** Custom components + theme system

## 📁 Project Structure

```
src/
├── components/          # Reusable UI, cards, modals, tips
│   ├── common/
│   └── job/
├── config/              # Firebase / app config
├── constants/           # Locations, job options, labels
├── context/             # Auth, Theme, Toast, Notifications
├── navigation/          # Root stack + tab navigation + deep linking
├── screens/
│   ├── admin/           # Admin dashboard / verification / reports
│   ├── applicants/      # Applicants and contact management
│   ├── auth/            # Login / register / onboarding / OTP
│   ├── chat/            # Conversation list and chat room
│   ├── help/            # Help / FAQ / guide entry
│   ├── home/            # Feed, filters, nearby jobs
│   ├── job/             # Post job / detail / payment flow
│   ├── notifications/   # Notifications + nearby alert settings
│   ├── profile/         # Own profile + public profile
│   ├── reviews/         # Reviews for hospitals and users
│   ├── settings/        # Settings and guide re-entry
│   └── ...
├── services/            # Firebase data access and business logic
├── theme/               # Theme palettes and tokens
├── types/               # Shared TypeScript models
└── utils/               # Helpers, location, tag/label mapping
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- Expo Go app (for mobile testing)

### Installation

1. Clone the repository
```bash
git clone https://github.com/s6752410009/nursejob.git
cd nursejob
```

2. Install dependencies
```bash
npm install
```

3. Start the development server
```bash
npx expo start
```

4. Run on device/emulator
- **Mobile:** Scan QR code with Expo Go
- **Web:** Press `w` or open http://localhost:8081
- **Android Emulator:** Press `a`
- **iOS Simulator:** Press `i`

### Environment Setup

ตั้งค่า Firebase project และค่าที่เกี่ยวข้องใน `src/config/firebase.ts` และไฟล์ config ที่จำเป็น เช่น `google-services.json`, `app.config.js`

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

## 🔧 Scripts

```bash
# Start development server
npm start

# Start with cache cleared
npx expo start --clear

# Start with tunnel (for remote testing)
npx expo start --tunnel

# Type check
npx tsc --noEmit

# TypeScript check
npx tsc --noEmit
```

## 🧭 Current Product Areas

- Authentication: email, phone OTP, Google login, admin login
- Role-aware onboarding and guide system
- Feed and search with category tabs, filters, favorites, nearby mode
- Posting workflows for nurse, hospital, and user roles
- Applicants and contact management
- In-app chat and notifications
- Public profile, review, verification, and premium tagging
- Help center, settings, legal pages

## 📄 Notes

- โปรเจกต์นี้ใช้งาน Firebase หลายส่วน ควรตั้งค่า auth, firestore rules, storage rules และ functions ให้ครบก่อนรันเต็มระบบ
- Deep link หลักของแอปถูกตั้งไว้ผ่าน `nursego://` และ URL ของ `nursego.co`