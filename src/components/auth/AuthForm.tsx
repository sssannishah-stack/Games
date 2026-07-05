"use client";

import { useActionState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";
import type { AuthFormState } from "@/actions/auth.actions";

interface AuthFormProps {
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  mode: "login" | "signup";
  showSwitch?: boolean;
  title?: string;
  subtitle?: string;
}

/** Shared login/signup card — a real server action drives submission and errors. */
export function AuthForm({ action, mode, showSwitch = true, title, subtitle }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <div className="w-full max-w-[400px] bg-card border border-line/[.08] rounded-2xl p-7 flex flex-col gap-5 shadow-[0_24px_80px_rgba(0,0,0,.45)]">
      <div className="flex flex-col items-center gap-2.5">
        <div className="w-11 h-11 rounded-[12px] bg-[linear-gradient(135deg,#6C7BFA,#4E96D8)] flex items-center justify-center shadow-[0_4px_18px_rgba(108,123,250,.4)]">
          <Icon name="sparkles" size={20} className="text-white" />
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-lg font-bold text-ink">
            {title ?? (mode === "login" ? "Welcome back" : "Create your host account")}
          </span>
          <span className="text-xs text-mute-2">
            {subtitle ??
              (mode === "login"
                ? "Sign in to run your live competitions"
                : "Set up competitions, rooms and teams")}
          </span>
        </div>
      </div>

      <form action={formAction} className="flex flex-col gap-3.5">
        {mode === "signup" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-3">Name</span>
            <input
              name="name"
              required
              autoComplete="name"
              className="bg-line/[.04] border border-line/[.09] rounded-[11px] px-3.5 py-[11px] text-sm text-ink outline-none focus:border-accent/60"
              placeholder="Priya Sharma"
            />
          </label>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-3">
            {mode === "login" ? "Email or username" : "Email"}
          </span>
          <input
            name="email"
            type={mode === "login" ? "text" : "email"}
            required
            autoComplete={mode === "login" ? "username" : "email"}
            className="bg-line/[.04] border border-line/[.09] rounded-[11px] px-3.5 py-[11px] text-sm text-ink outline-none focus:border-accent/60"
            placeholder="you@example.com"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-3">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="bg-line/[.04] border border-line/[.09] rounded-[11px] px-3.5 py-[11px] text-sm text-ink outline-none focus:border-accent/60"
            placeholder="••••••••"
          />
        </label>

        {state.error && (
          <span className="text-[12.5px] text-danger-soft bg-danger/[.08] border border-danger/25 rounded-[10px] px-3 py-2">
            {state.error}
          </span>
        )}

        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={pending}
          className="justify-center mt-1 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>

      {showSwitch && (
        <span className="text-xs text-mute-2 text-center">
          {mode === "login" ? (
            <>
              New here?{" "}
              <a href="/signup" className="text-accent font-semibold hover:brightness-125">
                Create an account
              </a>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <a href="/login" className="text-accent font-semibold hover:brightness-125">
                Sign in
              </a>
            </>
          )}
        </span>
      )}
    </div>
  );
}
