# ProfPlan AI: Updated Product Requirements Document

A private, local-first planning tool for a solo French tutor on Preply (25- and 50-minute classes). This version merges the original French Lesson Planner PRD with the single-user, offline, and Google Drive sync changes, applied to the whole app. The app has no built-in AI: the tutor writes lessons in the app, may paste in content made with an external AI tool, and can use an optional copy-prompt helper.

## 1. Intent and Goal

The tutor opens the tool before any class and has a ready, editable plan plus a branded handout within minutes, written in the app or reused from the library. The app keeps an independent record of every student, manages the schedule in both time zones, and includes a trial-student flow that maximizes conversion. All records remain viewable and editable offline, and sync with the tutor's Google Drive when connectivity returns. The app is single-tutor: no registration, no in-app login page, no additional accounts, and no exposure of records or Drive to anonymous visitors.

## 2. Audience and Roles

One user: the French teacher. Students exist only as records (name, CEFR level A1 to C2, IANA timezone, goals, notes). Trial students live in a separate Trials section until converted. There are no student logins and no sharing.

## 3. Whole-App Plan

### 3.1 Single-user access and privacy

* **Remove the in-app registration and login page.** No screen asks for a username or password, and no registration route exists.
* **Recommended access model (serverless):** there is no app server holding records. Data lives only on the tutor's device and in the tutor's own Google Drive, so there is nothing for anonymous visitors to reach: anyone who opens the app's address gets empty app code and no records.
* **Google account authentication:** The Google account is the only credential. The tutor connects it once through Google's consent screen, which is not an app sign-in page. Sync data sits in a hidden, app-only Drive folder that no other account or app can read.
* **Token handling:** the browser version keeps the short-lived access token in memory and renews it silently while the Google session is active. The desktop wrapper keeps its refresh token in the Windows credential store. No shared token exists, and none is sent to any server.
* **New device:** connect the same Google account. The tutor can revoke access at any time from their Google account permissions.
* **Lost or shared device:** offer an optional screen lock (device passcode or Windows Hello where available), since records are cached locally.
* **Gate:** this replaces the earlier server-session model, which would need a paid host. If the build platform only allows its shared server connector, confirm that limit before implementation.

### 3.2 Local-first data

* **Storage:** Store records in the browser's IndexedDB and request persistent storage so the browser cannot evict them. A service worker caches the app shell so the app opens offline.
* **Versioning:** Every record has a UUID, a schema version, a revision counter, an updated-at time, the editing device, and a deleted flag. Revision counters, not device clocks, decide what is newer; timestamps are for display only.
* **Operations:** Support offline create and edit for students, lessons, trials, vocabulary, bookings, exercises, message templates, settings, and reports.
* **Mutation Queue:** Queue each edit as a mutation with its own ID and the revision it was based on, so replays are safe. Show a pending count in the header and a marker on each unsynced record.
* **Derived Data:** Compute derived data (monthly statistics, due vocabulary reviews) locally from records instead of storing it.
* **Deletion:** Delete by archiving: archived students and trials leave the lists but keep their history. A true delete asks for confirmation and syncs as a tombstone.
* **Warnings:** Warn visibly when unsynced changes are older than 7 days.

### 3.3 Sync and data protection

* **Drive Layout:** One hidden app-only Drive folder holding a manifest (format version), one append-only change log per device, and periodic compacted snapshots (keep the last 10). Each device writes only its own log, so two devices never overwrite one file; Drive has no transactions.
* **Sync Steps:** Pull other devices' logs, apply them, detect conflicts, push this device's queued changes, then compact if needed. Show progress and a completion message.
* **Conflicts:** A conflict exists when both sides changed the same record since the revision they share. Show both versions side by side as a field-by-field diff; the tutor keeps mine, keeps theirs, or keeps both as a copy. Conflicts are resolved per record. Append-only data (completed lesson snapshots, vocabulary review events) merges automatically because nothing is overwritten.
* **Deletions:** Sync as tombstones. A delete against a newer edit is shown as a conflict. Tombstones are purged 90 days after every known device has acknowledged them.
* **Interrupted Sync:** Queued changes stay on the device until Drive acknowledges them. Changes are idempotent, pulled changes apply in batches, and sync resumes where it stopped.
* **First-Time Migration:** Save a full local snapshot first, then upload it as the baseline with all entity data unchanged. A second device that already holds local data must choose merge or replace before its first sync, never a silent overwrite.
* **Format Safety:** An older app version that finds a newer format becomes read-only instead of writing.
* **Restore:** The tutor can restore any kept snapshot as an explicit action, verified by checksum.

