"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { compressImage, TARGET_MIME } from "@/lib/clientImage";
import { PANELS, type PanelId } from "@/lib/promptTemplate";
import { PuzzleMosaic } from "@/components/PuzzleMosaic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sparkles, Plus, X, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SpecRow {
  id: string;
  label: string;
  value: string;
}
interface Slot {
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
const PLATFORMS = [
  { name: "淘宝", value: "taobao" as const, size: "1024×1024" },
  { name: "天猫", value: "tmall" as const, size: "1024×1024" },
  { name: "京东", value: "jd" as const, size: "1024×1024" },
  { name: "亚马逊", value: "amazon" as const, size: "2048×2048" },
  { name: "通用", value: "generic" as const, size: "1024×1024" },
];
const STYLES = [
  { name: "极简", value: "minimal" as const, c1: "bg-[#F4F0EA]", c2: "bg-foreground" },
  { name: "活力鲜明", value: "vivid" as const, c1: "bg-primary", c2: "bg-brand-yellow" },
  { name: "高端质感", value: "premium" as const, c1: "bg-[#1F1B17]", c2: "bg-[#C8A668]" },
  { name: "温暖生活感", value: "warm" as const, c1: "bg-[#F4DCC0]", c2: "bg-[#C97B4E]" },
];

export function GenerateForm({
  credits,
  onCreated,
}: {
  credits: number;
  /** When provided, called with the new job id instead of navigating. */
  onCreated?: (jobId: string) => void;
}) {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [title, setTitle] = useState("");
  const [pointsInputs, setPointsInputs] = useState<string[]>(["", "", ""]);
  const [style, setStyle] = useState<(typeof STYLES)[number]["value"]>("vivid");
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]["value"]>("taobao");
  const [selectedPanels, setSelectedPanels] = useState<Set<PanelId>>(
    new Set(PANELS.map((p) => p.id)),
  );
  const [specs, setSpecs] = useState<SpecRow[]>([]);
  const [drag, setDrag] = useState(false);
  const [submitting, startTransition] = useTransition();

  const doneSlots = slots.filter((s) => s.status === "done");
  const uploading = slots.some((s) => s.status === "uploading");
  const validPoints = pointsInputs.map((p) => p.trim()).filter(Boolean);
  const cost = selectedPanels.size;
  const enough = credits >= cost;
  const canSubmit = !submitting && !uploading && title.trim() && validPoints.length && doneSlots.length && cost > 0 && enough;

  const platformInfo = PLATFORMS.find((p) => p.value === platform)!;

