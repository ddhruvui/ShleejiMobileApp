# Shleeji

Expo / React Native mobile app for TaskAtHand, with five tabs:

| Tab       | What it does                                                                 |
| --------- | ---------------------------------------------------------------------------- |
| **Dream** | Vision board — add inspiration images from the photo library (masonry grid) |
| **Affirmations** | Daily affirmations — a scrollable list of short lines to read every day; add, edit, delete (synced with the web app via the backend) |
| **Todo**  | Full TaskAtHand client — headers, tasks, ECDs, filters, and Insights         |
| **Calls** | People to ring — Biweekly and Monthly sections; check off who you've called (the backend cron unchecks biweekly people on the 15th and everyone on the last day of the month); add, edit, delete (synced with the web app via the backend) |
| **Counter** | Mada counter — taps accumulate; every 108 clicks converts to 1 mada        |

Talks to the deployed TaskAtHandBE API (`https://task-at-hand-be.vercel.app`,
configured in `api/client.js`).

## Todo tab features

- **Headers & Tasks** — create, rename, reorder, delete headers; add tasks with
  notes and an optional ECD (one-time date, or recurring by day of week /
  month / year); toggle done, edit, reorder, delete. Deleting an **undone**
  task asks for a reason (required) which is archived and fed to the AI coach
  as an abandonment signal; deleting a done task doesn't ask
- **Filter toggles** (combinable): **Focus** (due today), **Past** (overdue),
  **By Date** (grouped by calendar date), **Insights** (see below),
  **Events** (see below), **Goals** (see below)
- **Events** — reusable task bundles (e.g. "Burger Night" with its shopping
  list). "Add to todo" opens a date picker plus a checklist of the event's
  tasks (all selected by default, tap to unmark); confirming adds the selected
  tasks, dated for the chosen day, under a header named after the event
  (reused if it already exists, so later additions join it). Each task row
  also has a per-task quick add. Templates are never consumed, so an event
  can be scheduled again and again
- **Goals** — long-term aims (e.g. "Improve Health") broken into small
  steps/habits ("Wake up at 6", "Have 1 fruit a day"), listed in the order you
  want to build them. A step is either paused (numbered) or **under
  progress** (∞). **Start** puts it under progress: a daily recurring task
  is created under a todo header named "One Step At A Time" (reused if it
  already exists) and kept for life. The pause button takes it out of
  progress: the daily task is removed and the step returns to the backlog.
  The goal heading's badge (e.g. "1/4 under progress") rises on Start and
  falls on pause. The two views stay in sync both ways: deleting the daily
  task from the todo — or the whole "One Step At A Time" header — pauses
  the matching step(s) automatically. Editing a goal edits its name and
  step list (one step per line; steps that keep their name keep their
  status)
- **Insights** — habit stats and AI coaching from the backend archive:
  - Habit cards: completion %, current/best streak, hit/miss dot row of recent
    scheduled days (habits = tasks scheduled by day of week)
  - Task stats: one-time completions, average slip past the planned date,
    most-rescheduled tasks
  - Coach: the latest AI report (summary, on track / slipping, task insights,
    procrastination flags, calls to make, suggestions) with a "Generate now"
    button — "Calls to make" appears only for reports generated after the
    Calls feature
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
├── App.js                     # Bottom-tab navigation (Dream / Affirmations / Todo / Calls / Counter)
├── screens/
│   ├── TodoScreen.js          # Todo tab incl. filter bar + reminder sync
│   ├── DreamScreen.js
│   ├── AffirmationsScreen.js  # Daily affirmations list (backend-synced)
│   ├── CallsScreen.js         # Biweekly/Monthly call list (backend-synced)
│   └── CounterScreen.js
├── components/
│   ├── TaskCard.js  AddTaskModal.js  EditTaskModal.js
│   ├── HeaderModal.js  ConfirmModal.js  EcdPicker.js
│   ├── AffirmationModal.js    # Add/edit (+ delete) affirmation modal
│   ├── CallModal.js           # Add/edit call modal (name + biweekly/monthly)
│   ├── InsightsSection.js     # Insights view (stats + AI report)
│   ├── EventsSection.js  EventModal.js  ScheduleEventModal.js   # Events view
│   └── GoalsSection.js  GoalModal.js                            # Goals view
├── api/
│   ├── client.js              # fetch wrapper (base URL lives here)
│   ├── headers.js  tasks.js
│   ├── affirmations.js        # /affirmations CRUD (daily affirmations)
│   ├── calls.js               # /calls CRUD (biweekly/monthly call list)
│   ├── events.js              # /events CRUD (reusable task bundles)
│   ├── goals.js               # /goals CRUD (habit backlogs)
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
- The Goals view requires the backend to be deployed with the `/goals`
  endpoints (it shows an error banner until then).
- The Affirmations tab requires the backend to be deployed with the
  `/affirmations` endpoints (it shows an error state with Retry until then).
- The Calls tab requires the backend to be deployed with the `/calls`
  endpoints (it shows an error state with Retry until then). The "called"
  checkmarks are reset by the backend's nightly cron — biweekly people on
  the 15th, everyone on the last day of the month.
- Counter and Dream data persist locally in AsyncStorage (not synced to the
  backend); Affirmations and Calls are stored in the backend and sync with
  the web app.
