# Encore — Live Competition Operating System

**Permanent project documentation.** Any AI or developer working on this codebase should read this file first. It describes what currently exists, verified against the live source — not an aspiration or a spec someone once wrote.

---

## 1. What this product is

Encore is **not a quiz app**. It is not Kahoot, Quizizz, or Slido. Judging is host-directed by default, and there is no participant-driven navigation. (One optional exception exists: a host may flag a specific question as multiple-choice, in which case the assigned team's captain taps an option and it auto-scores — see §MCQ below. This is an opt-in convenience per question, not the product's spine.)

Encore is an operating system for running a **real, physical, host-directed live competition** — the kind of event a family, school, or community runs in a hall with a projector, a host holding a laptop, and everyone else on their phones as companion screens. Examples: school inter-house competitions, Antakshari nights, community quiz evenings, corporate team offsites, cultural festival competitions.

The mental model:

- **The host is a TV show director.** They control every screen, every transition, every point awarded. Nothing happens without them.
- **Participants are the studio audience with a second screen.** They watch what the host is showing, request help via power cards, and see their team's score — they never drive the show.
- **Judging is manual by default.** Someone in the room speaks an answer, sings a line, or draws on paper. The host decides if it's correct and awards marks by hand. The one exception is a question the host explicitly marks as multiple-choice (`isMCQ`): there the assigned captain taps an option and the system scores it automatically. Every other question type is host-judged, never auto-graded.

Combine three products and that's roughly the shape of Encore:

| Influence | What it contributes |
|---|---|
| **Notion** | The competition/room/round/question builder — structured, hierarchical, edit-anytime |
| **OBS Studio** | The live host console — scene-by-scene control, a persistent control dock, one operator running the whole show |
| **A game show control room** | Manual scoring, lifelines/power-cards with host approval, live leaderboard reveals |

---

## 2. User roles

There are exactly **two** roles. There is no third role, no moderator, no co-host tier beyond what's described below.

### 2.1 Host / Admin

