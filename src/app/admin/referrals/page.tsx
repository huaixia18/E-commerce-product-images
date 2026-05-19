import { prisma } from "@/lib/prisma";
import { ReferralsTable } from "./ReferralsTable";

export const metadata = { title: "邀请审计 · 管理后台" };

export default async function ReferralsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const showRevoked = sp.status === "revoked";

  const referrals = await prisma.referral.findMany({
    where: { status: showRevoked ? "REVOKED" : "GRANTED" },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      referrer: { select: { email: true } },
      invitee: { select: { email: true } },
    },
  });

  return (
    <div className="p-8 max-w-6xl">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">邀请审计</h1>
          <p className="text-sm text-slate-500 mt-1">
            显示双方 IP / 设备指纹 · 可一键作废异常邀请
          </p>
        </div>
      </header>
      <ReferralsTable
        referrals={referrals.map((r) => ({
          ...r,
          createdAt: r.createdAt.toISOString(),
        }))}
        showRevoked={showRevoked}
      />
    </div>
  );
}
