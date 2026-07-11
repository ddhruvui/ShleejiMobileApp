# Shleeji

Expo / React Native mobile app for TaskAtHand, with three tabs:

| Tab       | What it does                                                                 |
| --------- | ---------------------------------------------------------------------------- |
| **Dream** | Vision board — add inspiration images from the photo library (masonry grid) |
| **Todo**  | Full TaskAtHand client — headers, tasks, ECDs, filters, and Insights         |
| **Counter** | Mada counter — taps accumulate; every 108 clicks converts to 1 mada        |

Talks to the deployed TaskAtHandBE API (`https://task-at-hand-be.vercel.app`,
configured in `api/client.js`).

## Todo tab features

- **Headers & Tasks** — create, rename, reorder, delete headers; add tasks with
  notes and an optional ECD (one-time date, or recurring by day of week /
  month / year); toggle done, edit, reorder, delete
- **Filter toggles** (combinable): **Focus** (due today), **Past** (overdue),
  **By Date** (grouped by calendar date), **Insights** (see below),
  **Events** (see below)
- **Events** — reusable task bundles (e.g. "Burger Night" with its shopping
  list). "Add to todo" opens a date picker plus a checklist of the event's
  tasks (all selected by default, tap to unmark); confirming adds the selected
  tasks, dated for the chosen day, under a header named after the event
  (reused if it already exists, so later additions join it). Each task row
  also has a per-task quick add. Templates are never consumed, so an event
  can be scheduled again and again
- **Insights** — habit stats and AI coaching from the backend archive:
  - Habit cards: completion %, current/best streak, hit/miss dot row of recent
    scheduled days (habits = tasks scheduled by day of week)
  - Task stats: one-time completions, average slip past the planned date,
    most-rescheduled tasks
  - Coach: the latest AI report (summary, on track / slipping, task insights,
    procrastination flags, suggestions) with a "Generate now" button
- **Daily reminders** — local notifications at **8:30 AM** and **4:00 PM**
  (device local time) listing the day's pending tasks and an overdue count.
  Slots with nothing pending are skipped.

### How reminders work (`utils/notifications.js`)

- Notification content is fixed at scheduling time, so the schedule is
  refreshed (next 3 days) every time task data loads or changes — each app
  open updates the content. If the app isn't opened for 3+ days, reminders
  pause until the next open.
- A task counts as pending for a day when its ECD makes it due that day and it
  isn't done; overdue one-time tasks are counted separately.
- **Expo Go on Android does not support notifications (SDK 53+)** — the app
  detects this and silently skips scheduling there. Use a development or EAS
  build to test reminders on Android; iOS Expo Go shows local notifications.
- First launch asks for notification permission.

## Project Structure

```
Shleeji/
├── App.js                     # Bottom-tab navigation (Dream / Todo / Counter)
├── screens/
│   ├── TodoScreen.js          # Todo tab incl. filter bar + reminder sync
│   ├── DreamScreen.js
│   └── CounterScreen.js
├── components/
│   ├── TaskCard.js  AddTaskModal.js  EditTaskModal.js
│   ├── HeaderModal.js  ConfirmModal.js  EcdPicker.js
│   ├── InsightsSection.js     # Insights view (stats + AI report)
│   └── EventsSection.js  EventModal.js  ScheduleEventModal.js   # Events view
├── api/
│   ├── client.js              # fetch wrapper (base URL lives here)
│   ├── headers.js  tasks.js
│   ├── events.js              # /events CRUD (reusable task bundles)
│   └── insights.js            # /insights/stats, /insights/latest, /insights/generate
└── utils/
    ├── ecd.js                 # ECD due-today/past/date-key helpers
    └── notifications.js       # 8:30 AM / 4:00 PM daily reminders
```

## Running

```bash
npm install
npm start          # Expo dev server (Expo Go)
npm run android    # or ios
```

## Builds & Updates (EAS)

```bash
npm run build:android        # preview build
npm run build:android:prod   # production build
npm run publish -- "message" # OTA update to preview branch
```

## Notes

- The Insights tab requires the backend to be deployed with the `/archive` and
  `/insights` endpoints; "Generate now" additionally needs `ANTHROPIC_API_KEY`
  configured on the server.
- Counter and Dream data persist locally in AsyncStorage (not synced to the
  backend).
