# 🏥 NurseGo - แพลตฟอร์มหางานพยาบาล

แอปพลิเคชันสำหรับพยาบาลในการประกาศหาคนแทนงานกะ และรับงานแทนกันในพื้นที่กรุงเทพฯ และปริมณฑล

![React Native](https://img.shields.io/badge/React_Native-0.81.5-blue)
![Expo](https://img.shields.io/badge/Expo-SDK_54-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20Functions-orange)

## ✨ Features

### สำหรับผู้ต้องการหาคนแทน (โรงพยาบาล / นายจ้าง)
- 📝 ลงประกาศหาคนแทนงานกะ (shifts)
- 💰 กำหนดค่าตอบแทน (ต่อชั่วโมง/วัน/กะ)
- 📅 ระบุวันที่และช่วงเวลา (กะเช้า/บ่าย/ดึก)
- 👥 ดูรายชื่อผู้สนใจและติดต่อกลับ
- ⚡ ปุ่มด่วน (Urgent post)

### สำหรับผู้ต้องการรับงาน (พยาบาล)
- 🔍 ค้นหางานตามพื้นที่ แผนก ประเภทงาน
- 🗺️ ดูแผนที่ตำแหน่งสถานที่ทำงาน
- 🔔 รับแจ้งเตือนงานใหม่ที่ตรงกับความต้องการ
- 💾 บันทึกงานที่สนใจ (Favorites)
- 📞 ติดต่อผู้ประกาศโดยตรง (แชท/โทร/LINE)
- ⭐ ให้คะแนนและรีวิวหลังทำงาน

### ฟีเจอร์ทั่วไป
- 🔐 ระบบสมาชิก (Email/Password, Google OAuth, OTP ทางโทรศัพท์)
- 👤 โปรไฟล์พยาบาลพร้อมระบบยืนยันตัวตน (เอกสาร/ใบประกอบวิชาชีพ)
- 💬 ระบบแชทแบบ Real-time
- 🔔 Push Notification (Expo Notifications + FCM)
- 💳 ระบบ Subscription (Free / Premium) ผ่าน Omise PromptPay
- 🛒 Shop สำหรับซื้อ Add-on (โพสต์เพิ่ม, ต่ออายุ)
- 🏆 ระบบ Referral
- 🛡️ Admin Dashboard (รายงาน, ฟีดแบ็ค, จัดการผู้ใช้)

## 🗺️ พื้นที่ให้บริการ

กรุงเทพมหานคร · นนทบุรี · ปทุมธานี · สมุทรปราการ · สมุทรสาคร · นครปฐม

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.81.5 + Expo SDK 54 |
| Language | TypeScript 5.8 |
| Navigation | React Navigation 7 |
| UI | UI Kitten + Custom components |
| Backend | Firebase (Auth, Firestore, Storage, Cloud Functions) |
| Payment | Omise (PromptPay QR) |
| Push Notifications | Expo Notifications + FCM |
| Maps | Google Maps (react-native-maps) |
| State | React Context |

## 📁 Project Structure

```
src/
├── components/
│   ├── common/         # Reusable UI (Button, Modal, Calendar, Map, etc.)
│   └── job/            # JobCard
├── config/             # Firebase + Admin config
├── constants/          # Districts, job options, locations
├── context/            # Auth, Theme, Toast, Notification contexts
├── navigation/         # AppNavigator
├── screens/
│   ├── admin/          # Dashboard, Reports, Feedback
│   ├── auth/           # Login, Register, OTP, ForgotPassword
│   ├── chat/           # Chat list + Chat room
│   ├── documents/      # Upload & manage documents
│   ├── favorites/      # Saved jobs
│   ├── home/           # Job feed with filters
│   ├── job/            # PostJob, JobDetail, Applicants
│   ├── map/            # Map view of jobs
│   ├── myposts/        # Manage own posts
│   ├── notifications/  # Notification history
│   ├── payment/        # Omise PromptPay payment flow
│   ├── profile/        # User profile & settings
│   ├── reviews/        # Ratings & reviews
│   ├── settings/       # App settings
│   ├── shop/           # Buy plans & add-ons
│   └── verification/   # Identity verification
├── services/           # All Firebase & API services
├── theme/              # Colors, palettes, UI Kitten config
├── types/              # TypeScript type definitions
└── utils/              # Helpers, geohash, validation, logger
functions/
└── index.js            # Cloud Functions (triggers, scheduled, OTP, Omise)
scripts/
├── fix-gradle-compat.js    # Android build patch (runs on npm install)
└── generateAdminHash.js    # Generate admin password hash for .env
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ (แนะนำ v20+ via [nvm](https://github.com/nvm-sh/nvm))
- Expo Go app บนมือถือ

### Installation

```bash
git clone https://github.com/s6752410009/nursejob.git
cd nursejob
npm install
```

### Environment Setup

สร้างไฟล์ `.env` ที่ root ของโปรเจค:

```bash
# Admin account
EXPO_PUBLIC_ADMIN_USERNAME=adminmark
EXPO_PUBLIC_ADMIN_PASSWORD_HASH=<sha256 hash>

# สร้าง hash ด้วย:
node scripts/generateAdminHash.js YOUR_PASSWORD
```

### Start Development Server

```bash
npx expo start
```

- **มือถือ:** Scan QR ผ่าน Expo Go
- **Android Emulator:** กด `a`
- **iOS Simulator:** กด `i`
- **Web:** กด `w`

## 🔧 Scripts

```bash
# Start (clear cache)
npx expo start --clear

# Type check
npx tsc --noEmit

# Deploy Cloud Functions
cd functions && npm install && firebase deploy --only functions
```

## ☁️ Cloud Functions

| Function | Trigger | หน้าที่ |
|---|---|---|
| `sendCustomOTP` | HTTP (onCall) | ส่ง OTP ทาง SMS |
| `verifyCustomOTP` | HTTP (onCall) | ตรวจสอบ OTP + คืน custom token |
| `createOmiseCharge` | HTTP (onCall) | สร้าง Omise PromptPay charge |
| `checkOmiseCharge` | HTTP (onCall) | ตรวจสอบสถานะการชำระเงิน |
| `expireOldJobs` | Scheduled (6h) | ปิด shift ที่หมดอายุ |
| `checkSubscriptionExpiry` | Scheduled (6h) | ตรวจ subscription หมดอายุ |
| `autoCloseFilledJobs` | Scheduled (3h) | ปิด shift ที่รับคนครบ |
| `onNewApplication` | Firestore trigger | แจ้งเตือนเมื่อมีคนสนใจงาน |
| `onNewMessage` | Firestore trigger | แจ้งเตือนข้อความใหม่ |
| `onNewShift` | Firestore trigger | แจ้งเตือนงานใหม่ทั่วไป |
| `onUserCreate` | Firestore trigger | สร้าง userPlan เริ่มต้น |
| `notifyJobExpiringSoon` | Scheduled (daily) | แจ้งเตือนงานใกล้หมดอายุ |
| `cleanupOldNotifications` | Scheduled (daily) | ลบ notification เก่า |
| `weeklyStatsReport` | Scheduled (weekly) | สรุปสถิติรายสัปดาห์ |
| `resetDailyLimits` | Scheduled (daily) | รีเซ็ต daily post limit |

## 📄 License

This project is for educational purposes.

## 👨‍💻 Author

- **Student ID:** s6752410009
- **GitHub:** [@s6752410009](https://github.com/s6752410009)


## 📱 Screenshots

| หน้าหลัก | รายละเอียดงาน | ประกาศหาคนแทน |
|:---:|:---:|:---:|
| หน้าแสดงรายการงาน | แสดงรายละเอียดและติดต่อ | ฟอร์มลงประกาศ |

## ✨ Features

### สำหรับผู้ต้องการหาคนแทน
- 📝 ลงประกาศหาคนแทนงานกะ
- 💰 กำหนดค่าตอบแทน (ต่อชั่วโมง/วัน/กะ)
- 📅 ระบุวันที่และช่วงเวลา (กะเช้า/บ่าย/ดึก)
- 👥 ดูรายชื่อผู้สนใจและติดต่อกลับ

### สำหรับผู้ต้องการรับงาน
- 🔍 ค้นหางานตามพื้นที่และแผนก
- 🔔 กรองงานด่วน หรือตามช่วงเวลา
- 💾 บันทึกงานที่สนใจ
- 📞 ติดต่อผู้ประกาศโดยตรง (โทร/LINE)

### ฟีเจอร์ทั่วไป
- 🔐 ระบบสมาชิก (Email/Password)
- 👤 โปรไฟล์พยาบาล
- 💬 ระบบแชท
- 🔔 แจ้งเตือน
- ⚙️ ตั้งค่าต่างๆ

## 🗺️ พื้นที่ให้บริการ

- กรุงเทพมหานคร
- นนทบุรี
- ปทุมธานี
- สมุทรปราการ
- สมุทรสาคร
- นครปฐม

## 🛠️ Tech Stack

- **Framework:** React Native + Expo SDK 54
- **Language:** TypeScript
- **Navigation:** React Navigation 7
- **Backend:** Firebase (Auth, Firestore, Storage)
- **State Management:** React Context
- **UI Components:** Custom components

## 📁 Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── common/         # Button, Input, Avatar, etc.
│   └── job/            # JobCard component
├── config/             # Firebase configuration
├── context/            # React Context (Auth)
├── navigation/         # App Navigator
├── screens/            # All screens
│   ├── auth/           # Login, Register, ForgotPassword
│   ├── home/           # Home screen with job list
│   ├── job/            # PostJob, JobDetail
│   ├── chat/           # Chat screens
│   ├── profile/        # User profile
│   ├── favorites/      # Saved jobs
│   ├── applicants/     # Manage interested users
│   ├── settings/       # App settings
│   ├── notifications/  # Notifications
│   ├── documents/      # Document management
│   ├── reviews/        # Reviews
│   ├── help/           # Help & FAQ
│   └── legal/          # Terms & Privacy
├── services/           # API & Firebase services
├── theme/              # Colors, spacing, fonts
├── types/              # TypeScript definitions
└── utils/              # Helper functions
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

Create Firebase project and update `src/config/firebase.ts`:

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

## 📦 Dependencies

### Main Dependencies
- `expo` - Development platform
- `react-native` - Mobile framework
- `@react-navigation/native` - Navigation
- `firebase` - Backend services
- `react-native-safe-area-context` - Safe area handling
- `@expo/vector-icons` - Icons

### Dev Dependencies
- `typescript` - Type checking
- `@types/react` - React types

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

# Build for Android
npx expo build:android

# Build for iOS
npx expo build:ios
```

## 📄 License

This project is for educational purposes.

## 👨‍💻 Author

- **Student ID:** s6752410009
- **GitHub:** [@s6752410009](https://github.com/s6752410009)

---

⭐ ถ้าชอบโปรเจคนี้ อย่าลืมกด Star ให้ด้วยนะครับ!