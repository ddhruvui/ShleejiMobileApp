# Shleeji

Expo / React Native mobile app for TaskAtHand, with five tabs:

| Tab       | What it does                                                                 |
| --------- | ---------------------------------------------------------------------------- |
| **Dream** | Vision board — add inspiration images from the photo library (masonry grid) |
| **Affirmations** | Daily affirmations — a scrollable list of short lines to read every day; add, edit, delete (synced with the web app via the backend) |
| **Todo**  | Full TaskAtHand client — headers, tasks, ECDs, filters, and Insights         |
| **Calls** | People to ring — Biweekly and Monthly sections; check off who you've called (the backend cron unchecks biweekly people on the 15th and everyone on the last day of the month); add, edit, delete (synced with the web app via the backend) |
| **Counter** | Mada counter — taps accumulate; every 108 clicks converts to 1 mada        |

Tapping a tab switches to it; re-tapping the already-active tab returns to
**Todo** (mirrors the web app, where re-clicking an active view button toggles
back to the todo view).

Talks to the deployed TaskAtHandBE API (`https://task-at-hand-be.vercel.app`,
configured in `api/client.js`).

## Todo tab features

- **Headers & Tasks** — create, rename, reorder, delete headers; add tasks with
  notes and an optional ECD (one-time date, or recurring by day of week /
  month / year); toggle done, edit, reorder, delete. Deleting an **undone**
  task asks for a reason (required) which is archived and fed to the AI coach
  as an abandonment signal; deleting a done task doesn't ask. **Postponing** a
  dated task (editing it to a later date) offers an optional reason field — a
  reason-less postpone is treated as procrastination, a valid reason as a
  legitimate deferral by the AI coach
- **Filter toggles**: **By Date** (grouped by calendar date — today first,
  then past dates, then future dates, with thick dividers between the
  present, past and future sections), **Insights** (see below),
  **Events** (see below), **Life Events** (see below), **Goals** (see below),
  **Projects** (see below). The panel toggles (everything except By Date)
  are mutually exclusive: tapping one opens that view and deactivates
  whichever was open, and tapping the active one returns to the todo list.
  By Date is a todo-list filter, stays active while a panel is open, and
  applies again when the panel closes.
- **Events** — reusable task bundles (e.g. "Burger Night" with its shopping
  list). "Add to todo" opens a date picker plus a checklist of the event's
  tasks (all selected by default, tap to unmark); confirming adds the selected
  tasks, dated for the chosen day, under a header named after the event
  (reused if it already exists, so later additions join it). Each task row
  also has a per-task quick add. Templates are never consumed, so an event
  can be scheduled again and again
