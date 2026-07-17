# Shleeji

Expo / React Native app (plain JavaScript, no TypeScript) with five bottom tabs (`App.js`):

- **Dream** (`screens/DreamScreen.js`) — vision board: masonry grid of device-library photos, persisted locally in AsyncStorage (`dreamPhotos`). Add via expo-image-picker, reorder, remove.
- **Affirmations** (`screens/AffirmationsScreen.js`) — daily affirmations list (backend `/affirmations`): add/edit/delete short lines to read every day, synced with the web app.
- **Todo** (`screens/TodoScreen.js`) — full TaskAtHand client: header/task CRUD, ECDs, Focus/Past/By-Date/Insights/Events/Goals filters, event templates, AI insights, daily local notifications (8:30 AM and 4:00 PM device time).
- **Calls** (`screens/CallsScreen.js`) — people to ring (backend `/calls`): Biweekly and Monthly sections with a "called" checkbox per person; the backend's nightly cron unchecks biweekly people on the 15th and everyone on the last day of the month.
- **Counter** (`screens/CounterScreen.js`) — mada counter: tap anywhere to increment; every 108 clicks converts to 1 mada (the app's term throughout — UI label `MADA`, storage key `madaCount`). "+ Add" bulk-adds N clicks and converts (`floor(total/108)` madas, remainder stays as clicks); Reset clears both after confirmation. `clickCount`/`madaCount` persisted in AsyncStorage.

The Todo, Affirmations and Calls tabs talk to the backend; Dream and Counter are local-only.

## Backend & commands

- **API base URL is hardcoded** to the deployed backend `https://task-at-hand-be.vercel.app` in `api/client.js:9` (local-dev alternative `http://10.0.2.2:3002` in a comment). There is no env-based config — changing target means editing that file. **All API calls hit production data; there is no test DB switch in this app.**
- `npm start` / `npm run android|ios|web` — Expo dev server
- `npm run publish` / `publish:prod` — EAS OTA update to the `preview` / `production` channel (append a message argument)
- `npm run build:android|ios[:prod]` — EAS builds (APK for Android); profiles in `eas.json`; `runtimeVersion` policy is `appVersion`, so native builds are needed when the app version changes

## Architecture & conventions

- `api/` mirrors TaskAtHandFE's API layer: `apiFetch(path, options)` in `client.js` (JSON headers, throws on `{ error }` or `!res.ok`); one module per resource (headers, tasks, events, goals, insights, affirmations, calls).
- **Feature parity with TaskAtHandFE (MANDATORY)**: this app and TaskAtHandFE are two clients of the same backend and must stay at feature parity. A user-facing feature/behavior change in either client must be replicated in the other in the same task (FE toolbar view modes map to bottom tabs here — e.g. FE Affirmations/Calls views ↔ the Affirmations/Calls tabs). If a change is genuinely inapplicable to the other client, call that out explicitly in the summary.
- `utils/ecd.js` mirrors the web frontend's `src/utils/ecd.ts`: four ECD types — `date` (`"YYYY-MM-DD"`), `day_of_week` (array of `"Sun".."Sat"`), `day_of_month` (array of 1–31), `day_of_year` (`"D/M/YYYY"`, no zero-padding) — plus `isTaskDueToday`, `isTaskPast` (date-type only), `getEcdDateKey`, `buildEcdFromInputs`. **A change to ECD logic here almost always needs the same change in TaskAtHandFE and must match the backend's validation.**
- Functional components + hooks; `StyleSheet.create` for all styling; no UI library. Modals for all forms (Add/EditTaskModal, HeaderModal, EventModal, ScheduleEventModal, ConfirmModal) with state lifted to the parent screen; modals reset their state in `useEffect([visible])`.
- Task ordering: undone tasks above done tasks; TaskCard disables moves across that barrier (same invariant as web FE and backend).
- **Filter logic** (TodoScreen `matchesFilter`): Focus = due today, Past = overdue `date`-type only; Focus+Past together = the union of both. By Date groups only non-done tasks by `getEcdDateKey` (recurring tasks surface under today when due). Insights, Events and Goals render as full panels replacing the header list.
- **Sequential API calls are intentional**: `loadAll` fetches each header's tasks in sequence, and event scheduling creates tasks one at a time to preserve template order (same as web FE). Don't "optimize" these into `Promise.all` without checking ordering implications.
- **Goal↔todo sync** (`utils/goalSync.js`, mirrors web FE): a goal step is `under_progress` exactly while its daily task lives under the "One Step At A Time" header. Start creates the task, pause removes it, and TodoScreen's delete flows call `pauseStepsMatchingTask`/`pauseAllStartedSteps` when a task/the header is deleted — keep any new delete path calling them.
- Date parsing is component-wise (never `new Date("YYYY-MM-DD")`) to avoid timezone shifts — preserve this in new date code.
- **Floating tab bar**: App.js positions the tab bar absolutely (bottom: 30, height: 70), so it overlaps screen content — screens must leave bottom clearance (e.g. CounterScreen's trackpad uses `marginBottom: 120`). Account for this in any new full-height layout.
- Failed Todo operations surface via an `actionError` banner in TodoScreen; follow that pattern rather than silent catches or alerts.

## Notifications (`utils/notifications.js`)

- `syncDailyReminders(headers)` is re-run whenever task data loads/changes (TodoScreen effect). It schedules reminders for today + 2 days (`DAYS_AHEAD = 3`) at 8:30 AM and 4:00 PM **device local time**; body lists up to 4 task names (`MAX_NAMES`) plus "+N more" and overdue count.
- Content is frozen at scheduling time — if the app isn't opened for 3+ days, reminders stop until next open; stale content can fire if tasks change after scheduling. This is known/accepted behavior.
- **Expo Go on Android (SDK 53+) does not support notifications** — the module is lazy-loaded and skipped there; testing notifications on Android requires a development/EAS build. iOS Expo Go works.
- Android uses the `task-reminders` channel; permission requested on first sync; notifications show even when the app is foregrounded.

## Testing & documentation policy (MANDATORY)

**This project has no automated tests** — no test script, no test files, no test dependencies. Until that changes:

1. Every change MUST be manually verified by running the app (`npm start`, then Expo Go or an emulator) and exercising the affected screen. State in your summary exactly what you verified and how.
2. Changes that touch the API layer or ECD logic must be checked against the backend contract (see `API_REFERENCE.md` / `todo_app_structure.md` in TaskAtHandBE or TaskAtHandFE) and against the web FE's equivalent code — the three projects must stay in agreement.
3. **`README.md` must be updated in the same task** for any change to: features/behavior of a tab, commands or the EAS workflow, reminder times/behavior, API endpoints used, or local-storage behavior. README is the only doc in this repo — keep its Features, Project structure, Running, Builds/Updates, and Notes sections accurate.
4. Remember all Todo-tab operations hit the **production** backend — do not run destructive experiments (bulk deletes, cleanup scripts) against it while developing.

If you add test infrastructure (e.g. jest-expo), also add a test script to package.json, document it in README.md, and update this section.

Never end a task with code changed but README and manual verification unaddressed. If a change genuinely needs neither, state why explicitly in your summary.
