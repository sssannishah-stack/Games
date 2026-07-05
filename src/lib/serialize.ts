/**
 * Convert a lean Mongoose document (or array of them) into a plain,
 * JSON-safe object — ObjectId → hex string, Date → ISO string — so it can
 * cross the Server → Client Component boundary.
 */
export function serialize<T>(doc: unknown): T {
  return JSON.parse(JSON.stringify(doc)) as T;
}
