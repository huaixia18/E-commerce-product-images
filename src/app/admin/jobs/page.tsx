import { prisma } from "@/lib/prisma";
import { JobsTable } from "./JobsTable";
import type { JobStatus } from "@prisma/client";

export const metadata = { title: "任务 · 管理后台" };

const STATUSES: JobStatus[] = ["PENDING", "RUNNING", "SUCCEEDED", "PARTIAL", "FAILED"];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = STATUSES.includes(sp.status as JobStatus) ? (sp.status as JobStatus) : undefined;
  const q = (sp.q ?? "").trim();

  const jobs = await prisma.job.findMany({
    where: {
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(q
        ? {
            user: {
              OR: [
                { email: { contains: q, mode: "insensitive" } },
                { name: { contains: q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { email: true } },
      _count: { select: { images: true } },
    },
  });

  return (
    <div className="p-8 max-w-6xl">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold">任务</h1>
          <p className="text-sm text-slate-500 mt-1">
            {statusFilter ? `状态 ${statusFilter} · ` : ""}
            {q ? `用户 “${q}” · ` : ""}
            {jobs.length} 条
          </p>
        </div>
      </header>
      <JobsTable
        jobs={jobs.map((j) => ({
          ...j,
          createdAt: j.createdAt.toISOString(),
          startedAt: j.startedAt?.toISOString() ?? null,
          finishedAt: j.finishedAt?.toISOString() ?? null,
        }))}
        statusFilter={statusFilter}
        initialQuery={q}
      />
    </div>
  );
}
