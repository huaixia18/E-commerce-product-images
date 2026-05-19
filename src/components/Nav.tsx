import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sparkles, LogOut } from "lucide-react";
import { prisma } from "@/lib/prisma";

export async function Nav() {
  const session = await auth();
  const credits = session?.user?.id
    ? (await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { credits: true },
      }))?.credits ?? 0
    : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center">
          <Logo />
        </Link>
        <nav className="flex items-center gap-5 text-sm font-medium text-muted-foreground">
          {!session?.user && (
            <>
              <Link href="#features" className="hover:text-foreground hidden sm:inline">产品</Link>
              <Link href="/pricing" className="hover:text-foreground">定价</Link>
              <Link href="/login" className="hover:text-foreground">登录</Link>
            </>
          )}
          {session?.user ? (
            <>
              <Link href="/dashboard" className="hover:text-foreground hidden sm:inline">控制台</Link>
              <CreditChip credits={credits ?? 0} />
              <Button asChild size="sm" className="gap-1.5 font-bold rounded-full px-4">
                <Link href="/generate">
                  <Sparkles className="h-4 w-4" />
                  开始生成
                </Link>
              </Button>
              <UserMenu email={session.user.email ?? ""} />
            </>
          ) : (
            <Button asChild size="sm" className="gap-1.5 font-bold rounded-full px-4">
              <Link href="/register">免费试用</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}

function CreditChip({ credits }: { credits: number }) {
  return (
    <Link
      href="/pricing"
      className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold whitespace-nowrap hover:bg-secondary/80"
    >
      <CoinDot />
      <span className="text-foreground">积分</span>
      <strong className="text-primary tabular-nums">{credits}</strong>
      <span className="ml-1 text-[10px] text-muted-foreground bg-background rounded px-1.5 py-0.5">+ 充值</span>
    </Link>
  );
}

function CoinDot() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-primary">
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9h4a2 2 0 010 4H9zM9 15h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserMenu({ email }: { email: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-9 w-9 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label="账户菜单"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-purple text-white text-sm font-bold">
          {email.charAt(0).toUpperCase()}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex flex-col">
          <span className="text-xs font-normal text-muted-foreground">已登录</span>
          <span className="truncate font-medium">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/dashboard" />}>控制台</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/dashboard/invite" />}>邀请中心</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/dashboard/settings" />}>账号设置</DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/pricing" />}>充值积分</DropdownMenuItem>
        <DropdownMenuSeparator />
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent/40 text-left"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
