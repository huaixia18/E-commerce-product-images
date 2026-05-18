// Pricing packages. Amounts are in RMB cents. Source of truth for the
// pricing page and order creation — never trust a client-supplied price.

export type PackageId = "trial" | "starter" | "standard" | "value" | "pro" | "team";
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

// Six-tier package ladder matching the Vibrant Orange design pack.
// Prices in RMB cents. perCredit is shown read-only.
export const PACKAGES: Record<PackageId, Package> = {
  trial: {
    id: "trial",
    label: "入门",
    amountCents: 600,
    credits: 30,
    perCredit: "0.20 元/积分",
  },
  starter: {
    id: "starter",
    label: "常用",
    amountCents: 1900,
    credits: 100,
    bonusCredits: 5,
    hot: true,
    badge: "常用",
    perCredit: "0.18 元/积分",
  },
  standard: {
    id: "standard",
    label: "热销",
    amountCents: 4900,
    credits: 300,
    bonusCredits: 30,
    hot: true,
    badge: "热销",
    perCredit: "0.15 元/积分",
  },
  value: {
    id: "value",
    label: "划算",
    amountCents: 11900,
    credits: 800,
    bonusCredits: 120,
    perCredit: "0.13 元/积分",
  },
  pro: {
    id: "pro",
    label: "专业",
    amountCents: 26900,
    credits: 2000,
    bonusCredits: 400,
    perCredit: "0.11 元/积分",
  },
  team: {
    id: "team",
    label: "团队",
    amountCents: 59900,
    credits: 5000,
    bonusCredits: 1200,
    perCredit: "0.10 元/积分",
  },
};

export const PACKAGE_ORDER: PackageId[] = ["trial", "starter", "standard", "value", "pro", "team"];

/** Total credits granted = base + bonus. */
export function totalCredits(pkg: Package): number {
  return pkg.credits + (pkg.bonusCredits ?? 0);
}

export function getPackage(id: string): Package | null {
  return (PACKAGES as Record<string, Package>)[id] ?? null;
}
