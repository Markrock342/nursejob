# NurseGo Data Architecture

เอกสารนี้ออกแบบ data architecture สำหรับ NurseGo โดยอิงจากโค้ดที่มีอยู่จริงในแอป, Firestore rules, และ Cloud Functions ปัจจุบัน เพื่อให้ทีมสามารถเริ่มทำ analytics, executive dashboard, partner-safe data sharing, และ data governance ได้แบบค่อยเป็นค่อยไปโดยไม่ทำลาย production flow

## 1. เป้าหมาย

NurseGo ควรมี data platform 4 ชั้นที่แยกหน้าที่กันชัดเจน

1. Transactional layer
   ใช้ Firestore และ Cloud Functions สำหรับ flow หลักของแอป
2. Analytics layer
   ใช้ BigQuery สำหรับ event analytics, funnel, cohort, marketplace, revenue, และ executive reporting
3. Governance layer
   ใช้สำหรับ consent, audit log, export history, partner catalog, retention policy
4. Delivery layer
   ใช้สำหรับ admin dashboard, internal BI, scheduled export, และ partner API/feed

หลักสำคัญคือ ห้ามแชร์ข้อมูลลูกค้าดิบจาก production Firestore ตรงไปยังคู่ค้า

## 2. Current State From Code

### 2.1 Core transactional collections

จาก [firestore.rules](../firestore.rules) และ service layer ปัจจุบัน มี collection หลักดังนี้

- `users`
- `shifts`
- `shift_contacts`
- `conversations`
- `conversations/{conversationId}/messages`
- `notifications`
- `favorites`
- `reviews`
- `documents`
- `verifications`
- `reports`
- `feedback`
- `userPlans`
- `purchases`
- `iap_receipts`
- `referrals`
- `otpCodes`
- `otpRateLimit`

### 2.2 Existing operational analytics signals

จาก [src/services/adminService.ts](../src/services/adminService.ts) และ [src/screens/admin/AdminDashboardScreen.tsx](../src/screens/admin/AdminDashboardScreen.tsx) ตอนนี้มี operational stats ระดับเบื้องต้นแล้ว เช่น

- total users
- total jobs
- active jobs
- total conversations
- today new users
- today new jobs
- pending verifications

จาก [functions/index.js](../functions/index.js) ยังมี scheduled jobs และ triggers ที่เป็น event source สำคัญอยู่แล้ว

- `onUserCreate`
- `onNewShift`
- `onNewApplication`
- `onNewMessage`
- `expireOldJobs`
- `autoCloseFilledJobs`
- `checkSubscriptionExpiry`
- `weeklyStatsReport`
- `notifyJobExpiringSoon`

### 2.3 Important structural gaps

มีช่องว่างที่ต้องแก้ก่อนทำ analytics ระดับองค์กร

1. ยังไม่มี event model กลาง
   ตอนนี้ข้อมูลส่วนใหญ่เป็น state-based reads จาก Firestore ไม่ใช่ append-only analytics events

2. ยังไม่มี BigQuery / warehouse layer
   จึงยังทำ cohort, funnel, retention, partner reporting, และ reproducible analytics ได้ไม่ดี

3. ไม่มี consent log สำหรับ data sharing
   ปัจจุบัน rules จัดการ access ฝั่ง app แต่ยังไม่มี policy enforcement สำหรับ partner delivery

4. ยังไม่มี export audit trail
   ไม่รู้ว่าใครดึงข้อมูลอะไรออกไป เมื่อไร เพื่อวัตถุประสงค์ใด

5. ยังไม่มี organization model แยกจาก user account
   ปัจจุบัน role `hospital` ถูกใช้แทน organization owner ทำให้ analytics ระดับองค์กรทำได้แต่ยังไม่สมบูรณ์

### 2.4 Current code issues that affect analytics quality

ประเด็นนี้ควรแก้ก่อนหรือระหว่างทำ phase 1

