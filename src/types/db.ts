import type { Types } from "mongoose";

/**
 * Database-layer types for the Live Competition OS.
 *
 * These are intentionally separate from the presentation types in
 * `@/types/index.ts` (which the UI components consume). DB documents use
 * ObjectId references and are prefixed with `I` to avoid name collisions.
 *
 * Enum values are declared as `as const` arrays so a single source of truth
 * feeds both Mongoose `enum` validation and the Zod validators.
 */

/* ─────────────── enums ─────────────── */

export const USER_ROLES = ["ADMIN", "HOST"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const COMPETITION_STATUSES = ["DRAFT", "READY", "LIVE", "COMPLETED"] as const;
export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];

export const ROOM_STATUSES = ["DRAFT", "TESTING", "READY", "LIVE", "COMPLETED"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const SCENE_TYPES = [
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
export type SceneType = (typeof SCENE_TYPES)[number];

export const QUESTION_TYPES = [
  "TEXT",
  "IMAGE",
  "TEXT_IMAGE",
  "AUDIO",
  "VIDEO",
  "DRAWING",
  "COMPLETION",
  "IDENTIFY",
  "RAPID_FIRE",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const SCORE_REASONS = [
  "CORRECT",
  "WRONG",
  "BONUS",
  "PENALTY",
  "POWER_CARD",
  "MANUAL",
] as const;
export type ScoreReason = (typeof SCORE_REASONS)[number];

export const QUESTION_DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];

export const ROUND_TYPES = ["GENERAL", "QUESTION_ANSWER", "IMAGE_BASED", "DRAWING", "CUSTOM"] as const;
export type RoundType = (typeof ROUND_TYPES)[number];

// Special live modes layered on top of a round (Section 13). They change how
// the round is framed and how the host is prompted to score — scoring stays
// manual, so these guide the host rather than auto-computing anything.
export const SPECIAL_ROUND_MODES = ["NONE", "SPEED", "RISK", "SURVIVAL", "BONUS"] as const;
export type SpecialRoundMode = (typeof SPECIAL_ROUND_MODES)[number];

export const ROUND_CATEGORIES = ["Knowledge", "Music", "Drawing", "Custom"] as const;
export type RoundCategory = (typeof ROUND_CATEGORIES)[number] | string;

export const RULE_OVERRIDE_MODES = ["INHERIT", "CUSTOM"] as const;
export type RuleOverrideMode = (typeof RULE_OVERRIDE_MODES)[number];

export const QUESTION_ASSIGNMENT_MODES = [
  "DEFAULT",
  "ANY_TEAM",
  "FIXED_ORDER",
  "HOST_CHOOSES",
  "RANDOM_TEAM",
] as const;
export type QuestionAssignmentMode = (typeof QUESTION_ASSIGNMENT_MODES)[number];

export const POWER_CARD_OVERRIDE_MODES = ["DEFAULT", "CUSTOM"] as const;
export type PowerCardOverrideMode = (typeof POWER_CARD_OVERRIDE_MODES)[number];

export const EVENT_LOG_TYPES = [
  "EVENT_STARTED",
  "COMPETITION_STARTED",
  "SCENE_CHANGED",
  "TIMER_STARTED",
  "TIMER_STOPPED",
  "QUESTION_OPENED",
  "ANSWER_REVEALED",
  "SCORE_CHANGED",
  "POWER_CARD_REQUESTED",
  "POWER_CARD_USED",
  "TIMER_CHANGED",
  "BROADCAST_SENT",
  "COIN_AWARDED",
  "CARD_PURCHASED",
  "STORE_OPENED",
  "STORE_CLOSED",
  "ACHIEVEMENT_EARNED",
  "FLASH_SALE_STARTED",
  "REWARD_DROP",
  "LUCKY_SPIN",
  "AUCTION_STARTED",
  "AUCTION_SOLD",
  "AUCTION_CANCELLED",
  "CAPTAIN_CHANGED",
  "ANSWER_SUBMITTED",
  "MCQ_RETRY",
  "MCQ_GRADED",
] as const;
export type EventLogType = (typeof EVENT_LOG_TYPES)[number];

export const AUCTION_TYPES = ["NORMAL", "SECRET", "LUCKY"] as const;
export type AuctionType = (typeof AUCTION_TYPES)[number];

export const AUCTION_STATUSES = ["OPEN", "SOLD", "CANCELLED"] as const;
export type AuctionStatus = (typeof AUCTION_STATUSES)[number];

// The "going once / going twice / sold" drama, host-advanced.
export const AUCTION_STAGES = ["LIVE", "GOING_ONCE", "GOING_TWICE"] as const;
export type AuctionStage = (typeof AUCTION_STAGES)[number];

export const ACHIEVEMENT_TYPES = [
  "FIRST_BLOOD",
  "HOT_STREAK",
  "ON_FIRE",
  "COMEBACK_KING",
  "PERFECT_ROUND",
  "FAST_ANSWER",
] as const;
export type AchievementType = (typeof ACHIEVEMENT_TYPES)[number];

// SUGGESTED — auto-detected, waiting on the host. AWARDED — host granted the
// reward. DISMISSED — host declined it. (Host decides; automation only suggests.)
export const ACHIEVEMENT_STATUSES = ["SUGGESTED", "AWARDED", "DISMISSED"] as const;
export type AchievementStatus = (typeof ACHIEVEMENT_STATUSES)[number];

export const SCENE_STATUSES = ["UPCOMING", "LIVE", "COMPLETED"] as const;
export type SceneStatus = (typeof SCENE_STATUSES)[number];

/**
 * Power Card taxonomy — "Lifeline" is now just one flavor of card. Every
 * strategy mechanic in the product (help, defense, boost, risk, attack) is
 * one unified engine, not separate systems.
 */
export const POWER_CARD_CATEGORIES = ["HELP", "DEFENSE", "BOOST", "RISK", "ATTACK"] as const;
export type PowerCardCategory = (typeof POWER_CARD_CATEGORIES)[number];

export const POWER_CARD_RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY"] as const;
export type PowerCardRarity = (typeof POWER_CARD_RARITIES)[number];

// Base set is what the spec named explicitly (HINT/EXTRA_TIME/BLOCK_NEGATIVE/
// DOUBLE_SCORE/SECOND_CHANCE/MYSTERY); GAMBLE/FREEZE are added so every named
// example card (Gamble, Freeze) maps to a real effect.
// INSURANCE is a stronger sibling of BLOCK_NEGATIVE: Shield (BLOCK_NEGATIVE)
// voids a negative on the current question only; Insurance (INSURANCE) shields
// a team from all negatives across three rounds.
export const POWER_CARD_EFFECT_TYPES = [
  "HINT",
  "EXTRA_TIME",
  "BLOCK_NEGATIVE",
  "INSURANCE",
  "DOUBLE_SCORE",
  "SECOND_CHANCE",
  "MYSTERY",
  "GAMBLE",
  "FREEZE",
  "PEEK",
] as const;
export type PowerCardEffectType = (typeof POWER_CARD_EFFECT_TYPES)[number];

export const PRICE_MODES = ["FIXED", "DYNAMIC"] as const;
export type PriceMode = (typeof PRICE_MODES)[number];

// Shared lifecycle for a team's owned copy of a card AND for a live request —
// one status vocabulary for the whole engine.
export const POWER_CARD_STATUSES = [
  "AVAILABLE",
  "REQUESTED",
  "APPROVED",
  "ACTIVE",
  "CONSUMED",
] as const;
export type PowerCardStatus = (typeof POWER_CARD_STATUSES)[number];

export const POWER_CARD_REQUEST_STATUSES = [
  "REQUESTED",
  "APPROVED",
  "REJECTED",
  "ACTIVE",
  "CONSUMED",
] as const;
export type PowerCardRequestStatus = (typeof POWER_CARD_REQUEST_STATUSES)[number];

export const COIN_TRANSACTION_TYPES = [
  "STARTING_BONUS",
  "QUESTION_REWARD",
  "CARD_PURCHASE",
  "HOST_ADJUSTMENT",
  "REFUND",
] as const;
export type CoinTransactionType = (typeof COIN_TRANSACTION_TYPES)[number];

export const STORE_STATUSES = ["OPEN", "CLOSED"] as const;
export type StoreStatus = (typeof STORE_STATUSES)[number];

export const STORE_AVAILABILITY_MODES = [
  "ALWAYS",
  "BEFORE_COMPETITION",
  "BETWEEN_ROUNDS",
  "HOST_MANUAL",
] as const;
export type StoreAvailabilityMode = (typeof STORE_AVAILABILITY_MODES)[number];

/* ─────────────── embedded shapes ─────────────── */

export interface CompetitionSettings {
  mode: "SIMPLE" | "ADVANCED";
  room: {
    name: string;
    code?: string;
    joinMethod: "QR" | "CODE" | "BOTH";
    participantJoining: "ANYONE" | "CREATED_MEMBERS";
  };
  permissions: {
    viewLeaderboard: boolean;
    viewTeamScore: boolean;
    viewPowerCards: boolean;
  };
  scoring: {
    defaultCorrect: number;
    defaultWrong: number;
    defaultTimer: number;
    defaultCoinReward: number;
    defaultPowerCardApprovalRequired: boolean;
    allowNegative: boolean;
    allowBonus: boolean;
    manualScoring: boolean;
    questionAssignment: "ANY_TEAM" | "FIXED_ORDER" | "HOST_CHOOSES" | "RANDOM_TEAM";
  };
  turnRules: {
    enableTeamTurns: boolean;
    allowStealing: boolean;
    allowChallenges: boolean;
  };
  /**
   * The Simple/Economy switch: `enabled: false` = Simple Mode (host directly
   * assigns power cards, no coins, no store). `enabled: true` = Economy Mode
   * (teams earn and spend coins through the store). Both modes run through
   * the same PowerCard engine — this flag only toggles whether coins matter.
   */
  economy: {
    enabled: boolean;
    startingCoins: number;
    correctAnswerCoins: number;
    fastAnswerBonusCoins: number;
    roundWinnerCoins: number;
    storeAvailability: StoreAvailabilityMode;
  };
  setupDraft: {
    teams: Array<{
      name: string;
      members: string[];
    }>;
    rounds: Array<{
      name: string;
      description?: string;
      rules?: string;
      defaultTimer: number;
      defaultMarks: number;
      addQuestionsLater: boolean;
    }>;
  };
}

export interface RoomLiveState {
  timerStartedAt: Date | null;
  timerEndsAt: Date | null;
  timerPaused: boolean;
  showAnswer: boolean;
  /** Live toggle for whether teams can buy from the store right now. */
  storeStatus: StoreStatus;
  /** Host-triggered timed discount on every card while active. */
  flashSaleActive: boolean;
  flashSalePercent: number;
  flashSaleEndsAt: Date | null;
  /** DRAWING scenes: the team whose captain may draw on the shared board.
   *  Null = only the host draws; everyone else watches. */
  drawerTeamId: Types.ObjectId | null;
}

export const ANSWER_MODES = ["VERBAL", "CAPTAIN_SUBMIT"] as const;
export type AnswerMode = (typeof ANSWER_MODES)[number];

export interface RoomSettings {
  joinMethod: "CODE" | "QR" | "BOTH";
  /**
   * VERBAL (default): teams answer out loud, the host judges and gives marks.
   * CAPTAIN_SUBMIT: the team captain's phone can also type/submit an answer —
   * still judged manually by the host (never auto-graded), it just gives the
   * host a written record next to the current question.
   */
  answerMode?: AnswerMode;
  permissions: {
    viewLeaderboard: boolean;
    viewTeamScore: boolean;
    buyPowers: boolean;
    requestLifelines: boolean;
  };
}

export interface TeamStats {
  correctAnswers: number;
  wrongAnswers: number;
  bonusPoints: number;
  /** Current consecutive-correct streak — reset to 0 on a wrong answer. */
  streak: number;
  /** Highest streak this team has reached during the event. */
  bestStreak: number;
}

/** A host-authored roster entry — a name only, no login. */
export interface TeamMemberEntry {
  name: string;
}

export interface QuestionHint {
  text: string;
  penalty: number;
}

export interface QuestionMedia {
  url: string;
  type: "IMAGE" | "AUDIO" | "VIDEO";
  name: string;
}

/* ─────────────── document interfaces ─────────────── */

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  image?: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICompetition {
  _id: Types.ObjectId;
  title: string;
  description?: string;
  language: string;
  theme: string;
  status: CompetitionStatus;
  ownerId: Types.ObjectId;
  settings: CompetitionSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface IRoom {
  _id: Types.ObjectId;
  competitionId: Types.ObjectId;
  name: string;
  roomCode: string;
  status: RoomStatus;
  settings: RoomSettings;
  /** Ordered library Rounds selected to run in this room. */
  selectedRounds: Types.ObjectId[];
  /**
   * Power card ids the host has force-enabled for this room's live event,
   * overriding a round's `allowedPowerCards` restriction. Host always has
   * the final say during a live event, even over settings decided earlier.
   */
  powerCardOverrides: string[];
  /**
   * Power card ids the host has force-disabled for this room's live event,
   * even though the round would otherwise allow them (or allows everything).
   * Lets the host shrink a round's card count mid-event, not just grow it.
   */
  powerCardExclusions: string[];
  /** Inventory restored by Reset Room. Empty means the automatic starter hand. */
  powerCardDefaults: Array<{ powerCardId: string; uses: number }>;
  currentSceneId: Types.ObjectId | null;
  currentRoundId: Types.ObjectId | null;
  currentQuestionId: Types.ObjectId | null;
  liveState: RoomLiveState;
  onlineDevices: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITeam {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  name: string;
  color?: string;
  members: TeamMemberEntry[];
  /** Decides the winner. Never mixed with coins. */
  score: number;
  rank: number;
  /** Buys power cards from the store. Never mixed with score. */
  coins: number;
  /** The team's rank before the most recent recalculation — powers comeback detection. */
  previousRank: number;
  stats: TeamStats;
  /** Question ids this team is shielded from negative marks on (Insurance card). */
  insuredQuestionIds: string[];
  /** Hints unlocked per question via the Hint card. */
  hintsRevealed: Array<{ questionId: string; count: number }>;
  /** Questions this team is frozen on (opponent's Freeze card) — no cards playable. */
  frozenQuestionIds: string[];
  /** One eliminated wrong-option index per question this team has Peeked. */
  peeks: Array<{ questionId: string; eliminatedOptionIndex: number }>;
  createdAt: Date;
  updatedAt: Date;
}

/** A per-team achievement, host-approved before its reward is granted. */
export interface ITeamAchievement {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  teamId: Types.ObjectId;
  type: AchievementType;
  status: AchievementStatus;
  /** Coin reward attached when this was suggested; granted on award. */
  coinReward: number;
  awardedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A live auction of one power card, host-started and host-settled. */
export interface IAuction {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  powerCardId: Types.ObjectId;
  type: AuctionType;
  status: AuctionStatus;
  stage: AuctionStage;
  startingBid: number;
  minIncrement: number;
  /** Highest public bid so far (NORMAL). 0 until the first bid. */
  currentBid: number;
  currentBidTeamId?: Types.ObjectId | null;
  winnerTeamId?: Types.ObjectId | null;
  winningBid: number;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A single team's bid in an auction (one row per team for SECRET/LUCKY). */
export interface IAuctionBid {
  _id: Types.ObjectId;
  auctionId: Types.ObjectId;
  roomId: Types.ObjectId;
  teamId: Types.ObjectId;
  amount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A connected phone's role within its team. A team roster can list 10 member
 * names while only 2-3 phones actually connect — roles belong to the
 * *connected devices* (Participants), not the roster:
 * - CAPTAIN 👑 — the team controller: uses/buys power cards, bids in auctions.
 * - VICE_CAPTAIN ⭐ — backup controller; acts as captain while the captain is
 *   disconnected (or when the host promotes them).
 * - MEMBER 👤 — view-only companion screen (question, score, leaderboard).
 * The first phone to join a team becomes CAPTAIN, the second VICE_CAPTAIN,
 * the rest MEMBER. The host can reassign roles at any time.
 */
export const PARTICIPANT_ROLES = ["CAPTAIN", "VICE_CAPTAIN", "MEMBER"] as const;
export type ParticipantRole = (typeof PARTICIPANT_ROLES)[number];

export interface IParticipant {
  _id: Types.ObjectId;
  name: string;
  teamId: Types.ObjectId;
  roomId: Types.ObjectId;
  role: ParticipantRole;
  /** Heartbeat — bumped by every live poll; "connected" = seen in the last ~15s. */
  lastSeenAt: Date;
  joinedAt: Date;
}

/** A reusable round in the host's library — not tied to any one room. */
export interface IRound {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  title: string;
  description?: string;
  rules?: string;
  category: RoundCategory;
  roundType: RoundType;
  /** Optional live special mode (Speed/Risk/Survival/Bonus). */
  specialMode: SpecialRoundMode;
  /** Ordered library Questions attached to this round. */
  questions: Types.ObjectId[];
  scoringMode: RuleOverrideMode;
  defaultTimer: number;
  positiveMarks: number;
  negativeMarks: number;
  bonusMarks: number;
  coinReward: number;
  questionAssignment: QuestionAssignmentMode;
  powerCardMode: PowerCardOverrideMode;
  allowedPowerCards: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IScene {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  roundId?: Types.ObjectId | null;
  type: SceneType;
  order: number;
  title: string;
  isActive: boolean;
  status: SceneStatus;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  questionId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

export const DRAWING_STROKE_KINDS = ["STROKE", "CLEAR"] as const;
export type DrawingStrokeKind = (typeof DRAWING_STROKE_KINDS)[number];

/**
 * One append-only mark on a DRAWING scene's shared board. Coordinates are
 * normalized 0..1 (a flat [x0,y0,x1,y1,…] array) so the same stroke renders
 * correctly on any screen size. A `CLEAR` row is a wipe marker: on replay the
 * canvas resets and only strokes with a higher `seq` are drawn. Scoped to a
 * question so a new drawing question always starts on a blank board.
 */
export interface IDrawingStroke {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  questionId: Types.ObjectId;
  seq: number;
  kind: DrawingStrokeKind;
  color: string;
  width: number;
  /** True for eraser strokes (rendered as destination-out). */
  erase: boolean;
  /** Flat, normalized: [x0, y0, x1, y1, …]. Empty for CLEAR rows. */
  points: number[];
  createdAt: Date;
}

/** A reusable question in the host's library — not tied to any one round. */
export interface IQuestion {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  type: QuestionType;
  question: string;
  mediaUrl?: string;
  media?: QuestionMedia | null;
  /** Opt-in multiple-choice: when true, the assigned captain taps an option and
   *  submitMcqAnswer auto-scores it against `answer` (the one auto-graded flow);
   *  the host's manual marking is hidden for these. False = host-judged like every
   *  other question type. */
  isMCQ: boolean;
  options: string[];
  answer: string;
  explanation?: string;
  hints: QuestionHint[];
  hostNotes?: string;
  scoringMode: RuleOverrideMode;
  /** INHERIT = use whichever round's defaultTimer this question is placed under; CUSTOM = always use `timer`. */
  timerMode: RuleOverrideMode;
  timer: number;
  positiveMarks: number;
  negativeMarks: number;
  bonusMarks: number;
  coinReward: number;
  difficulty: QuestionDifficulty;
  tags: string[];
  /** Library organization only — groups this question under a named folder
   *  (e.g. "Aadinath") in the Question Bank's group view. Null/empty = the
   *  implicit "General" bucket. Purely organizational, like `tags`; never
   *  changes gameplay or scoring. */
  groupName: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Catalog definition of a Power Card — the unified engine's core entity. Global per host (owner), shared across all of that host's competitions and rooms. */
export interface IPowerCard {
  _id: Types.ObjectId;
  ownerId: Types.ObjectId;
  name: string;
  description: string;
  icon: string;
  category: PowerCardCategory;
  rarity: PowerCardRarity;
  effectType: PowerCardEffectType;
  price: number;
  /** null = unlimited stock. */
  stock: number | null;
  enabled: boolean;
  requiresApproval: boolean;
  usesPerTeam: number;
  priceMode: PriceMode;
  createdAt: Date;
  updatedAt: Date;
}

/** A team's owned copies of a power card, tracking remaining uses. */
export interface ITeamPowerCard {
  _id: Types.ObjectId;
  teamId: Types.ObjectId;
  powerCardId: Types.ObjectId;
  remainingUses: number;
  status: PowerCardStatus;
  createdAt: Date;
  updatedAt: Date;
}

/** Drives the live approval flow: REQUESTED → APPROVED/REJECTED → ACTIVE → CONSUMED. */
export interface IPowerCardRequest {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  teamId: Types.ObjectId;
  powerCardId: Types.ObjectId;
  targetTeamId?: Types.ObjectId | null;
  status: PowerCardRequestStatus;
  approvedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Append-only coin ledger — mirrors ScoreTransaction. A team's coin balance
 * is never mutated in isolation; it is always the running total of these.
 */
export interface ICoinTransaction {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  teamId: Types.ObjectId;
  amount: number;
  type: CoinTransactionType;
  reason?: string;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
}

export interface IScoreTransaction {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  teamId: Types.ObjectId;
  participantId?: Types.ObjectId | null;
  questionId?: Types.ObjectId | null;
  points: number;
  reason: ScoreReason;
  isUndo: boolean;
  isReverted: boolean;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
}

export interface IEventLog {
  _id: Types.ObjectId;
  roomId: Types.ObjectId;
  type: EventLogType;
  metadata: Record<string, unknown>;
  createdAt: Date;
}
