import Link from "next/link";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PanelIllustration } from "@/components/PanelIllustration";
import { PANELS } from "@/lib/promptTemplate";
import { PACKAGES, PACKAGE_ORDER } from "@/lib/payment/packages";
import {
  ArrowRight,
  Upload,
  Sparkles,
  Download,
  Layers,
  Zap,
  ShieldCheck,
} from "lucide-react";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex-1">
      <Hero loggedIn={!!session?.user?.id} />
      <Showcase />
      <Features />
      <HowItWorks />
      <PricingTeaser />
      <FAQ />
      <CTA loggedIn={!!session?.user?.id} />
    </main>
  );
}

function Hero({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section className="relative overflow-hidden">
      {/* Decorative gradient blobs */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-accent/15 blur-3xl" />
      </div>
      <div className="mx-auto max-w-6xl px-6 pt-20 pb-24 text-center">
        <Badge variant="secondary" className="mb-6 rounded-full px-3 py-1 text-xs font-medium">
          <Sparkles className="h-3 w-3 mr-1 text-primary" />
          由 gpt-image-2 驱动
        </Badge>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-balance">
          上传商品图，<br className="sm:hidden" />
          <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
            一键生成电商详情图
          </span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
          主图、卖点图、场景图、参数卡 —— AI 按你填的卖点自动出图，几分钟搞定一整套上架素材。
          打包 zip 直接下载。
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          {loggedIn ? (
            <Button asChild size="lg" className="gap-2">
              <Link href="/generate">
                立即开始生成
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild size="lg" className="gap-2">
                <Link href="/register">
                  免费试用 · 送 10 积分
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/pricing">查看价格</Link>
              </Button>
            </>
          )}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          注册即送 10 积分，可生成 1 整套详情图 · 无需信用卡
        </p>
      </div>
    </section>
  );
}

function Showcase() {
  return (
    <section className="relative pb-16">
      <div className="mx-auto max-w-6xl px-6">
        <div className="rounded-2xl border border-border bg-card/40 backdrop-blur p-4 md:p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between px-2">
            <div>
              <h3 className="font-semibold">一次生成 6 张图</h3>
              <p className="text-xs text-muted-foreground mt-0.5">主图 / 3 张卖点图 / 场景图 / 参数卡</p>
            </div>
            <Badge variant="outline" className="text-xs">示例预览</Badge>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {PANELS.map((p) => (
              <div
                key={p.id}
                className={`relative rounded-lg overflow-hidden border border-border bg-background ${
                  p.aspect === "3:2" ? "aspect-[3/2]" : "aspect-square"
                }`}
              >
                <PanelIllustration panel={p.id} />
                <div className="absolute top-2 left-2 rounded-md bg-background/90 backdrop-blur px-2 py-0.5 text-[11px] font-medium border border-border/60">
                  {p.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    {
      icon: Layers,
      title: "多张参考图融合",
      desc: "最多上传 5 张商品图，主图 + 4 张参考。AI 自动识别商品形态、颜色、Logo，确保每张输出都对得上你的产品。",
    },
    {
      icon: Sparkles,
      title: "灵活选择面板",
      desc: "只要主图？只要卖点图 + 场景图？随你勾选 1–6 张，按张计费，不浪费一分钱。",
    },
    {
      icon: Zap,
      title: "平台尺寸预设",
      desc: "淘宝、天猫、京东、亚马逊 —— 一键切换目标平台，自动套用对应分辨率，省去你手动调整。",
    },
    {
      icon: ShieldCheck,
      title: "失败自动退款",
      desc: "任何一张生成失败，对应积分自动退回。预扣费、按张结算，可追溯到每一笔。",
    },
  ];
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">为什么是详图AI</h2>
          <p className="mt-3 text-muted-foreground">把卖家从 PS 里解放出来，专注卖货。</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {items.map((it) => (
            <Card key={it.title} className="border-border/60">
              <CardContent className="p-6 flex gap-4">
                <div className="flex-none">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <it.icon className="h-5 w-5" />
                  </span>
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-semibold">{it.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{it.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: Upload,
      label: "01",
      title: "上传商品图",
      desc: "把 1–5 张商品图拖进来，第一张当主图，其余作参考。前端自动压缩，不卡。",
    },
    {
      icon: Sparkles,
      label: "02",
      title: "填卖点 + 选面板",
      desc: "一行写一条卖点，挑你想要的图（主图、卖点图、场景图、参数卡），按张消耗积分。",
    },
    {
      icon: Download,
      label: "03",
      title: "下载 zip",
      desc: "几分钟生成完毕，单图下载或一键打包 zip。失败的自动退积分。",
    },
  ];
  return (
    <section className="py-20 bg-muted/30 border-y border-border/60">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold tracking-tight">三步完成</h2>
          <p className="mt-3 text-muted-foreground">从上传到拿到详情图素材，整个过程 5 分钟以内。</p>
        </div>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {steps.map((s) => (
            <li key={s.label}>
              <Card className="h-full border-border/60">
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-muted-foreground">{s.label}</span>
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <s.icon className="h-4 w-4" />
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function PricingTeaser() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold tracking-tight">明码标价，按张付费</h2>
          <p className="mt-3 text-muted-foreground">1 积分 = 1 张图。失败自动退款。</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PACKAGE_ORDER.map((id) => {
            const pkg = PACKAGES[id];
            const featured = !!pkg.badge;
            return (
              <Card
                key={pkg.id}
                className={
                  featured
                    ? "border-primary shadow-md relative !overflow-visible"
                    : "border-border/60"
                }
              >
                {featured && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {pkg.badge}
                  </span>
                )}
                <CardContent className="p-6 space-y-3">
                  <div className="text-sm font-medium text-muted-foreground">{pkg.label}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight">
                      ¥{Math.floor(pkg.amountCents / 100)}
                    </span>
                    {pkg.amountCents % 100 !== 0 && (
                      <span className="text-xl font-bold tracking-tight">
                        .{(pkg.amountCents % 100).toString().padStart(2, "0")}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {pkg.credits} 积分 · {pkg.perCredit}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <div className="mt-8 text-center">
          <Button asChild variant="outline">
            <Link href="/pricing">查看完整定价 →</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const qs = [
    {
      q: "生成一张图大概多久？",
      a: "单张通常 30–90 秒。一整套（6 张）并发生成，约 1–3 分钟拿到结果。",
    },
    {
      q: "如果生成的图我不满意怎么办？",
      a: "你可以重新提交，只为新生成的图扣积分。失败的图自动退回积分，不亏一分。",
    },
    {
      q: "支持哪些电商平台的尺寸？",
      a: "目前内置淘宝、天猫、京东、亚马逊预设。其他平台用「通用」也能直接出图。",
    },
    {
      q: "我的商品图会被泄露吗？",
      a: "图片存在你私有空间下，只在生成时短期签名供 AI 拉取。任何外部访问需要登录后通过 OSS 签名 URL。",
    },
  ];
  return (
    <section className="py-20 bg-muted/30 border-y border-border/60">
      <div className="mx-auto max-w-3xl px-6">
        <h2 className="text-3xl font-bold tracking-tight text-center mb-10">常见问题</h2>
        <dl className="space-y-4">
          {qs.map((it) => (
            <Card key={it.q} className="border-border/60">
              <CardContent className="p-6">
                <dt className="font-semibold">{it.q}</dt>
                <dd className="mt-2 text-sm text-muted-foreground leading-relaxed">{it.a}</dd>
              </CardContent>
            </Card>
          ))}
        </dl>
      </div>
    </section>
  );
}

function CTA({ loggedIn }: { loggedIn: boolean }) {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-bold tracking-tight">现在就把你的商品图变成一整套详情页</h2>
        <p className="mt-3 text-muted-foreground">注册即送 10 积分，足够生成一整套详情图。</p>
        <div className="mt-8">
          <Button asChild size="lg" className="gap-2">
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