1. `reports` ถูกใช้ปนกัน 2 แบบ
   moderation reports อยู่ใน [src/services/reportService.ts](../src/services/reportService.ts)
   แต่ `weeklyStatsReport` ใน [functions/index.js](../functions/index.js) เขียน weekly analytics ลง collection `reports` เช่นกัน
   ผลคือ schema ปนกันและ query ฝั่ง admin จะเสี่ยงพังหรือได้ข้อมูลผิดประเภท

2. subscription source of truth ยังซ้อนกัน
   มีทั้ง `users.subscription` และ `userPlans`
   ถ้าจะทำ revenue/subscription analytics ต้องกำหนด canonical source ให้ชัด

3. `subscriptionService.ts` ยังอ้าง `jobs` collection
   แต่ production job board ใช้ `shifts`
   ถ้าใช้ข้อมูลส่วนนี้ทำ analytics จะผิดทันที

4. ไม่มี immutable event log
   ทำให้ historical funnel บางตัวต้อง reconstruct จาก current state ซึ่งไม่แม่นพอ

## 3. Recommended Target Architecture

สถาปัตยกรรมเป้าหมายที่เหมาะกับ codebase ปัจจุบัน

```text
React Native App
  -> transactional writes to Firestore
  -> client product events to Analytics Ingestion Function

Firestore + Cloud Functions
  -> domain triggers emit canonical events
  -> scheduled snapshot jobs build daily facts
  -> governance logs for exports and approvals

BigQuery
  -> raw dataset
  -> curated marts
  -> partner-safe dataset
  -> governance dataset

Consumers
  -> admin analytics screens
  -> Looker Studio / Metabase
  -> scheduled CSV export
  -> partner API / signed file delivery
```

## 4. Data Domains

### 4.1 Identity and account

Source collections

- `users`
- `verifications`
- `documents`
- `referrals`

Main questions answered

- ผู้ใช้ใหม่มาจาก role อะไร
- verification funnel ไปถึงขั้นไหน
- supply ของ nurse แยกตามจังหวัดและสายงานเป็นเท่าไร
- organization signup โตแค่ไหน

### 4.2 Demand and marketplace

Source collections

- `shifts`
- `shift_contacts`
- `favorites`
- `notifications`

Main questions answered

- demand ต่อ staff type / province / org type
- post to application conversion
- time to first applicant
- fill rate
- demand heatmap รายสัปดาห์

### 4.3 Messaging and engagement

Source collections

- `conversations`
- `messages`
- `notifications`

Main questions answered

- application to chat conversion
- median response time
- conversation success proxy
- unread and engagement behavior

### 4.4 Trust and quality

Source collections

- `reviews`
- `reports`
- `feedback`
- `verifications`

Main questions answered

- review score by org/user type
- moderation volume
- abuse hotspots
- product pain points

### 4.5 Revenue and subscriptions

Source collections

- `purchases`
- `userPlans`
- `users.subscription`
- `iap_receipts`

Main questions answered

- MRR / ARR
- plan mix
- trial to paid / free to paid conversion
- add-on attachment rate
- revenue by org segment

## 5. Canonical Event Model

NurseGo ควรมี canonical event envelope เดียวที่ใช้ทั้ง client events และ domain events

### 5.1 Event envelope

```json
{
  "event_id": "uuid",
  "event_name": "application_submitted",
  "event_ts": "2026-03-09T10:15:32.000Z",
  "event_date": "2026-03-09",
  "event_source": "domain_trigger",
  "event_version": 1,
  "actor_user_id": "uid_123",
  "actor_role": "nurse",
  "actor_org_id": null,
  "subject_type": "shift_contact",
  "subject_id": "contact_456",
  "job_id": "shift_789",
  "conversation_id": null,
  "platform": "ios",
  "app_version": "1.4.0",
  "screen_name": "JobDetail",
  "country": "TH",
  "province": "กรุงเทพมหานคร",
  "props": {
    "staff_type": "registered_nurse",
    "job_post_type": "job",
    "job_poster_role": "hospital"
  },
  "pii_classification": "internal",
  "consent_scope": "service_analytics"
}
```

### 5.2 Event source types

- `domain_trigger`
  events generated by Cloud Functions จากข้อมูล transactional ที่ authoritative
