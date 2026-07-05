export type ProductPhaseId = "preparation" | "live-event" | "after-event";

export type FlowStepId =
  | "login"
  | "dashboard"
  | "create-competition"
  | "competition-dashboard"
  | "create-room"
  | "create-teams"
  | "assign-power-cards"
  | "create-rounds"
  | "add-questions"
  | "build-scenes"
  | "publish-room"
  | "participants-join"
  | "waiting-room"
  | "host-console"
  | "host-start"
  | "scene-control"
  | "question-scene"
  | "power-cards"
  | "manual-marks"
  | "leaderboard"
  | "broadcast"
  | "winner"
  | "results"
  | "score-history"
  | "analytics";

export interface ProductFlowStep {
  id: FlowStepId;
  title: string;
  owner: "host" | "participant" | "system";
  summary: string;
  mustHave: string[];
}

export interface ProductPhase {
  id: ProductPhaseId;
  title: string;
  goal: string;
  steps: ProductFlowStep[];
}

export const productPrinciples = [
  "The host controls the show; participants do not advance the event.",
  "Phones mirror the current scene and support power card requests.",
  "Teams are real-world groups; members are names, not login accounts.",
  "The system never auto-scores answers.",
  "Every score change is a transaction; every coin change is a transaction.",
  "Power cards move through available, requested, approved, active, consumed.",
  "Simple Mode: host assigns power cards directly. Economy Mode: teams earn coins and buy them from the store. Both run on one unified Power Card engine.",
  "The live event is scene-based, like a hosted slide show.",
] as const;

export const powerCardLifecycle = [
  "available",
  "requested",
  "approved",
  "active",
  "consumed",
] as const;

export const sceneFlow = [
  "WAITING",
  "WELCOME",
  "RULES",
  "ROUND_INTRO",
  "QUESTION",
  "HINT",
  "ANSWER_REVEAL",
  "DRAWING",
  "LEADERBOARD",
  "BROADCAST",
  "BREAK",
  "WINNER",
] as const;

