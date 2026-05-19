import { prisma } from "@/lib/prisma";
import { UsersTable } from "./UsersTable";

export const metadata = { title: "用户 · 管理后台" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const users = await prisma.user.findMany({
    where: q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" } },
            { name: { contains: q, mode: "insensitive" } },
            { id: q },
            { referralCode: q },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      name: true,
      credits: true,
      createdAt: true,
      referralCode: true,
      _count: { select: { jobs: true, orders: true, referralsSent: true } },
    },
  });

  return (
    <div className="p-8 max-w-6xl">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">用户</h1>
          <p className="text-sm text-slate-500 mt-1">
            {q ? `搜索 “${q}” · ${users.length} 条` : `最近 ${users.length} 个用户`}
          </p>
        </div>
      </header>
      <UsersTable users={users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))} initialQuery={q} />
    </div>
  );
}
