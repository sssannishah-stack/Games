/**
 * Imports the 26-question "જૈન ક્વિઝ" (Jain philosophy) MCQ set into the
 * Question Bank as standalone library questions:
 *   - groupName: "Jain Philosophy" (a new group, per request)
 *   - NOT attached to any round
 *   - difficulty: EASY/MEDIUM only, alternating by index (no HARD)
 *   - isMCQ: true, options + per-option optionRationales, answer = the
 *     correct option's text (submitMcqAnswer scores by string equality
 *     against `options`, so this must match exactly)
 *   - hints: the source `hint` field, wrapped as one hint entry
 *   - hostNotes: a marker so re-running is idempotent (deletes+reinserts
 *     its own prior copy only, same pattern as seed-jain-tirthankar.mjs)
 *
 * Defaults to a dry run (prints what would be created, writes nothing).
 * Pass --apply to actually write.
 *
 *   node scripts/import-jain-philosophy.mjs          # dry run
 *   node scripts/import-jain-philosophy.mjs --apply   # writes
 *
 * Owner: OWNER_EMAIL env var, else "admin", else first ADMIN, else first user
 * (same convention as seed-jain-tirthankar.mjs).
 */
import fs from "node:fs";
import mongoose from "mongoose";

const APPLY = process.argv.includes("--apply");
const env = fs.readFileSync(".env.local", "utf8");
const mongoUri = env.match(/MONGODB_URI="?([^"\n]+)"?/)?.[1];
if (!mongoUri) throw new Error("MONGODB_URI missing");

const GROUP_NAME = "Jain Philosophy";
const MARKER = "[import:jain-philosophy-v1]";

const source = JSON.parse(fs.readFileSync("scripts/jain-philosophy-quiz.json", "utf8"));

const { ObjectId } = mongoose.Types;
const now = () => new Date();

const docs = source.questions.map((q, i) => {
  const correct = q.options.find((o) => o.isCorrect);
  if (!correct) throw new Error(`Question ${q.number} has no isCorrect option`);
  return {
    _id: new ObjectId(),
    type: "TEXT",
    question: q.question,
    mediaUrl: undefined,
    media: null,
    isMCQ: true,
    options: q.options.map((o) => o.text),
    optionRationales: q.options.map((o) => o.rationale ?? ""),
    answer: correct.text,
    explanation: undefined,
    hints: q.hint ? [{ text: q.hint, penalty: 0 }] : [],
    hostNotes: MARKER,
    scoringMode: "INHERIT",
    timerMode: "INHERIT",
    timer: 20,
    positiveMarks: 10,
    negativeMarks: 5,
    bonusMarks: 0,
    coinReward: 0,
    difficulty: i % 2 === 0 ? "EASY" : "MEDIUM",
    tags: [],
    groupName: GROUP_NAME,
    createdAt: now(),
    updatedAt: now(),
  };
});

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db;
const Users = db.collection("users");
const Questions = db.collection("questions");

const preferredEmail = process.env.OWNER_EMAIL ?? "admin";
const owner =
  (await Users.findOne({ email: preferredEmail })) ??
  (await Users.findOne({ role: "ADMIN" })) ??
  (await Users.findOne({}));
if (!owner) throw new Error("No user found to own this import. Create an account first.");

console.log(`${APPLY ? "APPLYING" : "DRY RUN"} — owner: ${owner.email} (${owner._id})`);
console.log(`${docs.length} question(s) to import into group "${GROUP_NAME}", no round attachment.\n`);

const easyCount = docs.filter((d) => d.difficulty === "EASY").length;
const mediumCount = docs.filter((d) => d.difficulty === "MEDIUM").length;
console.log(`Difficulty split: ${easyCount} EASY, ${mediumCount} MEDIUM, 0 HARD.\n`);

for (const d of docs) {
  console.log(`Q${source.questions.find((q) => q.question === d.question).number}. [${d.difficulty}] ${d.question}`);
  console.log(`   options: ${d.options.join(" | ")}`);
  console.log(`   answer: ${d.answer}`);
}

if (APPLY) {
  // Idempotent: remove any prior copy of this exact import before re-inserting.
  const del = await Questions.deleteMany({ ownerId: owner._id, hostNotes: MARKER });
  if (del.deletedCount > 0) console.log(`\nRemoved ${del.deletedCount} prior copy/copies of this import.`);
  await Questions.insertMany(docs.map((d) => ({ ...d, ownerId: owner._id })));
  console.log(`\nInserted ${docs.length} questions into group "${GROUP_NAME}".`);
} else {
  console.log("\nDry run complete — re-run with --apply to write these questions.");
}

await mongoose.disconnect();
