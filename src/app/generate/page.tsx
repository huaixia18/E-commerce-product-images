import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GenerateForm } from "./GenerateForm";

export const metadata = { title: "生成详情图 · 图作AI" };

export default async function GeneratePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/generate");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { credits: true },
  });
  return <GenerateForm credits={user?.credits ?? 0} />;
}
