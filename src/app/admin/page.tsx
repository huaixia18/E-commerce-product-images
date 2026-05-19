import { prisma } from "@/lib/prisma";
import { TrendingUp, Users, ImageIcon, Wallet, Gift } from "lucide-react";

export const metadata = { title: "总览 · 管理后台" };

/** Cost estimate per generated image (RMB). Matches lib/payment commentary. */
const COST_PER_IMAGE_YUAN = 0.055;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function statsForRange(since: Date) {
  const [paidOrders, newUsers, doneImages, referrals] = await Promise.all([
    prisma.order.aggregate({
      where: { status: "PAID", paidAt: { gte: since } },
      _sum: { amountCents: true },
      _count: true,
    }),
    prisma.user.count({ where: { createdAt: { gte: since } } }),
    prisma.image.count({ where: { kind: "GENERATED", createdAt: { gte: since } } }),
    prisma.referral.count({ where: { status: "GRANTED", createdAt: { gte: since } } }),
  ]);
  const revenueCents = paidOrders._sum.amountCents ?? 0;
  const costYuan = doneImages * COST_PER_IMAGE_YUAN;
  const revenueYuan = revenueCents / 100;
  const grossYuan = revenueYuan - costYuan;
  return {
    revenueYuan,
    paidCount: paidOrders._count,
    newUsers,
    doneImages,
    costYuan,
    grossYuan,
    referrals,
  };
}

export default async function AdminOverviewPage() {
  const today = await statsForRange(daysAgo(0));
  const week = await statsForRange(daysAgo(7));
  const month = await statsForRange(daysAgo(30));

  const totals = await Promise.all([
    prisma.user.count(),
    prisma.order.count({ where: { status: "PAID" } }),
    prisma.image.count({ where: { kind: "GENERATED" } }),
    prisma.referral.count({ where: { status: "GRANTED" } }),
  ]);

  return (
    <div className="p-8 max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">总览</h1>
        <p className="text-sm text-slate-500 mt-1">业务关键指标 · 数据实时（每次刷新重算）</p>
      </header>

      {/* Lifetime totals */}
      <section className="grid grid-cols-4 gap-3 mb-8">
        <Totals icon={<Users className="h-4 w-4" />} label="累计用户" value={totals[0]} />
        <Totals icon={<Wallet className="h-4 w-4" />} label="已付订单" value={totals[1]} />
        <Totals icon={<ImageIcon className="h-4 w-4" />} label="累计出图" value={totals[2]} />
        <Totals icon={<Gift className="h-4 w-4" />} label="成功邀请" value={totals[3]} />
      </section>

      {/* Time windows */}
      <section className="space-y-6">
        <RangeBlock label="今日" data={today} />
        <RangeBlock label="近 7 日" data={week} />
        <RangeBlock label="近 30 日" data={month} />
      </section>
    </div>
  );
}

function Totals({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums mt-1">{value.toLocaleString()}</div>
    </div>
  );
}

function RangeBlock({
  label,
  data,
}: {
  label: string;
  data: Awaited<ReturnType<typeof statsForRange>>;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 font-semibold text-sm flex items-center justify-between">
        {label}
        <span className="text-xs text-slate-500 font-normal">
          毛利 ≈{" "}
          <strong
            className={
              data.grossYuan >= 0 ? "text-emerald-600 tabular-nums" : "text-red-600 tabular-nums"
            }
          >
            ¥{data.grossYuan.toFixed(2)}
          </strong>
        </span>
      </div>
      <div className="grid grid-cols-5 divide-x divide-slate-200 text-sm">
        <Cell label="收入" value={`¥${data.revenueYuan.toFixed(2)}`} accent="text-emerald-600" />
        <Cell label="付订单" value={data.paidCount.toLocaleString()} />
        <Cell label="新用户" value={data.newUsers.toLocaleString()} />
        <Cell label="出图" value={data.doneImages.toLocaleString()} />
        <Cell label="API 成本" value={`¥${data.costYuan.toFixed(2)}`} accent="text-red-600" />
      </div>
      <div className="px-5 py-2 text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
        <TrendingUp className="inline h-3 w-3 mr-1" />
        成功邀请 {data.referrals} 次
      </div>
    </div>
  );
}

function Cell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="px-4 py-3">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`text-lg font-bold tabular-nums mt-0.5 ${accent ?? "text-slate-900"}`}>
        {value}
      </div>
    </div>
  );
}
