"use server";

import { redirect } from "next/navigation";
import { connectToDatabase } from "@/lib/database/mongodb";
import { User } from "@/models";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { setSessionCookie, clearSessionCookie } from "@/lib/auth/session";
import { signupSchema, loginSchema } from "@/validators/auth.validator";

export interface AuthFormState {
  error?: string;
}

/** Create a host account, hash the password, and start a session. */
export async function signupAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await connectToDatabase();

  const existing = await User.findOne({ email: parsed.data.email.toLowerCase() }).lean();
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  // Bootstrap: the very first account on a fresh install becomes the admin
  // (only admins can create competitions), everyone after that is a host.
  const userCount = await User.countDocuments();
  const role = userCount === 0 ? "ADMIN" : "HOST";

  const passwordHash = await hashPassword(parsed.data.password);
  const user = await User.create({
    name: parsed.data.name,
    email: parsed.data.email.toLowerCase(),
    passwordHash,
    role,
  });

  await setSessionCookie(user._id.toString());
  redirect("/admin");
}

/** Verify credentials and start a session. */
export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  await connectToDatabase();

  const user = await User.findOne({ email: parsed.data.email.toLowerCase() }).select(
    "+passwordHash"
  );
  if (!user) {
    return { error: "Invalid email or password." };
  }

  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) {
    return { error: "Invalid email or password." };
  }

  await setSessionCookie(user._id.toString());
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await clearSessionCookie();
  redirect("/admin");
}
