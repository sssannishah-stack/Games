import mongoose from "mongoose";

/**
 * Cached MongoDB connection.
 *
 * Next.js (dev + serverless) re-evaluates modules on every hot reload and can
 * spin up many isolated invocations. Without caching, each one would open a new
 * Mongoose connection and quickly exhaust the Atlas connection pool. We stash a
 * single connection promise on `globalThis` so it survives reloads.
 */

const MONGODB_URI = process.env.MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

// `var` is required here so the declaration merges onto globalThis.
declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache =
  global._mongooseCache ?? (global._mongooseCache = { conn: null, promise: null });

/**
 * Connect to MongoDB, reusing the cached connection when available.
 * Throws a descriptive error if MONGODB_URI is missing or the connection fails.
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not defined. Add it to your .env.local (see .env.example)."
    );
  }

  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        // Fail fast instead of hanging when Atlas is unreachable.
        serverSelectionTimeoutMS: 10_000,
      })
      .then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (error) {
    // Reset so the next call can retry a fresh connection.
    cached.promise = null;
    throw new Error(
      `Failed to connect to MongoDB: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return cached.conn;
}

export default connectToDatabase;
