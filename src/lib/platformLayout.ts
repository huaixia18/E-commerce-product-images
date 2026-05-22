// Per-platform phone detail-page layout definitions.
// Drives <PhonePreview>: how the generated panels are arranged to mimic each
// marketplace's real mobile product page (carousel hero, long-image detail
// stream, thumbnail gallery, A+ modules, spec table, etc.).

import type { PanelId, PlatformId } from "./promptTemplate";

/** How the top "first screen" (主图) area is presented. */
export type HeroMode =
  | "carousel" // square main image with carousel dots (Taobao/Tmall/JD/PDD)
  | "gallery"; // large main image + thumbnail strip below (Amazon)

/** How a single detail block renders inside the scrolling page. */
export type BlockKind =
  | "longImage" // full-bleed long image (typical Chinese 详情长图)
  | "aplus" // Amazon A+ style framed module with a heading
  | "specTable"; // structured parameter table

export interface DetailBlock {
  panel: PanelId;
  kind: BlockKind;
  /** Heading shown above the block (A+ modules / spec table). */
  heading?: string;
}

export interface PlatformLayout {
  id: PlatformId;
  /** Short marketplace name shown in the simulated status/title bar. */
  chrome: string;
  heroMode: HeroMode;
  /** Aspect ratio (w/h) of the hero image. */
  heroAspect: number;
  /** Canvas width label shown to the user, e.g. "750px 详情宽". */
  canvasNote: string;
  /** Accent color (tailwind class) used for the simulated platform chrome. */
  accent: string;
  /** Ordered detail blocks below the hero. */
  blocks: DetailBlock[];
}

// The hero panel is always rendered by the hero area; detail blocks cover the
// remaining panels in marketplace-appropriate order.
const TAOBAO: PlatformLayout = {
  id: "taobao",
  chrome: "淘宝",
  heroMode: "carousel",
  heroAspect: 1,
  canvasNote: "主图 800×800 · 详情 750px",
  accent: "bg-[#FF5000]",
  blocks: [
    { panel: "feature_1", kind: "longImage" },
    { panel: "feature_2", kind: "longImage" },
    { panel: "feature_3", kind: "longImage" },
    { panel: "lifestyle", kind: "longImage" },
    { panel: "spec", kind: "specTable", heading: "规格参数" },
  ],
};

const TMALL: PlatformLayout = {
  id: "tmall",
  chrome: "天猫",
  heroMode: "carousel",
  heroAspect: 1,
  canvasNote: "主图白底 800×800 · 详情 790px",
  accent: "bg-[#FF0036]",
  blocks: [
    { panel: "feature_1", kind: "longImage" },
    { panel: "feature_2", kind: "longImage" },
    { panel: "lifestyle", kind: "longImage" },
    { panel: "spec", kind: "specTable", heading: "规格参数" },
  ],
};

const JD: PlatformLayout = {
  id: "jd",
  chrome: "京东",
  heroMode: "carousel",
  heroAspect: 1,
  canvasNote: "主图 800×800 · 详情 790px",
  accent: "bg-[#E1251B]",
  blocks: [
    { panel: "feature_1", kind: "longImage" },
    { panel: "feature_2", kind: "longImage" },
    { panel: "feature_3", kind: "longImage" },
    { panel: "spec", kind: "specTable", heading: "规格与包装" },
  ],
};

const AMAZON: PlatformLayout = {
  id: "amazon",
  chrome: "amazon",
  heroMode: "gallery",
  heroAspect: 1,
  canvasNote: "主图纯白底 ≥1000px · A+ 模块",
  accent: "bg-[#FF9900]",
  blocks: [
    { panel: "feature_1", kind: "aplus", heading: "Product Highlights" },
    { panel: "feature_2", kind: "aplus", heading: "Why You'll Love It" },
    { panel: "feature_3", kind: "aplus", heading: "Built to Last" },
    { panel: "lifestyle", kind: "aplus", heading: "In Your Life" },
  ],
};

const PINDUODUO: PlatformLayout = {
  id: "pinduoduo",
  chrome: "拼多多",
  heroMode: "carousel",
  heroAspect: 1,
  canvasNote: "主图 750×750 · 详情 750px",
  accent: "bg-[#E22E1F]",
  blocks: [
    { panel: "feature_1", kind: "longImage" },
    { panel: "feature_2", kind: "longImage" },
    { panel: "spec", kind: "specTable", heading: "商品参数" },
  ],
};

const GENERIC: PlatformLayout = {
  id: "generic",
  chrome: "商品详情",
  heroMode: "carousel",
  heroAspect: 1,
  canvasNote: "通用 1:1 主图 · 长图详情",
  accent: "bg-primary",
  blocks: [
    { panel: "feature_1", kind: "longImage" },
    { panel: "feature_2", kind: "longImage" },
    { panel: "feature_3", kind: "longImage" },
    { panel: "lifestyle", kind: "longImage" },
    { panel: "spec", kind: "specTable", heading: "规格参数" },
  ],
};

export const PLATFORM_LAYOUTS: Record<PlatformId, PlatformLayout> = {
  taobao: TAOBAO,
  tmall: TMALL,
  jd: JD,
  amazon: AMAZON,
  pinduoduo: PINDUODUO,
  generic: GENERIC,
};
