# Live Competition OS Product Flow

This product is a live competition operating system for real physical events.
It is not Kahoot, not an automatic quiz engine, and not an individual-player
online game. The host controls the event like a show director; participant
phones mirror the current scene and may request lifelines.

## Product Principles

- The host controls what everyone sees and when the event advances.
- Teams compete in the physical room; phones are support screens.
- One team may have many members but only one connected phone.
- Team members are names, not login accounts.
- Answers may be spoken, sung, drawn, guessed, or judged manually.
- The system never auto-scores answers.
- Every score change is a transaction with team, optional member, scene or
  question, points, reason, host, and timestamp.
- Lifelines move through explicit states: available, requested, approved,
  active, consumed.
- The competition runs as scenes, like a PowerPoint-controlled live show.

## Phase 1: Preparation

The preparation phase happens before the event.

1. Host login
   - Host opens the website.
   - Host logs in or signs up.
   - Host lands on the dashboard.

2. Dashboard
   - Shows My Competitions.
   - Shows Create Competition.
   - Shows recent competitions such as Jain Summer Camp 2026, Family Game
     Night, and School Quiz.

3. Create competition
   - Host enters competition name.
   - Host enters description.
   - Host chooses language, such as Gujarati, Hindi, or English.
   - Host chooses theme, such as Temple, Dark, or Kids.

4. Competition dashboard
   - Shows setup progress.
   - Tracks room, teams, rounds, questions, scenes, and publishing.
   - Start Event becomes available when required setup is complete.

5. Create room
   - A competition can contain multiple rooms.
   - Examples: Junior Room and Senior Room.
   - A room is the actual live event instance.

6. Create teams
   - Host creates teams inside the room.
   - Team members are simple names only.
   - Members do not log in.

7. Assign lifelines
   - Every team automatically receives the starter hand: Hint x1 and Extra Time x1.
   - Starter cards activate immediately when the current round allows them.
   - Host may grant more cards or customize inventory; non-starter cards may require approval.

8. Create rounds
   - Host creates rounds such as Antakshari, Chitra Thi Geet, or Q/A.
   - Each round has description, rules, default marks, and timer.

9. Add questions
   - Questions belong to rounds.
   - Question content can be text, image, audio, video, or drawing.
   - Questions can have answer, explanation, hints, marks, and wrong penalty.
   - These values guide the host; they do not auto-score participants.

10. Build scenes
    - The system creates an initial scene flow automatically.
    - Example: Waiting Room, Welcome, Rules, Round Intro, Question, Hint,
      Answer Reveal, Leaderboard, Break, Winner.
    - Host can reorder scenes like slides.

11. Publish room
    - System generates room code, QR code, and public join link.

## Phase 2: Live Event

The live event phase happens during the physical competition.

1. Participants join
   - Participant opens QR code, room code, or public join link.
   - Participant enters name.
   - Participant selects team.
   - Participant enters the waiting room.

2. Waiting room
   - Phone shows competition name.
   - Phone shows waiting for host.
   - Phone shows selected team and connected phone count.
   - Nothing advances until the host starts.

3. Host opens console
   - Left panel: scene flow.
   - Center panel: live participant preview.
   - Right panel: controls.
   - Bottom dock: previous, next, timer, reveal, leaderboard, give marks,
     broadcast, undo.

4. Host starts event
   - Host presses Start.
   - All connected phones move to the first live scene.

5. Scene control
   - Host advances Welcome, Rules, Round Intro, Question, Hint, Answer Reveal,
     Drawing, Leaderboard, Break, and Winner scenes.
   - Participants do not control the flow.

6. Question scene
   - Host shows the question.
   - Host starts timer when appropriate.
   - Teams discuss physically.
   - System does nothing when a team speaks, sings, draws, or guesses.

7. Give marks
   - Host opens Give Marks.
   - Host selects team.
   - Host optionally selects member.
   - Host chooses points and reason.
   - System appends a score transaction.
   - Leaderboard updates from score transactions.

8. Wrong answer
   - Host applies negative marks manually when needed.
   - A Shield or other active effect may alter the transaction.

9. Lifeline request
   - Team phone can use only a card its team owns and the current round allows.
   - Starter cards activate immediately; approval-required cards create a host request.
   - Host approves, rejects, or overrides approval-required cards.
   - An approved card is not active until host activates it.
   - Active lifeline becomes consumed only after the effect resolves.

10. Hint flow
    - Host can reveal a hint directly.
    - Team can request a hint.
    - Hint appears only when host approves or reveals it.

11. Drawing round
    - Host starts drawing scene.
    - Host selects team or participant.
    - Drawing and guessing happen in the room.
    - Host awards marks manually.

12. Leaderboard scene
    - Host shows leaderboard.
    - Phones show ranked teams and scores.

13. Broadcast
    - Host can send announcements at any time.
    - Phones show a popup or broadcast scene.

14. Winner
    - Final scene shows winning team and score.
    - Celebration effects may play on all phones.

## Phase 3: After Event

The after-event phase happens once the live competition is complete.

1. Results
   - Host sees final leaderboard.
   - Host sees score history.
   - Host sees event timeline.
   - Host sees analytics.

2. Score history
   - Shows transaction ledger by team, round, scene, question, reason, and time.
   - Includes point awards, penalties, lifelines, undos, and host identity.

3. Analytics
   - Shows total questions.
   - Shows most difficult question.
   - Shows most used lifeline.
   - Shows best comeback.
   - Can derive insights from event log and score transactions.

## End-to-End Flow

```text
LOGIN
  ↓
CREATE COMPETITION
  ↓
CREATE ROOM
  ↓
CREATE TEAMS
  ↓
ADD MEMBERS
  ↓
ASSIGN LIFELINES
  ↓
CREATE ROUNDS
  ↓
ADD QUESTIONS
  ↓
BUILD SCENES
  ↓
PUBLISH ROOM
  ↓
PARTICIPANTS JOIN
  ↓
WAITING ROOM
  ↓
HOST START
  ↓
SCENE CONTROL
  ↓
QUESTION
  ↓
LIFELINES
  ↓
MANUAL MARKS
  ↓
LEADERBOARD
  ↓
WINNER
  ↓
ANALYTICS
```
