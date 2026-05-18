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
  type JobInput,
  type PanelId,
} from "@/lib/promptTemplate";
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

  return (
    <main className="flex-1 bg-background">
      <div className="px-6 py-4 border-b border-border bg-card">
        <div className="mx-auto max-w-6xl flex items-center gap-3 text-sm text-muted-foreground">
          <Link href="/dashboard" className="inline-flex items-center hover:text-foreground">
            <ChevronLeft className="h-4 w-4 mr-1" />
            返回控制台
          </Link>
          <span>/</span>
          <span className="font-bold text-foreground">{input.title}</span>
          <span>·</span>
          <span>{input.platform ? PLATFORM_LABELS[input.platform] : "—"}</span>
          <span>·</span>
          <span>{input.style ? STYLE_LABELS[input.style] : "—"}</span>
        </div>
      </div>

      <JobView
        jobId={job.id}
        title={input.title}
        initialStatus={job.status}
        panels={panels}
        credits={user?.credits ?? 0}
        sources={sources}
        highlights={input.highlights}
        specs={input.specs}
      />
    </main>
  );
}
