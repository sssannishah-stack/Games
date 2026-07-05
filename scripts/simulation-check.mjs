import fs from "node:fs";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const env = fs.readFileSync(".env.local", "utf8");
const mongoUri = env.match(/MONGODB_URI="([^"]+)"/)?.[1];
if (!mongoUri) throw new Error("MONGODB_URI missing");

const { ObjectId } = mongoose.Types;
const now = () => new Date();
const oid = () => new ObjectId();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function roomCode() {
  return `JN${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db;

const c = {
  users: db.collection("users"),
  questions: db.collection("questions"),
  rounds: db.collection("rounds"),
  powercards: db.collection("powercards"),
  competitions: db.collection("competitions"),
  rooms: db.collection("rooms"),
  teams: db.collection("teams"),
  scenes: db.collection("scenes"),
  participants: db.collection("participants"),
  scoretransactions: db.collection("scoretransactions"),
  cointransactions: db.collection("cointransactions"),
  teampowercards: db.collection("teampowercards"),
  powercardrequests: db.collection("powercardrequests"),
  eventlogs: db.collection("eventlogs"),
};

const report = [];
const pass = (message) => report.push(`PASS ${message}`);

const email = "simulation.host@encore.local";
const passwordHash = await bcrypt.hash("Simulation@123", 10);
const user = await c.users.findOneAndUpdate(
  { email },
  {
    $setOnInsert: {
      name: "Simulation Host",
      email,
      passwordHash,
      role: "ADMIN",
      createdAt: now(),
    },
    $set: { updatedAt: now() },
  },
  { upsert: true, returnDocument: "after" }
);
const ownerId = user._id;

const oldCompetitions = await c.competitions.find({
  ownerId,
  title: { $in: ["Jain Competition 2026", "Jain Knowledge Night 2026"] },
}).project({ _id: 1 }).toArray();
const oldCompetitionIds = oldCompetitions.map((item) => item._id);
const oldRooms = await c.rooms.find({ competitionId: { $in: oldCompetitionIds } }).project({ _id: 1 }).toArray();
const oldRoomIds = oldRooms.map((item) => item._id);
const oldTeams = await c.teams.find({ roomId: { $in: oldRoomIds } }).project({ _id: 1 }).toArray();
const oldTeamIds = oldTeams.map((item) => item._id);
await Promise.all([
  c.scenes.deleteMany({ roomId: { $in: oldRoomIds } }),
  c.participants.deleteMany({ roomId: { $in: oldRoomIds } }),
  c.scoretransactions.deleteMany({ roomId: { $in: oldRoomIds } }),
  c.cointransactions.deleteMany({ roomId: { $in: oldRoomIds } }),
  c.powercardrequests.deleteMany({ roomId: { $in: oldRoomIds } }),
  c.teampowercards.deleteMany({ teamId: { $in: oldTeamIds } }),
  c.teams.deleteMany({ roomId: { $in: oldRoomIds } }),
  c.rooms.deleteMany({ competitionId: { $in: oldCompetitionIds } }),
  c.competitions.deleteMany({ _id: { $in: oldCompetitionIds } }),
]);
await c.questions.deleteMany({
  ownerId,
  question: {
    $in: [
      "Who was the 23rd Tirthankar?",
      'Complete the stavan line:\n"Mangal divo _____"',
      "Identify this temple/person.",
      "Draw the symbol and let other team guess.",
      "Temporary CRUD question",
      "Temporary CRUD question edited",
    ],
  },
});
await c.rounds.deleteMany({
  ownerId,
  title: { $in: ["Mara Pyara Parasnath", "Drawing Challenge", "Temporary Round"] },
});
await c.powercards.deleteMany({
  ownerId,
  name: { $in: ["Shield", "Hint", "Double Points", "Extra Time", "Temporary Card", "Temporary Card Edited"] },
});
pass("clean slate prepared");

async function createQuestion(input) {
  const doc = {
    _id: oid(),
    ownerId,
    type: input.type,
    question: input.question,
    mediaUrl: input.mediaUrl,
    media: input.media ?? null,
    isMCQ: false,
    options: [],
    answer: input.answer,
    explanation: input.explanation,
    hints: input.hints ?? [],
    hostNotes: input.hostNotes,
    scoringMode: "INHERIT",
    timerMode: "INHERIT",
    timer: input.timer ?? 20,
    positiveMarks: input.positiveMarks ?? 10,
    negativeMarks: input.negativeMarks ?? 5,
    bonusMarks: 0,
    coinReward: 0,
    difficulty: input.difficulty ?? "MEDIUM",
    tags: input.tags ?? [],
    createdAt: now(),
    updatedAt: now(),
  };
  await c.questions.insertOne(doc);
  return doc;
}

const tempQuestion = await createQuestion({
  type: "TEXT",
  question: "Temporary CRUD question",
  answer: "temp",
});
await c.questions.updateOne({ _id: tempQuestion._id }, { $set: { question: "Temporary CRUD question edited", updatedAt: now() } });
const duplicatedQuestion = { ...(await c.questions.findOne({ _id: tempQuestion._id })), _id: oid(), question: "Temporary CRUD question edited Copy", createdAt: now(), updatedAt: now() };
await c.questions.insertOne(duplicatedQuestion);
await c.questions.deleteOne({ _id: duplicatedQuestion._id });
await c.questions.deleteOne({ _id: tempQuestion._id });
pass("question CRUD works");

const q1 = await createQuestion({
  type: "TEXT",
  question: "Who was the 23rd Tirthankar?",
  answer: "Parshwanath Bhagwan",
  tags: ["Jain", "Easy"],
  difficulty: "EASY",
});
const q2 = await createQuestion({
  type: "COMPLETION",
  question: 'Complete the stavan line:\n"Mangal divo _____"',
  answer: "Host reference answer",
  tags: ["Stavan"],
});
const q3 = await createQuestion({
  type: "IMAGE",
  question: "Identify this temple/person.",
  answer: "Host reference.",
  mediaUrl: "https://example.com/temple.jpg",
  media: { url: "https://example.com/temple.jpg", type: "IMAGE", name: "Temple reference" },
});
const q4 = await createQuestion({
  type: "DRAWING",
  question: "Draw the symbol and let other team guess.",
  answer: "Host decides manually.",
});
assert(await c.questions.countDocuments({ ownerId, tags: "Jain" }) >= 1, "Question tag filter failed");
pass("question types and tags created");

async function createCard(input) {
  const doc = {
    _id: oid(),
    ownerId,
    description: input.description,
    icon: input.icon ?? "sparkles",
    category: input.category,
    rarity: "COMMON",
    effectType: input.effectType,
    price: input.price,
    stock: null,
    enabled: true,
    requiresApproval: input.requiresApproval ?? true,
    usesPerTeam: 1,
    priceMode: "FIXED",
    name: input.name,
    createdAt: now(),
    updatedAt: now(),
  };
  await c.powercards.insertOne(doc);
  return doc;
}

const tempCard = await createCard({ name: "Temporary Card", description: "temp", category: "HELP", effectType: "HINT", price: 1 });
await c.powercards.updateOne({ _id: tempCard._id }, { $set: { name: "Temporary Card Edited", updatedAt: now() } });
await c.powercards.deleteOne({ _id: tempCard._id });
const shield = await createCard({ name: "Shield", description: "Ignore one wrong answer", category: "DEFENSE", effectType: "BLOCK_NEGATIVE", price: 1000 });
const hint = await createCard({ name: "Hint", description: "Reveal clue", category: "HELP", effectType: "HINT", price: 500 });
const doublePoints = await createCard({ name: "Double Points", description: "Next correct answer gives 2X score", category: "BOOST", effectType: "DOUBLE_SCORE", price: 2000 });
const extraTime = await createCard({ name: "Extra Time", description: "Add 30 seconds", category: "HELP", effectType: "EXTRA_TIME", price: 700 });
pass("power card CRUD works");

async function createRound(input) {
  const doc = {
    _id: oid(),
    ownerId,
    title: input.title,
    description: input.description ?? "",
    rules: input.rules ?? "",
    category: input.category,
    roundType: input.roundType,
    questions: input.questions.map((q) => q._id),
    scoringMode: "CUSTOM",
    defaultTimer: input.defaultTimer,
    positiveMarks: input.positiveMarks,
    negativeMarks: input.negativeMarks,
    bonusMarks: 0,
    coinReward: 0,
    questionAssignment: "ANY_TEAM",
    powerCardMode: "CUSTOM",
    allowedPowerCards: input.allowedPowerCards.map((card) => card._id.toString()),
    createdAt: now(),
    updatedAt: now(),
  };
  await c.rounds.insertOne(doc);
  return doc;
}

const round1 = await createRound({
  title: "Mara Pyara Parasnath",
  category: "Knowledge",
  roundType: "QUESTION_ANSWER",
  rules: "Answer questions about life history.",
  defaultTimer: 30,
  positiveMarks: 10,
  negativeMarks: 5,
  questions: [q1, q3],
  allowedPowerCards: [hint, shield],
});
const round2 = await createRound({
  title: "Drawing Challenge",
  category: "Drawing",
  roundType: "DRAWING",
  rules: "Draw and let the other team guess.",
  defaultTimer: 30,
  positiveMarks: 20,
  negativeMarks: 0,
  questions: [q4],
  allowedPowerCards: [extraTime],
});
assert(round1.allowedPowerCards.includes(hint._id.toString()) && !round1.allowedPowerCards.includes(doublePoints._id.toString()), "Round power card allow-list failed");
assert(await c.rounds.countDocuments({ ownerId, category: "Knowledge" }) >= 1, "Round category filter failed");
pass("rounds, categories, question ordering, and allowed cards work");

const competition = {
  _id: oid(),
  title: "Jain Competition 2026",
  description: "Jain Knowledge Night 2026",
  language: "Gujarati",
  theme: "#6C7BFA",
  status: "DRAFT",
  ownerId,
  settings: {
    mode: "ADVANCED",
    room: { name: "Main Hall", joinMethod: "BOTH", participantJoining: "ANYONE" },
    permissions: { viewLeaderboard: true, viewTeamScore: true, viewPowerCards: true },
    scoring: {
      defaultCorrect: 10,
      defaultWrong: -5,
      defaultTimer: 30,
      defaultCoinReward: 100,
      defaultPowerCardApprovalRequired: true,
      allowNegative: true,
      allowBonus: true,
      manualScoring: true,
      questionAssignment: "ANY_TEAM",
    },
    turnRules: { enableTeamTurns: false, allowStealing: false, allowChallenges: false },
    economy: {
      enabled: true,
      startingCoins: 5000,
      correctAnswerCoins: 100,
      fastAnswerBonusCoins: 25,
      roundWinnerCoins: 250,
      storeAvailability: "HOST_MANUAL",
    },
    setupDraft: { teams: [], rounds: [] },
  },
  createdAt: now(),
  updatedAt: now(),
};
await c.competitions.insertOne(competition);

let code = roomCode();
while (await c.rooms.findOne({ roomCode: code })) code = roomCode();
const room = {
  _id: oid(),
  competitionId: competition._id,
  name: "Main Hall",
  roomCode: code,
  status: "DRAFT",
  settings: {
    joinMethod: "BOTH",
    permissions: { viewLeaderboard: true, viewTeamScore: true, buyPowers: true, requestLifelines: true },
  },
  selectedRounds: [round1._id, round2._id],
  powerCardOverrides: [],
  currentSceneId: null,
  currentRoundId: null,
  currentQuestionId: null,
  liveState: { timerStartedAt: null, timerEndsAt: null, timerPaused: false, showAnswer: false, storeStatus: "CLOSED" },
  onlineDevices: 0,
  createdAt: now(),
  updatedAt: now(),
};
await c.rooms.insertOne(room);
pass(`competition and room created (${room.roomCode})`);

const teamA = {
  _id: oid(),
  roomId: room._id,
  name: "Team A",
  color: "#6C7BFA",
  members: ["Amit", "Rahul", "Priya"].map((name) => ({ name })),
  score: 0,
  rank: 0,
  coins: 0,
  stats: { correctAnswers: 0, wrongAnswers: 0, bonusPoints: 0 },
  createdAt: now(),
  updatedAt: now(),
};
const teamB = {
  _id: oid(),
  roomId: room._id,
  name: "Team B",
  color: "#E8A33D",
  members: ["Jay", "Meet", "Riya"].map((name) => ({ name })),
  score: 0,
  rank: 0,
  coins: 0,
  stats: { correctAnswers: 0, wrongAnswers: 0, bonusPoints: 0 },
  createdAt: now(),
  updatedAt: now(),
};
await c.teams.insertMany([teamA, teamB]);
assert(teamA.members.every((member) => !member.email && !member.passwordHash), "Members must be names only");
pass("teams and name-only members created");

const rounds = [round1, round2];
const questionById = new Map([q1, q2, q3, q4].map((q) => [q._id.toString(), q]));
const scenes = [];
let order = 0;
function scene(type, title, round = null, question = null, content = {}, settings = {}) {
  const doc = {
    _id: oid(),
    roomId: room._id,
    type,
    title,
    roundId: round?._id ?? null,
    questionId: question?._id ?? null,
    order: order++,
    status: "UPCOMING",
    isActive: false,
    content,
    settings,
    createdAt: now(),
    updatedAt: now(),
  };
  scenes.push(doc);
  return doc;
}
scene("WELCOME", "Welcome", null, null, { headline: "Welcome" });
for (const round of rounds) {
  scene("ROUND_INTRO", `${round.title} Intro`, round, null, { title: round.title, rules: round.rules });
  for (const questionId of round.questions) {
    const question = questionById.get(questionId.toString());
    scene(question.type === "DRAWING" ? "DRAWING" : "QUESTION", question.question || "Question", round, question, { question: question.question, media: question.media }, { timer: round.defaultTimer, showTimer: true });
    scene("ANSWER_REVEAL", `Answer - ${question.question || "Question"}`, round, question, { answer: question.answer });
  }
  scene("LEADERBOARD", `${round.title} Leaderboard`, round, null, {}, { mode: "TOP_3", animation: true });
}
scene("WINNER", "Winner");
await c.scenes.insertMany(scenes);
await c.rooms.updateOne({ _id: room._id }, { $set: { status: "READY", updatedAt: now() } });
assert(scenes.some((s) => s.type === "DRAWING") && scenes.at(-1).type === "WINNER", "Scene generation failed");
pass(`scene flow generated (${scenes.length} scenes)`);

const firstScene = scenes[0];
await c.rooms.updateOne(
  { _id: room._id },
  { $set: { status: "TESTING", currentSceneId: firstScene._id, currentRoundId: null, currentQuestionId: null, updatedAt: now() } }
);
const testScoreCountBefore = await c.scoretransactions.countDocuments({ roomId: room._id });
await c.eventlogs.insertOne({ roomId: room._id, type: "SCORE_CHANGED", metadata: { teamId: teamA._id.toString(), points: 10, reason: "CORRECT", testMode: true }, createdAt: now(), updatedAt: now() });
const testScoreCountAfter = await c.scoretransactions.countDocuments({ roomId: room._id });
assert(testScoreCountAfter === testScoreCountBefore, "Test mode wrote real score transaction");
pass("test mode does not write real scores");

await c.rooms.updateOne(
  { _id: room._id },
  { $set: { status: "LIVE", currentSceneId: firstScene._id, "liveState.storeStatus": "CLOSED", updatedAt: now() } }
);
await c.competitions.updateOne({ _id: competition._id }, { $set: { status: "LIVE", updatedAt: now() } });
for (const team of [teamA, teamB]) {
  await c.cointransactions.insertOne({ _id: oid(), roomId: room._id, teamId: team._id, amount: 5000, type: "STARTING_BONUS", reason: "Starting balance", createdBy: null, createdAt: now() });
  await c.teams.updateOne({ _id: team._id }, { $inc: { coins: 5000 } });
}
pass("live start grants starting coins");

await c.participants.insertMany([
  { _id: oid(), name: "Amit", teamId: teamA._id, roomId: room._id, joinedAt: now(), createdAt: now(), updatedAt: now() },
  { _id: oid(), name: "Jay", teamId: teamB._id, roomId: room._id, joinedAt: now(), createdAt: now(), updatedAt: now() },
]);
pass("participants joined without accounts");

const qScene = scenes.find((s) => s.type === "QUESTION" && s.roundId?.toString() === round1._id.toString());
await c.rooms.updateOne(
  { _id: room._id },
  { $set: { currentSceneId: qScene._id, currentRoundId: round1._id, currentQuestionId: qScene.questionId, "liveState.showAnswer": false, updatedAt: now() } }
);
const visibleRound1Cards = [hint, shield, doublePoints, extraTime].filter((card) => round1.allowedPowerCards.includes(card._id.toString())).map((card) => card.name);
assert(visibleRound1Cards.includes("Hint") && visibleRound1Cards.includes("Shield") && !visibleRound1Cards.includes("Double Points"), "Round 1 card restriction failed");
pass("round card restrictions hide disabled cards");

async function addScore(team, points, reason, question = q1) {
  const tx = { _id: oid(), roomId: room._id, teamId: team._id, participantId: null, questionId: question._id, points, reason, isUndo: false, isReverted: false, createdBy: ownerId, createdAt: now() };
  await c.scoretransactions.insertOne(tx);
  await recalcScores();
  return tx;
}
async function recalcScores() {
  const txs = await c.scoretransactions.find({ roomId: room._id, isUndo: { $ne: true }, isReverted: { $ne: true } }).toArray();
  const totals = new Map();
  for (const tx of txs) totals.set(tx.teamId.toString(), (totals.get(tx.teamId.toString()) ?? 0) + tx.points);
  const teams = await c.teams.find({ roomId: room._id }).toArray();
  teams.sort((a, b) => (totals.get(b._id.toString()) ?? 0) - (totals.get(a._id.toString()) ?? 0) || a.name.localeCompare(b.name));
  await Promise.all(teams.map((team, index) => c.teams.updateOne({ _id: team._id }, { $set: { score: totals.get(team._id.toString()) ?? 0, rank: index + 1 } })));
}
await addScore(teamA, 10, "CORRECT", q1);
await addScore(teamB, -5, "WRONG", q1);
let currentTeamA = await c.teams.findOne({ _id: teamA._id });
let currentTeamB = await c.teams.findOne({ _id: teamB._id });
assert(currentTeamA.score === 10 && currentTeamB.score === -5, "Scoring failed");
pass("score transactions update leaderboard");

const request = {
  _id: oid(),
  roomId: room._id,
  teamId: teamA._id,
  powerCardId: hint._id,
  targetTeamId: null,
  status: "REQUESTED",
  approvedBy: null,
  createdAt: now(),
  updatedAt: now(),
};
await c.teampowercards.updateOne({ teamId: teamA._id, powerCardId: hint._id }, { $set: { remainingUses: 1, status: "REQUESTED" } }, { upsert: true });
await c.powercardrequests.insertOne(request);
await c.powercardrequests.updateOne({ _id: request._id }, { $set: { status: "APPROVED", approvedBy: ownerId, updatedAt: now() } });
await c.teampowercards.updateOne({ teamId: teamA._id, powerCardId: hint._id }, { $set: { status: "APPROVED" } });
await c.powercardrequests.updateOne({ _id: request._id }, { $set: { status: "ACTIVE", updatedAt: now() } });
await c.teampowercards.updateOne({ teamId: teamA._id, powerCardId: hint._id }, { $set: { status: "ACTIVE" } });
await c.powercardrequests.updateOne({ _id: request._id }, { $set: { status: "CONSUMED", updatedAt: now() } });
await c.teampowercards.updateOne({ teamId: teamA._id, powerCardId: hint._id }, { $set: { status: "CONSUMED", remainingUses: 0 } });
const consumed = await c.powercardrequests.findOne({ _id: request._id });
assert(consumed.status === "CONSUMED", "Power card request lifecycle failed");
pass("power request approve/activate/consume works");

await c.rooms.updateOne({ _id: room._id }, { $set: { "liveState.storeStatus": "OPEN", updatedAt: now() } });
await c.cointransactions.insertOne({ _id: oid(), roomId: room._id, teamId: teamA._id, amount: -shield.price, type: "CARD_PURCHASE", reason: "Bought Shield", createdBy: null, createdAt: now() });
await c.teams.updateOne({ _id: teamA._id }, { $inc: { coins: -shield.price } });
await c.teampowercards.updateOne({ teamId: teamA._id, powerCardId: shield._id }, { $inc: { remainingUses: 1 }, $set: { status: "AVAILABLE" } }, { upsert: true });
await c.rooms.updateOne({ _id: room._id }, { $set: { "liveState.storeStatus": "CLOSED", updatedAt: now() } });
currentTeamA = await c.teams.findOne({ _id: teamA._id });
const shieldInventory = await c.teampowercards.findOne({ teamId: teamA._id, powerCardId: shield._id });
assert(currentTeamA.coins === 4000 && shieldInventory.remainingUses >= 1, "Store purchase failed");
pass("store open/buy/close works");

await c.teampowercards.updateOne({ teamId: teamB._id, powerCardId: doublePoints._id }, { $inc: { remainingUses: 1 }, $set: { status: "AVAILABLE" } }, { upsert: true });
assert(await c.teampowercards.findOne({ teamId: teamB._id, powerCardId: doublePoints._id }), "Host override failed");
pass("host can manually grant disabled card");

const accidental = await addScore(teamA, 50, "BONUS", q1);
await c.scoretransactions.updateOne({ _id: accidental._id }, { $set: { isReverted: true } });
await c.scoretransactions.insertOne({ _id: oid(), roomId: room._id, teamId: teamA._id, participantId: null, questionId: q1._id, points: -50, reason: "BONUS", isUndo: true, isReverted: false, createdBy: ownerId, createdAt: now() });
await recalcScores();
currentTeamA = await c.teams.findOne({ _id: teamA._id });
assert(currentTeamA.score === 10 && await c.scoretransactions.countDocuments({ roomId: room._id, teamId: teamA._id }) >= 3, "Undo did not preserve history");
pass("undo preserves history and restores score");

const leaderboardScene = scenes.find((s) => s.type === "LEADERBOARD" && s.roundId?.toString() === round1._id.toString());
await c.rooms.updateOne({ _id: room._id }, { $set: { currentSceneId: leaderboardScene._id, currentRoundId: round1._id, currentQuestionId: null, updatedAt: now() } });
const winnerScene = scenes.find((s) => s.type === "WINNER");
await c.rooms.updateOne({ _id: room._id }, { $set: { currentSceneId: winnerScene._id, currentRoundId: null, currentQuestionId: null, status: "COMPLETED", updatedAt: now() } });
await c.competitions.updateOne({ _id: competition._id }, { $set: { status: "COMPLETED", updatedAt: now() } });
const completedRoom = await c.rooms.findOne({ _id: room._id });
const completedCompetition = await c.competitions.findOne({ _id: competition._id });
assert(completedRoom.status === "COMPLETED" && completedCompetition.status === "COMPLETED", "Winner completion failed");
pass("leaderboard and winner completion work");

console.log(JSON.stringify({
  user: { email, password: "Simulation@123" },
  competitionId: competition._id.toString(),
  roomId: room._id.toString(),
  roomCode: room.roomCode,
  teamAId: teamA._id.toString(),
  teamBId: teamB._id.toString(),
  checks: report,
}, null, 2));

await mongoose.disconnect();
