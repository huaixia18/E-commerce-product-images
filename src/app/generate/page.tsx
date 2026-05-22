import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Workbench } from "./Workbench";

export const metadata = { title: "工作台 · 图作AI" };

export default async function GeneratePage({
  searchParams,
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/generate");
  const { job } = await searchParams;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { credits: true },
  });
  return (
    <Suspense fallback={null}>
      <Workbench credits={user?.credits ?? 0} initialJobId={job} />
    </Suspense>
  );
}
