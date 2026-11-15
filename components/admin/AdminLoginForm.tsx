"use client";

import { useActionState } from "react";
import { adminLogin } from "@/lib/admin/actions";
import Spinner from "@/components/Spinner";

export default function AdminLoginForm() {
  const [state, action, pending] = useActionState(adminLogin, { error: null });
  return (
    <form action={action} className="mt-6 flex flex-col gap-3">
      <label className="flex flex-col gap-[7px]">
        <span className="text-sm font-medium">Admin password</span>
        <input
          name="password"
          type="password"
          required
          autoFocus
          autoComplete="current-password"
          className="h-13 w-full rounded-[14px] border border-line-strong bg-surface-2 px-4 text-base outline-none focus:border-ink"
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-[14px] bg-danger-bg px-3 py-2.5 text-[13px] text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="flex h-13 items-center justify-center gap-2 rounded-full bg-btn text-base font-semibold text-btn-ink transition-opacity hover:opacity-90"
      >
        {pending && <Spinner />}
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
