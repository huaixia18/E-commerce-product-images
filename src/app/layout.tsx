import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "电商详情图生成器 — AI 自动生成商品详情图",
  description:
    "上传商品图，填写卖点，AI 自动生成主图、卖点图、场景图、参数卡，一键打包下载。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // System font stack falls back gracefully when Google Fonts isn't reachable.
  // Inter/Geist is wrapped here as inline CSS variable; can be swapped to
  // next/font once production network access to Google is verified.
  return (
    <html lang="zh-CN" className="antialiased">
      <body className="min-h-screen flex flex-col bg-background text-foreground font-sans">
        <TooltipProvider>
          <Nav />
          <div className="flex-1 flex flex-col">{children}</div>
          <Footer />
          <Toaster richColors closeButton position="top-center" />
        </TooltipProvider>
      </body>
    </html>
  );
}
