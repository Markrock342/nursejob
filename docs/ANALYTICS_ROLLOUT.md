# Analytics Rollout

เอกสารนี้สรุปสิ่งที่ถูกลงมือทำแล้วใน phase แรกของระบบ analytics และลำดับการ rollout ที่ปลอดภัยสำหรับ NurseGo

## What Is Already Implemented

### Client-side

- App open tracking ใน [App.tsx](App.tsx)
- Automatic screen tracking ใน [src/navigation/AppNavigator.tsx](src/navigation/AppNavigator.tsx)
- Job Detail product tracking ใน [src/screens/job/JobDetailScreen.tsx](src/screens/job/JobDetailScreen.tsx)
- Home search/filter interaction tracking ใน [src/screens/home/HomeScreen.tsx](src/screens/home/HomeScreen.tsx)
- Shop purchase intent/success tracking ใน [src/screens/shop/ShopScreen.tsx](src/screens/shop/ShopScreen.tsx)
- Notification open tracking ใน [src/screens/notifications/NotificationsScreen.tsx](src/screens/notifications/NotificationsScreen.tsx)
- Onboarding funnel tracking ใน [src/screens/auth/RegisterScreen.tsx](src/screens/auth/RegisterScreen.tsx), [src/screens/auth/OTPVerificationScreen.tsx](src/screens/auth/OTPVerificationScreen.tsx), [src/screens/auth/ChooseRoleScreen.tsx](src/screens/auth/ChooseRoleScreen.tsx), [src/screens/auth/CompleteRegistrationScreen.tsx](src/screens/auth/CompleteRegistrationScreen.tsx), [src/screens/auth/OnboardingSurveyScreen.tsx](src/screens/auth/OnboardingSurveyScreen.tsx)
- Chat list / chat room tracking ใน [src/screens/chat/ChatScreens.tsx](src/screens/chat/ChatScreens.tsx)
- Post job funnel tracking ใน [src/screens/job/PostJobScreenNew.tsx](src/screens/job/PostJobScreenNew.tsx)
- Profile tracking ใน [src/screens/profile/ProfileScreen.tsx](src/screens/profile/ProfileScreen.tsx)

### Shared client analytics layer

- Event schema: [src/types/analytics.ts](src/types/analytics.ts)
- Client service: [src/services/analyticsService.ts](src/services/analyticsService.ts)

### Backend

- Callable ingestion function: `trackAnalyticsEvent`
- Domain event emission from:
  - `onUserCreate`
  - `onNewShift`
  - `onNewApplication`
  - `onNewMessage`
  - `onNewVerificationRequest`
- Admin callable summary endpoint: `getExecutiveAnalyticsSummary`
- Admin callable daily summary trigger: `runDailyAnalyticsSummaryNow`
- Scheduled daily summary job: `generateDailyAnalyticsSummary`
- Secure Firestore storage in `analytics_events`
- Optional BigQuery mirror for raw events and daily summaries

## Event Names Currently Captured

- `app_open`
- `screen_view`
- `onboarding_started`
- `onboarding_step_completed`
- `onboarding_completed`
- `role_selected`
- `otp_requested`
- `otp_verified`
- `job_detail_view`
- `chat_list_view`
- `chat_room_view`
- `search_filter_applied`
- `apply_cta_clicked`
- `chat_cta_clicked`
- `share_job_clicked`
- `notification_opened`
- `post_job_started`
- `post_job_submitted`
- `profile_viewed`
- `profile_updated`
- `profile_photo_updated`
- `user_registered`
- `job_post_created`
- `application_submitted`
- `message_sent`
- `verification_requested`
- `purchase_completed`

## Security Model

- Client cannot write directly to `analytics_events`
- All client writes go through Cloud Functions callable `trackAnalyticsEvent`
- Only admin can read `analytics_events` and `analytics_reports`
- Analytics payload is sanitized server-side to prevent oversized or malformed props
- BigQuery sync is gated by params/env so Firestore analytics still works even when warehouse is disabled

## Required Deployment Steps

1. Deploy Firestore rules
2. Deploy Cloud Functions
3. Reload app bundle
4. Verify analytics events appear in `analytics_events`
5. Verify `getExecutiveAnalyticsSummary` returns data for admin user
6. Trigger `runDailyAnalyticsSummaryNow` with an admin account and verify `analytics_reports`

## Suggested Verification Checklist

1. Open app once and confirm `app_open`
2. Navigate between tabs and confirm `screen_view`
3. Open one job detail and confirm `job_detail_view`
4. Tap share and confirm `share_job_clicked`
5. Tap chat CTA and confirm `chat_cta_clicked`
6. Submit interest/apply and confirm `apply_cta_clicked` plus backend `application_submitted`
7. Open notification and confirm `notification_opened`

## Known Limitations In This Phase

1. Events are stored in Firestore first, not BigQuery yet
2. No warehouse marts yet
3. No cohorting endpoint yet
4. No partner-safe dataset export yet
5. Purchase events are client-assisted, not yet ledger-reconciled against all financial records

## Recommended Next Steps

1. Add tracking to profile, onboarding, chat room, post job, and admin flows
2. Add purchase ledger reconciliation and more downstream domain events in Cloud Functions
3. Replace Firestore-based executive summary with warehouse-backed metrics
4. Build curated BigQuery marts for marketplace, onboarding, and trust
5. Expose partner-safe datasets from curated warehouse tables