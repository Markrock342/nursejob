# Analytics Production Deploy

เอกสารนี้คือ runbook สำหรับ deploy analytics ของ NurseGo ให้ครบทั้ง Firestore, Cloud Functions, index, และ BigQuery bootstrap

## ตอนนี้ข้อมูลสรุปดูได้ที่ไหน

ตอนนี้มี summary ที่ใช้งานได้แล้ว 2 จุด

1. หน้า Admin Dashboard > Overview
   แสดง Executive Analytics 7 วันล่าสุดจาก callable backend
2. Cloud Function callable `getExecutiveAnalyticsSummary`
   ใช้ข้อมูลจาก `analytics_events` โดยตรง

สิ่งที่ยังไม่เสร็จเต็มรูปแบบ

1. ยังไม่มี BI dashboard บน BigQuery/Looker
2. daily mart เพิ่งเริ่มจาก `generateDailyAnalyticsSummary`
3. partner-safe dataset ยังอยู่ในเฟสถัดไป

## สิ่งที่ deploy รอบนี้

1. Client analytics events
   ครอบคลุม app open, screen view, onboarding, chat, post job, profile, job detail, notifications, purchases
2. Backend ingestion
   `trackAnalyticsEvent`
3. Backend executive summary
   `getExecutiveAnalyticsSummary`
4. Backend daily summary jobs
   `generateDailyAnalyticsSummary`
   `runDailyAnalyticsSummaryNow`
5. Optional BigQuery mirror
   เปิดด้วย env/params เท่านั้น ถ้ายังไม่เปิด ระบบ Firestore analytics เดิมยังทำงานต่อได้

## Pre-Deploy Checklist

1. ยืนยัน Firebase project ที่จะ deploy
2. ยืนยันว่า admin account ใน `users` มี `role = admin` หรือ `isAdmin = true`
3. ยืนยันว่า Cloud Functions service account มีสิทธิ์ BigQuery Data Editor ถ้าจะเปิด sync
4. ยืนยันว่า dataset BigQuery ถูกสร้างแล้ว หรือมีสิทธิ์ให้ระบบสร้าง table ได้
5. ยืนยันว่า production ใช้ Node 20 สำหรับ Cloud Functions

## BigQuery Params ที่ต้องตั้ง

ถ้าจะเปิด warehouse sync ให้ตั้งค่าพวกนี้ใน environment ของ functions ก่อน deploy

```env
BIGQUERY_SYNC_ENABLED=true
BIGQUERY_PROJECT_ID=your-gcp-project-id
BIGQUERY_DATASET=nursego_analytics
BIGQUERY_EVENTS_TABLE=analytics_events
BIGQUERY_DAILY_SUMMARY_TABLE=analytics_daily_summaries
```

ถ้ายังไม่พร้อมใช้ BigQuery ให้ตั้งแค่

```env
BIGQUERY_SYNC_ENABLED=false
```

## Bootstrap BigQuery

ใช้ SQL จาก [docs/BIGQUERY_BOOTSTRAP.sql](/Users/nursego/nursejob/docs/BIGQUERY_BOOTSTRAP.sql)

ขั้นต่ำต้องมี 2 table

1. `analytics_events`
2. `analytics_daily_summaries`

## Deploy Commands

จาก root project

```bash
cd /Users/nursego/nursejob
npm install
cd functions
npm install
cd ..
firebase use <your-project-id>
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only functions
```

ทางลัดสำหรับ analytics โดยตรง

```bash
cd /Users/nursego/nursejob
npm run check:functions
npm run deploy:analytics
npm run verify:analytics
```

ถ้าต้องการ deploy เฉพาะ analytics functions แบบ targeted

```bash
cd /Users/nursego/nursejob
firebase deploy --only \
  functions:trackAnalyticsEvent,\
functions:getExecutiveAnalyticsSummary,\
functions:generateDailyAnalyticsSummary,\
functions:runDailyAnalyticsSummaryNow,\
functions:onUserCreate,\
functions:onNewShift,\
functions:onNewApplication,\
functions:onNewMessage,\
functions:onNewVerificationRequest
```

## First Production Verification