### 3.4 Tutor workflows

#### Students

* **Profile:** name, CEFR level (each change logged with its date), IANA timezone, goals, default class length (25 or 50 minutes), communication language, rate per class (private, never in reports), and notes marked private or shareable (only shareable notes appear in reports).
* Lesson history timeline, vocabulary, homework, and an archive of past monthly reports.
* Archive a student instead of deleting; history is kept.

#### Lessons & AI Integration

* **Lesson Editor:** The tutor writes each lesson in the app. A plan is built from blocks (warm-up, vocabulary, reading, grammar, speaking, review); each block is a text area with simple formatting, and blocks can be reordered, added, or removed.
* **No Built-in AI Calls:** The app makes no direct API calls to AI services.
* **Optional "Copy Prompt" Button:** An auxiliary UI element that dynamically populates a prompt using the selected student's CEFR level, current topic, and goals. Clicking it copies the text to the clipboard so the tutor can paste it directly into an external AI tool of their choice. No data leaves the app through automated calls; everything goes through manual copying.
* **Pasting External Content:** The tutor can paste in content made elsewhere, and it is stored exactly as pasted.
* **Paste Helpers:** Pasting a whole lesson splits it into blocks at its headings, and pasting a vocabulary list (one word per line, as `word - translation - example`) creates vocabulary items. The tutor reviews the result before saving.
* **Timing & Budgets:** Each plan has a class length of 25 or 50 minutes (or a custom length), taken from the booking, otherwise from the student's default. Block minutes are shown against the class length, with a warning when they add up to more.
* **Vocabulary Review Integration:** Each plan automatically includes due vocabulary review (see Vocabulary), counted inside the time budget.
* **Lesson Completion:** Marking a lesson done saves an immutable snapshot of what was taught: blocks as used, vocabulary, homework, date, actual length, and amount earned. Reports and the library read from snapshots, so later edits never rewrite history.
* **Homework:** The tutor writes or pastes the homework, and each lesson tracks homework status (not assigned, drafted, sent). The branded PDF handout and flashcards are built on the device, so they print offline.

**Starter Block Lengths (Minutes):**

| Block | 25-minute class | 50-minute class |
| --- | --- | --- |
| **Warm-up** | 3 | 5 |
| **Vocabulary** | 5 | 10 |
| **Reading** | 7 | 12 |
| **Grammar** | not included | 10 |
| **Speaking** | 5 | 8 |
| **Review** | 5 | 5 |
| **Total** | **25** | **50** |

*Note: The tutor can change these defaults and save their own plan templates.*

#### Trials

* **Pre-class:** Record stated level, goals, motivations, and prior exposure. The tutor writes the trial plan in the same lesson editor, fitted to the booked trial length (25 or 50 minutes), optionally starting from a saved trial plan in the library.
* **Post-class:** Record notes, then write the follow-up message, optionally starting from a follow-up template.
* **Conversion Tracking:** Each trial has a status (planned, held, followed up, converted, lost). Converting promotes it to a full student profile, carrying over all trial information and keeping a link back to the trial.

#### Vocabulary

* **Leitner System:** Each word has a per-student state on a five-box schedule (Leitner): new words start in box 1, a correct recall moves a word up one box, a miss sends it back to box 1, and a shaky answer keeps it in place.
* **States Shown:** Introduced, reviewed, mastered (box 5), struggling (two misses in a row).
* **Review Limits:** Next review dates are computed locally. Each plan includes up to 8 due words for a 50-minute class and 4 for a 25-minute class (adjustable), struggling words first, then the most overdue.
* **Review Events:** At lesson end the tutor marks each reviewed word *got it*, *shaky*, or *missed* in one tap; each mark is saved as a review event.

#### Schedule and Calendar Integration

