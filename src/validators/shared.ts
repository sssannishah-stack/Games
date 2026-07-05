import { z } from "zod";

/** A 24-char hex MongoDB ObjectId, as a string coming from the client. */
export const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

export type ObjectIdInput = z.infer<typeof objectId>;
