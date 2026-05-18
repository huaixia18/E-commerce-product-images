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
import { LayoutDashboard, LogOut, Sparkles, Wallet } from "lucide-react";

export async function Nav() {
  const session = await auth();
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between gap-6">
        <Link href="/" className="flex items-center">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {session?.user ? (
            <>
              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <Link href="/dashboard">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="hidden sm:inline">控制台</span>
                </Link>
              </Button>
              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <Link href="/pricing">
                  <Wallet className="h-4 w-4" />
                  <span className="hidden sm:inline">充值</span>
                </Link>
              </Button>
              <Button asChild size="sm" className="gap-1.5 ml-1">
                <Link href="/generate">
                  <Sparkles className="h-4 w-4" />
                  开始生成
                </Link>
              </Button>
              <UserMenu email={session.user.email ?? ""} />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/pricing">定价</Link>
              </Button>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">登录</Link>
              </Button>
              <Button asChild size="sm" className="ml-1">
                <Link href="/register">免费试用</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function UserMenu({ email }: { email: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="ml-1 inline-flex h-8 w-8 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        aria-label="账户菜单"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium">
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