* Bookings are added by hand or imported. Each booking stores its start as a UTC instant, the student's IANA zone, duration in minutes (from the calendar event's start and end, otherwise the student's default), source (manual or calendar), and the calendar event's UID.
* Connect a calendar read-only: Google Calendar with read-only access (a free call from the device), an imported `.ics` file, or an ICS feed URL where the desktop wrapper can fetch it, since browsers block most feed URLs. The app never writes to the calendar.
* Import is repeatable and safe: events are matched by UID, so re-imports update instead of duplicating. Cancelled events are marked cancelled, moved events are rescheduled, and recurring events are expanded in the calendar's own timezone so daylight-saving changes stay correct.
* Re-importing refreshes the calendar's fields but keeps the tutor's notes and student link on that booking.
* Events are matched to students by a remembered rule (title or attendee). Unmatched events wait in a short "needs a student" list.
* Overlapping bookings show a warning.
* Import runs on "Sync now" and when the app opens online. Offline, the last imported schedule shows with a "last synced" time.
* Day-of view: next class, local time for the tutor and the student, plan status (ready or not planned), recent lesson history, and a shortcut to message templates.

#### Library

* **Saved Exercises:** The tutor saves their best exercises, tagged by level and topic.
* **Lesson Archive:** Every completed lesson's material (blocks, vocabulary, homework, handout) is filed automatically and is searchable by student, level, topic, and date.
* **Reuse by Copy:** Adding library material to a plan makes an independent copy, so past lessons never change.
* Library items sync like other records.

#### Monthly and Quarterly Reports

