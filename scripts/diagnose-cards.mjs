import fs from "node:fs";
import mongoose from "mongoose";

const env = fs.readFileSync(".env.local", "utf8");
const mongoUri = env.match(/MONGODB_URI="([^"]+)"/)?.[1];
if (!mongoUri) throw new Error("MONGODB_URI missing");

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
const db = mongoose.connection.db;

const ROOM_ID = process.argv[2] || "6a50da80f866720d5bc06c6b";
const room = await db.collection("rooms").findOne({ _id: new mongoose.Types.ObjectId(ROOM_ID) });
if (!room) { console.log("Room not found"); process.exit(1); }
console.log("Room:", room.name, "competition:", room.competitionId.toString());

const competition = await db.collection("competitions").findOne({ _id: room.competitionId });
const ownerId = competition.ownerId;
console.log("Owner:", ownerId.toString());

// 1. Catalog: all power cards for this owner
const cards = await db.collection("powercards").find({ ownerId }).toArray();
console.log(`\n=== CATALOG (${cards.length} cards for owner) ===`);
const byName = {};
for (const c of cards) {
  byName[c.name] = byName[c.name] || [];
  byName[c.name].push(c);
  console.log(`  ${c._id.toString()}  ${c.name.padEnd(20)} enabled=${c.enabled} effect=${c.effectType}`);
}
console.log("\n=== DUPLICATE NAMES IN CATALOG ===");
let dupCount = 0;
for (const [name, list] of Object.entries(byName)) {
  if (list.length > 1) { dupCount++; console.log(`  ${name}: ${list.length} copies -> ${list.map(c=>c._id.toString()).join(", ")}`); }
}
if (dupCount === 0) console.log("  (none)");

// 2. Enabled-only catalog (what the live route queries)
const enabled = cards.filter(c => c.enabled);
console.log(`\n=== ENABLED cards: ${enabled.length} ===`);

// 3. Team inventory
const teams = await db.collection("teams").find({ roomId: room._id }).toArray();
const catalogIds = new Set(cards.map(c => c._id.toString()));
console.log(`\n=== TEAM INVENTORY (${teams.length} teams) ===`);
for (const t of teams) {
  const owned = await db.collection("teampowercards").find({ teamId: t._id }).toArray();
  console.log(`\n  ${t.name} — ${owned.length} owned cards`);
  for (const o of owned) {
    const pid = o.powerCardId?.toString();
    const card = cards.find(c => c._id.toString() === pid);
    const orphan = !card ? "  <<< ORPHAN (not in catalog)" : (!card.enabled ? "  <<< DISABLED" : "");
    console.log(`    ${pid}  ${(card?.name ?? "??").padEnd(18)} uses=${o.remainingUses} status=${o.status}${orphan}`);
  }
}

// 4. Round restriction
if (room.currentRoundId) {
  const round = await db.collection("rounds").findOne({ _id: room.currentRoundId });
  console.log(`\n=== CURRENT ROUND: ${round?.title} mode=${round?.powerCardMode} ===`);
  console.log("  allowedPowerCards:", (round?.allowedPowerCards ?? []).join(", ") || "(none)");
}
console.log("\n  room.powerCardOverrides:", (room.powerCardOverrides ?? []).join(", ") || "(none)");
console.log("  room.powerCardExclusions:", (room.powerCardExclusions ?? []).join(", ") || "(none)");
console.log("  room.powerCardDefaults:", JSON.stringify(room.powerCardDefaults ?? []));

await mongoose.disconnect();
