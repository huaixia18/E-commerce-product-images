import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { signedGetUrl } from "@/lib/oss";
import { type JobInput, type PanelId } from "@/lib/promptTemplate";
import { GalleryClient, type GalleryImage } from "./GalleryClient";

export const metadata = { title: "历史图库 · 图作AI" };

const PANEL_LABEL: Record<string, string> = {
  hero: "主图",
  feature_1: "卖点图 1",
  feature_2: "卖点图 2",
  feature_3: "卖点图 3",
  lifestyle: "场景图",
  spec: "参数卡",
};

export default async function GalleryPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/gallery");

  // All generated images across the user's jobs, newest first.
  const images = await prisma.image.findMany({
    where: { kind: "GENERATED", job: { userId: session.user.id } },
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      panel: true,
      ossKey: true,
      url: true,
      width: true,
      height: true,
      createdAt: true,
      jobId: true,
      job: { select: { inputJson: true } },
    },
  });

  const items: GalleryImage[] = images.map((img) => {
    const input = img.job.inputJson as unknown as JobInput;
    return {
      id: img.id,
      jobId: img.jobId,
      jobTitle: input.title ?? "未命名项目",
      panel: img.panel ?? "",
      panelLabel: PANEL_LABEL[img.panel ?? ""] ?? (img.panel ?? "图片"),
      url: img.url ?? signedGetUrl(img.ossKey, 3600),
      width: img.width ?? null,
      height: img.height ?? null,
      createdAt: img.createdAt.toISOString(),
      downloadUrl: `/api/jobs/${img.jobId}/panels/${img.panel ?? ""}/download`,
    };
  });

  // Distinct projects for the filter chips.
  const projectMap = new Map<string, string>();
  for (const it of items) if (!projectMap.has(it.jobId)) projectMap.set(it.jobId, it.jobTitle);
  const projects = Array.from(projectMap, ([id, title]) => ({ id, title }));

  return <GalleryClient items={items} projects={projects} />;
}