1. เปิดแอป 1 ครั้ง
2. ไปหน้า Home, Job Detail, Chat, Profile, Post Job
3. ทำ onboarding test 1 รอบใน test account
4. ใช้ admin account เปิดหน้า Admin Dashboard > Overview
5. ตรวจว่ามีเอกสารใน `analytics_events`
6. ตรวจว่า callable `getExecutiveAnalyticsSummary` ตอบข้อมูลได้

7. เรียก callable `getAnalyticsDeploymentReadiness` จาก admin account และยืนยันว่า `blockers` เป็น array ว่าง

## Manual Verification For Daily Summary

หลัง deploy แล้ว admin สามารถ trigger daily summary แบบ manual ได้ผ่าน callable `runDailyAnalyticsSummaryNow`

payload ตัวอย่าง

```json
{
  "eventDate": "2026-03-09"
}
```

ผลลัพธ์ที่ควรได้

1. มีเอกสารใหม่ใน `analytics_reports`
2. `type = daily_executive_summary`
3. ถ้าเปิด BigQuery sync จะมี row ใหม่ใน `analytics_daily_summaries`

## Firestore Checks

ตรวจ collection เหล่านี้

1. `analytics_events`
2. `analytics_reports`

สิ่งที่ควรเห็น

1. `analytics_events` มี `eventName`, `eventDate`, `createdAt`, `props`, `context`
2. `analytics_reports` มี `type = daily_executive_summary` หรือ `type = weekly`

## Production Sign-Off Checklist

1. Firestore rules deploy สำเร็จ
2. Firestore indexes deploy สำเร็จ
3. Cloud Functions deploy สำเร็จ
4. App เปิดแล้วมี `app_open`
5. เข้า Job Detail แล้วมี `job_detail_view`
6. ส่งข้อความแล้วมี `message_sent`
7. Onboarding flow ยิง `otp_requested`, `otp_verified`, `role_selected`, `onboarding_completed`
8. Post job flow ยิง `post_job_started` และ `post_job_submitted`
9. Profile flow ยิง `profile_viewed`, `profile_updated`, `profile_photo_updated`
10. Admin dashboard เห็น Executive Analytics section
11. Daily summary trigger ได้
12. ถ้าเปิด BigQuery sync: rows เข้า `analytics_events` และ `analytics_daily_summaries`

## Go / No-Go Gates

ปล่อยได้เมื่อครบทุกข้อด้านล่าง

1. `npm run check:functions` ผ่าน
2. `npx tsc --noEmit` ผ่าน
3. `firebase deploy --only firestore:indexes` สำเร็จ
4. `firebase deploy --only functions` หรือ `npm run deploy:analytics` สำเร็จ
5. `npm run verify:analytics` ผ่านครบ
6. callable `getAnalyticsDeploymentReadiness` คืนค่า `ready = true`
7. ถ้าเปิด `BIGQUERY_SYNC_ENABLED=true` ต้องไม่มี blocker เรื่อง dataset หรือ table หาย

ต้องเลื่อนปล่อยถ้ามีข้อใดข้อหนึ่งด้านล่าง

1. `getAnalyticsDeploymentReadiness.blockers.length > 0`
2. ไม่พบ daily summary ของเมื่อวานใน `analytics_reports`
3. ไม่พบ executive summary cache ล่าสุด
4. BigQuery sync เปิดอยู่แต่ dataset หรือ table ยังไม่ครบ

## Rollback Approach

ถ้าพบปัญหาที่ BigQuery sync แต่ไม่อยากปิด analytics ทั้งระบบ

1. ตั้ง `BIGQUERY_SYNC_ENABLED=false`
2. deploy functions ใหม่

ผลลัพธ์

1. client และ backend analytics ยังเขียนลง Firestore ต่อ
2. BigQuery mirror จะหยุดชั่วคราว

## Residual Risks

1. `getExecutiveAnalyticsSummary` ยังอ่านจาก Firestore raw events ไม่ใช่ warehouse mart
2. event volume โตมากแล้ว Firestore counting จะเริ่มแพงกว่า warehouse
3. purchase analytics ยังเป็น hybrid ระหว่าง client event กับ transactional record ไม่ใช่ reconciled finance mart เต็มรูปแบบ

## Next Recommended Step After This Deploy

1. ต่อ Looker Studio หรือ Metabase เข้ากับ BigQuery
2. ทำ curated marts รายวัน/รายสัปดาห์
3. แยก partner-safe dataset จาก raw/internal analytics