- `client_sdk`
  events จากฝั่งแอป เช่น screen_view, filter_apply, share_click
- `batch_snapshot`
  events/snapshots ที่ generate จาก scheduled jobs สำหรับ daily facts
- `admin_action`
  actions เช่น export request, report resolution, manual moderation

### 5.3 First event catalog

#### Identity

- `user_registered`
- `onboarding_started`
- `onboarding_completed`
- `role_selected`
- `profile_completed`
- `verification_requested`
- `verification_approved`
- `verification_rejected`

#### Marketplace

- `job_post_created`
- `job_post_updated`
- `job_post_closed`
- `job_post_expired`
- `job_viewed`
- `job_shared`
- `job_favorited`
- `application_submitted`
- `application_confirmed`
- `application_cancelled`

#### Messaging

- `conversation_created`
- `message_sent`
- `message_read`
- `chat_locked`

#### Revenue

- `plan_upgraded`
- `purchase_completed`
- `purchase_failed`
- `subscription_expired`
- `urgent_boost_used`
- `extra_post_used`

#### Trust

- `review_created`
- `report_created`
- `report_resolved`
- `feedback_submitted`

## 6. BigQuery Dataset Design

แนะนำให้แยก dataset ตาม sensitivity และ use case

### 6.1 `nursego_raw`

ใช้เก็บ event ดิบและ snapshots ที่ยังไม่ clean เต็มที่

Tables

- `domain_events`
- `client_events`
- `firestore_users_snapshot_daily`
- `firestore_shifts_snapshot_daily`
- `firestore_shift_contacts_snapshot_daily`
- `firestore_conversations_snapshot_daily`
- `firestore_purchases_snapshot_daily`

Retention

- เก็บถาวรแบบ partitioned
- จำกัด access เฉพาะ data engineering / analytics admin

### 6.2 `nursego_curated`

ใช้เก็บ mart ที่ทีม product, ops, leadership ใช้งานได้ทันที

Dimension tables

- `dim_users`
- `dim_organizations`
- `dim_jobs`
- `dim_calendar`
- `dim_locations`
- `dim_plans`

Fact tables

- `fact_user_lifecycle`
- `fact_job_posts`
- `fact_job_applications`
- `fact_conversations`
- `fact_messages`
- `fact_notifications`
- `fact_reviews`
- `fact_moderation_reports`
- `fact_feedback`
- `fact_subscriptions`
- `fact_purchases`

Daily marts

- `mart_marketplace_daily`
- `mart_supply_demand_daily`
- `mart_funnel_daily`
- `mart_revenue_daily`
- `mart_quality_daily`
- `mart_geo_weekly`

### 6.3 `nursego_partner`

ใช้เก็บเฉพาะข้อมูลที่อนุมัติให้คู่ค้าเห็นได้ โดย default ต้องไม่มี direct identifiers

Tables

- `partner_org_daily_metrics`
- `partner_market_demand_weekly`
- `partner_staff_supply_weekly`
- `partner_campaign_summary_monthly`
- `partner_benchmark_quarterly`

### 6.4 `nursego_governance`

ใช้เก็บ metadata และ audit

Tables

- `consent_events`
- `data_access_audit`
- `export_requests`
- `export_runs`
- `partner_registry`
- `dataset_release_catalog`
- `retention_policy_registry`

## 7. Curated Schema Proposal

### 7.1 `dim_users`

One row per user account

| field | type | note |
| --- | --- | --- |
| user_id | STRING | Firebase uid |
| role | STRING | user, nurse, hospital, admin |
| org_id | STRING | null for most current users, later mapped when org model exists |
| org_type | STRING | public_hospital, private_hospital, clinic, agency |
| primary_staff_type | STRING | from `staffType` |
| is_verified | BOOL | current verification flag |
| preferred_province | STRING | if available |
| signup_date | DATE | derived from `createdAt` |
| signup_platform | STRING | from client event if available |
| onboarding_completed | BOOL | current state |
| is_active | BOOL | current state |
| subscription_plan | STRING | current plan |

### 7.2 `dim_organizations`

Interim design while no dedicated organization entity exists

