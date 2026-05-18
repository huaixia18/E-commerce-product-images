"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      email: String(fd.get("email") ?? ""),
      password: String(fd.get("password") ?? ""),
      name: String(fd.get("name") ?? "") || undefined,
    };
    startTransition(async () => {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "注册失败");
        return;
      }
      // Auto sign-in after register.
      const signinRes = await fetch("/api/auth/callback/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          email: payload.email,
          password: payload.password,
          redirect: "false",
        }),
      });
      if (signinRes.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        router.push("/login");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="昵称（可选）" name="name" type="text" autoComplete="nickname" />
      <Field label="邮箱" name="email" type="email" required autoComplete="email" />
      <Field
        label="密码"
        name="password"
        type="password"
        required
        autoComplete="new-password"
        minLength={8}
        hint="至少 8 个字符"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "处理中…" : "注册"}
      </button>
    </form>
  );
}

function Field(props: {
  label: string;
  name: string;
  type: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{props.label}</span>
      <input
        name={props.name}
        type={props.type}
        required={props.required}
        autoComplete={props.autoComplete}
        minLength={props.minLength}
        className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
      />
      {props.hint && <span className="text-xs text-zinc-500 mt-1 block">{props.hint}</span>}
    </label>
  );
}
