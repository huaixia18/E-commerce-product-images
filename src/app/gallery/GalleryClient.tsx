"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, X, Sparkles, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface GalleryImage {
  id: string;
  jobId: string;
  jobTitle: string;
  panel: string;
  panelLabel: string;
  url: string;
  width: number | null;
  height: number | null;
  createdAt: string;
  downloadUrl: string;
}

export function GalleryClient({
  items,
  projects,
}: {
  items: GalleryImage[];
  projects: { id: string; title: string }[];
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<GalleryImage | null>(null);

  const shown = useMemo(
    () => (filter ? items.filter((i) => i.jobId === filter) : items),
    [items, filter],
  );

  return (
    <main className="flex-1 bg-background">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <header className="flex items-baseline justify-between mb-5">
          <div>
            <h1 className="text-2xl font-black tracking-tight">历史图库</h1>
            <p className="text-xs text-muted-foreground mt-1">
              共 {items.length} 张图 · 来自 {projects.length} 个项目
            </p>
          </div>
          <Button asChild className="rounded-full gap-1.5 font-bold">
            <Link href="/generate">
              <Sparkles className="h-3.5 w-3.5" />
              去生成
            </Link>
          </Button>
        </header>

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Sparkles className="h-6 w-6" />
            </div>
            <div className="font-bold">图库还是空的</div>
            <p className="text-sm text-muted-foreground">生成第一套详情图后，所有出图都会汇总到这里。</p>
            <Button asChild className="rounded-full font-bold mt-2">
              <Link href="/generate">开始生成</Link>
            </Button>
          </div>
        ) : (
          <>
            {/* Project filter chips */}
            <div className="flex flex-wrap gap-2 mb-6">
              <FilterChip active={filter === null} onClick={() => setFilter(null)}>
                全部
              </FilterChip>
              {projects.map((p) => (
                <FilterChip key={p.id} active={filter === p.id} onClick={() => setFilter(p.id)}>
                  {p.title}
                </FilterChip>
              ))}
            </div>

            {/* Masonry grid */}
            <div className="columns-2 sm:columns-3 lg:columns-4 gap-3 [column-fill:_balance]">
              {shown.map((img) => (
                <figure
                  key={img.id}
                  className="mb-3 break-inside-avoid rounded-xl overflow-hidden border border-border bg-card group relative cursor-zoom-in"
                  onClick={() => setLightbox(img)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.jobTitle}
                    loading="lazy"
                    className="w-full block"
                  />
                  <figcaption className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="text-white text-[11px] font-bold truncate">{img.jobTitle}</div>
                    <div className="text-white/70 text-[10px]">{img.panelLabel}</div>
                  </figcaption>
                  <a
                    href={img.downloadUrl}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/55 text-white grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/75"
                    aria-label="下载"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                </figure>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm grid place-items-center p-6"
          onClick={() => setLightbox(null)}
        >
          <div
            className="max-w-3xl w-full bg-card rounded-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="min-w-0">
                <div className="text-sm font-bold truncate">{lightbox.jobTitle}</div>
                <div className="text-[11px] text-muted-foreground">{lightbox.panelLabel}</div>
              </div>
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="w-8 h-8 rounded-full hover:bg-secondary grid place-items-center"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-secondary grid place-items-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={lightbox.url} alt={lightbox.jobTitle} className="max-w-full max-h-[60vh] rounded-lg" />
            </div>
            <div className="flex items-center gap-2 px-4 py-3 border-t border-border">
              <Button asChild className="rounded-full gap-1.5 font-bold flex-1">
                <a href={lightbox.downloadUrl} download>
                  <Download className="h-4 w-4" />
                  下载这张
                </a>
              </Button>
              <Button asChild variant="outline" className="rounded-full gap-1.5 font-bold">
                <Link href={`/generate?job=${lightbox.jobId}`}>
                  <ExternalLink className="h-4 w-4" />
                  打开项目
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors border max-w-[180px] truncate",
        active
          ? "bg-foreground text-background border-foreground"
          : "bg-card text-foreground border-border hover:border-foreground/30",
      )}
    >
      {children}
    </button>
  );
}
