import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PACKAGES, PACKAGE_ORDER } from "@/lib/payment/packages";
import { PricingClient } from "./PricingClient";

export const metadata = { title: "充值积分 · 详图AI" };

export default async function PricingPage() {
  const session = await auth();
  const credits = session?.user?.id
    ? (
        await prisma.user.findUnique({
          where: { id: session.user.id },
          select: { credits: true },
        })
      )?.credits ?? 0
    : null;

  return (
    <main className="flex-1">
      <PricingClient
        packages={PACKAGE_ORDER.map((id) => PACKAGES[id])}
        loggedIn={!!session?.user?.id}
        balance={credits ?? 0}
      />
    </main>
  );
}
