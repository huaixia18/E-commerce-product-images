"use client";

import type { JobSpec, PanelId, PlatformId } from "@/lib/promptTemplate";
import { PLATFORM_LAYOUTS, type DetailBlock } from "@/lib/platformLayout";
import { cn } from "@/lib/utils";
import { Loader2, ImageIcon } from "lucide-react";

export interface PhoneTile {
  panel: PanelId;
  state?: "done" | "running" | "queued" | "failed" | "off";
  label?: string;
  imageUrl?: string;
  progress?: number;
}

const PANEL_TINT: Record<PanelId, string> = {
  hero: "from-primary/15 to-primary/5",
  feature_1: "from-brand-magenta/15 to-brand-magenta/5",
  feature_2: "from-brand-yellow/20 to-brand-yellow/5",
  feature_3: "from-brand-mint/15 to-brand-mint/5",
  lifestyle: "from-brand-purple/15 to-brand-purple/5",
  spec: "from-secondary to-secondary",
};

/**
 * Simulates a marketplace mobile product page for the chosen platform: a phone
 * frame with a carousel/gallery hero and a vertically-scrolling detail stream
 * laid out per platformLayout. Renders generated images when available, and
 * styled placeholders (queued / running / off) otherwise.
 */
export function PhonePreview({
  platform,
  tiles,
  specs,
  title,
  className,
}: {
  platform: PlatformId;
  tiles: PhoneTile[];
  specs?: JobSpec[];
  title?: string;
  className?: string;
}) {
  const layout = PLATFORM_LAYOUTS[platform];
  const byPanel = new Map(tiles.map((t) => [t.panel, t]));
  const hero = byPanel.get("hero");
  const heroOn = !!hero && hero.state !== "off";

  // Detail blocks the user actually selected (panel present + not "off").
  const blocks = layout.blocks.filter((b) => {
    const t = byPanel.get(b.panel);
    return t && t.state !== "off";
  });

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* Phone frame — true device aspect (~9:19.5). Content scrolls inside. */}
      <div className="relative w-[268px] aspect-[9/19] rounded-[2.6rem] bg-[#1B1714] p-2 shadow-[0_24px_60px_-15px_rgba(26,18,8,0.5)] ring-1 ring-black/5">
        {/* screen */}
        <div className="relative h-full w-full overflow-hidden rounded-[2.1rem] bg-card flex flex-col">
          {/* status bar (time + notch + signal), part of the platform chrome */}
          <div className={cn("relative shrink-0 text-white", layout.accent)}>
            <div className="flex items-center justify-between px-4 pt-1.5 pb-0.5 text-[9px] font-bold">
              <span>9:41</span>
              <span className="flex items-center gap-1 opacity-90">
                <span>5G</span>
                <span className="inline-block h-2 w-4 rounded-[2px] border border-white/70 relative">
                  <span className="absolute inset-[1px] right-1 bg-white/90 rounded-[1px]" />
                </span>
              </span>
            </div>
            {/* notch */}
            <div className="absolute left-1/2 top-0 h-4 w-20 -translate-x-1/2 rounded-b-2xl bg-[#1B1714]" />
            {/* title row */}
            <div className="flex items-center gap-2 px-3 pb-2">
              <span className="text-[11px] font-black tracking-tight">{layout.chrome}</span>
              <span className="ml-auto text-[9px] opacity-80 truncate max-w-[130px]">
                {title || "商品详情"}
              </span>
            </div>
          </div>

          {/* scrollable page — fills remaining height, content clipped to frame */}
          <div className="relative flex-1 min-h-0">
            <div className="absolute inset-0 overflow-y-auto">
              {/* HERO */}
              {layout.heroMode === "gallery" ? (
                <AmazonHero tile={hero} on={heroOn} />
              ) : (
                <CarouselHero tile={hero} on={heroOn} count={blocks.length + (heroOn ? 1 : 0)} />
              )}

              {/* price / title strip (decorative, makes it read like a real page) */}
              <div className="px-3 py-2 border-b border-border">
                <div className="flex items-baseline gap-1">
                  <span className="text-destructive font-black text-base">¥199</span>
                  <span className="text-muted-foreground text-[10px] line-through">¥299</span>
                </div>
                <div className="text-[11px] font-bold text-foreground truncate mt-0.5">
                  {title || "你的商品标题"}
                </div>
              </div>

              {/* DETAIL BLOCKS */}
              {blocks.length === 0 ? (
                <div className="px-3 py-8 text-center text-[10px] text-muted-foreground">
                  选择要生成的图，详情区会按 {layout.chrome} 版式排列
                </div>
              ) : (
                <div className={layout.heroMode === "gallery" ? "p-3 space-y-3" : ""}>
                  {blocks.map((b) => (
                    <Block key={b.panel} block={b} tile={byPanel.get(b.panel)!} specs={specs} />
                  ))}
                  {/* bottom spacer so last block clears the home indicator */}
                  <div className="h-8" />
                </div>
              )}
            </div>
            {/* fade hint that the page continues scrolling */}
            <div className="pointer-events-none absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-card to-transparent" />
            {/* home indicator */}
            <div className="pointer-events-none absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-24 rounded-full bg-foreground/30" />
          </div>
        </div>
      </div>
      <div className="mt-3 text-[10px] text-muted-foreground text-center">{layout.canvasNote}</div>
    </div>
  );
}

