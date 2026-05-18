"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { compressImage, TARGET_MIME } from "@/lib/clientImage";

interface Slot {
  // After compression + upload, ossKey is set. While uploading, status reflects progress.
  id: string;
  previewUrl: string;
  width: number;
  height: number;
  bytes: number;
  status: "uploading" | "done" | "error";
  ossKey?: string;
  error?: string;
}

const MAX_FILES = 5;
const STYLES = [
  { value: "minimal", label: "极简" },
  { value: "vivid", label: "活力鲜明" },
  { value: "premium", label: "高端质感" },
  { value: "warm", label: "温暖生活感" },
] as const;
const PLATFORMS = [
  { value: "generic", label: "通用" },
  { value: "taobao", label: "淘宝" },
  { value: "tmall", label: "天猫" },
  { value: "jd", label: "京东" },
  { value: "amazon", label: "亚马逊" },
] as const;

export function GenerateForm() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [title, setTitle] = useState("");
  const [highlightsText, setHighlightsText] = useState("");
  const [style, setStyle] = useState<(typeof STYLES)[number]["value"]>("minimal");
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]["value"]>("generic");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, startTransition] = useTransition();

  const doneSlots = slots.filter((s) => s.status === "done");
  const canSubmit =
    !submitting && title.trim().length > 0 && parseHighlights(highlightsText).length > 0 && doneSlots.length > 0;

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const room = MAX_FILES - slots.length;
    const picks = Array.from(files).slice(0, room);
    for (const file of picks) {
      const id = crypto.randomUUID();
      // 1) compress on-device
      let compressed;
      try {
        compressed = await compressImage(file);
      } catch (e) {
        appendSlot({ id, previewUrl: "", width: 0, height: 0, bytes: 0, status: "error", error: "压缩失败" });
        continue;
      }
      appendSlot({
        id,
        previewUrl: compressed.previewUrl,
        width: compressed.width,
        height: compressed.height,
        bytes: compressed.bytes,
        status: "uploading",
      });

      // 2) ask backend for a signed PUT URL
      try {
        const signRes = await fetch("/api/uploads/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            files: [{ contentType: TARGET_MIME, size: compressed.bytes }],
          }),
        });
        if (!signRes.ok) throw new Error(`sign ${signRes.status}`);
        const signJson = (await signRes.json()) as { items: { ossKey: string; uploadUrl: string }[] };
        const item = signJson.items[0];
        if (!item) throw new Error("no signed url");

        // 3) PUT to OSS
        const putRes = await fetch(item.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": TARGET_MIME },
          body: compressed.blob,
        });
        if (!putRes.ok) throw new Error(`oss ${putRes.status}`);

        patchSlot(id, { status: "done", ossKey: item.ossKey });
      } catch (e) {
        patchSlot(id, { status: "error", error: e instanceof Error ? e.message : "上传失败" });
      }
    }
  }

  function appendSlot(s: Slot) {
    setSlots((prev) => [...prev, s]);
  }
  function patchSlot(id: string, patch: Partial<Slot>) {
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function removeSlot(id: string) {
    setSlots((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((s) => s.id !== id);
    });
  }
  function moveSlot(id: string, dir: -1 | 1) {
    setSlots((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    const sourceImageKeys = slots
      .filter((s) => s.status === "done" && s.ossKey)
      .map((s) => s.ossKey!);
    if (sourceImageKeys.length === 0) {
      setSubmitError("请至少上传一张商品图");
      return;
    }
    const highlights = parseHighlights(highlightsText);
    if (highlights.length === 0) {
      setSubmitError("请至少填写一条卖点");
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          highlights,
          style,
          platform,
          sourceImageKeys,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSubmitError(body.error ?? "提交失败");
        return;
      }
      const body = (await res.json()) as { id: string };
      router.push(`/generate/${body.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">商品图</h2>
          <span className="text-xs text-zinc-500">
            {slots.length}/{MAX_FILES} · 第一张为主图
          </span>
        </div>
        <Dropzone
          disabled={slots.length >= MAX_FILES}
          onFiles={handleFiles}
        />
        {slots.length > 0 && (
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mt-3">
            {slots.map((s, i) => (
              <li
                key={s.id}
                className="relative rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 aspect-square"
              >
                {s.previewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.previewUrl} alt="" className="w-full h-full object-cover" />
                )}
                <div className="absolute top-1 left-1 rounded bg-black/60 text-white text-[10px] px-1.5 py-0.5">
                  {i === 0 ? "主图" : `参考 ${i}`}
                </div>
                <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[10px] px-1.5 py-1 flex items-center justify-between">
                  <span>
                    {s.status === "uploading" && "上传中…"}
                    {s.status === "done" && `${s.width}×${s.height}`}
                    {s.status === "error" && (s.error || "失败")}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveSlot(s.id, -1)}
                      disabled={i === 0}
                      className="disabled:opacity-30"
                      aria-label="上移"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSlot(s.id, 1)}
                      disabled={i === slots.length - 1}
                      className="disabled:opacity-30"
                      aria-label="下移"
                    >
                      →
                    </button>
                    <button type="button" onClick={() => removeSlot(s.id)} aria-label="移除">
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Field label="产品标题">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={80}
          placeholder="例：便携蓝牙音箱 X1"
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        />
      </Field>

      <Field
        label="产品卖点"
        hint="一行一条，最多 8 条；每条 ≤ 60 字"
      >
        <textarea
          value={highlightsText}
          onChange={(e) => setHighlightsText(e.target.value)}
          required
          rows={5}
          placeholder={"24 小时续航\nIPX7 防水\n360° 立体声\n金属拉丝外壳"}
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="风格">
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as typeof style)}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          >
            {STYLES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="目标平台">
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as typeof platform)}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
          >
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {submitError && <p className="text-sm text-red-600">{submitError}</p>}
      <div className="pt-2">
        <button
          type="submit"
          disabled={!canSubmit}
          className="rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-5 py-2.5 text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "提交中…" : "下一步：预览"}
        </button>
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-1">{label}</span>
      {children}
      {hint && <span className="text-xs text-zinc-500 mt-1 block">{hint}</span>}
    </label>
  );
}

function Dropzone({ disabled, onFiles }: { disabled: boolean; onFiles: (f: FileList | null) => void }) {
  return (
    <label
      className={`block rounded-lg border-2 border-dashed px-6 py-8 text-center text-sm transition-colors ${
        disabled
          ? "border-zinc-200 dark:border-zinc-800 text-zinc-400 cursor-not-allowed"
          : "border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500 text-zinc-600 dark:text-zinc-300 cursor-pointer"
      }`}
      onDragOver={(e) => {
        if (disabled) return;
        e.preventDefault();
      }}
      onDrop={(e) => {
        if (disabled) return;
        e.preventDefault();
        onFiles(e.dataTransfer.files);
      }}
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
      {disabled ? "已达上限（5 张）" : "拖拽图片到此处，或点击选择文件"}
    </label>
  );
}

function parseHighlights(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 8);
}
