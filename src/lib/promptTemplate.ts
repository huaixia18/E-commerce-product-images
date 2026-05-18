// Generic e-commerce detail-page prompt template.
// One template, multiple panels. Phase 2 only validates inputs and stores the
// snapshot; Phase 3 will materialize these into actual gpt-image-2 prompts.

export interface JobInput {
  title: string;
  highlights: string[]; // 1-8 short bullets
  style?: "minimal" | "vivid" | "premium" | "warm";
  /** Target platform — controls panel size presets. */
  platform?: "taobao" | "tmall" | "jd" | "amazon" | "generic";
  /** OSS keys for uploaded product photos. First is the hero/main shot. */
  sourceImageKeys: string[]; // 1-5
}

export const STYLE_LABELS: Record<NonNullable<JobInput["style"]>, string> = {
  minimal: "极简",
  vivid: "活力鲜明",
  premium: "高端质感",
  warm: "温暖生活感",
};

export const PLATFORM_LABELS: Record<NonNullable<JobInput["platform"]>, string> = {
  taobao: "淘宝",
  tmall: "天猫",
  jd: "京东",
  amazon: "亚马逊",
  generic: "通用",
};

/**
 * The fixed set of panels we'll generate. Keep this stable — the result page
 * relies on these IDs for layout.
 */
export const PANELS = [
  { id: "hero", label: "主图", aspect: "1:1" },
  { id: "feature_1", label: "卖点图 1", aspect: "1:1" },
  { id: "feature_2", label: "卖点图 2", aspect: "1:1" },
  { id: "feature_3", label: "卖点图 3", aspect: "1:1" },
  { id: "lifestyle", label: "场景图", aspect: "3:2" },
  { id: "spec", label: "参数卡", aspect: "1:1" },
] as const;

export type PanelId = (typeof PANELS)[number]["id"];

export const PRESET_PLATFORM_SIZES: Record<NonNullable<JobInput["platform"]>, Record<PanelId, string>> = {
  taobao: {
    hero: "1024x1024",
    feature_1: "1024x1024",
    feature_2: "1024x1024",
    feature_3: "1024x1024",
    lifestyle: "1536x1024",
    spec: "1024x1024",
  },
  tmall: {
    hero: "1024x1024",
    feature_1: "1024x1024",
    feature_2: "1024x1024",
    feature_3: "1024x1024",
    lifestyle: "1536x1024",
    spec: "1024x1024",
  },
  jd: {
    hero: "1024x1024",
    feature_1: "1024x1024",
    feature_2: "1024x1024",
    feature_3: "1024x1024",
    lifestyle: "1536x1024",
    spec: "1024x1024",
  },
  amazon: {
    hero: "2048x2048",
    feature_1: "2048x2048",
    feature_2: "2048x2048",
    feature_3: "2048x2048",
    lifestyle: "2048x1152",
    spec: "2048x2048",
  },
  generic: {
    hero: "1024x1024",
    feature_1: "1024x1024",
    feature_2: "1024x1024",
    feature_3: "1024x1024",
    lifestyle: "1536x1024",
    spec: "1024x1024",
  },
};