export const productFlow: ProductPhase[] = [
  {
    id: "preparation",
    title: "Phase 1: Before Event",
    goal: "The host prepares the competition, rooms, teams, rounds, questions, scenes, and public join access.",
    steps: [
      {
        id: "login",
        title: "Host Login",
        owner: "host",
        summary: "Host logs in or signs up before managing competitions.",
        mustHave: ["Login", "Signup", "Authenticated dashboard redirect"],
      },
      {
        id: "dashboard",
        title: "Dashboard",
        owner: "host",
        summary: "Host sees competitions, recent work, and the create competition entry point.",
        mustHave: ["My Competitions", "Create Competition", "Recent competitions"],
      },
      {
        id: "create-competition",
        title: "Create Competition",
        owner: "host",
        summary: "Host defines the top-level event identity and settings.",
        mustHave: ["Name", "Description", "Language", "Theme"],
      },
      {
        id: "competition-dashboard",
        title: "Competition Dashboard",
        owner: "host",
        summary: "Host sees setup progress and can continue room setup.",
        mustHave: ["Setup progress", "Room status", "Teams status", "Rounds status", "Questions status", "Start Event"],
      },
      {
        id: "create-room",
        title: "Create Room",
        owner: "host",
        summary: "Host creates the actual live event room inside a competition.",
        mustHave: ["Room name", "Room code", "Room-specific teams, rounds, scenes"],
      },
      {
        id: "create-teams",
        title: "Create Teams",
        owner: "host",
        summary: "Host creates teams and member name lists without member logins.",
        mustHave: ["Team name", "Member names", "No member accounts"],
      },
      {
        id: "assign-power-cards",
        title: "Assign Power Cards",
        owner: "host",
        summary: "Host builds the Power Card catalog and, in Simple Mode, assigns default or customized cards to each team. In Economy Mode, teams buy them from the store instead.",
        mustHave: ["Shield", "Hint", "Extra Time", "Double Points", "Per-team counts", "Coins (Economy Mode)"],
      },
      {
        id: "create-rounds",
        title: "Create Rounds",
        owner: "host",
        summary: "Host creates rounds with descriptions, rules, default marks, and timers.",
        mustHave: ["Round title", "Description", "Rules", "Default marks", "Timer"],
      },
      {
        id: "add-questions",
        title: "Add Questions",
        owner: "host",
        summary: "Host adds content and answer guidance for manual judging.",
        mustHave: ["Type", "Question", "Answer", "Hints", "Marks", "Wrong penalty"],
      },
      {
        id: "build-scenes",
        title: "Build Scenes",
        owner: "host",
        summary: "System generates a reorderable scene flow from setup content.",
        mustHave: ["Waiting", "Welcome", "Rules", "Round intros", "Questions", "Leaderboard", "Winner"],
      },
      {
        id: "publish-room",
        title: "Publish Room",
        owner: "system",
        summary: "System generates access details for participants.",
        mustHave: ["Room code", "QR code", "Public join link"],
      },
    ],
  },
  {
    id: "live-event",
    title: "Phase 2: Live Event",
    goal: "The host runs the physical competition scene by scene while phones stay synchronized.",
    steps: [
      {
        id: "participants-join",
        title: "Participants Join",
        owner: "participant",
        summary: "Participants enter name, select team, and join the waiting room.",
        mustHave: ["Name", "Team selection", "Room code or link"],
      },
      {
        id: "waiting-room",
        title: "Waiting Room",
        owner: "participant",
        summary: "Participant phones wait until the host starts.",
        mustHave: ["Competition name", "Waiting for host", "Selected team", "Connected phones"],
      },
      {
        id: "host-console",
        title: "Host Console",
        owner: "host",
        summary: "Host sees scene flow, live preview, controls, and persistent dock.",
        mustHave: ["Left scene flow", "Center preview", "Right controls", "Bottom dock"],
      },
      {
        id: "host-start",
        title: "Host Start",
        owner: "host",
        summary: "Host starts the event and moves everyone from waiting into the first scene.",
        mustHave: ["Start action", "Synchronized phones", "Event timeline log"],
      },
      {
        id: "scene-control",
        title: "Scene Control",
        owner: "host",
        summary: "Host advances welcome, rules, round intro, questions, leaderboard, and winner scenes.",
        mustHave: ["Previous scene", "Next scene", "Reveal", "Timer", "Broadcast"],
      },
      {
        id: "question-scene",
        title: "Question Scene",
        owner: "host",
        summary: "Host shows question and timer while teams answer physically.",
        mustHave: ["Question display", "Timer", "Available power cards", "No auto scoring"],
      },
      {
        id: "power-cards",
        title: "Power Cards",
        owner: "host",
        summary: "Teams request or buy power cards; host controls approval, activation, and consumption. Coins and score are always kept separate.",
        mustHave: ["Request", "Approve", "Reject", "Activate", "Consume", "Buy (Economy Mode)"],
      },
      {
        id: "manual-marks",
        title: "Manual Marks",
        owner: "host",
        summary: "Host awards or deducts points through score transactions.",
        mustHave: ["Team", "Optional member", "Points", "Reason", "Host", "Timestamp"],
      },
      {
        id: "leaderboard",
        title: "Leaderboard",
        owner: "host",
        summary: "Host shows ranked team scores derived from transactions.",
        mustHave: ["Team ranks", "Scores", "Animation", "Host-controlled display"],
      },
      {
        id: "broadcast",
        title: "Broadcast",
        owner: "host",
        summary: "Host sends announcements to every phone anytime.",
        mustHave: ["Message", "Popup or scene display", "Timeline log"],
      },
      {
        id: "winner",
        title: "Winner",
        owner: "host",
        summary: "Host shows final winner scene with celebration effects.",
        mustHave: ["Winning team", "Final score", "Confetti"],
      },
    ],
  },
  {
    id: "after-event",
    title: "Phase 3: After Event",
    goal: "The host reviews results, score history, timeline, and analytics.",
    steps: [
      {
        id: "results",
        title: "Results",
        owner: "host",
        summary: "Host sees final competition results.",
        mustHave: ["Final leaderboard", "Timeline", "Analytics entry points"],
      },
      {
        id: "score-history",
        title: "Score History",
        owner: "host",
        summary: "Host reviews the complete score transaction ledger.",
        mustHave: ["Team", "Round", "Question or scene", "Points", "Reason", "Power card events", "Coin transactions", "Undo history"],
      },
      {
        id: "analytics",
        title: "Analytics",
        owner: "host",
        summary: "System derives insights from score transactions and event logs.",
        mustHave: ["Total questions", "Most difficult", "Most purchased card", "Most used card", "Total coins spent", "Best strategy team", "Best comeback"],
      },
    ],
  },
];

