# Product Role & Permission Map

This document defines the product architecture before adding more screens.
The product is a Live Competition Operating System with only two user types:

- HOST: Admin, organizer, show director.
- PARTICIPANT: Team member using a phone during the event.

Important product concept:

- Host owns configuration.
- Participant owns interaction.
- Host controls event flow.
- Participant follows current live state.

## Section 1: Host Complete Flow

```text
Login
  ->
Admin Dashboard
  ->
Create / Select Competition
  ->
Setup Competition
  ->
Open Live Control Room
  ->
Run Event
  ->
Results
```

### Host Responsibilities

Before the event, the host creates the competition, configures rooms, creates
teams, adds participants, creates rounds, adds questions, uploads media,
configures scoring, configures lifelines, configures the power store, and builds
the scene flow.

During the event, the host controls the single live room: scene control, timer,
questions, scores, lifeline requests, store control, broadcasts, leaderboard,
and timeline.

After the event, the host reviews the final leaderboard, score history, event
timeline, and analytics.

## Section 2: Participant Complete Flow

```text
Join Event
  ->
Enter Code
  ->
Join Team
  ->
Wait
  ->
Follow Live State
  ->
Interact When Allowed
  ->
Results
```

### Participant Responsibilities

Participants use one live route: `/play/[roomCode]`.

The participant cannot navigate the event. The participant sees whatever the
host publishes for the current room.

Possible participant scenes:

- WAITING
- WELCOME
- ROUND_INTRO
- QUESTION
- DRAWING
- LEADERBOARD
- WINNER

The participant can join a team, enter their name, view team score, view coins,
buy power cards if enabled, request lifelines, and interact with the current
published scene.

The participant cannot change questions, change rounds, see future questions,
give marks, control the timer, control the leaderboard, or change the event
flow.

## Section 3: Keep Features

| Feature | Who uses it? | Phase | Decision | Correct Location | Reason |
| --- | --- | --- | --- | --- | --- |
| Competition | HOST | Before / After | KEEP | `/admin/competitions`, `/admin/competitions/[id]` | Core container for the full event. |
| Rooms | HOST | Before / During | KEEP | Inside competition: Rooms | A room is the live event instance with a room code and host control room. |
| Teams | HOST / PARTICIPANT | Before / During | KEEP | Inside competition: Teams; participant joins in `/play/[roomCode]` | Host configures teams; participant chooses or joins a team. |
| Participants | HOST / PARTICIPANT | Before / During | KEEP | Inside competition: Teams / Participants; `/play/[roomCode]` | Host can manually add; participant can enter own name and join. |
| Rounds | HOST | Before / During | KEEP | Inside competition: Rounds | Rounds structure the event. |
| Questions | HOST | Before / During | KEEP | Inside competition: Questions; live control room during event | Host creates and controls questions. |
| Scenes | HOST / PARTICIPANT | Before / During | KEEP | Inside competition: Scene Builder; published to `/play/[roomCode]` | Host builds and publishes scenes; participant follows current scene. |
| Power Store | HOST / PARTICIPANT | Before / During | KEEP | Inside room: Power Store; `/host/[roomId]`; `/play/[roomCode]` | Host configures and can override; participant buys cards if enabled. |
| Coins | HOST / PARTICIPANT | During / After | KEEP | Store, scores, participant live state | Supports team strategy, purchases, and host-controlled economy. |
| Score History | HOST | During / After | KEEP | `/host/[roomId]` Timeline; Analytics | Required for audit, undo, and final review. |
| Leaderboard | HOST / PARTICIPANT | During / After | KEEP | `/host/[roomId]`; participant scene in `/play/[roomCode]` | Host controls when shown; participants view the published leaderboard. |
| Analytics | HOST | After | KEEP | Admin dashboard / competition results | Helps the organizer review event performance. |
| Broadcast | HOST / PARTICIPANT | During | KEEP | `/host/[roomId]`; participant scene / overlay in `/play/[roomCode]` | Host sends announcements; participants receive them. |
| Media | HOST | Before / During | KEEP | Inside competition: Media | Supports questions, rounds, scenes, and drawing prompts. |
| Settings | HOST | Before / During / After | KEEP | Inside competition: Settings | Host-owned configuration for event behavior. |
| Drawing | HOST / PARTICIPANT | During | KEEP | Scene Builder and `/host/[roomId]` as a DRAWING scene | Drawing is not a separate route; it is a scene in the live event. |

