import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GenerateForm } from "./GenerateForm";

export const metadata = { title: "生成详情图 · 电商详情图" };

export default async function GeneratePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/generate");
  return (
    <main className="flex-1 bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-semibold mb-1">生成详情图</h1>
        <p className="text-sm text-zinc-500 mb-8">
          上传 1–5 张商品图（第一张为主图，其余为参考），填写卖点，提交后进入预览页。
        </p>
        <GenerateForm />
      </div>
    </main>
  );
}
