# NurseGo TH/EN Localization Architecture

## Goal

Build a production-grade Thai/English localization system that feels invisible to users, is safe for the current codebase, and can be rolled out incrementally without breaking existing screens.

This design is optimized for the current NurseGo app:

- React Native + Expo
- existing local settings storage in `settingsService`
- existing `ThemeContext` pattern with `system` mode
- a large number of hardcoded Thai strings across screens and services

The target is not a big-bang rewrite. The target is a controlled migration with excellent UX and low regression risk.

## Product Principles

### 1. No forced language prompt on first launch

World-class apps do not interrupt users with a language chooser before the app is usable.

Preferred behavior:

- first launch follows device language when supported
- if device language is unsupported, choose a sensible fallback automatically
- user can override later in Settings
- app remembers the choice immediately and applies it live without restart

### 2. Support `system`, not only `th` and `en`

Language preference should mirror the theme model:

- `system`
- `th`
- `en`

This gives the best UX with the least friction. It also avoids surprising users when they change their device language.

### 3. Translate UI chrome first, not user data

Only localize app-owned UI:

- buttons
- labels
- empty states
- alerts
- navigation titles
- settings
- badges
- helper text

Do not attempt to translate user-generated or backend-entered content automatically.

### 4. Keep localization out of Firestore documents where possible

Store stable values in data:

- enum codes
- IDs
- role keys
- status keys

Render translated labels only in the client. This avoids duplicating content and avoids data migration risk.

### 5. Migrate by shell, not by whole app

Roll out in layers:

- foundation
- shared UI components
- auth shell
- settings/profile/home
- remaining feature screens
- server-side notifications and transactional text

This is the same migration style used in large apps to avoid destabilizing shipping code.

## Recommended Technical Shape

## 1. Use a thin app-owned localization layer

Do not let screens depend directly on a third-party localization library API.

Create an app-owned layer under `src/i18n/`.

Recommended structure:

```text
src/i18n/
  config.ts
  index.ts
  I18nProvider.tsx
  useI18n.ts
  format.ts
  dictionaries/
    th.ts
    en.ts
    common.ts
```

Recommended responsibilities:

- `I18nProvider.tsx`: resolves active language and exposes context
- `useI18n.ts`: exposes `t`, `language`, `resolvedLanguage`, `setLanguagePreference`
- `format.ts`: locale-aware date, time, currency, relative-time helpers
- `dictionaries/*.ts`: typed message dictionaries

### Why this shape

- screens import one stable app API
- the underlying localization engine can be swapped later if needed
- translation logic stays centralized
- tests become simpler
- migration is low-risk and easy to reason about

## 2. Use typed dictionaries, not scattered string lookups

The dictionary source of truth should be TypeScript objects, not ad hoc JSON files with no typing.

Example direction:

```ts
export const th = {
  common: {
    actions: {
      save: 'บันทึก',
      cancel: 'ยกเลิก',
    },
  },
  settings: {
    title: 'ตั้งค่า',
  },
} as const;
```

Then enforce that `en` has the same shape as `th`.

Benefits:

- missing keys are caught early
- refactors are safer
- autocomplete is better
- fewer runtime surprises

## 3. Keep fallback strict and predictable

Recommended fallback chain:

- explicit user preference
- device language if supported
- if region is Thailand, fallback to `th`
- otherwise fallback to `en`

This matches real-world UX expectations better than forcing Thai for everyone.

## 4. Centralize all locale formatting

Current code has many direct calls like:

- `toLocaleDateString('th-TH')`
- `toLocaleTimeString('th-TH')`
- `toLocaleString('th-TH')`
- string assembly with Thai units inline

These must be replaced gradually with shared helpers.

Recommended API:

- `formatDate(value)`
- `formatTime(value)`
- `formatDateTime(value)`
- `formatCurrency(amount)`
- `formatCompactNumber(value)`
- `formatRelativeTime(value)`
- `formatSalaryRange(min, max, unit)`

The active locale should come from the localization context, not from hardcoded `'th-TH'`.

## 5. Use the same system-mode UX pattern as theme

The app already has a strong theme model with:

- explicit mode
- `system` option
- immediate apply

Language should follow the same model. That keeps the product mentally consistent for users and the implementation consistent for developers.

## UX Specification

## 1. Language settings UX

Recommended setting:

- section: `Language`
- options: `System`, `ไทย`, `English`
- subtitle shows the active resolved language
- applying a choice updates UI immediately
- no restart, no reload prompt

Recommended copy behavior:

- when preference is `system`, show something like `System (Thai)` or `System (English)`
- when explicit, show only the chosen language

## 2. First-run behavior

Recommended:

- no blocking modal
- no onboarding interruption
- silently adopt device language
- only expose control in Settings

Optional enhancement:

- after first sign-in, sync preference to user profile for cross-device continuity
- local app setting still applies immediately and should not wait for network

## 3. Partial migration UX

During migration, users must never see broken or mixed placeholders.

Rules:

- untranslated keys must fall back to Thai or English text, never show raw key strings in production
- if a screen is not migrated yet, leave it fully Thai until converted
- avoid half-translating a single surface unless the whole path is coherent

This reduces the “cheap unfinished app” feeling.

## 4. Notification UX

Push and in-app notifications should not block the first client rollout.

Recommended order:

- phase 1: local app UI bilingual
- phase 2: in-app notification rendering bilingual when content is client-owned
- phase 3: backend-generated notification templates localized by stored user preference

## Data Model Recommendation

## Local settings

Extend the current settings shape from:

- `language: 'th' | 'en'`

to:

- `language: 'system' | 'th' | 'en'`

Migration rule:

- existing saved `th` or `en` remains valid
- missing value becomes `system`

## Optional remote profile sync

If syncing to Firestore, store only the preference, not resolved locale:

