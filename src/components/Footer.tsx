import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="border-t border-border/60 bg-muted/30 mt-auto">
      <div className="mx-auto max-w-6xl px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div className="col-span-2 space-y-3">
          <Logo />
          <p className="text-muted-foreground max-w-xs">
            AI 自动生成电商详情图。让卖家把时间花在卖货上，不是 PS 上。
          </p>
        </div>
        <div className="space-y-2">
          <h4 className="font-medium">产品</h4>
          <ul className="space-y-1.5 text-muted-foreground">
            <li><Link href="/generate" className="hover:text-foreground">开始生成</Link></li>
            <li><Link href="/pricing" className="hover:text-foreground">定价</Link></li>
            <li><Link href="/dashboard" className="hover:text-foreground">控制台</Link></li>
          </ul>
        </div>
        <div className="space-y-2">
          <h4 className="font-medium">支持</h4>
          <ul className="space-y-1.5 text-muted-foreground">
            <li><Link href="/login" className="hover:text-foreground">登录</Link></li>
            <li><Link href="/register" className="hover:text-foreground">注册</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-muted-foreground flex items-center justify-between">
          <span>© {new Date().getFullYear()} 详图AI</span>
          <span>由 gpt-image-2 驱动</span>
        </div>
      </div>
    </footer>
  );
}
