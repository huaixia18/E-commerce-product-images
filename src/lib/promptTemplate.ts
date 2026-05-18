// Generic e-commerce detail-page prompt template.
// Phase 2: defines panel set + per-platform sizes + style/platform labels.
// Phase 3: expands (JobInput, PanelId) into a concrete gpt-image-2 prompt.

export interface JobSpec {
  label: string; // e.g. "重量"
  value: string; // e.g. "350g"
}

export interface JobInput {
  title: string;
  highlights: string[]; // 1-8 short bullets
  style?: StyleId;
  platform?: PlatformId;
  /** OSS keys for uploaded product photos. First is the hero/main shot. */
  sourceImageKeys: string[]; // 1-5
  /** Which panels the user wants to generate. Defaults to all. */
  panels?: PanelId[];
  /** Optional structured product specs. Used primarily by the spec panel
   *  and as secondary context in other panels. */
  specs?: JobSpec[]; // 0-8
}

export type StyleId = "minimal" | "vivid" | "premium" | "warm";
export type PlatformId = "taobao" | "tmall" | "jd" | "amazon" | "generic";

export const STYLE_LABELS: Record<StyleId, string> = {
  minimal: "极简",
  vivid: "活力鲜明",
  premium: "高端质感",
  warm: "温暖生活感",
};

const STYLE_PROMPTS: Record<StyleId, string> = {
  minimal:
    "clean minimal e-commerce style, soft neutral background, balanced negative space, crisp studio lighting, subtle shadow",
  vivid:
    "vibrant high-contrast e-commerce style, bold complementary color background, dynamic lighting, energetic composition",
  premium:
    "premium luxury product style, dark moody background with rim lighting, glossy reflections, fine material textures, cinematic depth",
  warm: "warm lifestyle scene, golden-hour natural light, soft fabric or wood textures, inviting and cozy atmosphere",
};

export const PLATFORM_LABELS: Record<PlatformId, string> = {
  taobao: "淘宝",
  tmall: "天猫",
  jd: "京东",
  amazon: "亚马逊",
  generic: "通用",
};

export const PANELS = [
  { id: "hero", label: "主图", aspect: "1:1" },
  { id: "feature_1", label: "卖点图 1", aspect: "1:1" },
  { id: "feature_2", label: "卖点图 2", aspect: "1:1" },
  { id: "feature_3", label: "卖点图 3", aspect: "1:1" },
  { id: "lifestyle", label: "场景图", aspect: "3:2" },
  { id: "spec", label: "参数卡", aspect: "1:1" },
] as const;

export type PanelId = (typeof PANELS)[number]["id"];
export const PANEL_IDS = PANELS.map((p) => p.id) as PanelId[];
export const ALL_PANEL_IDS: readonly PanelId[] = PANEL_IDS;

export const PRESET_PLATFORM_SIZES: Record<PlatformId, Record<PanelId, string>> = {
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

// ─── Prompt expansion ─────────────────────────────────────────────────────────

/** Maps a feature panel id to the highlight index it should depict. */
function featureIndex(panel: PanelId): number | null {
  if (panel === "feature_1") return 0;
  if (panel === "feature_2") return 1;
  if (panel === "feature_3") return 2;
  return null;
}

interface ExpandedPrompt {
  prompt: string;
  size: string;
}

/**
 * Materialize a panel prompt for gpt-image-2.
 * The product photo (first sourceImageKey) is passed separately as reference
 * via imageClient.generateImage({ referenceUrls }).
 */
export function expandPrompt(input: JobInput, panel: PanelId): ExpandedPrompt {
  const style = input.style ?? "minimal";
  const platform = input.platform ?? "generic";
  const size = PRESET_PLATFORM_SIZES[platform][panel];
  const styleDesc = STYLE_PROMPTS[style];

  const featIdx = featureIndex(panel);

  // Build an optional "Product specs:" line that every panel sees, so the
  // AI knows the form factor (e.g. "this is a 350g handheld device").
  const specs = (input.specs ?? []).filter((s) => s.label.trim() && s.value.trim());
  const specsLine = specs.length
    ? `Product specs: ${specs.map((s) => `${s.label}: ${s.value}`).join("; ")}.`
    : "";

  const base = `E-commerce detail image for product "${input.title}".
Use the provided reference photo as the product's exact appearance — preserve shape, color, logo, and label.
Style: ${styleDesc}.${specsLine ? `\n${specsLine}` : ""}
Output a single image, no text watermark, no border.`;

  let panelBody: string;
  switch (panel) {
    case "hero":
      panelBody = `Hero shot: the product centered, three-quarter angle, full visibility, neutral background suitable as the listing thumbnail. No text overlay.`;
      break;
    case "lifestyle":
      panelBody = `Lifestyle scene showing the product in realistic use. Convey: ${input.highlights.join("; ")}. Natural environment, human elements optional but never showing the user's face clearly.`;
      break;
    case "spec": {
      // Prefer structured specs when the user provided them; fall back to
      // highlight bullets for the in-image labels.
      const labels = specs.length
        ? specs.slice(0, 6).map((s) => `${s.label}: ${s.value}`).join(" | ")
        : input.highlights.slice(0, 4).join(" | ");
      panelBody = `Spec/parameter card: the product on a clean studio surface with subtle technical-blueprint accents. List these key specs as small in-image labels: ${labels}. Keep the typography minimal and legible.`;
      break;
    }
    default: {
      const idx = featIdx!;
      const hl = input.highlights[idx] ?? input.highlights[0];
      panelBody = `Feature panel highlighting: "${hl}". Compose so the visual metaphor for this feature is unmistakable. Optional short Chinese label (one phrase ≤8 chars) integrated into the image; avoid long sentences.`;
    }
  }

  return {
    prompt: `${base}\n\n${panelBody}`,
    size,
  };
}
