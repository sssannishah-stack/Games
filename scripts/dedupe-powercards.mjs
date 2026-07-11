/**
 * One-time cleanup for duplicate Power Cards created by a pre-fix seed race.
 * For each (ownerId, name) keeps the earliest card as canonical, repoints every
 * reference to it, merges duplicate team-inventory rows, and deletes the extras.
 *
 * Safe to re-run (idempotent): once there are no dup names, it does nothing.
 * Pass --dry to preview without writing.
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

// 1. Build canonical map per owner: dupIdStr -> canonicalIdStr, and collect deletable ids.
const cards = await C.powercards.find({}).sort({ _id: 1 }).toArray();
const canonicalByName = new Map(); // key: `${ownerId}::${name}` -> canonical id str
const remap = new Map(); // dup id str -> canonical id str
const toDelete = [];
for (const card of cards) {
  const key = `${card.ownerId.toString()}::${card.name}`;
  const idStr = card._id.toString();
  if (!canonicalByName.has(key)) {
    canonicalByName.set(key, idStr);
    remap.set(idStr, idStr);
  } else {
    remap.set(idStr, canonicalByName.get(key));
    toDelete.push(card._id);
  }
}

console.log(`Catalog: ${cards.length} cards, ${canonicalByName.size} unique (owner,name), ${toDelete.length} duplicates to remove.`);
if (toDelete.length === 0) { console.log("Nothing to do."); await mongoose.disconnect(); process.exit(0); }

const changed = (idStr) => remap.get(idStr) && remap.get(idStr) !== idStr;

// 2. TeamPowerCard — repoint + merge (unique index on team+card means we can't
//    blindly repoint; collapse each team's copies of the same canonical card).
const tpcs = await C.teampowercards.find({}).toArray();
const groups = new Map(); // `${teamId}::${canonicalId}` -> [tpc,...]
for (const tpc of tpcs) {
  const pid = tpc.powerCardId?.toString();
  const canonical = remap.get(pid) ?? pid;
  const key = `${tpc.teamId.toString()}::${canonical}`;
  (groups.get(key) ?? groups.set(key, []).get(key)).push({ tpc, canonical });
}
const STATUS_RANK = { AVAILABLE: 0, REQUESTED: 1, APPROVED: 2, ACTIVE: 3, CONSUMED: 4 };
let tpcMerges = 0, tpcRepoints = 0, tpcDeletes = 0;
for (const [, list] of groups) {
  const canonical = list[0].canonical;
  const needsWork = list.length > 1 || list.some(({ tpc }) => tpc.powerCardId.toString() !== canonical);
  if (!needsWork) continue;

  // Survivor = the "most available" copy (max remaining uses breaks ties).
  const sorted = [...list].sort((a, b) =>
    (STATUS_RANK[a.tpc.status] ?? 9) - (STATUS_RANK[b.tpc.status] ?? 9) ||
    (b.tpc.remainingUses ?? 0) - (a.tpc.remainingUses ?? 0)
  );
  const survivor = sorted[0].tpc;
  const maxUses = Math.max(...list.map(({ tpc }) => tpc.remainingUses ?? 0));
  const losers = sorted.slice(1).map(({ tpc }) => tpc._id);

  if (list.length > 1) tpcMerges++;
  if (survivor.powerCardId.toString() !== canonical || (survivor.remainingUses ?? 0) !== maxUses) tpcRepoints++;
  tpcDeletes += losers.length;

  if (!DRY) {
    await C.teampowercards.updateOne(
      { _id: survivor._id },
      { $set: { powerCardId: oid(canonical), remainingUses: maxUses } }
    );
    if (losers.length) await C.teampowercards.deleteMany({ _id: { $in: losers } });
  }
}
console.log(`TeamPowerCard: ${tpcMerges} merged groups, ${tpcRepoints} repointed, ${tpcDeletes} rows deleted.`);

// 3. PowerCardRequest + Auction — simple repoint.
for (const [coll, name] of [[C.powercardrequests, "PowerCardRequest"], [C.auctions, "Auction"]]) {
  const docs = await coll.find({}).toArray();
  let n = 0;
  for (const doc of docs) {
    const pid = doc.powerCardId?.toString();
    if (pid && changed(pid)) {
      n++;
      if (!DRY) await coll.updateOne({ _id: doc._id }, { $set: { powerCardId: oid(remap.get(pid)) } });
    }
  }
  console.log(`${name}: ${n} repointed.`);
}

// 4. Round.allowedPowerCards (string[]).
const rounds = await C.rounds.find({ allowedPowerCards: { $exists: true, $ne: [] } }).toArray();
let roundN = 0;
for (const round of rounds) {
  const next = [...new Set((round.allowedPowerCards ?? []).map((id) => remap.get(id) ?? id))];
  if (JSON.stringify(next) !== JSON.stringify(round.allowedPowerCards)) {
    roundN++;
    if (!DRY) await C.rounds.updateOne({ _id: round._id }, { $set: { allowedPowerCards: next } });
  }
}
console.log(`Round.allowedPowerCards: ${roundN} updated.`);

// 5. Room.powerCardDefaults[].powerCardId + powerCardOverrides[] + powerCardExclusions[].
const rooms = await C.rooms.find({}).toArray();
let roomN = 0;
for (const room of rooms) {
  const defaults = (room.powerCardDefaults ?? []).map((d) => ({ ...d, powerCardId: remap.get(d.powerCardId) ?? d.powerCardId }));
  // collapse duplicate default entries created by remap
  const seen = new Set();
  const dedupDefaults = [];
  for (const d of defaults) { if (!seen.has(d.powerCardId)) { seen.add(d.powerCardId); dedupDefaults.push(d); } }
  const overrides = [...new Set((room.powerCardOverrides ?? []).map((id) => remap.get(id) ?? id))];
  const exclusions = [...new Set((room.powerCardExclusions ?? []).map((id) => remap.get(id) ?? id))];
  const dirty =
    JSON.stringify(dedupDefaults) !== JSON.stringify(room.powerCardDefaults ?? []) ||
    JSON.stringify(overrides) !== JSON.stringify(room.powerCardOverrides ?? []) ||
    JSON.stringify(exclusions) !== JSON.stringify(room.powerCardExclusions ?? []);
  if (dirty) {
    roomN++;
    if (!DRY) await C.rooms.updateOne({ _id: room._id }, { $set: { powerCardDefaults: dedupDefaults, powerCardOverrides: overrides, powerCardExclusions: exclusions } });
  }
}
console.log(`Room refs: ${roomN} updated.`);

// 6. Finally delete the duplicate catalog cards.
if (!DRY) {
  const res = await C.powercards.deleteMany({ _id: { $in: toDelete } });
  console.log(`Deleted ${res.deletedCount} duplicate power cards.`);
} else {
  console.log(`[dry] would delete ${toDelete.length} duplicate power cards.`);
}

await mongoose.disconnect();
console.log(DRY ? "\nDRY RUN complete — no writes made." : "\nCleanup complete.");
