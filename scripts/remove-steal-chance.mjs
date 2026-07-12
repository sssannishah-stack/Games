/**
 * Removes the Steal Chance power card (effectType STEAL) from every host's
 * catalog now that the feature is gone from the app, and cleans up every
 * reference to it: team inventory, requests, round allow-lists, room
 * overrides/exclusions/defaults. Also clears leftover turnStolen/
 * stolenFromTeamId/assignmentSource:"STEAL" scene settings (dead fields,
 * harmless but tidied up).
 * Safe to re-run (idempotent) — no-ops once nothing matches.
 */
import fs from "node:fs";
import mongoose from "mongoose";

const DRY = process.argv.includes("--dry");
const env = fs.readFileSync(".env.local", "utf8");
const mongoUri = env.match(/MONGODB_URI="?([^"\n]+)"?/)?.[1];
if (!mongoUri) throw new Error("MONGODB_URI missing");

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db;
const C = {
  powercards: db.collection("powercards"),
  teampowercards: db.collection("teampowercards"),
  powercardrequests: db.collection("powercardrequests"),
  rounds: db.collection("rounds"),
  rooms: db.collection("rooms"),
  scenes: db.collection("scenes"),
};

const stealCards = await C.powercards.find({ effectType: "STEAL" }).toArray();
const stealIds = stealCards.map((c) => c._id);
const stealIdStrs = stealIds.map((id) => id.toString());
console.log(`Found ${stealCards.length} Steal Chance card(s) across all hosts.`);
if (stealCards.length === 0) {
  console.log("Nothing to do.");
  await mongoose.disconnect();
  process.exit(0);
}

const tpcCount = await C.teampowercards.countDocuments({ powerCardId: { $in: stealIds } });
const reqCount = await C.powercardrequests.countDocuments({ powerCardId: { $in: stealIds } });
const roundsWithIt = await C.rounds.countDocuments({ allowedPowerCards: { $in: stealIdStrs } });
const roomsWithOverride = await C.rooms.countDocuments({ powerCardOverrides: { $in: stealIdStrs } });
const roomsWithExclusion = await C.rooms.countDocuments({ powerCardExclusions: { $in: stealIdStrs } });
const roomsWithDefault = await C.rooms.countDocuments({ "powerCardDefaults.powerCardId": { $in: stealIdStrs } });
const scenesWithStolen = await C.scenes.countDocuments({
  $or: [
    { "settings.turnStolen": { $exists: true } },
    { "settings.stolenFromTeamId": { $exists: true } },
    { "settings.assignmentSource": "STEAL" },
  ],
});

console.log(`  TeamPowerCard rows: ${tpcCount}`);
console.log(`  PowerCardRequest rows: ${reqCount}`);
console.log(`  Rounds referencing it: ${roundsWithIt}`);
console.log(`  Rooms with override: ${roomsWithOverride}`);
console.log(`  Rooms with exclusion: ${roomsWithExclusion}`);
console.log(`  Rooms with default: ${roomsWithDefault}`);
console.log(`  Scenes with leftover steal/turn fields: ${scenesWithStolen}`);

if (DRY) {
  console.log("\n[dry] no writes made.");
  await mongoose.disconnect();
  process.exit(0);
}

await C.teampowercards.deleteMany({ powerCardId: { $in: stealIds } });
await C.powercardrequests.deleteMany({ powerCardId: { $in: stealIds } });
await C.rounds.updateMany({}, { $pull: { allowedPowerCards: { $in: stealIdStrs } } });
await C.rooms.updateMany({}, { $pull: { powerCardOverrides: { $in: stealIdStrs }, powerCardExclusions: { $in: stealIdStrs } } });
await C.rooms.updateMany({}, { $pull: { powerCardDefaults: { powerCardId: { $in: stealIdStrs } } } });
await C.scenes.updateMany(
  {},
  { $unset: { "settings.turnStolen": "", "settings.stolenFromTeamId": "" } }
);
await C.scenes.updateMany(
  { "settings.assignmentSource": "STEAL" },
  { $unset: { "settings.assignmentSource": "" } }
);
const res = await C.powercards.deleteMany({ effectType: "STEAL" });
console.log(`\nDeleted ${res.deletedCount} Steal Chance card(s) and all references.`);

await mongoose.disconnect();
console.log("Cleanup complete.");
