import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { signedGetUrl } from "@/lib/oss";
import { STYLE_LABELS, PLATFORM_LABELS, type JobInput } from "@/lib/promptTemplate";

export const metadata = { title: "预览 · 电商详情图" };

export default async function JobPreviewPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { jobId } = await params;

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      images: { where: { kind: "SOURCE" }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!job || job.userId !== session.user.id) notFound();

  const input = job.inputJson as unknown as JobInput;
  const sources = job.images.map((img) => ({
    id: img.id,
    url: signedGetUrl(img.ossKey, 3600),
  }));

  return (
    <main className="flex-1 bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <div>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            ← 返回控制台
          </Link>
          <h1 className="text-2xl font-semibold mt-2">{input.title}</h1>
          <p className="text-sm text-zinc-500 mt-1">
            任务 {job.id.slice(0, 10)} · 状态 {job.status}
          </p>
        </div>

        <section>
          <h2 className="text-sm font-medium mb-2">商品图（{sources.length}）</h2>
          <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {sources.map((s, i) => (
              <li
                key={s.id}
                className="relative rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-square bg-zinc-100 dark:bg-zinc-900"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt="" className="w-full h-full object-cover" />
                <div className="absolute top-1 left-1 rounded bg-black/60 text-white text-[10px] px-1.5 py-0.5">
                  {i === 0 ? "主图" : `参考 ${i}`}
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-medium mb-2">卖点</h2>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {input.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
        </section>

        <section className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-zinc-500 text-xs">风格</div>
            <div>{input.style ? STYLE_LABELS[input.style] : "—"}</div>
          </div>
          <div>
            <div className="text-zinc-500 text-xs">目标平台</div>
            <div>{input.platform ? PLATFORM_LABELS[input.platform] : "—"}</div>
          </div>
        </section>

        <section className="border-t border-zinc-200 dark:border-zinc-800 pt-6">
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
            🚧 Phase 3 将在这里加上「开始生成」按钮，调用 gpt-image-2 生成详情图。
          </div>
        </section>
      </div>
    </main>
  );
}
