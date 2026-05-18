import type { PanelId } from "@/lib/promptTemplate";
import { cn } from "@/lib/utils";

/**
 * Stylized "sticker-puzzle" illustration of each panel type, matching the
 * Vibrant Orange design system. Each tile uses a different brand color so the
 * grid reads as a colorful detail-page mosaic at a glance.
 */
const PANEL_VISUAL: Record<PanelId, { bg: string; ink: string; tag: string; label: string }> = {
  hero:      { bg: "bg-primary",         ink: "text-primary-foreground", tag: "HERO",    label: "主图" },
  feature_1: { bg: "bg-brand-magenta",   ink: "text-white",              tag: "FEAT 01", label: "卖点 01" },
  feature_2: { bg: "bg-brand-yellow",    ink: "text-foreground",         tag: "FEAT 02", label: "卖点 02" },
  feature_3: { bg: "bg-brand-mint",      ink: "text-white",              tag: "FEAT 03", label: "卖点 03" },
  lifestyle: { bg: "bg-brand-purple",    ink: "text-white",              tag: "SCENE",   label: "场景图" },
  spec:      { bg: "bg-card",            ink: "text-foreground",         tag: "SPEC",    label: "参数卡" },
};

export function PanelIllustration({
  panel,
  className,
  label,
}: {
  panel: PanelId;
  className?: string;
  /** Optional override label (e.g. preview an actual highlight text on the tile). */
  label?: string;
}) {
  const v = PANEL_VISUAL[panel];
  const isSpec = panel === "spec";
  return (
    <div
      className={cn(
        "relative w-full h-full overflow-hidden rounded-2xl p-3 flex flex-col justify-between",
        v.bg,
        v.ink,
        isSpec && "ring-1 ring-border",
        className,
      )}
    >
      <div className="text-[10px] font-bold tracking-widest opacity-85">{v.tag}</div>
      {isSpec ? (
        <div className="text-xs space-y-1 leading-relaxed">
          <div className="flex justify-between"><span className="opacity-60">容量</span><strong>480 ml</strong></div>
          <div className="flex justify-between"><span className="opacity-60">材质</span><strong>316 钢</strong></div>
        </div>
      ) : (
        <div className="text-base font-black leading-tight">{label ?? v.label}</div>
      )}
    </div>
  );
}
