// Pricing packages. Amounts are in RMB cents. Source of truth for the
// pricing page and order creation — never trust a client-supplied price.

export type PackageId = "starter" | "standard" | "pro";
export type PayChannel = "wechat" | "alipay";

export interface Package {
  id: PackageId;
  label: string;
  amountCents: number; // RMB cents
  credits: number;
  badge?: string;
  perCredit: string; // for display only
}

export const PACKAGES: Record<PackageId, Package> = {
  starter: {
    id: "starter",
    label: "体验包",
    amountCents: 990,
    credits: 60,
    perCredit: "0.17 元/积分",
  },
  standard: {
    id: "standard",
    label: "标准包",
    amountCents: 2990,
    credits: 200,
    badge: "推荐",
    perCredit: "0.15 元/积分",
  },
  pro: {
    id: "pro",
    label: "专业包",
    amountCents: 9900,
    credits: 800,
    perCredit: "0.12 元/积分",
  },
};

export const PACKAGE_ORDER: PackageId[] = ["starter", "standard", "pro"];

export function getPackage(id: string): Package | null {
  return (PACKAGES as Record<string, Package>)[id] ?? null;
}
