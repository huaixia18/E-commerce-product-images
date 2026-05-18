import type { PanelId } from "@/lib/promptTemplate";
import { cn } from "@/lib/utils";

/**
 * The signature 6-column puzzle grid from the Vibrant Orange design.
 * Used as a hero showcase, workbench preview, and result mosaic.
 *
 * Layout (6 columns × 6 rows):
 *   hero        cols 1-4, rows 1-4   (4×4 big tile)
 *   feature_1   cols 5-6, rows 1-2   (2×2)
 *   feature_2   cols 5-6, rows 3-4   (2×2)
 *   lifestyle   cols 1-3, rows 5-6   (3×2)
 *   feature_3   cols 4-6, rows 5-6   (3×2)
 *   spec        cols 1-6, rows 7-8   (6×2 wide)
 */

const PANEL_DEFS: Record<
  PanelId,
  { col: string; row: string; bg: string; ink: string; tag: string; label: string }
> = {
  hero:      { col: "col-span-4", row: "row-span-4", bg: "bg-primary",       ink: "text-primary-foreground", tag: "主图 · HERO", label: "春日轻盈\n咖啡杯" },
  feature_1: { col: "col-start-5 col-end-7", row: "row-start-1 row-end-3", bg: "bg-brand-magenta", ink: "text-white", tag: "卖点 01", label: "360° 防漏" },
  feature_2: { col: "col-start-5 col-end-7", row: "row-start-3 row-end-5", bg: "bg-brand-yellow",  ink: "text-foreground", tag: "卖点 02", label: "真空保温" },
  lifestyle: { col: "col-span-3", row: "row-span-2", bg: "bg-brand-purple", ink: "text-white", tag: "场景图", label: "桌面场景" },
  feature_3: { col: "col-span-3", row: "row-span-2", bg: "bg-brand-mint",   ink: "text-white", tag: "卖点 03", label: "316 食品级钢" },
  spec:      { col: "col-span-6", row: "row-span-2", bg: "bg-card ring-1 ring-border", ink: "text-foreground", tag: "参数卡 · SPEC", label: "" },
};

const ORDERED: PanelId[] = ["hero", "feature_1", "feature_2", "lifestyle", "feature_3", "spec"];

export interface MosaicTile {
  panel: PanelId;
  state?: "done" | "running" | "queued" | "failed" | "off";
  /** Override the label shown on the tile (e.g. a real highlight). */
  label?: string;
  /** Optional override image URL for completed tiles. */
  imageUrl?: string;
  /** Progress 0..1 for running state. */
  progress?: number;
}

export function PuzzleMosaic({
  tiles,
  className,
  rowHeight = 56,
  showAllStates = false,
}: {
  /** Provide either a list of tiles (order respected) or a Set of enabled panels. */
  tiles: MosaicTile[];
  className?: string;
  rowHeight?: number;
  showAllStates?: boolean;
}) {
  // Ensure tiles are rendered in the canonical mosaic order.
  const tilesByPanel = new Map(tiles.map((t) => [t.panel, t]));
  const rendered = ORDERED.filter((p) => tilesByPanel.has(p));

  return (
    <div
      className={cn("grid grid-cols-6 gap-2", className)}
      style={{ gridAutoRows: `${rowHeight}px` }}
    >
      {rendered.map((p) => {
        const tile = tilesByPanel.get(p)!;
        const def = PANEL_DEFS[p];
        const state = tile.state ?? "done";
        if (state === "off") {
          return (
            <div
              key={p}
              className={cn(
                def.col,
                def.row,
                "rounded-2xl border-2 border-dashed border-border opacity-40",
              )}
            />
          );
        }
        return (
          <Tile
            key={p}
            tile={tile}
            def={def}
            state={state}
            showAllStates={showAllStates}
          />
        );
      })}
    </div>
  );
}

