"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export function NameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("昵称不能为空");
      return;
    }
    if (trimmed === initialName) return;
    startTransition(async () => {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "保存失败");
        return;
      }
      toast.success("已更新昵称");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        placeholder="给自己起个名字"
        className="flex-1"
      />
      <Button type="submit" disabled={pending || name.trim() === initialName} className="rounded-full font-bold">
        {pending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
        保存
      </Button>
    </form>
  );
}
