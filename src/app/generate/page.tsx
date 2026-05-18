import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GenerateForm } from "./GenerateForm";

export const metadata = { title: "生成详情图 · 详图AI" };

export default async function GeneratePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/generate");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { credits: true },
  });
  return (
    <main className="flex-1 bg-muted/30">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8 space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">创建新任务</h1>
          <p className="text-sm text-muted-foreground">
            上传商品图、填卖点、选要生成的图，按张消耗积分。当前余额{" "}
            <span className="font-semibold text-foreground">{user?.credits ?? 0}</span> 积分。
          </p>
        </div>
        <GenerateForm credits={user?.credits ?? 0} />
      </div>
    </main>
  );
}
