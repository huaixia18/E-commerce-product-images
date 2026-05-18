import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "电商详情图生成器",
  description: "上传商品图，AI 自动生成电商详情图。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <Nav />
        <div className="flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  );
}