* Pick a calendar month or a calendar quarter in the tutor's timezone (default: the last complete one), for one student or for all students.
* Statistics are computed on the device from completed lesson snapshots, so reports are identical every time and print offline. Only lessons marked done count as taught; cancelled and no-show lessons are listed separately.
* **Monthly, per student:** classes taught and total hours (from each lesson's actual length, 25 or 50 minutes), lesson dates, topics and grammar covered, the full vocabulary list from that month (word, translation, example, retention state), homework sent, and the tutor's next-month focus.
* **Quarterly, per student:** classes and hours for each of the three months, topics covered over the quarter, vocabulary learned and how many words reached mastered, CEFR level at the start and end of the quarter, attendance (classes held, cancelled, no-show), homework sent for lessons done, and the tutor's written summary and goals for the next quarter.
* **All-students summary (monthly or quarterly):** classes and hours per student, total hours taught, and new words introduced, on one printable page for the tutor's own records.
* **Formatting:** Print as a branded PDF with a light, ink-friendly layout. The vocabulary list can also print on its own as a word list or flashcards.
* The tutor's written comment is typed in the app, is optional, and is saved with the report; the report is complete without it. Final reports are saved to the student's history.
* The parent-facing version includes only shareable notes.

#### Message Templates

* A library of reusable replies by category: trial follow-up, booking confirmation or reschedule, cancellation or no-show, homework reminder, lesson recap, renewal or package, and monthly report cover note. Variants exist per language (French or English).
* Placeholders fill from records: `{student_name}`, `{next_class_local_time}`, `{tutor_time}`, `{homework}`, `{last_topic}`, `{month}`. Any unfilled placeholder is highlighted before copying.
* One tap copies the message to the clipboard for pasting into Preply's chat; the app does not send messages.
* Reachable from the day-of view and each student profile, and available offline.
* A starter set is included; templates are editable and sync like other records.

#### Settings and Exports

* Tutor branding (name, logo, colors), tutor timezone, week start day, currency, paper size (A4 or Letter), calendar connection, and Google Drive connection.
* Default class lengths (25 and 50 minutes, plus custom) and a default rate for each length, for regular and trial lessons; each student can override both. Amounts are estimates the tutor enters.
* PDFs (handouts, flashcards, monthly reports) use the branding and print in a light, ink-friendly layout.

### 3.5 Online-only features

* Only two things need a connection: Google Drive sync and calendar import. Neither is attempted offline.
* Offline, those two actions are disabled with a short reason, while viewing, writing and editing lessons, printing handouts and reports, copying message templates, and using the copy-prompt helper all keep working.
* The app makes no calls to any AI service. Student data goes nowhere except the tutor's own Drive and, read-only, their calendar.

### 3.6 At-a-glance week view

The home screen is a *This Week* view built from local data, so it opens instantly and works offline. The week start day and currency are settings.

| Panel | What it shows |
| --- | --- |
| **Week plan** | Classes by day with length (25 or 50 min), tutor time, student local time, and plan status (ready/not planned); tap to open |
| **Homework checklist** | One row per student with a lesson done this week and a "homework sent" tick; unsent rows sort first |
| **Earned this week** | Earned (lessons marked done at saved amount) and expected (remaining scheduled classes at each student's rate), with a week picker |
| **Trial conversion** | Trials converted ÷ trials held in chosen period (default last 90 days) as a percentage with counts (e.g., 3 of 8); trials held in last 14 days are pending |
| **Retention** | Active students (lesson in last 30 days), students with no booking in 14 days, and average lessons per student per month |
| **Needs attention** | Classes in next 48 hours with no plan, done lessons with homework unsent, trials waiting for follow-up, and unsynced changes |

* **Homework Tick:** Records that the tutor sent it; the app does not message students. It is one tap and works offline.
* **Earnings:** Estimates from rates the tutor enters: a default for regular and trial classes, a per-student rate, and a per-lesson override. Amounts never appear in student or parent reports, and the all-students monthly summary shows them in the tutor's copy only.
* **Conversion Insights:** Opening the conversion card shows conversion by month, average days from trial to first regular lesson, and conversion by follow-up template used.

### 3.7 Windows 10 and 11, light on resources

* **Target:** Windows 10 and 11 with a current Edge or Chrome, tested on a low-end laptop (assumed: 4 GB RAM, dual-core).
* **Delivery:** An installable web app (PWA) from Edge or Chrome running in its own window with a Start menu icon, using the browser engine already on the PC and no bundled runtime. If a standalone `.exe` is wanted, wrap it with Tauri on WebView2 (avoiding Electron's heavy resource footprint).
* **Resource Rules:** No polling or background timers; sync runs on app open, on reconnect, and on "Sync now". Long lists are virtualized and history is paged. PDF code loads only when a PDF is made. Logos are downscaled on upload, and queries use IndexedDB indexes.
* **Budget:** The *This Week* view appears in under 2 seconds on the target laptop once cached, and the app uses near-zero CPU when idle.
* **Windows Fit:** Works at 100% to 200% display scaling, offers keyboard shortcuts, prints through the Windows print dialog, and saves exports to Downloads.
* **Load Test:** Check speed with two years of data (assumed: 50 students, 2,000 lessons) before release.

### 3.8 Zero-cost sync

* **No Server:** The device talks straight to Google Drive's API. The free quota is expected to be far above one tutor's use.
* **Storage:** Sync data sits in the app-only folder of the tutor's own Drive and counts against existing free storage. Data is text (a few megabytes expected); logs are compressed and only the last 10 snapshots are kept.
* **Hosting:** Static files hosted on a free static host or installed locally from a file. No database or paid backend.
* **Authorization:** App-only and file-level Drive scopes are non-sensitive, bypassing complex app verification processes.
* **Quota-Friendly:** One change check per sync using a modified-time filter, batched writes, and no polling.
* **Free Fallback:** If Drive is unreachable, all data stays locally on the device for manual export or import.

### 3.9 End-to-end verification

* Existing student, lesson, trial, schedule, library, and settings flows work seamlessly.
* Offline edits, reconnection, Drive sync, interrupted-sync recovery, and manual conflict resolution behave as specified.
* Concurrent edits by two devices, deletes against edits, and wrong clock states resolve without lost data.
* Monthly report totals match completed lessons, and PDFs print correctly offline.
* Calendar import handles cancellations, reschedules, recurring events, and daylight-saving changes without duplicates.
* Message templates fill every placeholder or highlight missing ones.
* The *This Week* view shows correct classes, homework status, earnings, and conversion counts offline.
* Sync runs serverlessly at zero cost, meeting startup and idle-CPU budgets on low-spec hardware.

---

## 4. Technical Requirements

* **Zero AI Calls in App:** No automated AI requests. Lessons, vocabulary, homework, and reports are managed entirely by the tutor or populated using manual paste actions and the optional copy-prompt helper.
* **IndexedDB & Service Worker:** Used for local records, mutation queues, and offline app shell caching.
* **jsPDF:** Generates handouts, flashcards, and monthly reports with a print-friendly layout.
* **Versioned Drive Sync Format:** Manifests, per-device logs, snapshots, revision counters, and tombstones.
* **Time Management:** IANA timezone per student; times stored as UTC instants; class length stored in minutes on each booking and lesson.
* **ICS Parser:** Established library for handling recurring calendar rules and timezones.
* **Architecture:** Serverless direct communication with Google Drive and Calendar APIs; delivered as a PWA with an optional WebView2 Windows wrapper.

---

## 5. Design Preferences

* **Dark Theme UI:** Modern dark UI with near-black backgrounds (`#0A0A0B` range) and layered dark gray cards. Yellow (e.g., `#FACC15`) is the sole accent color (no blue anywhere). Clean sans-serif type, high contrast, yellow for primary actions and active states.
* **Navigation:** Sidebar navigation spanning Schedule, Students, Trials, lesson planning, and the exercise library. Sync status and conflict resolution indicators remain clear and minimal.
* **Print Exception:** PDFs and printed outputs feature a white background and dark text with thin yellow accents to ensure clarity and save ink.
* **Mobile Layout:** Tap targets are at least 44 px, with sync state and pending item counts always visible in the header.

---

## 6. Design Review: Flaws Fixed

| Flaw in First Draft | Risk | Fix Applied |
| --- | --- | --- |
| Three unranked access options | Work stalls or ships insecure | One recommended model: serverless, Google account as the only credential, app-only Drive folder (3.1) |
| Conflicts decided by last-modified time | Device clocks drift, so wrong version wins | Revision counters decide; timestamps are display only (3.2, 3.3) |
| One shared sync file on Drive | Two devices overwrite each other | Per-device append-only logs plus snapshots (3.3) |
| Hard deletes | Deleted records return from another device | Tombstones with retention; archive instead of delete (3.2, 3.3) |
| Retention states with no rules | Review lists are arbitrary | Five-box schedule, due dates, review cap per lesson (3.4) |
| Lesson history editable after the fact | Reports change retroactively | Immutable lesson snapshot on completion (3.4) |
| Reports depend on generated text | No printable stats offline | Statistics computed locally; tutor's own comment is optional (3.4) |
| Times stored as local strings | Daylight-saving errors, wrong class times | UTC instant plus IANA zone; recurring events expanded in zone (3.4) |
| Calendar import overwrites manual edits | Duplicate or lost bookings | Match by UID; keep notes and student link (3.4) |
| Token and student data on the device | Lost device or leaked token exposes students | No shared token and no server; optional screen lock; private notes kept out of reports (3.1, 3.4) |
| Browser can evict local data | Silent loss before first sync | Persistent storage; warning when unsynced changes are old (3.2) |
| Newer data format opened by older app | Corrupted sync data | Version check; older apps go read-only (3.3) |

* **Additional Review Updates:**
* A server-held Drive token would need a paid host, so access and sync are now serverless (3.1, 3.8).
* Calendar import uses Google Calendar read-only, an `.ics` file, or the desktop wrapper because browsers block most feed URLs (3.4).
* Built-in AI generation was removed to eliminate AI costs, API key overhead, and external data transfers. An optional **Copy Prompt** helper button was added to let tutors generate customized text prompts for external AI tools with zero server-side AI calls.
* Class length (25 or 50 minutes) is stored explicitly on every student, booking, and lesson (3.4), and quarterly reports were added (3.4).



---

## 7. Open Decisions

1. Confirm the serverless access and sync model (3.1, 3.8) is allowed on the build platform, since it bypasses the shared server connector.
2. Confirm hosting: a free static host or install from a file, avoiding any ongoing hosting bills.
3. Confirm report periods: a calendar month and a calendar quarter in the tutor's timezone (assumed).
4. Decide which fields a parent-facing report may include (assumed: shareable notes only).
5. Confirm earnings inputs: the tutor enters the net rate per class length, and the app does not read Preply payouts.
6. Confirm starter block lengths for 25- and 50-minute classes in section 3.4, or replace them with the tutor's own preferences.