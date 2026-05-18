"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { compressImage, TARGET_MIME } from "@/lib/clientImage";
import { PANELS, type PanelId } from "@/lib/promptTemplate";
import { PanelIllustration } from "@/components/PanelIllustration";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, ImagePlus, Loader2, X, MoveLeft, MoveRight, Coins, Plus, Trash2 } from "lucide-react";
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

export function GenerateForm({ credits }: { credits: number }) {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [title, setTitle] = useState("");
  const [highlightsText, setHighlightsText] = useState("");
  const [style, setStyle] = useState<(typeof STYLES)[number]["value"]>("minimal");
  const [platform, setPlatform] = useState<(typeof PLATFORMS)[number]["value"]>("generic");
  const [selectedPanels, setSelectedPanels] = useState<Set<PanelId>>(
    new Set(PANELS.map((p) => p.id)),
  );
  const [specs, setSpecs] = useState<SpecRow[]>([]);
  const [submitting, startTransition] = useTransition();

  const doneSlots = slots.filter((s) => s.status === "done");
  const uploading = slots.some((s) => s.status === "uploading");
  const cost = selectedPanels.size;
  const canSubmit =
    !submitting &&
    !uploading &&
    title.trim().length > 0 &&
    parseHighlights(highlightsText).length > 0 &&
    doneSlots.length > 0 &&
    selectedPanels.size > 0;

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const room = MAX_FILES - slots.length;
    const picks = Array.from(files).slice(0, room);
    for (const file of picks) {
      const id = crypto.randomUUID();
      let compressed;
      try {
        compressed = await compressImage(file);
      } catch {
        appendSlot({ id, previewUrl: "", width: 0, height: 0, bytes: 0, status: "error", error: "压缩失败" });
        toast.error("图片压缩失败", { description: file.name });
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
      try {
        const signRes = await fetch("/api/uploads/sign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ files: [{ contentType: TARGET_MIME, size: compressed.bytes }] }),
        });
        if (!signRes.ok) throw new Error(`sign ${signRes.status}`);
        const signJson = (await signRes.json()) as { items: { ossKey: string; uploadUrl: string }[] };
        const item = signJson.items[0];
        if (!item) throw new Error("no signed url");
        const putRes = await fetch(item.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": TARGET_MIME },
          body: compressed.blob,
        });
        if (!putRes.ok) throw new Error(`oss ${putRes.status}`);
        patchSlot(id, { status: "done", ossKey: item.ossKey });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "上传失败";
        patchSlot(id, { status: "error", error: msg });
        toast.error("上传失败", { description: msg });
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
      const t = prev.find((s) => s.id === id);
      if (t?.previewUrl) URL.revokeObjectURL(t.previewUrl);
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
  function addSpec() {
    if (specs.length >= 8) return;
    setSpecs((prev) => [...prev, { id: crypto.randomUUID(), label: "", value: "" }]);
  }
  function patchSpec(id: string, patch: Partial<SpecRow>) {
    setSpecs((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function removeSpec(id: string) {
    setSpecs((prev) => prev.filter((s) => s.id !== id));
  }

  function togglePanel(p: PanelId) {
    setSelectedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const sourceImageKeys = slots
      .filter((s) => s.status === "done" && s.ossKey)
      .map((s) => s.ossKey!);
    if (sourceImageKeys.length === 0) return toast.error("请至少上传一张商品图");
    const highlights = parseHighlights(highlightsText);
    if (highlights.length === 0) return toast.error("请至少填写一条卖点");
    if (selectedPanels.size === 0) return toast.error("请至少选择一种要生成的图");

    const panels = PANELS.filter((p) => selectedPanels.has(p.id)).map((p) => p.id);
    // Drop empty rows; the server also strips them, but clean data on the wire is nicer.
    const cleanSpecs = specs
      .map((s) => ({ label: s.label.trim(), value: s.value.trim() }))
      .filter((s) => s.label && s.value);

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
      router.push(`/generate/${body.id}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Step 1: Upload */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <StepNumber n={1} />
                上传商品图
              </CardTitle>
              <CardDescription className="mt-1">最多 5 张 · 第一张是主图，其余作参考</CardDescription>
            </div>
            <Badge variant="outline" className="tabular-nums">
              {slots.length}/{MAX_FILES}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Dropzone disabled={slots.length >= MAX_FILES} onFiles={handleFiles} />
          {slots.length > 0 && (
            <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {slots.map((s, i) => (
                <li
                  key={s.id}
                  className="relative rounded-lg overflow-hidden border border-border bg-muted aspect-square group"
                >
                  {s.previewUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.previewUrl} alt="" className="w-full h-full object-cover" />
                  )}
                  <div className="absolute top-1.5 left-1.5">
                    <Badge variant={i === 0 ? "default" : "secondary"} className="text-[10px]">
                      {i === 0 ? "主图" : `参考 ${i}`}
                    </Badge>
                  </div>
                  {s.status === "uploading" && (
                    <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  )}
                  {s.status === "error" && (
                    <div className="absolute inset-0 bg-destructive/90 flex items-center justify-center text-destructive-foreground text-xs px-2 text-center">
                      {s.error || "失败"}
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent pt-6 pb-1.5 px-1.5 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-[10px] text-white">
                      {s.status === "done" ? `${s.width}×${s.height}` : ""}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveSlot(s.id, -1)}
                        disabled={i === 0}
                        className="text-white/90 hover:text-white disabled:opacity-30 p-0.5"
                        aria-label="上移"
                      >
                        <MoveLeft className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSlot(s.id, 1)}
                        disabled={i === slots.length - 1}
                        className="text-white/90 hover:text-white disabled:opacity-30 p-0.5"
                        aria-label="下移"
                      >
                        <MoveRight className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSlot(s.id)}
                        className="text-white/90 hover:text-white p-0.5"
                        aria-label="移除"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Product info */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <StepNumber n={2} />
            产品信息
          </CardTitle>
          <CardDescription className="mt-1">告诉 AI 这是什么商品，有哪些卖点</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">产品标题</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              required
              placeholder="例：便携蓝牙音箱 X1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="highlights">
              产品卖点 <span className="text-xs text-muted-foreground">一行一条，最多 8 条</span>
            </Label>
            <Textarea
              id="highlights"
              rows={5}
              value={highlightsText}
              onChange={(e) => setHighlightsText(e.target.value)}
              required
              placeholder={"24 小时续航\nIPX7 防水\n360° 立体声\n金属拉丝外壳"}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                产品参数 <span className="text-xs text-muted-foreground">可选 · 最多 8 条，会出现在「参数卡」</span>
              </Label>
              {specs.length > 0 && (
                <span className="text-xs text-muted-foreground tabular-nums">{specs.length}/8</span>
              )}
            </div>
            {specs.length > 0 && (
              <ul className="space-y-2">
                {specs.map((s) => (
                  <li key={s.id} className="flex items-center gap-2">
                    <Input
                      value={s.label}
                      onChange={(e) => patchSpec(s.id, { label: e.target.value })}
                      maxLength={20}
                      placeholder="参数名（如：重量）"
                      className="flex-[2]"
                    />
                    <Input
                      value={s.value}
                      onChange={(e) => patchSpec(s.id, { value: e.target.value })}
                      maxLength={40}
                      placeholder="参数值（如：350g）"
                      className="flex-[3]"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSpec(s.id)}
                      aria-label="删除此参数"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addSpec}
              disabled={specs.length >= 8}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {specs.length === 0 ? "添加产品参数（可选）" : "再加一条"}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>视觉风格</Label>
              <Select value={style} onValueChange={(v) => setStyle(v as typeof style)}>
                <SelectTrigger>
                  <SelectValue>{STYLES.find((s) => s.value === style)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STYLES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>目标平台</Label>
              <Select value={platform} onValueChange={(v) => setPlatform(v as typeof platform)}>
                <SelectTrigger>
                  <SelectValue>{PLATFORMS.find((p) => p.value === platform)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Panel picker */}
      <Card className="border-border/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <StepNumber n={3} />
                要生成哪些图？
              </CardTitle>
              <CardDescription className="mt-1">每张 1 积分 · 失败自动退款</CardDescription>
            </div>
            <Badge variant="secondary" className="tabular-nums">
              已选 {selectedPanels.size}/{PANELS.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {PANELS.map((p) => {
              const on = selectedPanels.has(p.id);
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => togglePanel(p.id)}
                    className={cn(
                      "w-full text-left rounded-lg border overflow-hidden transition-all relative",
                      on
                        ? "border-primary ring-2 ring-primary/30 shadow-sm"
                        : "border-border hover:border-primary/40",
                    )}
                  >
                    <div className={p.aspect === "3:2" ? "aspect-[3/2]" : "aspect-square"}>
                      <PanelIllustration panel={p.id} />
                    </div>
                    <div className="p-3 flex items-center justify-between">
                      <span className="text-sm font-medium">{p.label}</span>
                      <span className="text-xs text-muted-foreground">{p.aspect}</span>
                    </div>
                    {on && (
                      <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs">
                        ✓
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {/* Sticky submit bar */}
      <div className="sticky bottom-4 z-10">
        <Card className="border-border/60 shadow-lg backdrop-blur bg-card/95">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-sm">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                <Coins className="h-4 w-4" />
              </span>
              <div>
                <div className="text-xs text-muted-foreground">预计消耗</div>
                <div className="font-semibold tabular-nums">
                  {cost} 积分 <span className="text-muted-foreground font-normal">/ 余额 {credits}</span>
                </div>
              </div>
            </div>
            <Button type="submit" disabled={!canSubmit} size="lg" className="gap-2">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              下一步：预览
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold tabular-nums">
      {n}
    </span>
  );
}

function Dropzone({ disabled, onFiles }: { disabled: boolean; onFiles: (f: FileList | null) => void }) {
  return (
    <label
      className={cn(
        "block rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors cursor-pointer",
        disabled
          ? "border-border bg-muted/30 text-muted-foreground cursor-not-allowed"
          : "border-border hover:border-primary hover:bg-primary/5 text-foreground",
      )}
      onDragOver={(e) => { if (!disabled) e.preventDefault(); }}
      onDrop={(e) => { if (disabled) return; e.preventDefault(); onFiles(e.dataTransfer.files); }}
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={disabled}
        className="hidden"
        onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }}
      />
      <ImagePlus className={cn("h-7 w-7 mx-auto mb-2", disabled ? "text-muted-foreground" : "text-primary")} />
      <div className="text-sm font-medium">
        {disabled ? "已达上限（5 张）" : "拖拽图片到此处，或点击选择文件"}
      </div>
      <div className="text-xs text-muted-foreground mt-1">JPG / PNG / WEBP · 单张最大 10MB</div>
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
