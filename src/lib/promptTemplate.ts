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

// Each style is a dense, photographer-grade description. The vocabulary is
// deliberately loaded with commercial-photography terms that nudge the model
// toward catalog-quality output instead of generic renders.
const STYLE_PROMPTS: Record<StyleId, string> = {
  minimal:
    "clean minimalist commercial product photography, seamless pure-white sweep background (#FFFFFF), " +
    "soft even key light from a large softbox with gentle fill, faint natural contact shadow under the product, " +
    "generous negative space, true-to-life colors, ultra-sharp focus, high dynamic range, 8k, " +
    "shot on a 100mm macro lens, studio quality",
  vivid:
    "vibrant high-energy commercial product photography, bold solid complementary-color backdrop with a subtle gradient, " +
    "punchy directional lighting with crisp highlights, saturated yet realistic colors, dynamic 3/4 composition, " +
    "glossy reflective surface, sharp focus, high contrast, 8k, advertising-grade, eye-catching",
  premium:
    "premium luxury product photography, deep dark gradient background, dramatic rim lighting and soft top key light, " +
    "elegant glossy reflections on a polished surface, fine material texture detail (brushed metal, glass, leather), " +
    "cinematic shallow depth of field, rich shadows, color-graded warm highlights, 8k, ultra-detailed, magazine-quality",
  warm: "warm lifestyle product photography, golden-hour natural window light, soft wood and linen textures, " +
    "cozy out-of-focus home background with gentle bokeh, inviting earthy color palette, natural soft shadows, " +
    "authentic and aspirational, 8k, editorial quality",
};

// Quality + negative anchors appended to every prompt. Negative phrasing
// listed as "avoid:" because gpt-image-2 has no separate negative-prompt
// field — it respects in-prompt exclusions reasonably well.
const QUALITY_SUFFIX =
  "Professional studio product photography, photorealistic, commercially polished, " +
  "perfectly exposed, color-accurate. " +
  "Avoid: blurry, low-resolution, distorted proportions, warped or duplicated product, " +
  "extra random objects, messy background, harsh ugly shadows, oversaturated artifacts, " +
  "plastic-looking CGI, watermark, signature, frame, border.";

// Chinese text rendering is the most fragile part. When we DO ask for Chinese
// labels, we constrain hard: very short, bold sans-serif, high contrast, and
// we tell the model legibility matters more than decoration.
const CN_TEXT_RULES =
  "If rendering Chinese text, use a clean bold sans-serif (思源黑体 / PingFang style), " +
  "keep each label to at most 6 characters, large and high-contrast against its background, " +
  "perfectly legible with correct stroke shapes, no garbled or broken characters. " +
  "Prefer fewer words over decorative typography.";

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

  // Whether this panel renders Chinese text (so we only spend the CN rules
  // budget where it matters — hero stays text-free for a clean main image).
  let rendersChinese = false;

  const base = `Create one e-commerce detail image for the product 「${input.title}」.
CRITICAL: the attached reference photo IS the product. Reproduce its exact shape, proportions, color, material, logo and label faithfully — do not redesign or substitute it. Keep it the unmistakable hero of the frame.
Visual style: ${styleDesc}.${specsLine ? `\n${specsLine}` : ""}`;

  let panelBody: string;
  switch (panel) {
    case "hero":
      // Main listing image: text-free, platform-clean, product front & center.
      panelBody =
        `MAIN LISTING IMAGE. The product occupies ~70% of the frame, centered, ` +
        `shot from a flattering three-quarter angle, fully visible and tack-sharp. ` +
        `Plenty of clean margin around it so it reads well as a thumbnail. ` +
        `Absolutely no text, no logo overlay, no graphic decorations — just the product.`;
      break;
    case "lifestyle":
      panelBody =
        `LIFESTYLE SCENE. Place the product naturally in a real usage context that conveys: ` +
        `${input.highlights.join("; ")}. The product stays in clear focus and is the obvious subject. ` +
        `Tasteful real-world props and environment, soft depth of field. ` +
        `No people's faces clearly visible. No text overlay.`;
      break;
    case "spec": {
      const labels = specs.length
        ? specs.slice(0, 6).map((s) => `${s.label} ${s.value}`)
        : input.highlights.slice(0, 4);
      rendersChinese = true;
      panelBody =
        `SPEC / PARAMETER CARD. The product sits on a clean studio surface with subtle ` +
        `technical accents (thin guide lines, small icons). Lay out these specs as a tidy ` +
        `aligned list of short labels: ${labels.map((l) => `「${l}」`).join("  ")}. ` +
        `Each label short and crisp. Plenty of whitespace, modern infographic look.`;
      break;
    }
    default: {
      const idx = featIdx!;
      const hl = input.highlights[idx] ?? input.highlights[0];
      rendersChinese = true;
      panelBody =
        `FEATURE / SELLING-POINT IMAGE highlighting one benefit: 「${hl}」. ` +
        `Compose a clear visual metaphor or close-up that makes this benefit obvious. ` +
        `Add one short bold Chinese headline (the benefit phrase, ≤6 characters) ` +
        `placed in clean negative space, not covering the product.`;
    }
  }

  const parts = [base, panelBody, QUALITY_SUFFIX];
  if (rendersChinese) parts.push(CN_TEXT_RULES);

  return {
    prompt: parts.join("\n\n"),
    size,
  };
}
