// Pricing packages. Amounts are in RMB cents. Source of truth for the
// pricing page and order creation — never trust a client-supplied price.

export type PackageId = "trial" | "standard" | "value";
export type PayChannel = "wechat" | "alipay";

export interface Package {
  id: PackageId;
  label: string;
  amountCents: number; // RMB cents
  credits: number;
  /** Bonus credits granted on top of `credits`. */
  bonusCredits?: number;
  badge?: string;
  hot?: boolean;
  perCredit: string; // for display only
}

// 3-tier "scheme B" — single API cost ≈ 0.055 元 / image; targeting
// ~67% blended gross margin while keeping per-credit prices visually
// attractive. Signup gift remains 10 credits (≈ 0.55 元 acquisition cost).
//   入门 ¥9.9   / 50 积分            → 0.198 元/张 · 72% 毛利
//   常用 ¥29.9  / 150 + 30 = 180 积分 → 0.166 元/张 · 67% 毛利
//   划算 ¥49.9  / 250 + 75 = 325 积分 → 0.154 元/张 · 64% 毛利
export const PACKAGES: Record<PackageId, Package> = {
  trial: {
    id: "trial",
    label: "入门",
    amountCents: 990,
    credits: 50,
    perCredit: "0.198 元/张",
  },
  standard: {
    id: "standard",
    label: "常用",
    amountCents: 2990,
    credits: 150,
    bonusCredits: 30,
    hot: true,
    badge: "推荐",
    perCredit: "0.166 元/张",
  },
  value: {
    id: "value",
    label: "划算",
    amountCents: 4990,
    credits: 250,
    bonusCredits: 75,
    hot: true,
    badge: "省心",
    perCredit: "0.154 元/张",
  },
};

export const PACKAGE_ORDER: PackageId[] = ["trial", "standard", "value"];

/** Total credits granted = base + bonus. */
export function totalCredits(pkg: Package): number {
  return pkg.credits + (pkg.bonusCredits ?? 0);
}

export function getPackage(id: string): Package | null {
  return (PACKAGES as Record<string, Package>)[id] ?? null;
}
