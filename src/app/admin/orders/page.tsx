import { prisma } from "@/lib/prisma";
import { OrdersTable } from "./OrdersTable";
import type { OrderStatus } from "@prisma/client";

export const metadata = { title: "订单 · 管理后台" };

const STATUSES: OrderStatus[] = ["PENDING", "PAID", "FAILED", "REFUNDED"];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const statusFilter = STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : undefined;

  const orders = await prisma.order.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      user: { select: { email: true } },
    },
  });

  return (
    <div className="p-8 max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">订单</h1>
        <p className="text-sm text-slate-500 mt-1">
          {statusFilter ? `状态 ${statusFilter} · ${orders.length} 条` : `最近 ${orders.length} 个订单`}
        </p>
      </header>
      <OrdersTable
        orders={orders.map((o) => ({
          ...o,
          createdAt: o.createdAt.toISOString(),
          paidAt: o.paidAt?.toISOString() ?? null,
        }))}
        statusFilter={statusFilter}
      />
    </div>
  );
}