| field | type | note |
| --- | --- | --- |
| org_id | STRING | initially same as hospital owner user_id |
| owner_user_id | STRING | uid of hospital account |
| org_name | STRING | from displayName |
| org_type | STRING | hospital/clinic/agency segmentation |
| province | STRING | from user profile location |
| verified_status | BOOL | current organization verification |
| subscription_plan | STRING | current paid plan |
| created_date | DATE | organization signup date |

เมื่อพร้อมในอนาคต ควรแยก collection `organizations` และ `organization_members`

### 7.3 `dim_jobs`

| field | type | note |
| --- | --- | --- |
| job_id | STRING | from `shifts.id` |
| poster_user_id | STRING | current owner |
| org_id | STRING | poster user id in interim phase |
| post_type | STRING | shift, job, homecare |
| title | STRING | normalized title |
| department | STRING | job department |
| staff_type | STRING | target staff type |
| province | STRING | location.province |
| district | STRING | location.district |
| shift_rate | NUMERIC | rate |
| status | STRING | active, urgent, closed, expired |
| is_urgent | BOOL | urgent boost |
| created_date | DATE | posting date |
| expires_date | DATE | expiry date |
| required_slots | INT64 | from totalShifts or positions |
| filled_slots | INT64 | from filledShifts or acceptedApplicants |

### 7.4 `fact_job_applications`

One row per application status record

| field | type | note |
| --- | --- | --- |
| application_id | STRING | `shift_contacts.id` |
| job_id | STRING | target shift |
| applicant_user_id | STRING | applying user |
| poster_user_id | STRING | resolved poster |
| application_status | STRING | interested, confirmed, cancelled |
| applied_at | TIMESTAMP | contactedAt |
| updated_at | TIMESTAMP | updatedAt |
| applicant_role | STRING | from profile snapshot if available |
| applicant_staff_type | STRING | from profile snapshot if available |
| applicant_province | STRING | from profile snapshot if available |
| job_staff_type | STRING | from shift |
| job_province | STRING | from shift |

### 7.5 `fact_conversations`

| field | type | note |
| --- | --- | --- |
| conversation_id | STRING | conversation id |
| job_id | STRING | nullable |
| created_at | TIMESTAMP | creation timestamp |
| participant_1_id | STRING | participant 1 |
| participant_2_id | STRING | participant 2 |
| participant_roles | ARRAY<STRING> | derived at build time |
| last_message_at | TIMESTAMP | latest activity |
| total_messages | INT64 | rollup |
| first_response_minutes | INT64 | derived KPI |
| is_locked | BOOL | if chat tied to closed/expired job |

### 7.6 `fact_purchases`

| field | type | note |
| --- | --- | --- |
| purchase_id | STRING | purchase record |
| user_id | STRING | buyer |
| org_id | STRING | buyer org if hospital |
| product_id | STRING | SKU |
| plan | STRING | mapped plan if applicable |
| amount_thb | NUMERIC | gross amount |
| currency | STRING | THB |
| purchase_status | STRING | completed, failed, refunded |
| billing_cycle | STRING | monthly, annual, one_time |
| purchased_at | TIMESTAMP | event time |

## 8. Metric Layer

ทุก metric ต้องมี owner, SQL definition, refresh cadence, และ source of truth

### 8.1 Executive metrics

| metric | definition | source |
| --- | --- | --- |
| MAU | distinct active users with app event or transactional action in trailing 30 days | client events + domain events |
| WAU | distinct active users in trailing 7 days | same as above |
| active organizations | distinct hospital orgs with at least one post, application review, or chat in trailing 30 days | shifts + shift_contacts + conversations |
| gross revenue | sum completed purchase amount | purchases |
| paid organizations | distinct orgs with active non-free plan | users.subscription or canonical subscription fact |
| verified nurse supply | distinct verified nurse users available in trailing 30 days | users + verification status |

### 8.2 Marketplace metrics

