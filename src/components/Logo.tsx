import { cn } from "@/lib/utils";

/**
 * Brand mark + wordmark. The mark is a simple square gradient with a stylized
 * "stack" silhouette — evokes layered detail-page panels.
 */
export function Logo({ className, withWordmark = true }: { className?: string; withWordmark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Mark />
      {withWordmark && (
        <span className="font-semibold tracking-tight text-foreground">
          详图AI
        </span>
      )}
    </span>
  );
}

function Mark() {
  return (
    <span
      aria-hidden
      className="relative inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent shadow-sm ring-1 ring-primary/20"
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4 text-primary-foreground" fill="currentColor">
        <rect x="2" y="2" width="6" height="6" rx="1.2" opacity="0.85" />
        <rect x="8" y="5" width="6" height="6" rx="1.2" opacity="0.55" />
        <rect x="5" y="8" width="6" height="6" rx="1.2" />
      </svg>
    </span>
  );
}
