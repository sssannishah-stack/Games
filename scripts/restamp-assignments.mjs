/**
 * Re-stamp question->team assignments onto a room's question scenes, matching
 * applyQuestionTeamAssignments / buildQuestionTeamAssignments. Fixes rooms
 * whose flow was generated before a round's Fixed/Random Team order was set.
 * Usage: node scripts/restamp-assignments.mjs <roomId>
 */
import fs from "node:fs";
import mongoose from "mongoose";

const env = fs.readFileSync(".env.local", "utf8");
const uri = env.match(/MONGODB_URI="?([^"\n]+)"?/)[1];
await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db;
const oid = (v) => new mongoose.Types.ObjectId(v);

const ROOM_ID = process.argv[2] || "6a50da80f866720d5bc06c6b";
const room = await db.collection("rooms").findOne({ _id: oid(ROOM_ID) });
const comp = await db.collection("competitions").findOne({ _id: room.competitionId });
const fallback = comp.settings?.scoring?.questionAssignment ?? "ANY_TEAM";

const teams = await db.collection("teams").find({ roomId: room._id }).sort({ createdAt: 1 }).toArray();
const teamIds = teams.map((t) => t._id.toString());

function shuffle(a) { const r=[...a]; for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]];} return r; }

function build(questionIds, mode) {
  if (!questionIds.length || !teamIds.length) return new Map();
  if (mode === "ANY_TEAM" || mode === "HOST_CHOOSES") return new Map();
  const out = new Map();
  if (mode === "FIXED_ORDER") {
    const cycle = Math.floor(questionIds.length / teamIds.length) * teamIds.length;
    questionIds.slice(0, cycle).forEach((q, i) => out.set(q, { teamId: teamIds[i % teamIds.length], source: "FIXED" }));
    const rem = shuffle(teamIds);
    questionIds.slice(cycle).forEach((q, i) => out.set(q, { teamId: rem[i], source: "RANDOM_REMAINDER" }));
    return out;
  }
  // RANDOM_TEAM
  for (let o = 0; o < questionIds.length; o += teamIds.length) {
    const bag = shuffle(teamIds);
    questionIds.slice(o, o + teamIds.length).forEach((q, i) => out.set(q, { teamId: bag[i], source: "RANDOM" }));
  }
  return out;
}

const scenes = await db.collection("scenes").find({ roomId: room._id, questionId: { $ne: null } }).sort({ order: 1 }).toArray();
const roundIds = [...new Set(scenes.flatMap((s) => (s.roundId ? [s.roundId.toString()] : [])))];
const rounds = await db.collection("rounds").find({ _id: { $in: roundIds.map(oid) } }).toArray();
const roundById = new Map(rounds.map((r) => [r._id.toString(), r]));

let stamped = 0, cleared = 0;
for (const rid of roundIds) {
  const round = roundById.get(rid);
  if (!round) continue;
  const configured = round.questionAssignment ?? "DEFAULT";
  const mode = configured === "DEFAULT" ? fallback : configured;
  const map = build((round.questions ?? []).map(String), mode);
  for (const s of scenes.filter((x) => x.roundId?.toString() === rid)) {
    const a = map.get(s.questionId?.toString());
    if (a) {
      await db.collection("scenes").updateOne({ _id: s._id }, {
        $set: { "settings.assignmentMode": mode, "settings.assignedTeamId": a.teamId, "settings.assignmentSource": a.source },
        $unset: { "settings.turnStolen": "", "settings.stolenFromTeamId": "" },
      });
      stamped++;
    } else {
      await db.collection("scenes").updateOne({ _id: s._id }, {
        $set: { "settings.assignmentMode": mode },
        $unset: { "settings.assignedTeamId": "", "settings.assignmentSource": "", "settings.turnStolen": "", "settings.stolenFromTeamId": "" },
      });
      cleared++;
    }
  }
}
console.log(`Teams: ${teams.map((t) => t.name).join(", ")}`);
console.log(`Stamped ${stamped} scenes, cleared ${cleared} (unassigned modes).`);

// Show first few for a sanity check.
const check = await db.collection("scenes").find({ roomId: room._id, type: "QUESTION" }).sort({ order: 1 }).limit(6).toArray();
const nameById = new Map(teams.map((t) => [t._id.toString(), t.name]));
for (const s of check) console.log("  Q order", s.order, "->", nameById.get(s.settings?.assignedTeamId) ?? "(none)");

await mongoose.disconnect();