  // Preview mosaic shows selected panels filled + others as dashed empty.
  const previewTiles = useMemo(
    () =>
      PANELS.map(({ id }, i) => ({
        panel: id,
        state: selectedPanels.has(id) ? ("done" as const) : ("off" as const),
        label: validPoints[i - 1] || undefined,
      })),
    [selectedPanels, validPoints],
  );

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const room = MAX_FILES - slots.length;
    for (const file of Array.from(files).slice(0, room)) {
      const id = crypto.randomUUID();
      let compressed;
      try {
        compressed = await compressImage(file);
      } catch {
        setSlots((p) => [...p, { id, previewUrl: "", width: 0, height: 0, bytes: 0, status: "error", error: "压缩失败" }]);
        toast.error("图片压缩失败", { description: file.name });
        continue;
      }
      setSlots((p) => [
        ...p,
        { id, previewUrl: compressed!.previewUrl, width: compressed!.width, height: compressed!.height, bytes: compressed!.bytes, status: "uploading" },
      ]);
      try {
        const r = await fetch("/api/uploads/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: [{ contentType: TARGET_MIME, size: compressed.bytes }] }),
        });
        if (!r.ok) throw new Error(`sign ${r.status}`);
        const sj = (await r.json()) as { items: { ossKey: string; uploadUrl: string }[] };
        const item = sj.items[0];
        const pr = await fetch(item.uploadUrl, { method: "PUT", headers: { "Content-Type": TARGET_MIME }, body: compressed.blob });
        if (!pr.ok) throw new Error(`oss ${pr.status}`);
        setSlots((p) => p.map((s) => (s.id === id ? { ...s, status: "done", ossKey: item.ossKey } : s)));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "上传失败";
        setSlots((p) => p.map((s) => (s.id === id ? { ...s, status: "error", error: msg } : s)));
        toast.error("上传失败", { description: msg });
      }
    }
  }

  function removeUpload(id: string) {
    setSlots((p) => {
      const t = p.find((s) => s.id === id);
      if (t?.previewUrl) URL.revokeObjectURL(t.previewUrl);
      return p.filter((s) => s.id !== id);
    });
  }
  function patchPoint(i: number, v: string) {
    setPointsInputs((p) => p.map((x, idx) => (idx === i ? v : x)));
  }
  function removePoint(i: number) {
    setPointsInputs((p) => p.filter((_, idx) => idx !== i));
  }
  function addPoint() {
    if (pointsInputs.length >= 5) return;
    setPointsInputs((p) => [...p, ""]);
  }
  function togglePanel(id: PanelId) {
    setSelectedPanels((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function addSpec() {
    if (specs.length >= 8) return;
    setSpecs((p) => [...p, { id: crypto.randomUUID(), label: "", value: "" }]);
  }
  function patchSpec(id: string, patch: Partial<SpecRow>) {
    setSpecs((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function removeSpec(id: string) {
    setSpecs((p) => p.filter((s) => s.id !== id));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const sourceImageKeys = slots.filter((s) => s.status === "done" && s.ossKey).map((s) => s.ossKey!);
    if (sourceImageKeys.length === 0) return toast.error("请至少上传一张商品图");
    if (validPoints.length === 0) return toast.error("请至少填写一条卖点");
    if (selectedPanels.size === 0) return toast.error("请至少选择一种要生成的图");
    const panels = PANELS.filter((p) => selectedPanels.has(p.id)).map((p) => p.id);
    const cleanSpecs = specs
      .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
      .filter((s) => s.label && s.value);
    startTransition(async () => {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          highlights: validPoints,
          style,
          platform,
          sourceImageKeys,
          panels,
          ...(cleanSpecs.length ? { specs: cleanSpecs } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error("提交失败", { description: body.error });
        return;
      }
      const body = (await res.json()) as { id: string };
      if (onCreated) onCreated(body.id);
      else router.push(`/generate/${body.id}`);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "grid grid-cols-1 lg:grid-cols-[320px_1fr_400px] bg-background",
        onCreated ? "h-full" : "min-h-[calc(100vh-4rem)]",
      )}
    >
      {/* LEFT — uploads + selling points */}
      <aside className="border-r border-border bg-card p-5 space-y-6 overflow-y-auto">
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-extrabold">① 上传商品图</h2>
            <span className="text-[11px] text-muted-foreground tabular-nums">{slots.length}/{MAX_FILES}</span>
          </div>
          <label
            onMouseEnter={() => setDrag(true)}
            onMouseLeave={() => setDrag(false)}
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
            className={cn(
              "block rounded-2xl border-2 border-dashed p-3 transition-all cursor-pointer",
              drag ? "border-primary bg-secondary" : "border-border bg-card",
            )}
          >
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
            />
            <div className="grid grid-cols-3 gap-2">
              {slots.map((s, i) => (
                <div key={s.id} className={cn(
                  "relative aspect-square rounded-xl overflow-hidden",
                  i === 0 ? "ring-2 ring-primary" : "ring-1 ring-border",
                )}>
                  {s.previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.previewUrl} alt="" className="w-full h-full object-cover" />
                  )}
                  {i === 0 && (
                    <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[9px] font-extrabold px-1.5 py-0.5 rounded">主图</span>
                  )}
                  {s.status === "uploading" && (
                    <div className="absolute inset-0 bg-card/70 grid place-items-center">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); removeUpload(s.id); }}
                    className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/55 text-white grid place-items-center"
                    aria-label="移除"
                  >
                    <X className="h-2.5 w-2.5" strokeWidth={2.5} />
                  </button>
                </div>
              ))}
              {slots.length < MAX_FILES && (
                <span className="aspect-square rounded-xl border-2 border-dashed border-border grid place-items-center text-muted-foreground">
                  <Plus className="h-5 w-5" />
                </span>
              )}
            </div>
            <div className="text-center text-[11px] text-muted-foreground mt-3 leading-relaxed">
              拖拽图片到此 · 或<span className="text-primary font-bold"> 点击上传</span>
              <br />
              第 1 张为主图，其余作参考
            </div>
          </label>
        </section>

        <section>
          <h2 className="text-sm font-extrabold mb-3">
            ② 卖点文案 <span className="text-muted-foreground text-[11px] font-medium">· 3-5 条</span>
          </h2>
          <div className="space-y-2">
            {pointsInputs.map((p, i) => (
              <div key={i} className="flex items-center gap-2 rounded-full bg-card border border-border pl-3 pr-1 py-1">
                <span className="w-5 h-5 rounded-full bg-brand-yellow text-foreground grid place-items-center text-[10px] font-black tabular-nums shrink-0">
                  {i + 1}
                </span>
                <input
                  value={p}
                  onChange={(e) => patchPoint(i, e.target.value)}
                  placeholder="输入卖点…"
                  maxLength={60}
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() => removePoint(i)}
                  className="text-muted-foreground hover:text-foreground p-1"
                  aria-label="移除"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
            {pointsInputs.length < 5 && (
              <button
                type="button"
                onClick={addPoint}
                className="w-full py-2 rounded-full border-2 border-dashed border-border text-muted-foreground text-xs font-bold hover:border-primary/40 hover:text-foreground flex items-center justify-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                添加卖点
              </button>
            )}
          </div>
        </section>

        {/* Specs */}
        <section>
          <h2 className="text-sm font-extrabold mb-3">
            ⑥ 产品参数 <span className="text-muted-foreground text-[11px] font-medium">· 可选</span>
          </h2>
          {specs.length > 0 && (
            <ul className="space-y-2 mb-2">
              {specs.map((s) => (
                <li key={s.id} className="flex items-center gap-1">
                  <Input
                    value={s.label}
                    onChange={(e) => patchSpec(s.id, { label: e.target.value })}
                    placeholder="参数名"
                    maxLength={20}
                    className="flex-[2] h-9 text-xs rounded-full"
                  />
                  <Input
                    value={s.value}
                    onChange={(e) => patchSpec(s.id, { value: e.target.value })}
                    placeholder="值"
                    maxLength={40}
                    className="flex-[3] h-9 text-xs rounded-full"
                  />
                  <button
                    type="button"
                    onClick={() => removeSpec(s.id)}
                    className="text-muted-foreground hover:text-foreground p-1"
                    aria-label="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={addSpec}
            disabled={specs.length >= 8}
            className="w-full py-2 rounded-full border-2 border-dashed border-border text-muted-foreground text-xs font-bold hover:border-primary/40 hover:text-foreground flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {specs.length === 0 ? "添加产品参数" : "再加一条"}
          </button>
        </section>
      </aside>

      {/* MIDDLE — title + platform + style + panels */}
      <section className="p-6 space-y-6 overflow-y-auto">
        <div>
          <Label htmlFor="title" className="text-sm font-extrabold mb-2 block">产品标题</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            placeholder="例：春日轻盈咖啡杯"
            className="h-11 text-base rounded-2xl"
            required
          />
        </div>

        {/* PLATFORM */}
        <div>
          <h2 className="text-sm font-extrabold mb-3">③ 平台尺寸预设</h2>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => {
              const active = p.value === platform;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPlatform(p.value)}
                  className={cn(
                    "inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all border",
                    active
                      ? "bg-foreground text-background border-foreground"
                      : "bg-card text-foreground border-border hover:border-foreground/30",
                  )}
                >
                  {p.name}
                  <span className={cn("font-mono text-[10px]", active ? "opacity-70" : "text-muted-foreground")}>{p.size}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* STYLE */}
        <div>
          <h2 className="text-sm font-extrabold mb-3">④ 风格预设</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {STYLES.map((s) => {
              const active = s.value === style;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStyle(s.value)}
                  className={cn(
                    "relative rounded-2xl overflow-hidden text-left bg-card transition-all border-2",
                    active
                      ? "border-primary shadow-[0_6px_20px_-4px_oklch(0.67_0.21_38_/_0.3)]"
                      : "border-border hover:border-primary/30",
                  )}
                >
                  <div className={cn("h-16 grid place-items-center", s.c1)}>
                    <div className={cn("w-[60%] h-[60%] rounded-xl", s.c2)} />
                    {active && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary text-primary-foreground grid place-items-center">
                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l4 4 10-10" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <div className="text-xs font-extrabold">{s.name}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* PANELS */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-sm font-extrabold">⑤ 输出面板</h2>
            <span className="text-[11px] text-muted-foreground">
              已选 <strong className="text-primary tabular-nums">{selectedPanels.size}</strong> / {PANELS.length} 张
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {PANELS.map((p) => {
              const on = selectedPanels.has(p.id);
              const visuals: Record<PanelId, { bg: string; ink: string }> = {
                hero:      { bg: "bg-primary",       ink: "text-primary-foreground" },
                feature_1: { bg: "bg-brand-magenta", ink: "text-white" },
                feature_2: { bg: "bg-brand-yellow",  ink: "text-foreground" },
                feature_3: { bg: "bg-brand-mint",    ink: "text-white" },
                lifestyle: { bg: "bg-brand-purple",  ink: "text-white" },
                spec:      { bg: "bg-card ring-1 ring-border", ink: "text-foreground" },
              };
              const v = visuals[p.id];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePanel(p.id)}
                  className={cn(
                    "relative rounded-2xl overflow-hidden text-left bg-card transition-all border-2",
                    on ? "border-primary opacity-100" : "border-border opacity-50",
                  )}
                >
                  <div className={cn("h-14 grid place-items-center text-[11px] font-extrabold tracking-widest", v.bg, v.ink)}>
                    {p.id.toUpperCase().replace("_", " ")}
                  </div>
                  <div className="px-2.5 py-2 flex items-center justify-between">
                    <span className="text-xs font-bold">{p.label}</span>
                    <span className={cn(
                      "w-4 h-4 rounded grid place-items-center",
                      on ? "bg-primary text-primary-foreground" : "border-2 border-border",
                    )}>
                      {on && (
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l4 4 10-10" />
                        </svg>
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* RIGHT — preview + CTA */}
      <aside className="border-l border-border bg-card flex flex-col">
        <header className="px-5 py-3.5 border-b border-border flex items-center justify-between">
          <div className="text-xs font-extrabold">预览 · 拼图布局</div>
          <div className="text-[11px] text-muted-foreground font-mono">{platformInfo.size}</div>
        </header>
        <div className="flex-1 p-4 overflow-y-auto">
          <PuzzleMosaic tiles={previewTiles} rowHeight={36} />
        </div>
        <footer className="px-5 py-4 border-t border-border bg-card space-y-2.5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">本次消耗</span>
            <span>
              <strong className="text-lg text-primary tabular-nums">{cost}</strong>
              <span className="text-muted-foreground ml-1">积分 / 余额 {credits}</span>
            </span>
          </div>
          {!enough && (
            <div className="text-[11px] text-destructive">
              积分不足，<a href="/pricing" className="underline font-bold">立即充值</a>
            </div>
          )}
          <Button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-12 rounded-full font-extrabold text-base gap-2 shadow-[0_6px_24px_-4px_oklch(0.67_0.21_38_/_0.5)]"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            开始生成 {cost} 张
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            失败自动按张退积分 · 每张最多重试 2 次
          </p>
        </footer>
      </aside>
    </form>
  );
}