```ts
preferences: {
  language: 'system' | 'th' | 'en';
}
```

Do not block app rendering on remote preference reads.

Resolution should be:

- load local setting immediately
- apply local setting immediately
- optionally reconcile remote value later if product wants multi-device sync

## Implementation Pattern

## 1. Foundation APIs

The app-facing API should look simple:

```ts
const { t, languagePreference, resolvedLanguage, setLanguagePreference } = useI18n();
```

Example usage:

```ts
<Text>{t('settings.title')}</Text>
<Button title={t('common.actions.save')} />
```

Interpolation should be supported centrally:

```ts
t('shop.discountSaved', { amount: formatCurrency(120) })
```

## 2. Stable translation keys

Keys should be semantic and stable:

- good: `settings.notifications.title`
- good: `profile.actions.logout`
- bad: `button1`
- bad: `logoutTextFinal`

Use English-like key names even when Thai is the source language. Keys are code, not product copy.

## 3. Namespace by product surface

Recommended namespaces:

- `common`
- `auth`
- `settings`
- `profile`
- `home`
- `job`
- `notifications`
- `errors`
- `legal`
- `admin`

This keeps the dictionaries maintainable as the app grows.

## 4. Prefer translation at render time

Avoid translating too early inside services unless the service is specifically a presentation helper.

Preferred:

- services return codes or domain values
- UI layer maps them to localized labels

Example:

- service returns `verificationStatus = 'pending'`
- UI renders `t('verification.status.pending')`

This is safer than returning already-localized Thai strings from services.

## Migration Strategy

## Phase 0: Foundation

Add:

- `src/i18n/` provider and hooks
- locale resolution
- typed dictionaries for `th` and `en`
- format helpers
- settings support for `system`

Do not rewrite screens yet.

## Phase 1: Shared UI shell

Convert shared components first:

- confirm modal
- alerts
- loading states
- empty states
- reusable form labels
- back button text if any
- shared badges/status labels

This gives broad coverage with minimal file churn.

## Phase 2: Core user shell

Convert highest-visibility screens:

- login
- register
- settings
- profile
- home
- job detail

These are the screens users notice immediately.

## Phase 3: Feature surfaces

Convert:

- favorites
- notifications
- reviews
- help
- documents
- applicants
- payment
- shop
- verification

## Phase 4: Admin and server-generated content

Convert:

- admin screens
- backend notification templates
- analytics labels that are visible in UI

Admin can be migrated later because it has a smaller audience and much higher string volume.

## Risk Controls

## 1. Do not rewrite every screen at once

This repo has many hardcoded Thai strings. A big-bang conversion would create a large regression surface and make QA difficult.

The correct approach is incremental migration with small safe batches.

## 2. Keep old helpers working while new helpers land

For example:

- do not delete existing `formatDate` on day one
- first upgrade helpers to be locale-aware
- then migrate call sites gradually

## 3. Add development-only missing key warnings

In development:

- warn when a key is missing
- log the current locale and key

In production:

- fallback silently
- never expose raw keys to end users

## 4. Add translation coverage checks

Recommended safeguards:

- script or test that compares `en` shape against `th`
- fail CI if required keys are missing

## 5. Never localize business logic conditions

Do not use translated strings for control flow.

Always branch on stable values like:

- `role === 'nurse'`
- `status === 'pending'`
- `unit === 'day'`

Only localize what gets rendered.

## Formatting Rules

## Currency

Use a single helper that formats for active language while preserving local business meaning.

Examples:

- Thai UI: `฿1,200`
- English UI: `THB 1,200` or `฿1,200` depending on brand preference

Recommendation for NurseGo:

- keep `฿` in both locales because the product is Thailand-specific
- change surrounding text and units per language

## Dates and time

Thai locale:

- use Thai formatting where appropriate

English locale:

- use English month/day naming

Important decision:

- if the product wants Buddhist Era in Thai, centralize it in format helpers only
- do not scatter year conversion logic across screens

## Units

Examples that must move into localization:

- `ชม.` / `hr`
- `วัน` / `day`
- `เดือน` / `month`
- `บาท` / `THB`

## Backend and API Considerations

## Google Places

Current implementation sends `language: 'th'`.

Recommended behavior:

- `th` UI -> request Thai place labels
- `en` UI -> request English place labels if available

This should be driven by resolved locale from the localization layer.

## Notifications

For backend-created notifications, future-safe template shape should be:

- template key
- variables payload
- resolved localized text at send time

Example direction:

```ts
{
  templateKey: 'verification.approved',
  variables: { reviewerName: 'Admin' }
}
```

This is safer and more scalable than storing only Thai free text everywhere.

## Testing Strategy

## Manual QA

Critical checks:

- switching language updates live without restart
- fallback works when a key is missing
- no key strings are visible in production builds
- dates, prices, relative time, and units switch correctly
- settings remain persisted across relaunch
- guest and signed-in flows both work

## Automated QA

Recommended additions:

- dictionary shape check
- locale formatting unit tests
- snapshot tests for core shared components in both locales

## What should change first in this repo

The safest first implementation in NurseGo is:

1. add a new localization provider and typed dictionaries
2. upgrade settings to support `system | th | en`
3. add locale-aware formatting helpers
4. convert `SettingsScreen` to include language selection
5. convert shared components and auth shell
6. migrate the rest screen by screen

This gives immediate visible value without destabilizing the app.

## Final Recommendation

For NurseGo, the best-in-class approach is not a massive rewrite. It is a controlled localization platform with:

- `system`-aware UX
- typed translation dictionaries
- centralized formatting
- local-first persistence
- optional later cloud sync
- phased rollout by surface
- strict fallback safety

That gives the user experience of a world-class app while keeping the engineering risk low and the current codebase intact.