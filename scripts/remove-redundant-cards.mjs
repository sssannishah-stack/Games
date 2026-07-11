/**
 * Two changes to the default catalog:
 *   1. Remove Bonus Multiplier (identical to Double Points, both DOUBLE_SCORE)
 *      and repoint every reference to Double Points so no team loses a card.
 *   2. Differentiate the two defensive cards — Shield stays BLOCK_NEGATIVE
 *      (voids a negative on the current question), Insurance becomes the new
 *      INSURANCE effect (no negatives for 3 rounds). Existing Insurance cards
 *      are converted in place.
 * Idempotent; pass --dry to preview.
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
  auctions: db.collection("auctions"),
  rounds: db.collection("rounds"),
  rooms: db.collection("rooms"),
};
const oid = (v) => new mongoose.Types.ObjectId(v);

// remove name -> survivor name (same owner)
const REMOVE = { "Bonus Multiplier": "Double Points" };

const cards = await C.powercards.find({}).toArray();
const byOwnerName = new Map(); // `${owner}::${name}` -> card
for (const c of cards) byOwnerName.set(`${c.ownerId.toString()}::${c.name}`, c);

const remap = new Map(); // removedId -> survivorId
const toDelete = [];
for (const c of cards) {
  const survivorName = REMOVE[c.name];
  if (!survivorName) continue;
  const survivor = byOwnerName.get(`${c.ownerId.toString()}::${survivorName}`);
  if (!survivor) {
    console.warn(`! ${c.name} for owner ${c.ownerId} has no ${survivorName} survivor — skipping (would orphan holders).`);
    continue;
  }
  remap.set(c._id.toString(), survivor._id.toString());
  toDelete.push(c._id);
}
const changed = (idStr) => remap.has(idStr);
console.log(`Cards to remove: ${toDelete.length} (${[...remap.keys()].length} repoint mappings).`);

// TeamPowerCard: repoint + merge (unique index on team+card).
const tpcs = await C.teampowercards.find({ powerCardId: { $in: toDelete } }).toArray();
let tpcRepoint = 0, tpcMerge = 0;
for (const tpc of tpcs) {
  const survivor = remap.get(tpc.powerCardId.toString());
  const existing = await C.teampowercards.findOne({ teamId: tpc.teamId, powerCardId: oid(survivor) });
  if (existing) {
    // Team already holds the survivor — keep the better copy, drop this one.
    tpcMerge++;
    const uses = Math.max(existing.remainingUses ?? 0, tpc.remainingUses ?? 0);
    if (!DRY) {
      await C.teampowercards.updateOne({ _id: existing._id }, { $set: { remainingUses: uses } });
      await C.teampowercards.deleteOne({ _id: tpc._id });
    }
  } else {
    tpcRepoint++;
    if (!DRY) await C.teampowercards.updateOne({ _id: tpc._id }, { $set: { powerCardId: oid(survivor) } });
  }
}
console.log(`TeamPowerCard: ${tpcRepoint} repointed, ${tpcMerge} merged.`);

// PowerCardRequest + Auction.
for (const [coll, name] of [[C.powercardrequests, "PowerCardRequest"], [C.auctions, "Auction"]]) {
  const docs = await coll.find({ powerCardId: { $in: toDelete } }).toArray();
  for (const d of docs) if (!DRY) await coll.updateOne({ _id: d._id }, { $set: { powerCardId: oid(remap.get(d.powerCardId.toString())) } });
  console.log(`${name}: ${docs.length} repointed.`);
}

// Round.allowedPowerCards (string[]).
const rounds = await C.rounds.find({ allowedPowerCards: { $exists: true, $ne: [] } }).toArray();
let roundN = 0;
for (const r of rounds) {
  const next = [...new Set((r.allowedPowerCards ?? []).map((id) => remap.get(id) ?? id))];
  if (JSON.stringify(next) !== JSON.stringify(r.allowedPowerCards)) { roundN++; if (!DRY) await C.rounds.updateOne({ _id: r._id }, { $set: { allowedPowerCards: next } }); }
}
console.log(`Round.allowedPowerCards: ${roundN} updated.`);

// Room defaults/overrides/exclusions.
const rooms = await C.rooms.find({}).toArray();
let roomN = 0;
for (const room of rooms) {
  const defaults = (room.powerCardDefaults ?? []).map((d) => ({ ...d, powerCardId: remap.get(d.powerCardId) ?? d.powerCardId }));
  const seen = new Set(); const dd = [];
  for (const d of defaults) { if (!seen.has(d.powerCardId)) { seen.add(d.powerCardId); dd.push(d); } }
  const ov = [...new Set((room.powerCardOverrides ?? []).map((id) => remap.get(id) ?? id))];
  const ex = [...new Set((room.powerCardExclusions ?? []).map((id) => remap.get(id) ?? id))];
  if (JSON.stringify(dd) !== JSON.stringify(room.powerCardDefaults ?? []) || JSON.stringify(ov) !== JSON.stringify(room.powerCardOverrides ?? []) || JSON.stringify(ex) !== JSON.stringify(room.powerCardExclusions ?? [])) {
    roomN++; if (!DRY) await C.rooms.updateOne({ _id: room._id }, { $set: { powerCardDefaults: dd, powerCardOverrides: ov, powerCardExclusions: ex } });
  }
}
console.log(`Room refs: ${roomN} updated.`);

// Convert existing Insurance cards to the new INSURANCE effect + copy so the
// 3-round behaviour actually triggers (they were BLOCK_NEGATIVE before).
if (!DRY) {
  const res = await C.powercards.updateMany(
    { name: "Insurance" },
    { $set: { effectType: "INSURANCE", description: "Blocks negative marks for 3 questions", icon: "🩹" } }
  );
  console.log(`Insurance converted to INSURANCE effect on ${res.modifiedCount} card(s).`);
} else {
  const n = await C.powercards.countDocuments({ name: "Insurance" });
  console.log(`[dry] would convert ${n} Insurance card(s) to INSURANCE effect.`);
}

// Delete the redundant cards.
if (!DRY) {
  const res = await C.powercards.deleteMany({ _id: { $in: toDelete } });
  console.log(`Deleted ${res.deletedCount} redundant cards.`);
} else {
  console.log(`[dry] would delete ${toDelete.length} redundant cards.`);
}

await mongoose.disconnect();
console.log(DRY ? "\nDRY RUN — no writes." : "\nDone.");