function Tile({
  tile,
  def,
  state,
  showAllStates,
}: {
  tile: MosaicTile;
  def: (typeof PANEL_DEFS)[PanelId];
  state: NonNullable<MosaicTile["state"]>;
  showAllStates: boolean;
}) {
  const baseCls = cn(
    def.col,
    def.row,
    "rounded-2xl overflow-hidden relative shadow-[0_2px_10px_rgba(26,18,8,0.06)]",
  );

  if (state === "failed") {
    return (
      <div className={cn(baseCls, "bg-[#3B1419] flex items-center justify-center p-3")}>
        <div className="text-center">
          <div className="text-[#FF4D6D] text-xl">✕</div>
          <div className="text-xs font-bold text-[#FFE0E6] mt-1">生成失败</div>
          <div className="text-[10px] text-[#FFB3C0] mt-0.5">已重试 2 次 · 已退分</div>
        </div>
      </div>
    );
  }
  if (state === "queued") {
    return (
      <div className={cn(baseCls, "bg-[#1B1714] flex items-center justify-center p-3")}>
        <div className="text-center">
          <div className="text-[10px] font-bold text-[#9E9285] tracking-widest">{def.tag}</div>
          <div className="text-xs font-bold mt-1 text-[#C9BEB0]">{tile.label ?? def.label.split("\n")[0]}</div>
          <div className="text-[10px] mt-1.5 inline-block px-2 py-0.5 rounded bg-white/5 text-[#9E9285]">排队中…</div>
        </div>
      </div>
    );
  }
  if (state === "running") {
    return (
      <div className={cn(baseCls, "bg-[#1B1714] flex items-end p-3")}>
        <PixelDiffusion bg={def.bg} progress={tile.progress ?? 0.4} />
        <div className="relative z-10 w-full">
          <div className="text-[10px] font-bold tracking-widest text-white/70">{def.tag}</div>
          <div className="text-xs font-bold text-white">{tile.label ?? def.label.split("\n")[0]}</div>
          <div className="text-[10px] font-mono text-white/70 mt-0.5">
            {Math.round((tile.progress ?? 0.4) * 100)}% · 像素扩散
          </div>
        </div>
      </div>
    );
  }
  // done
  return (
    <div className={cn(baseCls, def.bg, def.ink, "p-3 flex flex-col justify-between")}>
      <div className="flex items-start justify-between">
        <span className="text-[10px] font-bold tracking-widest opacity-85">{def.tag}</span>
        {showAllStates && (
          <span className="inline-flex w-4 h-4 items-center justify-center rounded-full bg-white/95 text-[#0a8a3a]">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l4 4 10-10" />
            </svg>
          </span>
        )}
      </div>
      {tile.panel === "spec" ? (
        <div className="text-xs grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-2">
          {[["容量", "480 ml"], ["材质", "316 钢"], ["保温", "12 小时"], ["重量", "320 g"]].map(([k, v]) => (
            <div key={k}>
              <div className="text-muted-foreground text-[10px]">{k}</div>
              <div className="font-bold">{v}</div>
            </div>
          ))}
        </div>
      ) : tile.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={tile.imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className={cn("font-black leading-tight whitespace-pre-line", tile.panel === "hero" ? "text-2xl" : "text-base")}>
          {tile.label ?? def.label}
        </div>
      )}
    </div>
  );
}

/** Pixel diffusion noise pattern — deterministic per panel id. */
function PixelDiffusion({ bg, progress }: { bg: string; progress: number }) {
  const cols = 14;
  const rows = 10;
  const total = cols * rows;
  const revealed = Math.floor(total * Math.min(0.95, progress));
  // Deterministic shuffle (not random across renders — SSR-safe)
  const order = (() => {
    const arr = Array.from({ length: total }, (_, i) => i);
    let seed = 991;
    for (let i = arr.length - 1; i > 0; i--) {
      seed = (seed * 9301 + 49297) % 233280;
      const j = Math.floor((seed / 233280) * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  })();
  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      preserveAspectRatio="none"
      className="absolute inset-0 w-full h-full"
    >
      {order.map((idx, rank) => {
        const x = idx % cols;
        const y = Math.floor(idx / cols);
        const isRevealed = rank < revealed;
        return (
          <rect
            key={idx}
            x={x}
            y={y}
            width="1.02"
            height="1.02"
            className={isRevealed ? bg : "fill-white/10"}
          />
        );
      })}
    </svg>
  );
}

export const ALL_PANELS_FOR_DEMO: MosaicTile[] = ORDERED.map((panel) => ({ panel, state: "done" }));
