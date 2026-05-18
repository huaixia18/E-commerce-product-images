import type { PanelId } from "@/lib/promptTemplate";
import { cn } from "@/lib/utils";

/**
 * Stylized SVG illustration of each panel type. Used in the panel-picker
 * and on the marketing pages so users can recognize what they're choosing
 * before any real image is generated.
 */
export function PanelIllustration({
  panel,
  className,
}: {
  panel: PanelId;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative w-full h-full overflow-hidden rounded-md bg-gradient-to-br from-primary/10 via-background to-accent/10",
        className,
      )}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
        {renderPanel(panel)}
      </svg>
    </div>
  );
}

function renderPanel(panel: PanelId): React.ReactNode {
  switch (panel) {
    case "hero":
      return (
        <g>
          <circle cx="50" cy="50" r="22" fill="oklch(0.5 0.24 270 / 0.25)" />
          <rect x="38" y="48" width="24" height="18" rx="2" fill="oklch(0.5 0.24 270 / 0.65)" />
          <rect x="42" y="42" width="16" height="10" rx="1" fill="oklch(0.78 0.16 70 / 0.85)" />
          <ellipse cx="50" cy="78" rx="18" ry="2" fill="oklch(0.5 0.02 270 / 0.2)" />
        </g>
      );
    case "feature_1":
      return (
        <g>
          <rect x="14" y="22" width="40" height="56" rx="3" fill="oklch(0.5 0.24 270 / 0.55)" />
          <rect x="60" y="32" width="26" height="3" rx="1" fill="oklch(0.5 0.02 270 / 0.6)" />
          <rect x="60" y="40" width="22" height="2" rx="1" fill="oklch(0.5 0.02 270 / 0.4)" />
          <rect x="60" y="46" width="18" height="2" rx="1" fill="oklch(0.5 0.02 270 / 0.4)" />
          <circle cx="71" cy="62" r="6" fill="oklch(0.78 0.16 70 / 0.85)" />
        </g>
      );
    case "feature_2":
      return (
        <g>
          <circle cx="32" cy="50" r="20" fill="oklch(0.5 0.24 270 / 0.55)" />
          <path d="M52 38 L78 38 M52 50 L72 50 M52 62 L66 62" stroke="oklch(0.5 0.02 270 / 0.6)" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="32" cy="50" r="6" fill="oklch(0.78 0.16 70)" />
        </g>
      );
    case "feature_3":
      return (
        <g>
          <rect x="20" y="32" width="60" height="36" rx="4" fill="oklch(0.5 0.24 270 / 0.45)" />
          <circle cx="34" cy="50" r="6" fill="oklch(0.99 0 0)" opacity="0.9" />
          <circle cx="50" cy="50" r="6" fill="oklch(0.78 0.16 70)" />
          <circle cx="66" cy="50" r="6" fill="oklch(0.99 0 0)" opacity="0.9" />
        </g>
      );
    case "lifestyle":
      return (
        <g>
          <rect x="0" y="0" width="100" height="62" fill="oklch(0.78 0.16 70 / 0.35)" />
          <rect x="0" y="62" width="100" height="38" fill="oklch(0.5 0.24 270 / 0.4)" />
          <circle cx="78" cy="22" r="10" fill="oklch(0.99 0.04 70 / 0.95)" />
          <rect x="20" y="48" width="30" height="32" rx="3" fill="oklch(0.99 0 0 / 0.85)" />
          <rect x="24" y="56" width="22" height="14" rx="1" fill="oklch(0.5 0.24 270 / 0.7)" />
        </g>
      );
    case "spec":
      return (
        <g>
          <rect x="50" y="20" width="32" height="44" rx="2" fill="oklch(0.5 0.24 270 / 0.55)" />
          <line x1="18" y1="28" x2="42" y2="28" stroke="oklch(0.5 0.02 270 / 0.5)" strokeWidth="1.5" />
          <line x1="18" y1="38" x2="38" y2="38" stroke="oklch(0.5 0.02 270 / 0.5)" strokeWidth="1.5" />
          <line x1="18" y1="48" x2="40" y2="48" stroke="oklch(0.5 0.02 270 / 0.5)" strokeWidth="1.5" />
          <line x1="18" y1="58" x2="36" y2="58" stroke="oklch(0.5 0.02 270 / 0.5)" strokeWidth="1.5" />
          <text x="18" y="78" fontSize="6" fill="oklch(0.5 0.02 270 / 0.6)" fontFamily="monospace">SPEC</text>
        </g>
      );
  }
}
