import { cn } from "@/lib/utils";

/**
 * Brand mark, matching the Vibrant Orange design pack:
 * a rounded square in primary orange showing the Chinese character "详".
 * Wordmark sits beside it.
 */
export function Logo({
  className,
  withWordmark = true,
  size = "md",
}: {
  className?: string;
  withWordmark?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const dims = size === "sm" ? "h-7 w-7 text-sm" : size === "lg" ? "h-9 w-9 text-lg" : "h-8 w-8 text-base";
  const textCls = size === "sm" ? "text-base" : size === "lg" ? "text-xl" : "text-lg";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn(
          "inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground font-black tracking-tighter shadow-[0_4px_14px_-2px_oklch(0.67_0.21_38_/_0.5)]",
          dims,
        )}
      >
        详
      </span>
      {withWordmark && (
        <span className={cn("font-extrabold tracking-tight text-foreground", textCls)}>
          详图<span className="text-primary">AI</span>
        </span>
      )}
    </span>
  );
}