| metric | definition | source |
| --- | --- | --- |
| jobs posted | count `job_post_created` | shifts/domain events |
| active jobs | jobs with status active or urgent and not expired | shifts snapshot |
| application rate | applications / job views | domain + client events |
| time to first applicant | median minutes from post created to first application | shifts + shift_contacts |
| fill rate | filled jobs / total jobs | shifts snapshot |
| chat start rate | jobs with conversation created / jobs with at least one application | conversations + shift_contacts |

### 8.3 Trust metrics

| metric | definition | source |
| --- | --- | --- |
| pending verification backlog | open verification requests | verifications |
| moderation backlog | reports with pending status | moderation reports |
| average rating | mean rating by target type | reviews |
| complaint rate | complaints per 1,000 active users | feedback + active users |

### 8.4 Revenue metrics

| metric | definition | source |
| --- | --- | --- |
| MRR | normalized monthly recurring revenue from active subscriptions | subscription fact |
| conversion to paid | users upgraded to paid / eligible active users | subscriptions + lifecycle |
| add-on attachment rate | buyers of add-on / paid buyers | purchases |
| churned orgs | orgs whose paid plan expired and not renewed within grace period | subscriptions |

## 9. Partner-Safe Dataset Design

หลักการคือ partner dataset ต้อง default เป็น aggregate, delayed, and de-identified

### 9.1 Allowed by default

- จังหวัด
- สัปดาห์หรือเดือน
- staff type
- org type
- จำนวนโพสต์
- จำนวนผู้สมัคร
- median time to apply
- fill rate
- conversion rate
- benchmark percentile

### 9.2 Not allowed by default

- ชื่อบุคคล
- เบอร์โทร
- email
- chat text
- message preview
- license number
- document URLs
- exact lat/lng ของผู้ใช้
- raw user id ของลูกค้า

### 9.3 Example `partner_org_daily_metrics`

| field | type | note |
| --- | --- | --- |
| partner_id | STRING | requesting partner |
| metric_date | DATE | date grain |
| org_segment | STRING | public_hospital, private_hospital, clinic, agency |
| province | STRING | region grain |
| staff_type | STRING | RN, PN, caregiver, etc. |
| jobs_posted | INT64 | aggregate |
| jobs_with_applicants | INT64 | aggregate |
| total_applications | INT64 | aggregate |
| median_minutes_to_first_applicant | FLOAT64 | aggregate |
| fill_rate | FLOAT64 | aggregate |
| active_orgs | INT64 | aggregate |

Privacy rules

- suppress rows where `active_orgs < 3`
- round selected counts when volume ต่ำมาก
- delay export 24 to 72 ชั่วโมงสำหรับ dataset ที่ sensitive

### 9.4 Example `partner_staff_supply_weekly`

| field | type | note |
| --- | --- | --- |
| week_start | DATE | ISO week start |
| province | STRING | region grain |
| staff_type | STRING | normalized staff type |
| verified_supply_users | INT64 | aggregated count |
| active_supply_users | INT64 | aggregated count |
| median_experience_years_bucket | STRING | bucketed, not raw |
| response_rate | FLOAT64 | aggregated |

## 10. Governance Model

### 10.1 Data classification

ทุก field ควรถูกจัดชั้นดังนี้

- `public`
- `internal`
- `confidential`
- `restricted_personal`
- `sensitive_health_related`

### 10.2 Required governance tables

#### `consent_events`

| field | type |
| --- | --- |
| consent_event_id | STRING |
| user_id | STRING |
| consent_scope | STRING |
| status | STRING |
| policy_version | STRING |
| captured_at | TIMESTAMP |
| capture_source | STRING |

#### `export_requests`

| field | type |
| --- | --- |
| export_request_id | STRING |
| requester_user_id | STRING |
| partner_id | STRING |
| dataset_name | STRING |
| purpose | STRING |
| requested_fields | ARRAY<STRING> |
| status | STRING |
| requested_at | TIMESTAMP |
| approved_by | STRING |
| approved_at | TIMESTAMP |

#### `export_runs`

| field | type |
| --- | --- |
| export_run_id | STRING |
| export_request_id | STRING |
| dataset_name | STRING |
| row_count | INT64 |
| file_uri | STRING |
| checksum | STRING |
| executed_at | TIMESTAMP |
| executed_by | STRING |