## Section 4: Move Features

| Feature | Who uses it? | Phase | Decision | Move To | Reason |
| --- | --- | --- | --- | --- | --- |
| Templates | HOST | Before | MOVE | Create competition wizard | Templates are useful setup accelerators, not a top-level product area. |
| Themes | HOST | Before / During | MOVE | Competition Settings | Theme configuration belongs with event settings. |
| Gallery | HOST | Before / During / After | MOVE | Remove global Media Library | Media should be one clear library for images, audio, video, and event assets. |
| Room Questions | HOST | Before | MOVE | Inside competition: Questions | Questions are part of competition setup, not a participant feature. |
| Standalone Team / Question shortcuts | HOST | Before | MOVE | Inside `/admin/competitions/[id]` | They can exist as shortcuts later, but the primary mental model is inside a competition. |

## Section 5: Remove Features

| Feature | Who uses it? | Phase | Decision | Reason |
| --- | --- | --- | --- | --- |
| Sponsors | HOST | Before / After | REMOVE | Not required for creating, running, scoring, or managing the live event. |
| Certificates | HOST | After | REMOVE | Optional after-event output; not part of the core operating system. |
| Public user accounts | New visitor / PARTICIPANT | Any | REMOVE | Public visitors and participants should not create accounts. Host access is through `/admin`. |
| Participant management controls | PARTICIPANT | Any | REMOVE | Participants interact only with the current live state. |
| Participant future question access | PARTICIPANT | During | REMOVE | Participants should only see what the host publishes. |
| Participant timer control | PARTICIPANT | During | REMOVE | Timer belongs to host control. |
| Participant score editing | PARTICIPANT | During | REMOVE | Scoring belongs to host control and host override. |

## Section 6: Simplified Final App Structure

### Public Routes

```text
/
/join
```

`/` is the marketing page.

Actions:

- Start Hosting -> `/admin`
- Join Event -> `/join`

`/join` is only for entering a participant room code.

### Admin Routes

```text
/admin
/admin/competitions
/admin/competitions/[id]
```

`/admin` is the host dashboard.

Inside `/admin/competitions/[id]`:

- Overview
- Rooms
- Teams
- Rounds
- Questions
- Scene Builder
- Power Store
- Media
- Settings

### Live Host Route

```text
/host/[roomId]
```

This is the single host control room.

It contains:

- Scene Control
- Timer
- Questions
- Scores
- Lifeline Requests
- Power Store Control
- Broadcast
- Leaderboard
- Timeline

Drawing is not a separate route. Drawing is a scene controlled inside
`/host/[roomId]` and published to participants through `/play/[roomCode]`.

### Participant Route

```text
/play/[roomCode]
```

This is the only live participant route.

The participant sees whatever the host publishes. The participant cannot
navigate between screens manually.

Possible scenes:

- WAITING
- WELCOME
- ROUND_INTRO
- QUESTION
- DRAWING
- LEADERBOARD
- WINNER

## Permission Rules

| Action | HOST | PARTICIPANT |
| --- | --- | --- |
| Create competition | Yes | No |
| Configure competition | Yes | No |
| Configure room | Yes | No |
| Create teams | Yes | No |
| Join team | Yes, manual add | Yes |
| Add participant names | Yes | Own name only |
| Create rounds | Yes | No |
| Add questions | Yes | No |
| Upload media | Yes | No |
| Arrange scenes | Yes | No |
| Start competition | Yes | No |
| Change current screen | Yes | No |
| Start / pause timer | Yes | No |
| Reveal hints / answers | Yes | No |
| Give or remove points | Yes | No |
| Request lifeline | Yes, force activate | Yes |
| Approve / reject lifeline | Yes | No |
| Buy power card | Yes, override / manual | Yes |
| Open / close store | Yes | No |
| Send announcement | Yes | No |
| View leaderboard | Yes | Yes, when published |
| View score history | Yes | No |
| View analytics | Yes | No |
| Undo mistakes | Yes | No |
| Override state | Yes | No |

## Final Simplification Decision

Do not remove important event features. Move them into the correct ownership
area.

Keep the product focused on creating competitions, running live competitions,
team strategy, scoring, leaderboard, analytics, broadcast, media, and event
management.

The final mental model should be simple:

- Public visitors choose to host or join.
- Hosts manage competitions from `/admin`.
- Hosts run live rooms from `/host/[roomId]`.
- Participants play from `/play/[roomCode]`.

