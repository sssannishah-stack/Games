/** Provisions (or resets) the dedicated Playwright QA host account. Mirrors the
 * upsert pattern in simulation-check.mjs — direct DB write, no app code touched. */
import fs from "node:fs";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const env = fs.readFileSync(".env.local", "utf8");
const mongoUri = env.match(/MONGODB_URI="?([^"\n]+)"?/)?.[1];
if (!mongoUri) throw new Error("MONGODB_URI missing");

const EMAIL = "qa.playwright@encore.local";
const PASSWORD = "QaPlaywright@123";

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
const users = mongoose.connection.db.collection("users");

const passwordHash = await bcrypt.hash(PASSWORD, 10);
const result = await users.findOneAndUpdate(
  { email: EMAIL },
  {
    $setOnInsert: { name: "QA Playwright", email: EMAIL, role: "ADMIN", createdAt: new Date() },
    $set: { passwordHash, updatedAt: new Date() },
  },
  { upsert: true, returnDocument: "after" }
);

console.log(JSON.stringify({ id: result._id.toString(), email: EMAIL, password: PASSWORD }, null, 2));
await mongoose.disconnect();