### 10.3 Policy rules

1. Partner access ใช้ curated partner dataset เท่านั้น
2. No direct Firestore access for partners
3. No raw chat or document export
4. All exports require approval and audit trail
5. Sensitive datasets require minimum k-anonymity threshold
6. Privacy policy และ consent wording ต้องอัปเดตก่อนเปิด external data sharing

## 11. Implementation Plan

แผนนี้ออกแบบให้ทำได้ทีละชิ้นจาก codebase ปัจจุบัน

### Phase 0: Fix source-of-truth problems

เป้าหมาย: ทำให้ analytics เชื่อถือได้ก่อน

Tasks

1. แยก collection `reports`
   - moderation reports อยู่ต่อที่ `reports` หรือ rename เป็น `moderation_reports`
   - weekly stats / analytics job outputs ย้ายไป `analytics_runs` หรือ `internal_reports`

2. เลือก canonical subscription source
   - แนะนำให้ใช้ `users.subscription` เป็น current-state source
   - ใช้ `purchases` เป็น financial ledger
   - ค่อย migrate `userPlans` ให้เป็น derived หรือ deprecated

3. แก้ `subscriptionService.ts` ให้ใช้ `shifts` แทน `jobs`

4. กำหนด normalized enums
   - role
   - org_type
   - staff_type
   - application_status
   - plan
   - notification_type

Deliverables

- source-of-truth matrix
- field classification sheet
- migration notes

### Phase 1: Domain event tracking

เป้าหมาย: ได้ event backbone โดยอิงกับ transactional truth

Tasks

1. เพิ่ม event emitter helper ใน Cloud Functions
   - `emitDomainEvent(eventName, payload)`
   - เขียนลง BigQuery หรือ dead-letter Firestore ถ้าส่งไม่สำเร็จ

2. ต่อ domain triggers ที่มีอยู่แล้ว
   - `onUserCreate` -> `user_registered`
   - `onNewShift` -> `job_post_created`
   - `onNewApplication` -> `application_submitted`
   - `onNewMessage` -> `message_sent`
   - verification approval/rejection -> corresponding events
   - purchase complete -> `purchase_completed`

3. เพิ่ม update triggers เฉพาะที่จำเป็น
   - shift status changed -> `job_post_closed` / `job_post_expired`
   - shift contact status changed -> `application_confirmed` / `application_cancelled`
   - conversation created -> `conversation_created`

Deliverables

- canonical event schema
- event catalog v1
- BigQuery raw domain event table

### Phase 2: Client product analytics

เป้าหมาย: รู้ funnel ฝั่งแอปที่ transactional state บอกไม่ได้

Tasks

1. เพิ่ม client analytics service
   - `trackScreenView`
   - `trackAction`
   - `trackFunnelStep`

2. เริ่มจาก event ที่มี impact สูง
   - app_open
   - home_view
   - search_filter_applied
   - job_detail_view
   - apply_cta_clicked
   - chat_cta_clicked
   - share_job_clicked
   - profile_view
   - notification_opened

3. ส่ง event ผ่าน callable/HTTPS ingestion endpoint
   - validate schema server-side
   - attach auth context
   - rate limit abuse

Deliverables

- `src/services/analyticsService.ts`
- ingestion function
- `nursego_raw.client_events`

### Phase 3: BigQuery curated marts

เป้าหมาย: ทำ dashboard และ KPI ที่ทีมใช้ได้จริง

Tasks

1. build `dim_users`, `dim_jobs`, `fact_job_applications`, `fact_conversations`, `fact_purchases`
2. build `mart_marketplace_daily`, `mart_funnel_daily`, `mart_revenue_daily`
3. define metric ownership and refresh schedule

Deliverables

- SQL models
- data quality checks
- BI semantic layer

### Phase 4: Admin analytics surfaces

เป้าหมาย: ยกระดับจาก operational dashboard ไปเป็น analytics dashboard

Recommended dashboard modules

1. Executive overview
   - MAU, WAU, active orgs, revenue, fill rate
2. Marketplace
   - jobs, applications, conversion, geo demand
