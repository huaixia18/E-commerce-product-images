import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { signedGetUrl } from "@/lib/oss";
import { JobView } from "./JobView";
import {
  STYLE_LABELS,
  PLATFORM_LABELS,
  ALL_PANEL_IDS,
  PANELS,
  type JobInput,
  type PanelId,
} from "@/lib/promptTemplate";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft } from "lucide-react";

export const metadata = { title: "任务详情 · 详图AI" };

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
    include: { images: { where: { kind: "SOURCE" }, orderBy: { createdAt: "asc" } } },
  });
  if (!job || job.userId !== session.user.id) notFound();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { credits: true },
  });

  const input = job.inputJson as unknown as JobInput;
  const sources = job.images.map((img) => ({
    id: img.id,
    url: signedGetUrl(img.ossKey, 3600),
  }));
  const panels = (input.panels ?? ALL_PANEL_IDS) as PanelId[];
  const panelLabels: Record<PanelId, string> = Object.fromEntries(
    PANELS.map((p) => [p.id, p.label]),
  ) as Record<PanelId, string>;
  const panelAspects: Record<PanelId, string> = Object.fromEntries(
    PANELS.map((p) => [p.id, p.aspect]),
  ) as Record<PanelId, string>;

  return (
    <main className="flex-1 bg-muted/30">
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-6">
        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            返回控制台
          </Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">{input.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{job.id.slice(0, 10)}</span>
            <span>·</span>
            <Badge variant="outline">{input.style ? STYLE_LABELS[input.style] : "—"}</Badge>
            <Badge variant="outline">{input.platform ? PLATFORM_LABELS[input.platform] : "—"}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card className="border-border/60 sm:col-span-1">
            <CardContent className="p-5 space-y-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  商品图（{sources.length}）
                </div>
                <ul className="grid grid-cols-3 gap-2">
                  {sources.map((s, i) => (
                    <li
                      key={s.id}
                      className="relative rounded-md overflow-hidden border border-border aspect-square bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={s.url} alt="" className="w-full h-full object-cover" />
                      {i === 0 && (
                        <Badge className="absolute top-1 left-1 text-[9px] px-1.5 py-0">主图</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                  卖点
                </div>
                <ul className="space-y-1 text-sm">
                  {input.highlights.map((h, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {input.specs && input.specs.length > 0 && (
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
                    参数
                  </div>
                  <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                    {input.specs.map((s, i) => (
                      <div key={i} className="contents">
                        <dt className="text-muted-foreground">{s.label}</dt>
                        <dd className="font-medium">{s.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="sm:col-span-2">
            <JobView
              jobId={job.id}
              initialStatus={job.status}
              panels={panels}
              panelLabels={panelLabels}
              panelAspects={panelAspects}
              credits={user?.credits ?? 0}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
