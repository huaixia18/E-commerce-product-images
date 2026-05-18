import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PuzzleMosaic, ALL_PANELS_FOR_DEMO } from "@/components/PuzzleMosaic";
import { PACKAGES, PACKAGE_ORDER } from "@/lib/payment/packages";
import { ArrowRight, Sparkles, Layers, Coins } from "lucide-react";

const PLATFORMS = ["淘宝", "天猫", "京东", "亚马逊", "抖音", "小红书", "拼多多"];

export default async function Home() {
  const session = await auth();
  return (
    <main className="flex-1">
      <Hero loggedIn={!!session?.user?.id} />
      <PlatformStrip />
      <Features />
      <PricingTeaser />
      <CTA loggedIn={!!session?.user?.id} />
    </main>
  );
}

function Hero({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute -top-32 -left-32 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute top-40 -right-32 h-80 w-80 rounded-full bg-brand-magenta/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-brand-yellow/15 blur-3xl" />
      </div>
      <div className="mx-auto max-w-6xl px-6 pt-16 pb-12 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground mb-6 shadow-sm">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-brand-mint" />
            gpt-image-2 驱动 · 已生成 218 万张
          </div>
          <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.05] text-balance">
            5 分钟，
            <span className="inline-block bg-primary text-primary-foreground px-3 rounded-xl -rotate-[1deg]">一整套</span>
            <br />
            电商详情图就
            <br />
            自己<span className="text-brand-magenta">蹦</span>出来。
          </h1>
          <p className="mt-6 text-base text-muted-foreground max-w-md leading-relaxed">
            上传商品图、写几行卖点，AI 自动拼出主图 + 卖点图 + 场景图 + 参数卡。
            <br />
            一键打包 zip，平台尺寸全适配。
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            {loggedIn ? (
              <Button asChild size="lg" className="gap-2 rounded-full font-bold px-6 h-12 text-base shadow-[0_6px_24px_-4px_oklch(0.67_0.21_38_/_0.5)]">
                <Link href="/generate">
                  立即开始生成
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="gap-2 rounded-full font-bold px-6 h-12 text-base shadow-[0_6px_24px_-4px_oklch(0.67_0.21_38_/_0.5)]">
                  <Link href="/register">
                    免费试做 3 张
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="rounded-full font-bold px-6 h-12 text-base border-foreground/20">
                  <Link href="#features">看演示 ▶</Link>
                </Button>
              </>
            )}
          </div>
          <div className="mt-8 flex flex-wrap gap-7 text-sm">
            <Stat label="付费卖家" value="2.5万+" />
            <Stat label="出一张" value="30秒" />
            <Stat label="=1张图" value="1积分" />
          </div>
        </div>

        <div className="relative">
          {/* Rotated yellow sticker */}
          <div
            aria-hidden
            className="absolute -top-3 right-0 px-4 py-2 bg-brand-yellow text-foreground rounded-full font-extrabold text-sm rotate-[6deg] shadow-md z-10 whitespace-nowrap"
          >
            ✨ 6 张一套出
          </div>
          <PuzzleMosaic tiles={ALL_PANELS_FOR_DEMO} rowHeight={56} />
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xl font-black text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function PlatformStrip() {
  return (
    <section className="border-y border-border py-5 bg-card/40">
      <div className="mx-auto max-w-6xl px-6 flex items-center flex-wrap gap-x-6 gap-y-3">
        <div className="text-[11px] font-semibold tracking-widest text-muted-foreground">
          适配主流电商平台
        </div>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
              {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: Sparkles,
      title: "AI 拼版",
      desc: "主图 / 3 卖点 / 场景 / 参数 一次出齐",
      color: "bg-primary",
    },
    {
      icon: Layers,
      title: "多图融合",
      desc: "上传 5 张参考，AI 理解你的产品语言",
      color: "bg-brand-magenta",
    },
    {
      icon: Coins,
      title: "失败退分",
      desc: "生成失败自动按张退积分，0 风险",
      color: "bg-brand-yellow text-foreground",
    },
  ];
  return (
    <section id="features" className="py-16">
      <div className="mx-auto max-w-6xl px-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((it) => (
          <Card key={it.title} className="border-border shadow-[0_2px_10px_rgba(26,18,8,0.06)]">
            <CardContent className="p-6 space-y-3">
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl text-white ${it.color}`}
              >
                <it.icon className="h-5 w-5" />
              </span>
              <h3 className="text-lg font-extrabold">{it.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{it.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function PricingTeaser() {
  // Show the first 3 packages in the teaser for the home page.
  const previewPackages = PACKAGE_ORDER.slice(0, 3).map((id) => PACKAGES[id]);
  return (
    <section className="py-16 bg-secondary/40 border-y border-border">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-black tracking-tight">明码标价，按张付费</h2>
          <p className="mt-3 text-sm text-muted-foreground">1 积分 = 1 张图 · 失败自动退分 · 积分永不过期</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {previewPackages.map((pkg) => {
            const featured = !!pkg.badge;
            const yuan = Math.floor(pkg.amountCents / 100);
            const cents = pkg.amountCents % 100;
            return (
              <Card
                key={pkg.id}
                className={
                  featured
                    ? "relative !overflow-visible border-primary bg-secondary/40 ring-2 ring-primary/40 shadow-[0_6px_24px_-4px_oklch(0.67_0.21_38_/_0.3)]"
                    : "border-border"
                }
              >
                {featured && (
                  <span className="absolute -top-3 right-4 rotate-[6deg] rounded-full bg-brand-magenta text-white px-3 py-1 text-[10px] font-extrabold whitespace-nowrap">
                    🔥 {pkg.badge}
                  </span>
                )}
                <CardContent className="p-6 space-y-2">
                  <div className="text-sm font-bold text-muted-foreground">{pkg.label}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl text-muted-foreground">¥</span>
                    <span className="text-5xl font-black tracking-tight tabular-nums">{yuan}</span>
                    {cents !== 0 && (
                      <span className="text-xl font-black tracking-tight tabular-nums">.{cents.toString().padStart(2, "0")}</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <strong className="text-foreground">{pkg.credits}</strong> 积分 · {pkg.perCredit}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="mt-8 text-center">
          <Button asChild variant="outline" className="rounded-full font-bold">
            <Link href="/pricing">查看完整定价 →</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function CTA({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-4xl font-black tracking-tight">
          现在就把你的商品图<br />
          变成<span className="text-primary">一整套</span>详情页
        </h2>
        <p className="mt-4 text-muted-foreground">注册即送 10 积分，足够生成一整套 6 张详情图。</p>
        <div className="mt-8">
          <Button asChild size="lg" className="gap-2 rounded-full font-bold px-6 h-12 text-base shadow-[0_6px_24px_-4px_oklch(0.67_0.21_38_/_0.5)]">
            <Link href={loggedIn ? "/generate" : "/register"}>
              {loggedIn ? "开始生成" : "免费注册"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
