import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

export const loginSchema = z.object({
  // Signup always requires a real email, but some accounts (e.g. an admin
  // provisioned directly in the database) may use a plain id like "admin" —
  // login only requires a non-empty identifier, not strict email format.
  email: z.string().min(1, "Enter your email or username"),
  password: z.string().min(1, "Password is required"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
