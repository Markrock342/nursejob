# Performance Readiness Checklist

## What Is Instrumented

- `Home`, `ChatList`, `ChatRoom`, `Notifications`, `Favorites`, and `MyPosts` now create dev-only screen sessions.
- Each session logs:
  - render count
  - approximate Firestore document reads from hot queries and subscriptions
  - subscriptions started
  - peak active subscriptions
  - per-source read breakdown
- In development, inspect the latest summaries with `global.__NURSEGO_PERF__.getLatestSummary()`.

## How To Measure

1. Open a screen from a cold app state in a development build.
2. Interact once with the primary action for that screen.
3. Leave the screen so the session closes and logs its summary.
4. Read the latest metrics from logs or `global.__NURSEGO_PERF__.getLatestSummary('Home')`.

## 10k Readiness Checks

1. `Home` first open should keep reads bounded to the active job window, not full collection scans.
2. `ChatList` should keep one shared Firestore conversation listener per signed-in user, even when badge and chat list UI are both mounted.
3. `ChatRoom` should load only the recent message window by default, not full message history.
4. `Favorites` should batch job lookups instead of one job read per favorite.
5. `Notifications` should always stay inside the configured notification window, including fallback paths.
6. `MyPosts` should stay on one realtime listener and avoid extra manual reloads except explicit refresh.
7. Admin pending-document counts should rely on count queries where possible, not broad document fetches.

## Release Gate

1. Capture metrics for `Home`, `ChatList`, `ChatRoom`, `Notifications`, `Favorites`, and `MyPosts` on both iOS and Android dev builds.
2. Verify that each screen closes with a perf summary and no runaway subscription count.
3. Confirm Firestore usage in Firebase console matches the app-side summaries within expected variance.
4. Smoke test large accounts:
   - 100+ favorites
   - 100+ notifications
   - 100+ conversations
   - 300+ messages in a conversation
   - 50+ posts on one poster account
5. If a screen still spikes, move the hot query behind pagination or a callable or backend aggregate before store promotion.
