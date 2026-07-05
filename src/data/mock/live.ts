import type {
  ApprovalRequest,
  Guess,
  PowerCard,
  ScoreEvent,
  TimelineEvent,
} from "@/types";

/* Preview-only mock data — replaced by MongoDB later. */

export const mockPowerCards: PowerCard[] = [
  {
    id: "shield",
    name: "Shield",
    description: "Protects the team if host approves",
    icon: "shield",
    color: "#3DD68C",
    count: 2,
    state: "available",
  },
  {
    id: "extra-time",
    name: "Extra Time",
    description: "Requested; waiting for host approval",
    icon: "clock-plus",
    color: "#7EB5F0",
    count: 1,
    state: "requested",
  },
  {
    id: "hint",
    name: "Hint",
    description: "Ask the host to reveal one hint",
    icon: "lightbulb",
    color: "#F5B93D",
    count: 3,
    state: "available",
  },
  {
    id: "double",
    name: "2× Points",
    description: "Active for the host's next award",
    icon: "zap",
    color: "#6C7BFA",
    count: 1,
    state: "active",
  },
  {
    id: "mystery",
    name: "Mystery box",
    description: "Effect finished and logged",
    icon: "gift",
    color: "#8A8F9C",
    count: 0,
    state: "consumed",
    usedOn: "Scene 04",
  },
  {
    id: "freeze",
    name: "Freeze",
    description: "Approved; host can activate it now",
    icon: "snowflake",
    color: "#7EB5F0",
    count: 1,
    state: "approved",
  },
];

export const mockApprovals: ApprovalRequest[] = [
  {
    id: "ap1",
    powerCard: "extra-time",
    fromTeamId: "chai",
    secondsAgo: 8,
  },
  { id: "ap2", powerCard: "hint", fromTeamId: "stars", secondsAgo: 21 },
];

export const mockTimeline: TimelineEvent[] = [
  { id: "t1", time: "8:04", bold: "Mango", text: "awarded +10 by host · Correct" },
  { id: "t2", time: "8:04", bold: "Chai", text: "requested Shield · awaiting approval" },
  { id: "t3", time: "8:03", text: "Question scene shown on 5 team phones" },
  { id: "t4", time: "8:02", text: "Host started Round 2 intro" },
  { id: "t5", time: "7:58", text: "Leaderboard shown · 8s" },
];

export const mockScoreHistory: ScoreEvent[] = [
  { id: "s1", delta: 20, reason: "Q3 · Correct · Double points approved", by: "by Priya", at: "8:05 PM" },
  { id: "s2", delta: 5, reason: "Q2 · Host bonus for explanation", by: "by Priya", at: "8:01 PM" },
  { id: "s3", delta: -3, reason: "Q2 · Hint consumed", by: "by Priya", at: "8:00 PM" },
  { id: "s4", delta: 15, reason: "Antakshari · Full song bonus", by: "by Priya", at: "7:52 PM" },
];

export const mockGuesses: Guess[] = [
  { id: "g1", teamId: "mango", text: "“rain”", detail: "Mango · 0:12" },
  { id: "g2", teamId: "kites", text: "“monsoon”", detail: "Kites · 0:31", exact: true },
  { id: "g3", teamId: "ladoo", text: "“umbrella cloud”", detail: "Ladoo · 0:29" },
  { id: "g4", teamId: "stars", text: "Stars is typing…", detail: "now", typing: true },
];

export const markReasons = [
  "Correct",
  "Wrong",
  "Half answer",
  "Bonus",
  "Penalty",
  "Challenge won",
  "Speed bonus",
  "Combo bonus",
];

export const quickBroadcasts = [
  { icon: "coffee", label: "Tea break" },
  { icon: "utensils", label: "Dinner is served" },
  { icon: "party-popper", label: "Confetti everywhere" },
];