function CarouselHero({ tile, on, count }: { tile?: PhoneTile; on: boolean; count: number }) {
  return (
    <div className="relative aspect-square w-full bg-secondary">
      <TileSurface tile={tile} on={on} panel="hero" rounded={false} />
      {/* carousel dots */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
        {Array.from({ length: Math.max(1, Math.min(5, count)) }).map((_, i) => (
          <span
            key={i}
            className={cn("h-1.5 rounded-full transition-all", i === 0 ? "w-3 bg-white" : "w-1.5 bg-white/50")}
          />
        ))}
      </div>
    </div>
  );
}

function AmazonHero({ tile, on }: { tile?: PhoneTile; on: boolean }) {
  return (
    <div className="p-3">
      <div className="relative aspect-square w-full bg-white rounded-lg ring-1 ring-border overflow-hidden">
        <TileSurface tile={tile} on={on} panel="hero" rounded={false} />
      </div>
      {/* thumbnail strip */}
      <div className="mt-2 flex gap-1.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-9 w-9 rounded ring-1 overflow-hidden bg-secondary",
              i === 0 ? "ring-[#FF9900]" : "ring-border",
            )}
          >
            {i === 0 && on && tile?.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tile.imageUrl} alt="" className="w-full h-full object-cover" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Block({ block, tile, specs }: { block: DetailBlock; tile: PhoneTile; specs?: JobSpec[] }) {
  if (block.kind === "specTable") {
    const rows =
      specs && specs.length > 0
        ? specs.slice(0, 6)
        : [
            { label: "材质", value: "—" },
            { label: "规格", value: "—" },
            { label: "重量", value: "—" },
          ];
    return (
      <div className="px-3 py-3 border-t-8 border-secondary">
        {block.heading && <div className="text-xs font-extrabold mb-2">{block.heading}</div>}
        <dl className="rounded-lg ring-1 ring-border overflow-hidden text-[11px]">
          {rows.map((r, i) => (
            <div key={i} className={cn("grid grid-cols-[80px_1fr]", i > 0 && "border-t border-border")}>
              <dt className="bg-secondary px-2.5 py-1.5 text-muted-foreground">{r.label}</dt>
              <dd className="px-2.5 py-1.5 font-medium">{r.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    );
  }

  if (block.kind === "aplus") {
    return (
      <div className="rounded-lg ring-1 ring-border overflow-hidden bg-card">
        {block.heading && (
          <div className="px-2.5 py-1.5 text-[11px] font-extrabold border-b border-border">
            {block.heading}
          </div>
        )}
        <div className="aspect-[3/2] w-full">
          <TileSurface tile={tile} on rounded={false} panel={block.panel} />
        </div>
      </div>
    );
  }

  // longImage — full-bleed. When the image is ready, show it at its natural
  // ratio (no crop) so baked-in copy stays fully visible; otherwise use a
  // fixed placeholder box.
  if (tile.state === "done" && tile.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={tile.imageUrl} alt={tile.label ?? block.panel} className="block w-full" />
    );
  }
  return (
    <div className="aspect-[3/4] w-full">
      <TileSurface tile={tile} on rounded={false} panel={block.panel} />
    </div>
  );
}

/** The actual pixel surface for one panel: image, running, queued, or failed. */
function TileSurface({
  tile,
  on,
  panel,
  rounded,
}: {
  tile?: PhoneTile;
  on: boolean;
  panel: PanelId;
  rounded: boolean;
}) {
  const r = rounded ? "rounded-lg" : "";
  const state = tile?.state ?? (on ? "done" : "off");

  if (!on || state === "off") {
    return (
      <div className={cn("w-full h-full grid place-items-center bg-secondary text-muted-foreground", r)}>
        <ImageIcon className="h-5 w-5 opacity-40" />
      </div>
    );
  }
  if (state === "failed") {
    return (
      <div className={cn("w-full h-full grid place-items-center bg-destructive/10 text-destructive", r)}>
        <div className="text-center">
          <div className="text-sm">✕</div>
          <div className="text-[9px] font-bold">生成失败 · 已退分</div>
        </div>
      </div>
    );
  }
  if (state === "running" || state === "queued") {
    return (
      <div
        className={cn(
          "w-full h-full grid place-items-center bg-gradient-to-br text-foreground/70",
          PANEL_TINT[panel],
          r,
        )}
      >
        <div className="text-center">
          {state === "running" ? (
            <Loader2 className="h-4 w-4 animate-spin mx-auto text-primary" />
          ) : (
            <div className="text-[9px] font-bold tracking-widest text-muted-foreground">排队中</div>
          )}
          {tile?.label && <div className="text-[9px] font-bold mt-1 px-2 truncate">{tile.label}</div>}
        </div>
      </div>
    );
  }
  // done
  if (tile?.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={tile.imageUrl} alt={tile.label ?? panel} className={cn("w-full h-full object-cover", r)} />
    );
  }
  return (
    <div className={cn("w-full h-full grid place-items-center bg-gradient-to-br text-foreground", PANEL_TINT[panel], r)}>
      <div className="text-center px-3">
        <div className="text-[11px] font-black leading-tight">{tile?.label ?? "示例图"}</div>
      </div>
    </div>
  );
}
