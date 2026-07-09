/**
 * Fast DB-level setup for Phases 10+ live-event tests. Mirrors exactly what
 * Phases 0-9 already proved works correctly via real UI automation (login,
 * competition/room creation, questions, round, teams, event flow generation,
 * start event) — reproduced here as direct writes so each remaining phase
 * group doesn't have to replay that whole UI chain (and its memory cost)
 * every run. The *live interactions themselves* (join, scene stepping, hint
 * requests, power card use, scoring, etc.) are still driven for real through
 * the browser — only the "getting to a live WELCOME scene" scaffolding is
 * fast-forwarded.
 */
import fs from "node:fs";
import mongoose from "mongoose";

export const QA_EMAIL = "qa.playwright@encore.local";
export const QA_PASSWORD = "QaPlaywright@123";

export const DEFAULT_POWER_CARDS = [
  { name: "Hint", description: "Reveal a clue", category: "HELP", rarity: "COMMON", effectType: "HINT", price: 1000, icon: "💡" },
  { name: "Extra Time", description: "Add time to the clock", category: "HELP", rarity: "COMMON", effectType: "EXTRA_TIME", price: 1200, icon: "⏱" },
  { name: "Double Guess", description: "Get a second attempt", category: "HELP", rarity: "RARE", effectType: "SECOND_CHANCE", price: 1800, icon: "🎯" },
  { name: "Shield", description: "Protect from one wrong answer", category: "DEFENSE", rarity: "RARE", effectType: "BLOCK_NEGATIVE", price: 1500, icon: "🛡" },
  { name: "Double Points", description: "Double the score reward", category: "BOOST", rarity: "EPIC", effectType: "DOUBLE_SCORE", price: 2000, icon: "🔥" },
  { name: "Mystery Box", description: "Random reward", category: "RISK", rarity: "RARE", effectType: "MYSTERY", price: 900, icon: "🎁" },
  { name: "Freeze", description: "Slow or block an opponent", category: "ATTACK", rarity: "EPIC", effectType: "FREEZE", price: 1600, icon: "❄" },
  { name: "Steal Chance", description: "Take an opponent's opportunity", category: "ATTACK", rarity: "LEGENDARY", effectType: "STEAL", price: 2500, icon: "🥷" },
];

export interface SeededLiveEvent {
  ownerId: mongoose.Types.ObjectId;
  competitionId: mongoose.Types.ObjectId;
  roomId: mongoose.Types.ObjectId;
  roomCode: string;
  teamAId: mongoose.Types.ObjectId;
  teamBId: mongoose.Types.ObjectId;
  round1Id: mongoose.Types.ObjectId;
  q1Id: mongoose.Types.ObjectId; // MCQ
  q2Id: mongoose.Types.ObjectId; // second question (future, must stay hidden until host advances)
  powerCardIds: Record<string, mongoose.Types.ObjectId>; // name -> id
  sceneIds: { welcome: string; roundIntro: string; q1: string; a1: string; q2: string; a2: string; leaderboard: string; winner: string };
}

function roomCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function seedLiveEvent(): Promise<SeededLiveEvent> {
  const env = fs.readFileSync(".env.local", "utf8");
  const uri = env.match(/MONGODB_URI="?([^"\n]+)"?/)?.[1];
  if (!uri) throw new Error("MONGODB_URI missing");
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15_000 });
  }
  const db = mongoose.connection.db!;
  const { ObjectId } = mongoose.Types;
  const now = () => new Date();

  const owner = await db.collection("users").findOne({ email: QA_EMAIL });
  if (!owner) throw new Error("QA user not found — run the main lifecycle seed/login once first.");
  const ownerId = owner._id;

  // Clean slate for this owner, same scope as resetQaData().
  const oldCompetitions = await db.collection("competitions").find({ ownerId }).project({ _id: 1 }).toArray();
  const oldCompetitionIds = oldCompetitions.map((c) => c._id);
  const oldRooms = await db.collection("rooms").find({ competitionId: { $in: oldCompetitionIds } }).project({ _id: 1 }).toArray();
  const oldRoomIds = oldRooms.map((r) => r._id);
  const oldTeams = await db.collection("teams").find({ roomId: { $in: oldRoomIds } }).project({ _id: 1 }).toArray();
  const oldTeamIds = oldTeams.map((t) => t._id);
  await Promise.all([
    db.collection("scenes").deleteMany({ roomId: { $in: oldRoomIds } }),
    db.collection("participants").deleteMany({ roomId: { $in: oldRoomIds } }),
    db.collection("teampowercards").deleteMany({ teamId: { $in: oldTeamIds } }),
    db.collection("powercardrequests").deleteMany({ roomId: { $in: oldRoomIds } }),
    db.collection("cointransactions").deleteMany({ roomId: { $in: oldRoomIds } }),
    db.collection("scoretransactions").deleteMany({ roomId: { $in: oldRoomIds } }),
    db.collection("eventlogs").deleteMany({ roomId: { $in: oldRoomIds } }),
    db.collection("auctions").deleteMany({ roomId: { $in: oldRoomIds } }),
    db.collection("auctionbids").deleteMany({ roomId: { $in: oldRoomIds } }),
    db.collection("teams").deleteMany({ roomId: { $in: oldRoomIds } }),
    db.collection("rooms").deleteMany({ competitionId: { $in: oldCompetitionIds } }),
    db.collection("competitions").deleteMany({ ownerId }),
    db.collection("questions").deleteMany({ ownerId }),
    db.collection("rounds").deleteMany({ ownerId }),
    db.collection("powercards").deleteMany({ ownerId }),
  ]);

  // Power card catalog.
  const powerCardIds: Record<string, mongoose.Types.ObjectId> = {};
  const cardDocs = DEFAULT_POWER_CARDS.map((c) => {
    const _id = new ObjectId();
    powerCardIds[c.name] = _id;
    return {
      _id, ownerId, name: c.name, description: c.description, icon: c.icon,
      category: c.category, rarity: c.rarity, effectType: c.effectType, price: c.price,
      stock: null, enabled: true, requiresApproval: true, usesPerTeam: 3, priceMode: "FIXED",
      createdAt: now(), updatedAt: now(),
    };
  });
  await db.collection("powercards").insertMany(cardDocs);

  // Questions: Q1 MCQ (current), Q2 text (future — must stay hidden).
  const q1Id = new ObjectId();
  const q2Id = new ObjectId();
  await db.collection("questions").insertMany([
    {
      _id: q1Id, ownerId, type: "TEXT", question: "Live Test Question One — MCQ?",
      isMCQ: true, options: ["Option A", "Option B", "Option C", "Option D"], answer: "Option A",
      hints: [{ text: "First hint", penalty: 5 }, { text: "Second hint", penalty: 10 }],
      hostNotes: "SECRET HOST NOTE — must never reach participant.", explanation: undefined,
      scoringMode: "CUSTOM", timerMode: "CUSTOM", timer: 30, positiveMarks: 10, negativeMarks: 5,
      bonusMarks: 0, coinReward: 0, difficulty: "MEDIUM", tags: [], createdAt: now(), updatedAt: now(),
    },
    {
      _id: q2Id, ownerId, type: "TEXT", question: "FUTURE Question Two — must stay hidden until revealed",
      isMCQ: false, options: [], answer: "Future answer", hints: [{ text: "Future hint", penalty: 5 }],
      hostNotes: undefined, explanation: undefined,
      scoringMode: "CUSTOM", timerMode: "CUSTOM", timer: 30, positiveMarks: 10, negativeMarks: 5,
      bonusMarks: 0, coinReward: 0, difficulty: "MEDIUM", tags: [], createdAt: now(), updatedAt: now(),
    },
  ]);

  // Round with both questions, all power cards allowed (DEFAULT mode = no restriction).
  const round1Id = new ObjectId();
  await db.collection("rounds").insertOne({
    _id: round1Id, ownerId, title: "Live Round 1", description: "", rules: "",
    category: "Custom", roundType: "QUESTION_ANSWER", specialMode: "NONE",
    questions: [q1Id, q2Id], scoringMode: "CUSTOM", defaultTimer: 30,
    positiveMarks: 10, negativeMarks: 5, bonusMarks: 0, coinReward: 0,
    questionAssignment: "DEFAULT", powerCardMode: "DEFAULT", allowedPowerCards: [],
    createdAt: now(), updatedAt: now(),
  });

  // Competition — Economy mode, matching CreateCompetitionButton's ADVANCED defaults.
  const competitionId = new ObjectId();
  await db.collection("competitions").insertOne({
    _id: competitionId, title: "Live Event Test", description: "", language: "English", theme: "#6C7BFA",
    status: "LIVE", ownerId,
    settings: {
      mode: "ADVANCED",
      room: { name: "Main Room", joinMethod: "BOTH", participantJoining: "ANYONE" },
      permissions: { viewLeaderboard: true, viewTeamScore: true, viewPowerCards: true },
      scoring: { defaultCorrect: 10, defaultWrong: -5, defaultTimer: 30, defaultCoinReward: 100, defaultPowerCardApprovalRequired: true, allowNegative: true, allowBonus: true, manualScoring: true, questionAssignment: "ANY_TEAM" },
      turnRules: { enableTeamTurns: false, allowStealing: false, allowChallenges: false },
      economy: { enabled: true, startingCoins: 5000, correctAnswerCoins: 100, fastAnswerBonusCoins: 25, roundWinnerCoins: 250, storeAvailability: "BETWEEN_ROUNDS" },
      setupDraft: { teams: [], rounds: [] },
    },
    createdAt: now(), updatedAt: now(),
  });

  // Room.
  const roomId = new ObjectId();
  let code = roomCode();
  while (await db.collection("rooms").findOne({ roomCode: code })) code = roomCode();
  await db.collection("rooms").insertOne({
    _id: roomId, competitionId, name: "Main Room", roomCode: code, status: "LIVE",
    settings: { joinMethod: "BOTH", permissions: { viewLeaderboard: true, viewTeamScore: true, buyPowers: true, requestLifelines: true } },
    selectedRounds: [round1Id], powerCardOverrides: [],
    currentSceneId: null, currentRoundId: null, currentQuestionId: null,
    liveState: { timerStartedAt: null, timerEndsAt: null, timerPaused: false, showAnswer: false, storeStatus: "CLOSED", flashSaleActive: false, flashSalePercent: 0, flashSaleEndsAt: null },
    onlineDevices: 0, createdAt: now(), updatedAt: now(),
  });

  // Teams — with starting coins already granted (as startRoomEvent would do).
  const teamAId = new ObjectId();
  const teamBId = new ObjectId();
  await db.collection("teams").insertMany([
    { _id: teamAId, roomId, name: "Team A", color: "#F5A93D", members: [{ name: "Amit" }, { name: "Jay" }], score: 0, rank: 1, coins: 5000, previousRank: 1, stats: { correctAnswers: 0, wrongAnswers: 0, bonusPoints: 0, streak: 0, bestStreak: 0 }, createdAt: now(), updatedAt: now() },
    { _id: teamBId, roomId, name: "Team B", color: "#5EC9E8", members: [{ name: "Rahul" }, { name: "Meet" }], score: 0, rank: 2, coins: 5000, previousRank: 2, stats: { correctAnswers: 0, wrongAnswers: 0, bonusPoints: 0, streak: 0, bestStreak: 0 }, createdAt: now(), updatedAt: now() },
  ]);
  await db.collection("cointransactions").insertMany([
    { roomId, teamId: teamAId, amount: 5000, type: "STARTING_BONUS", reason: "Starting balance", createdBy: null, createdAt: now() },
    { roomId, teamId: teamBId, amount: 5000, type: "STARTING_BONUS", reason: "Starting balance", createdBy: null, createdAt: now() },
  ]);

  // Scenes — same canonical sequence generateScenes() produces.
  let order = 0;
  const sceneDoc = (type: string, title: string, extra: Record<string, unknown> = {}) => ({
    _id: new ObjectId(), roomId, type, title, roundId: null, questionId: null,
    order: order++, status: "UPCOMING", isActive: false, content: {}, settings: {},
    createdAt: now(), updatedAt: now(), ...extra,
  });
  const welcome = sceneDoc("WELCOME", "Welcome", { content: { headline: "Welcome" } });
  const roundIntro = sceneDoc("ROUND_INTRO", "Live Round 1 Intro", { roundId: round1Id, content: { title: "Live Round 1" } });
  const q1Scene = sceneDoc("QUESTION", "Live Test Question One — MCQ?", { roundId: round1Id, questionId: q1Id, settings: { timer: 30, showTimer: true } });
  const a1Scene = sceneDoc("ANSWER_REVEAL", "Answer - Live Test Question One — MCQ?", { roundId: round1Id, questionId: q1Id, content: { answer: "Option A" } });
  const q2Scene = sceneDoc("QUESTION", "FUTURE Question Two — must stay hidden until revealed", { roundId: round1Id, questionId: q2Id, settings: { timer: 30, showTimer: true } });
  const a2Scene = sceneDoc("ANSWER_REVEAL", "Answer - FUTURE Question Two", { roundId: round1Id, questionId: q2Id, content: { answer: "Future answer" } });
  const leaderboard = sceneDoc("LEADERBOARD", "Live Round 1 Leaderboard", { roundId: round1Id, settings: { mode: "TOP_3", animation: true } });
  const winner = sceneDoc("WINNER", "Winner");
  const scenes = [welcome, roundIntro, q1Scene, a1Scene, q2Scene, a2Scene, leaderboard, winner];
  await db.collection("scenes").insertMany(scenes);

  // Publish the WELCOME scene (mirrors startEvent()).
  welcome.status = "LIVE";
  welcome.isActive = true;
  await db.collection("scenes").updateOne({ _id: welcome._id }, { $set: { status: "LIVE", isActive: true } });
  await db.collection("rooms").updateOne(
    { _id: roomId },
    { $set: { currentSceneId: welcome._id, currentRoundId: null, currentQuestionId: null, "liveState.showAnswer": false } }
  );

  return {
    ownerId, competitionId, roomId, roomCode: code, teamAId, teamBId, round1Id, q1Id, q2Id, powerCardIds,
    sceneIds: {
      welcome: welcome._id.toString(), roundIntro: roundIntro._id.toString(),
      q1: q1Scene._id.toString(), a1: a1Scene._id.toString(),
      q2: q2Scene._id.toString(), a2: a2Scene._id.toString(),
      leaderboard: leaderboard._id.toString(), winner: winner._id.toString(),
    },
  };
}