A host has a real account (email + password, `HOST` or `ADMIN` role — see [§8 Auth](#8-auth--permissions)). They are the event controller.

| Phase | Host can |
|---|---|
| **Before event** | Create reusable questions and rounds in the library · create a competition · create rooms · create teams · add members (names only, no login) · select which library rounds a room runs · build/generate the scene flow · configure power cards & store · publish the room (code/QR/link) |
| **During event** | Start the event · step scenes forward/back · start/pause/reset the timer · reveal answers · award or deduct marks manually · approve/reject/activate/consume power card requests · open/close the store · give coins or free cards · send broadcasts to all phones · undo any score mistake |
| **After event** | View the final leaderboard · review the full score-transaction history · review the event timeline (audit log) · view analytics |

### 2.2 Participant

A participant is **not a user account**. No signup, no email, no password. Joining is: enter a room code (or scan a QR), type a display name, pick a team.

| Phase | Participant can |
|---|---|
| **Before** | Join a room by code/QR · enter name · select team · wait in the lobby |
| **During** | See whatever scene the host is currently showing (question, round intro, reveal, leaderboard, broadcast, winner) · see their team's score · see their team's power card inventory · request a power card · buy a power card from the store (Economy Mode only) |
| **After** | See the final leaderboard and winner scene |

**A participant can never**: change the question, change the round, see a future question before the host reveals it, give or edit marks, control the timer, or advance/change the leaderboard. There is no participant dashboard, no participant account system, no independent participant navigation. If a page ever lets a participant do one of these things, that is a bug against this spec, not a feature.

---

## 3. Application routes

### 3.1 Canonical routes (what a developer should build against)

| Route | Renders | Auth | Data |
|---|---|---|---|
| `/` | Marketing landing page | Public | Static |
| `/join` | Room-code entry → redirects into `/play/[code]` | Public | Real (`getRoomByCode` downstream) |
| `/play/[roomCode]` | The real participant experience — polls live room state, renders the current scene, lets a team join, request/buy power cards | Public (no login) | **Real**, via `GET /api/live/[roomCode]` polling + `joinRoom`/`requestPowerCard`/`purchasePowerCard` actions |
| `/admin` | Login form if logged out; real dashboard (`AdminDashboard`) if logged in | Optional session check (not `requireUser()`, since it must render a login form) | Real |
| `/admin/questions` | Question Bank — create reusable questions once, search/filter, attach to rounds | `requireUser()` | Real |
| `/admin/rounds` | Round Builder library — reusable rounds, independent of any room | `requireUser()` | Real |
| `/admin/rounds/[roundId]` | Round Builder detail: Settings, Power Cards (allow-list from the global catalog), Questions (ordered, reorderable) | `requireUser()` + ownership | Real |
| `/admin/competitions` | Competition list | `requireUser()` | Real |
| `/admin/competitions/[id]` | Competition dashboard: Overview, Rooms, Settings. Competitions organize events only; they do not contain teams, rounds, questions, scenes, or store setup directly. | `requireUser()` + ownership | Real |
| `/admin/rooms/[roomId]` | Room setup dashboard: Overview, Teams, Rounds, Scenes, Power Cards, Settings. Rooms are the playable event spaces. | `requireUser()` + ownership | Real |
| `/host/[roomId]` | `HostConsole` — the live director's console: top bar (competition/room/code/status/connected count/timer), left Event Flow panel (scene list grouped by round, click to jump), center Live Preview (what participants see, plus a host-only answer/hints/notes panel), right Control Center (current question, timer, per-team quick actions, power requests, store, broadcast, event log), and a persistent bottom dock | `requireUser()` + ownership | Real |
| `/admin/settings` | App-level theme controls (accent color, corner radius) | `requireUser()` | Local state only (Zustand), no DB |

### 3.2 Data hierarchy — library resources vs. live events

Questions and Rounds are **reusable library resources owned directly by the host**, decoupled from any room. A Room *selects* rounds from the library rather than authoring its own — this is what lets a host reuse the same Antakshari round across a dozen events instead of rebuilding it every time.

```
User (host account)
  ├─ Question              (standalone, reusable; owner = User)
  ├─ Round                 (standalone, reusable; owner = User)
  │    └─ questions: []     (ordered refs to Question — a question can be in many rounds)
  ├─ PowerCard              (global catalog; owner = User — shared across every
  │                          competition/room this host runs)
  └─ Competition            (owner = User; has settings)
       └─ Room              (a specific live event; has roomCode, liveState)
            ├─ selectedRounds: []  (ordered refs to Round — chosen for this room, not owned)
            ├─ Team          (roster of member names; score + coins; NOT the same as Participant)
            ├─ Scene         (the run-of-show; optionally points at a Round and/or Question)
            ├─ Participant   (who actually connected live — name + team + room, no login)
            ├─ TeamPowerCard (a team's owned copies of a PowerCard)
            ├─ PowerCardRequest (live request→approve→activate→consume workflow)
            ├─ ScoreTransaction (append-only points ledger)
            ├─ CoinTransaction  (append-only coins ledger)
            └─ EventLog      (append-only audit trail of everything)
```

**Product rule**: Questions are reusable. Rounds are reusable. Rooms are live events. Competitions organize rooms. Deleting a Room or a Competition never deletes the Rounds/Questions it referenced — they're shared library items and may be in use elsewhere. Deleting a Round from the library just removes it from any room's `selectedRounds` (`$pull`), it doesn't touch the Questions it contained.

**Reusable edit safety**: If a Question is already attached to one or more Rounds, editing it must offer two choices: update the shared question everywhere, or duplicate it and edit the copy. If a Round is already selected by one or more Rooms, editing round settings or power-card access must offer the same two choices: update the shared round everywhere, or duplicate it and edit the copy.

**Question types**: The library supports `TEXT`, `IMAGE`, `TEXT_IMAGE`, `AUDIO`, `VIDEO`, `DRAWING`, `COMPLETION`, `IDENTIFY`, and `RAPID_FIRE`. These are still manually judged by the host; they only change authoring fields and live presentation shape.

**Room lifecycle**: Rooms use `DRAFT -> READY -> TESTING -> LIVE -> COMPLETED`. A generated scene flow can move a room from `DRAFT` to `READY`. Test Mode runs the host console without writing real score transactions or granting starting coins. Real live mode writes the official score ledger.

**Round → Power Card link**: `Round.allowedPowerCards` (a list of PowerCard ids) is how "different rounds allow different power cards" is expressed — e.g. an early round might allow Hint + Extra Time while the final round only allows Double Points. This field is edited from the Round Builder's Power Cards tab. **It is stored but not yet enforced anywhere at runtime** (no purchase/request path currently checks it) — treat it as scaffolding for a future live-override layer, not a working restriction today.

**Important nuance**: `Team.members` (the host-authored roster, names only) and `Participant` (who actually joined live via `/play/[code]`) are **two separate, unsynced concepts**. A team can list 5 member names while only 2 phones actually connect during the event — that's expected, not a bug. No code currently reconciles the two lists.

### 3.3 V1 route cleanup

The production V1 admin surface is consolidated under `/admin/*`.

- No `/competitions` duplicate route. Use `/admin/competitions`.
- No `/rooms` duplicate route. Use `/admin/rooms/[roomId]`.
- Questions and Rounds each have their own top-level library: `/admin/questions` and `/admin/rounds`. They are not nested under a room or competition.
- No global Media Library. Uploads happen inside questions (currently a media URL field, no file-upload endpoint exists).
- The sidebar has three groups: an ungrouped **Dashboard**, **BUILD** (Questions, Rounds, Competitions), and **SYSTEM** (Settings).
- Legacy redirect stubs may exist only to bounce old links forward: `/host` -> `/admin`, `/host/drawing` -> `/admin`, `/join/[code]` -> `/play/[code]`, `/login` and `/signup` -> `/admin`, `/rooms/[roomId]/rounds/[roundId]` -> `/admin/rooms/[roomId]` (round/question management is no longer a room-nested page).
---

### 3.4 Final V1 architecture freeze

Power Cards are reusable library resources, same as Questions and Rounds. Manage them from `/admin/power-cards`; rounds only select allowed cards from that catalog and must not create duplicate cards inside a round.

The final admin structure is:

```
Dashboard

BUILD
  Questions      (reusable, supports tags)
  Rounds         (reusable, supports categories, selects questions)
  Power Cards    (reusable cards)
  Competitions   (contains rooms)

SYSTEM
  Settings
```

Question tags are `tags: string[]` for filtering only. Round categories are organization-only (`Knowledge`, `Music`, `Drawing`, `Custom` by default). Neither tags nor categories change gameplay.

---

## 4. Two flows: preparing the library, then running an event

Preparing questions/rounds and running a live event are deliberately separate flows. A host might spend a week building a round library, then reuse it across many unrelated competitions.

**Library prep (any time, no competition required):**

```
Login (or first-ever signup, which becomes ADMIN automatically)
   ↓
/admin/questions — Create Question: pick a type first (TEXT / IMAGE / TEXT_IMAGE / AUDIO / VIDEO / DRAWING),
                    then fill in only the fields that type needs. Optionally attach to
                    existing rounds, or create a new round inline while saving.
   ↓
/admin/rounds — Create Round: name, description, rules, round type, scoring, timer, team order,
                 allowed Power Cards. Add Questions via a search/filter picker (or create one inline).
```

**Running an event (needs a competition and at least one room):**

```
/admin  — Dashboard: see existing competitions, or start a new one
   ↓
Create Competition  — name, description, language, theme, default Simple/Economy mode
   ↓
/admin/competitions/[id]  — Competition dashboard with Overview, Rooms, Settings
   ↓
Create Room  — e.g. Junior Room, Senior Room, Finals
   ↓
/admin/rooms/[roomId]  — Room setup
   ↓
Create/confirm Teams  — room-specific team names + member names, no login
   ↓
Select Rounds  — pick existing library rounds into this room's ordered `selectedRounds`
   ↓
Generate Scenes  — one click rebuilds the whole run-of-show from the room's selected
                    rounds and each round's ordered questions
   ↓
Test Mode  — optional rehearsal in `/host/[roomId]`; scene/timer controls work,
             but score changes are logged as test actions and do not change real scores
   ↓
Publish Room  — real QR code + join link + room code, ready to share
   ↓
Start Event  — flips Room + Competition to LIVE, grants starting coins if Economy Mode is on
```

## 5. Live event flow (during event)

The host has `/host/[roomId]` open. Every participant has `/play/[roomCode]` open. The host is the only one who ever advances anything.

```
Host: Start Event
   ↓
WELCOME scene                         ← shown on every phone
   ↓
For each Round:
   ROUND_INTRO scene
   ↓
   For each Question in the round:
       QUESTION (or DRAWING) scene    ← team discusses physically, answers out loud
       ↓
       Host manually awards/deducts marks (a ScoreTransaction, never auto-scored)
       ↓
       ANSWER_REVEAL scene
   ↓
   LEADERBOARD scene (top 3, animated)
   ↓
WINNER scene                          ← confetti, final scores
```

Throughout, independent of the scene sequence, the host can at any moment: pause/resume the timer, send a broadcast (e.g. "Tea break — 10 minutes"), open/close the store, approve or reject a pending power-card request, or undo a scoring mistake. None of these require leaving the console or changing the current scene.

Note: `RULES`, `WAITING`, `HINT`, and `BROADCAST` scene types exist in the schema and can be inserted manually, but the automatic `generateScenes()` builder does **not** insert them — the auto-generated flow is exactly `WELCOME → (ROUND_INTRO → [QUESTION/DRAWING → ANSWER_REVEAL]× → LEADERBOARD) per round → WINNER`. A `WAITING` scene is handled separately by the pre-start lobby state, not by the generated sequence.

---

## 6. The scene engine

A **scene**, not a question, is the atomic unit the host operates on. A question is just the payload of one particular scene type. This is deliberate: it lets the same "next/previous" control work uniformly across intros, questions, reveals, leaderboards, and the winner screen.

**Scene types** (`SceneType`, what kind of scene it is):
`WAITING · WELCOME · RULES · ROUND_INTRO · QUESTION · HINT · ANSWER_REVEAL · DRAWING · LEADERBOARD · BROADCAST · BREAK · WINNER`

**Scene status** (`SceneStatus`, where it is in its own lifecycle — a separate axis from type):
`UPCOMING · LIVE · COMPLETED`

Every scene document carries both independently, plus a redundant `isActive: boolean` that mirrors `status === "LIVE"`. Only one scene per room is ever `LIVE` at a time; publishing a new scene demotes the previous `LIVE` scene to `COMPLETED`.

The host moves with **Next / Previous** (`stepScene`), or jumps directly to any scene (`publishScene`, aliased `setActiveScene`). Publishing a scene also updates `Room.currentSceneId/currentRoundId/currentQuestionId` and resets the "show answer" flag, so `/play/[roomCode]`'s polling always reflects exactly what the host is showing.

---

## 7. Scoring system

**Marks are never auto-computed and a team's score is never edited directly.** Every point change is an immutable row in the `ScoreTransaction` collection:

```
ScoreTransaction {
  roomId, teamId, participantId?, questionId?,
  points: number,
  reason: "CORRECT" | "WRONG" | "BONUS" | "PENALTY" | "POWER_CARD" | "MANUAL",
  isUndo: boolean,
  isReverted: boolean,
  createdBy: User | null,
  createdAt
}
```

A team's live `score` is a **derived value**, recalculated by summing every non-undone, non-reverted transaction for that room and re-ranking all teams — not something incremented in place. Undo doesn't delete history: it flags the original row `isReverted: true` and appends a new inverse transaction. This is what makes "undo any mistake" and "full score history" both trivially correct — the ledger is the single source of truth, the `score` field is just a cache of it.

### MCQ auto-scoring (the one opt-in exception)

A question the host has flagged `isMCQ` is the single place scoring is *not* manual. On such a question the assigned team's captain taps an option and `submitMcqAnswer` grades it server-side against `question.answer`, writing exactly the same `ScoreTransaction` (`CORRECT`/`WRONG`, with `questionId`) plus an `MCQ_GRADED` event so the result survives the live feed window. Rules that keep this honest and non-double-counting:

- **Only the captain, only on their turn, once.** A second submission is rejected once an `MCQ_GRADED` event exists for that team+question.
- **The host cannot also mark it.** The host console hides the manual Correct/Wrong controls for MCQ questions and shows an "auto-scored" notice instead — so a question is scored by *either* the captain's tap *or* the host, never both.
- **Power cards still apply:** Double Guess grants one retry on a wrong pick (`MCQ_RETRY`), and Peek rules out one wrong option client-side.
- Everything else — undo, the derived-score model, coin rewards in Economy Mode — behaves identically to a host-awarded mark. MCQ changes *who taps the button*, not how the ledger works.

---

## 8. Coins vs. points — never mixed

Two completely separate numbers live on every `Team`:

| Field | Ledger | Determines |
|---|---|---|
| `score` | `ScoreTransaction` | **Who wins the competition** |
| `coins` | `CoinTransaction` | **What a team can afford in the store** |

Example: Team Chai can be in 2nd place with 150 points and simultaneously be the richest team with 3,000 coins because they played conservatively and skipped the Legendary card. The two systems never touch each other except in one direction: `createScoreTransaction` can *optionally* also fire a coin reward (e.g. "+100 coins for a correct answer") if Economy Mode is enabled — but that's a coin transaction being triggered *alongside* a score transaction, not the same number.

`CoinTransaction` types: `STARTING_BONUS · QUESTION_REWARD · CARD_PURCHASE · HOST_ADJUSTMENT · REFUND`.

---

## 9. The Power Card system

"Lifeline" is not a separate concept — it's just one flavor of **Power Card**. There is one unified engine, not two competing systems. A Power Card is defined by:

| Field | Values |
|---|---|
| Category | `HELP · DEFENSE · BOOST · RISK · ATTACK` |
| Rarity | `COMMON · RARE · EPIC · LEGENDARY` |
| Effect type | `HINT · EXTRA_TIME · BLOCK_NEGATIVE · DOUBLE_SCORE · SECOND_CHANCE · MYSTERY · GAMBLE · FREEZE · STEAL` |
| Economy fields | `price, stock (null = unlimited), enabled, requiresApproval, usesPerTeam, priceMode (FIXED today, DYNAMIC reserved)` |

**The catalog is global per host** (`PowerCard.ownerId`) — every competition and room that host runs shares the same store/catalog, and it's managed from a Round Builder's Power Cards tab (there's no separate top-level Power Cards page). A team's *owned copies* live in `TeamPowerCard`; a *live, in-progress use* of one is tracked in `PowerCardRequest`. A Round's `allowedPowerCards` field references entries in this global catalog to say which cards that round permits (see §3.2) — but nothing enforces that allow-list at runtime yet.

### 9.1 Two modes, one engine

Controlled by a single flag: `Competition.settings.economy.enabled`.

- **Simple Mode** (`enabled: false`) — the host directly grants cards to teams (`assignPowerCardsToRoom`, or `giveFreeCard` for a single team). No coins involved.
- **Economy Mode** (`enabled: true`) — teams start with coins (`grantStartingCoins`, fired once when the host starts the event) and buy cards from the store (`purchasePowerCard`) whenever it's open.

### 9.2 Using a card — the approval lifecycle

Two related but distinct state machines:

**A team's owned copy** (`TeamPowerCard.status`): `AVAILABLE → REQUESTED → APPROVED → ACTIVE → CONSUMED` (and back to `AVAILABLE` if rejected, or back to `AVAILABLE` after `CONSUMED` if a multi-use card still has uses left).

**The live request** (`PowerCardRequest.status`, which additionally has `REJECTED`):

```
Team requests a card (requestPowerCard)
   │
   ├─ if card.requiresApproval === false → skip straight to ACTIVE
   │
   └─ else → REQUESTED
              │
              ├─ Host rejects (resolvePowerCardRequest, approve=false) → REJECTED
              │                                    (owned copy reverts to AVAILABLE)
              │
              └─ Host approves → APPROVED
                                    │
                                    Host activates (hostActivatePowerCard) → ACTIVE
                                                    │
                                                    Host marks resolved (hostConsumePowerCard) → CONSUMED
```

Every transition is logged to `EventLog` (`POWER_CARD_REQUESTED`, `POWER_CARD_USED`).

### 9.3 The Store

Live per-room toggle: `Room.liveState.storeStatus` = `OPEN` or `CLOSED`, controlled by the host (`openStore`/`closeStore`). Purchases (`purchasePowerCard`) are rejected outright if the store is closed, the card is disabled, stock has run out (checked with an atomic conditional decrement to prevent overselling under concurrent buyers), or the team can't afford it. A successful purchase debits coins, credits the card to the team's inventory, and is logged.

`Competition.settings.economy.storeAvailability` (`ALWAYS · BEFORE_COMPETITION · BETWEEN_ROUNDS · HOST_MANUAL`) configures the *intended* availability policy; only `ALWAYS` currently has automatic behavior (the store auto-opens when the host starts the event). The other three modes are host-manual today — the host uses the Store panel's Open/Close buttons to enforce them by hand.

**Not yet built (scaffolded only, do not assume it works):** dynamic pricing (`priceMode: "DYNAMIC"` is a stored enum value with no pricing logic behind it).

---

## 10. Auth & permissions

- **No third-party auth provider.** A home-grown cookie + JWT session (`jose`, HS256, signed with the `AUTH_SECRET` env var), 7-day cookie `encore_session`, HttpOnly + `secure` in production. The JWT only carries a user id — every request re-fetches the user from MongoDB, so a role change takes effect on the next request without needing to log out.
- **No middleware.ts anywhere in the repo.** Every protected page calls `requireUser()` itself (which redirects to `/admin` if there's no valid session); every mutating server action independently calls `requireUser()` again plus an ownership check. This is deliberate defense-in-depth, not an oversight — but it does mean a new protected page must remember to call `requireUser()` itself; there is no global gate.
- **Role assignment**: the **first account ever created** on a fresh database automatically becomes `ADMIN`; every signup after that becomes `HOST`. There is currently no invite or promote-to-admin flow.
- **What's actually role-gated vs. ownership-gated**: only one function in the entire codebase checks `role` — `createCompetition` throws unless `user.role === "ADMIN"`. Every other mutation is gated purely by **ownership**, via `src/lib/authz.ts`. Two shapes of ownership check coexist: `assertCompetitionOwnership`/`assertRoomOwnership` walk up to `Competition.ownerId === session.user.id` (rooms, teams, scenes, scoring, coins); `assertRoundOwnership`/`assertQuestionOwnership`/`assertPowerCardOwnership` check `ownerId` directly on the Round/Question/PowerCard document (they're flat library resources, not nested under a room or competition). A `HOST` can fully run any competition they own, they just can't create a brand-new one. There is no mechanism yet for an `ADMIN` to assign a `HOST` to co-manage a competition someone else created.
- **Public, no-auth surfaces** (by design, not by omission): `/`, `/join`, `/play/[roomCode]`, `GET /api/live/[roomCode]`, and the server actions `joinRoom`, `requestPowerCard`, `purchasePowerCard` — these are the participant-facing paths and must work without a login.

---

## 11. Tech stack & architecture decisions

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16, App Router, React 19 | Server Components + Server Actions let mutations live next to the pages that need them, no separate REST API layer for the admin/host side |
| Database | MongoDB Atlas + Mongoose | Flexible schema suits a product whose settings/config shapes (round overrides, power card categories) are still evolving |
| Live participant sync | Polling (`GET /api/live/[roomCode]`), not WebSockets | Simplicity — one dynamic route re-reads current room/scene/team state; adequate for phone-in-hand polling cadence, not true sub-second push |
| Styling | Tailwind CSS, hand-built dark SaaS design system | No component library; consistent tokens (accent color, radii, spacing) defined once and reused |
| Animation | Framer Motion | Scene transitions, reveal animations, leaderboard movement |
| Client state | Zustand | Local-only UI state (theme settings); **not** used for server data — all real data flows through Server Components + Server Actions, never a client-side store pretending to be a database |
| Auth | Hand-rolled JWT + cookie, bcrypt password hashing | No external dependency/cost for a small-scale internal tool; see §10 for the exact mechanism |
| Money/score integrity | Append-only transaction ledgers (`ScoreTransaction`, `CoinTransaction`) rather than mutable counters | Makes undo, full history, and analytics correct by construction instead of by careful bookkeeping |

---

## 12. Rules for anyone (human or AI) extending this project

**Never build:**
- A participant dashboard or participant account/login system.
- A *forced* multiple-choice-only flow, or auto-scoring anything other than a question the host has explicitly opted into MCQ. (Opt-in per-question MCQ auto-scoring exists and is fine; making it the default or the only mode is not.)
- Independent participant navigation (a participant choosing what screen they're on).
- A second, competing "cards" or "lifelines" system — everything strategy-related goes through the one Power Card engine described in §9.

**Before adding any feature, ask:**
1. Is this for the host or the participant? (If you're not sure, it's almost certainly host-only.)
2. Does it support running a *live, physical, host-directed* competition — not a remote/automated one?
3. Does it preserve host control? (If a participant could use the feature to change what everyone else sees, it's wrong.)

If the answer to #3 is "the participant gets to decide," stop — that violates the core premise of this product.

**Before extending the question/round/room builder specifically**, re-read §3.2 — Questions and Rounds are shared library resources, not owned by a room or competition. A feature that mutates a Question or Round must never assume there's exactly one room using it; check `Round.questionIds`/`Room.selectedRounds` rather than deleting or duplicating on the assumption of single ownership.

---

## 13. Design philosophy, one line per role

- **Admin surface** → feels like a **Notion workspace**: structured, hierarchical, calm, edit-anytime.
- **Host console** → feels like an **OBS Studio control room**: dense, fast, keyboard-friendly, built for someone operating live under pressure.
- **Participant phone** → feels like a **simple companion screen**: large type, minimal choices, always mirrors what the host just did.