- **Life Events** — annually recurring dates (e.g. "Wife's birthday" on
  7 Mar), listed in priority order with move up/down arrows (a server-side
  contiguous priority, like headers and projects). Each row shows a done
  checkbox, the name, the annual date ("↻ 7 Mar") and an "in todo" badge
  while this year's task is linked. Every year on the event's day, the
  **backend cron** adds a one-time date task named after the event to the
  todo under an "Events" header (reused if it already exists) and links it.
  The two views stay in sync both ways: toggling done on either side flips
  the other, renaming either side renames the other (only the name — the
  annual date is never moved by rescheduling this year's todo task), and
  deleting the todo task (or its header) unlinks the event without touching
  its done state. Add/edit uses a month + day picker (Feb 29 allowed; the
  cron fires it on Feb 28 in non-leap years) producing the "D/M" date.
  Deleting a life event keeps this year's todo task; when the nightly cron
  deletes the done todo task it marks the event done and clears the link —
  the event itself is never deleted and fires again next year
- **Goals** — long-term aims (e.g. "Improve Health") broken into small
  steps/habits ("Wake up at 6", "Have 1 fruit a day"), listed in the order you
  want to build them. Steps render as todo task rows and are added the same
  way: a `+` on the goal heading opens an add-step dialog that appends one
  step, just as `+` on a todo header adds a task. A step is either paused
  (unchecked, "Not started") or **under progress** (checked, "↻ Daily"); the
  checkbox toggles between them. Checking it creates a daily recurring task
  under a todo header named "One Step At A Time" (reused if it already
  exists), kept for life; unchecking removes that task and returns the step
  to the backlog. The goal heading's badge (e.g. "1/4 under progress")
  tracks this. Goals are ordered with move up/down arrows on the heading (a
  server-side contiguous priority, like headers and projects), and each step
  has its own move up/down and delete — deleting an under-progress step
  removes its daily task too, so the todo never keeps an orphan habit.
  Under-progress steps always sort above the pending backlog (starting a
  step lifts it into the top group) and the move arrows never cross that
  boundary, mirroring the todo's undone-above-done barrier. The
  two views stay in sync both ways: deleting the daily task from the todo —
  or the whole "One Step At A Time" header — pauses the matching step(s)
  automatically. Because the goal links to its task by name, editing a task
  under "One Step At A Time" locks the name and schedule fields (notes and
  done stay editable) so the link can't drift. A goal's name and its initial
  step list are set when it is created; there is no goal-level edit, so
  steps are managed individually afterwards
- **Projects** — long term projects (e.g. "Automated Stock Market") broken
  into ordered tasks/steps ("get data from EODHD", "get data from Nasdaq",
  "deploy to cpu"). Projects are ordered with move up/down arrows
  (header-style priority) and each project's tasks are added, edited,
  reordered, completed and deleted with the same interactions as the todo —
  done tasks always drop to the bottom, and moves never cross the
  done/undone barrier. Each task can carry free-text **notes** (shown under
  the task name), just like a todo task. Giving a task a **date** mirrors it
  into the todo as a one-time date task under the project's own header
  (created on demand and kept in the projects' order by the backend), and
  the task's notes are mirrored onto that todo task (an empty note falls back to a
  "Step towards …" default); the badge (e.g. "1/3 done") tracks completion.
  The two views stay in sync both ways: toggling done on
  either side flips the other, editing the todo task's name, date or notes
  updates the project task (clearing the date sets it to none there, and the
  "Step towards …" placeholder note mirrors back as empty), reordering on
  either side mirrors the relative order of linked tasks on the other,
  deleting the todo task (or its header) unlinks the project task (clearing
  its date), removing a task's date removes its todo entry, and renaming
  the project renames its todo header. The project-derived todo headers are
  kept in the projects' priority order — a project ranked above another has
  its todo header above the other's — placed as a contiguous block starting
  just below the topmost existing header (at priority 1), or at the very top
  (priority 0) when the todo has no other headers; moving a project up/down
  re-sorts its todo header to match.
  When the todo task is done and the backend's nightly cron deletes it, the
  project task is marked done and **retained in the project** as a
  completed step (its date is kept for the record)
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
│   ├── LifeEventsSection.js  LifeEventModal.js                   # Life Events view
│   ├── GoalsSection.js  GoalModal.js  AddStepModal.js            # Goals view
│   └── ProjectsSection.js  ProjectModal.js  ProjectTaskModal.js # Projects view
├── api/
│   ├── client.js              # fetch wrapper (base URL lives here)
│   ├── headers.js  tasks.js
│   ├── affirmations.js        # /affirmations CRUD (daily affirmations)
│   ├── calls.js               # /calls CRUD (biweekly/monthly call list)
│   ├── events.js              # /events CRUD (reusable task bundles)
│   ├── lifeevents.js          # /lifeevents CRUD (annually recurring dates)
│   ├── goals.js               # /goals CRUD (habit backlogs)
│   ├── projects.js            # /projects CRUD (long term projects)
│   └── insights.js            # /insights/stats, /insights/latest, /insights/generate
└── utils/
    ├── ecd.js                 # ECD due-today/date-key helpers
    ├── goalSync.js            # goal step ↔ todo sync helpers
    ├── projectSync.js         # project task ↔ todo sync helpers
    ├── lifeEventSync.js       # life event ↔ todo sync helpers
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
- The Projects view requires the backend to be deployed with the `/projects`
  endpoints (it shows an error banner until then). Completed project steps
  are marked done by the backend's nightly cron when it deletes the finished
  todo task.
- The Life Events view requires the backend to be deployed with the
  `/lifeevents` endpoints (it shows an error banner until then). The yearly
  todo task is created by the backend's cron on the event's day, and the
  cron marks the event done when it deletes the finished todo task.
- The Affirmations tab requires the backend to be deployed with the
  `/affirmations` endpoints (it shows an error state with Retry until then).
- The Calls tab requires the backend to be deployed with the `/calls`
  endpoints (it shows an error state with Retry until then). The "called"
  checkmarks are reset by the backend's nightly cron — biweekly people on
  the 15th, everyone on the last day of the month.
- Counter and Dream data persist locally in AsyncStorage (not synced to the
  backend); Affirmations and Calls are stored in the backend and sync with
  the web app.
