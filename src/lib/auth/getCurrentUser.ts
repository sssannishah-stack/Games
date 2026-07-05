import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/database/mongodb";
import { User } from "@/models";
import { readSessionToken, verifySessionToken } from "./session";
import type { UserRole } from "@/types/db";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

/**
 * Resolve the logged-in host from the session cookie, or null if absent/invalid.
 *
 * Wrapped in React's `cache()` so that within a single request, calling this
 * (or `requireUser`) from both a layout and a page — which happens on every
 * workspace route — hits the database once instead of twice.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = await readSessionToken();
  if (!token) return null;

  const payload = await verifySessionToken(token);
  if (!payload) return null;

  await connectToDatabase();
  const user = await User.findById(payload.userId).lean<{
    _id: unknown;
    name: string;
    email: string;
    role: UserRole;
  }>();
  if (!user) return null;

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
  };
});

/** Same as getCurrentUser but redirects to host access when there is no session. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin");
  return user;
}
