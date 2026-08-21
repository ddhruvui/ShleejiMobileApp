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

Every tab's add action is a single **"+" button in the blue title bar**, beside
the screen title — there are no labelled "+ Add X" buttons. On **Todo** that one
button follows the view that is showing: it adds a header in the todo and By
Date lists, a project in Projects, a goal in Goals, an event in Events, a life
event in Life Events, a vacation in Vacation, and is hidden in Insights
(nothing to add there).
**Counter** is the exception — it keeps its original pair of labelled white
buttons, **Reset** and **+ Add**, stacked at the right of its blue header.

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
  **Projects** (see below), **Vacation** (see below). The panel toggles
  (everything except By Date)
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
  (unchecked, "Not started") or **under progress** (checked, "↻ Daily" /
  "↻ Mon, Wed, Fri"); the checkbox toggles between them. Checking it opens a
  day picker (whole week by default, with Every day/Weekdays/Weekends presets,
  at least one day required) and creates a recurring task on those weekdays
  under a todo header named "One Step At A Time" (reused if it already
  exists), kept for life; unchecking removes that task (the days are kept for
  the next start) and returns the step to the backlog. An under-progress row
  also carries a **calendar button** to reschedule the habit later — the only
  way in, since the todo locks a goal-managed task's schedule — which rewrites
  the task's ECD to match, and a **streak badge** ("🔥 4") read from
  `GET /insights/stats`. The nightly archive only records a result on days the
  habit is due, so the streak counts scheduled days only: an untouched Tuesday
  can't break a Mon/Wed/Fri habit. The goal heading's badge (e.g. "1/4 under
  progress") tracks how many steps are running. Goals are ordered with move up/down arrows on the heading (a
  server-side contiguous priority, like headers and projects), and each step
  has its own move up/down and delete — deleting an under-progress step
  removes its task too, so the todo never keeps an orphan habit.
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
  done tasks always drop to the bottom, **dated tasks always sit above the
  undated ones** (a step with a date is already committed to the todo, so it
  outranks the backlog), and moves never cross either barrier. Each task can carry free-text **notes** (shown under
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
- **Vacation** — periods you booked off. Each vacation is a start and an end
  date, **both inclusive** (the day you leave and the day you get back are both
  vacation days) and both required, which is what lets a trip be booked months
  ahead. Ranges can't overlap; a trip can be edited afterwards (forgot to book
  it, came home early) or deleted. Rows show the length, whether the trip is
  past/upcoming/on now, and expand to a **re-date list**: the undone one-time
  dated tasks that fall inside the window, each with a one-tap "Move to <first
  day back>". Those moves are sent with `vacationMove`, so they're never
  counted as postponement — needed because a trip booked in advance is re-dated
  before it starts. Repeating tasks aren't listed: they can't be moved without
  changing their schedule, so the backend excuses those days instead. **An
  active vacation shows a banner above every Todo view** (except the Vacation view itself, which has its own fuller one) (booking time off and
  forgetting is the failure mode this feature actually has), and **daily
  reminders are silenced** for booked days
- **What vacation changes** — it's a lens on the history, not a pause button:
  the backend cron runs unchanged, and anything ticked off while away still
  counts. What changes is how the archive is read — a missed day on vacation is
  *paused*, not missed (out of completion rates and per-weekday miss counts),
  slippage has the days away subtracted from it, postpones and deletions are
  labelled rather than flagged, and a call period is only excused when a trip
  swallowed ≥80% of it. **Streaks restart on return rather than spanning the
  break.** While away, the Insights numbers freeze at the day before departure
  and coach reports are skipped entirely; the first report back opens with a
  restart plan
- **Insights** — habit stats and AI coaching from the backend archive:
  - Habit cards: completion %, current/best streak, the **all-time** number of
    times the habit has been done, and a dot row of recent scheduled days
    (habits = tasks scheduled by day of week). The dots have three states — hit,
    miss, and a hollow **paused** pip for a vacation day, which is neither. A
    card also names how many vacation days were excluded
  - Task stats: one-time completions, how many landed on or before their
    planned date (finishing early or on the day counts as on time), the average
    slip past the planned date when some ran late, and the most-rescheduled
    tasks
  - Coach: the latest AI report (summary, on track / slipping, task insights,
    procrastination flags, calls to make, suggestions) with a "Generate now"
    button — "Calls to make" appears only for reports generated after the
    Calls feature. The backend generates a report on its own **once per day**;
    "Generate now" is not limited by that, except while on vacation, when
    reports are paused and the button is disabled
  - A vacation notice when relevant: that the numbers are frozen and as of which
    day, a welcome-back line after a trip, or how many vacation days in the
    period were excluded from the rates
- **Daily reminders** — local notifications at **8:30 AM** and **4:00 PM**
  (device local time) listing the day's pending tasks and an overdue count.
  Slots with nothing pending are skipped, and **days inside a booked vacation
  are skipped entirely**.

### How reminders work (`utils/notifications.js`)

- Notification content is fixed at scheduling time, so the schedule is
  refreshed (next 3 days) every time task data loads or changes — each app
  open updates the content. If the app isn't opened for 3+ days, reminders
  pause until the next open.
- A task counts as pending for a day when its ECD makes it due that day and it
  isn't done; overdue one-time tasks are counted separately.
- `syncDailyReminders(headers, vacations)` skips any day inside a booked
  vacation — being nagged by your todo app on holiday rather defeats the point.
  The check compares the device's **local** day against the range, while the
  backend measures the same range in UTC; they can disagree by a few hours at a
  boundary, which is the right trade for a reminder (better to fall silent an
  hour early than to nag on holiday).
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
│   ├── AddButton.js           # Shared icon-only "+" (sits in the title bar)
│   ├── HeaderModal.js  ConfirmModal.js  EcdPicker.js
│   ├── AffirmationModal.js    # Add/edit (+ delete) affirmation modal
│   ├── CallModal.js           # Add/edit call modal (name + biweekly/monthly)
│   ├── InsightsSection.js     # Insights view (stats + AI report)
│   ├── VacationSection.js     # Vacation view (ranges + the re-date list)
│   ├── VacationModal.js       # Book/edit a vacation (two inclusive dates)
│   ├── EventsSection.js  EventModal.js  ScheduleEventModal.js   # Events view
│   ├── LifeEventsSection.js  LifeEventModal.js                   # Life Events view
│   ├── GoalsSection.js  GoalModal.js  AddStepModal.js            # Goals view
│   ├── StepDaysModal.js                                         # habit weekday picker
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
│   ├── vacations.js           # /vacations CRUD + /status + the re-date task list
│   └── insights.js            # /insights/stats, /insights/latest, /insights/generate
└── utils/
    ├── ecd.js                 # ECD due-today/date-key helpers
    ├── goalSync.js            # goal step ↔ todo sync + habit-day helpers
    ├── projectSync.js         # project task ↔ todo sync helpers
    ├── lifeEventSync.js       # life event ↔ todo sync helpers
    └── notifications.js       # 8:30 AM / 4:00 PM daily reminders (silent on vacation days)
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