3. Supply
   - verified nurses, active supply, province/staff type coverage
4. Messaging
   - chat start rate, response time, unread backlog
5. Revenue
   - plan mix, MRR, add-on revenue, renewal
6. Trust
   - verification backlog, report backlog, rating trends

Implementation note

- ในแอปเองควรแสดงเฉพาะ summary ที่ query ไว
- dashboard หนักควรอ่านจาก BigQuery ผ่าน backend endpoint หรือ precomputed Firestore summaries

### Phase 5: Partner export flow

เป้าหมาย: ส่งมอบข้อมูลให้คู่ค้าได้แบบ audited และ safe

Tasks

1. สร้าง `partner_registry`
2. สร้าง approval workflow สำหรับ export request
3. build scheduled export jobs จาก `nursego_partner`
4. ส่งไฟล์ผ่าน signed URL หรือ SFTP
5. log ทุกครั้งใน `export_runs`

Export modes

- manual approved CSV
- scheduled monthly partner feed
- partner API with fixed schema and field whitelist

## 12. Suggested File and Service Additions

### App / services

- `src/services/analyticsService.ts`
- `src/utils/analyticsEvents.ts`
- `src/types/analytics.ts`

### Functions

- `functions/analytics/emitEvent.js`
- `functions/analytics/trackClientEvent.js`
- `functions/analytics/buildDailyMarts.js`
- `functions/analytics/exportPartnerDataset.js`
- `functions/governance/approveExport.js`

### Docs and governance

- `docs/DATA_ARCHITECTURE.md`
- `docs/DATA_GOVERNANCE.md`
- `docs/METRIC_CATALOG.md`
- `docs/PARTNER_DATA_POLICY.md`

## 13. Policy Update Requirements

ก่อนเปิด partner sharing ต้องอัปเดตอย่างน้อย

1. Privacy Policy
   ระบุให้ชัดว่าอาจมีการใช้ข้อมูลในรูป aggregate/de-identified เพื่อ analytics, benchmarking, และ partner reporting หรือไม่

2. Terms of Service
   ระบุขอบเขตการใช้ข้อมูลเพื่อการพัฒนาบริการและรายงานเชิงสถิติ

3. Consent UX
   ถ้าจะใช้ข้อมูลเกินกว่าการให้บริการหลัก ควรมี explicit consent หรืออย่างน้อย clear notice ตาม use case

4. Data Processing Agreement
   สำหรับคู่ค้าที่ได้รับข้อมูล ต้องมีข้อกำหนดเรื่อง retention, re-identification ban, onward transfer ban, และ breach notification

## 14. Recommended Rollout Sequence

ถ้าต้องเริ่มทำจริงพรุ่งนี้ ให้ทำตามนี้

1. fix source-of-truth issues
2. define event catalog v1
3. implement domain event emission in functions
4. create raw and curated BigQuery datasets
5. build first 10 KPI queries
6. expose internal executive dashboard
7. implement governance tables and export approval flow
8. release partner-safe aggregated exports only

## 15. What Not To Do

อย่าทำสิ่งเหล่านี้

1. อย่าให้คู่ค้า query Firestore production โดยตรง
2. อย่า export `users`, `messages`, `documents` แบบ raw
3. อย่าใช้ current state แทน event history สำหรับ funnel สำคัญทั้งหมด
4. อย่าเริ่มจาก custom partner feed ก่อนมี governance log
5. อย่าใช้ collection `reports` เป็นทั้ง moderation และ analytics output ต่อไป

## 16. First Sprint Backlog

Sprint แรกที่ practical ที่สุด

1. refactor `reports` schema separation
2. fix subscription source-of-truth and `jobs` vs `shifts`
3. add analytics type definitions
4. add Cloud Function event emitter
5. instrument 6 domain events
6. create BigQuery raw tables
7. build 3 marts
   - marketplace daily
   - funnel daily
   - revenue daily
8. add admin endpoint for executive summary

ผลลัพธ์ที่ควรได้หลัง sprint แรก

- daily marketplace dashboard
- reliable weekly management report
- analytics foundation ที่พร้อมต่อยอดสู่ partner-safe export
