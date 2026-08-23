import { CORECOORD_LOGO } from "@/lib/brand";
import { cn } from "@/lib/utils";

export type BrandLogoVariant =
  | "horizontal"
  | "horizontal-color"
  | "horizontal-reverse"
  | "reverse"
  | "stacked"
  | "stacked-color"
  | "stacked-reverse"
  | "mark"
  | "mark-color"
  | "mark-reverse";

const VARIANT_SOURCES: Record<BrandLogoVariant, string> = {
  horizontal: CORECOORD_LOGO.horizontal,
  "horizontal-color": CORECOORD_LOGO.horizontal,
  "horizontal-reverse": CORECOORD_LOGO.horizontalReverse,
  reverse: CORECOORD_LOGO.horizontalReverse,
  stacked: CORECOORD_LOGO.stacked,
  "stacked-color": CORECOORD_LOGO.stacked,
  "stacked-reverse": CORECOORD_LOGO.stackedReverse,
  mark: CORECOORD_LOGO.mark,
  "mark-color": CORECOORD_LOGO.mark,
  "mark-reverse": CORECOORD_LOGO.markReverse,
};

const INTRINSIC_SIZE: Record<BrandLogoVariant, { width: number; height: number }> = {
  horizontal: { width: 300, height: 120 },
  "horizontal-color": { width: 300, height: 120 },
  "horizontal-reverse": { width: 300, height: 120 },
  reverse: { width: 300, height: 120 },
  stacked: { width: 200, height: 240 },
  "stacked-color": { width: 200, height: 240 },
  "stacked-reverse": { width: 200, height: 240 },
  mark: { width: 40, height: 40 },
  "mark-color": { width: 40, height: 40 },
  "mark-reverse": { width: 40, height: 40 },
};

export interface BrandLogoProps {
  variant?: BrandLogoVariant;
  alt?: string;
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  decorative?: boolean;
}

/** Official CORECOORD lockups. Do not crop, round, or recolor this image. */
export function BrandLogo({
  variant = "horizontal",
  alt = "芯坐标 CORECOORD",
  className,
  width,
  height,
  priority = false,
  decorative = false,
}: BrandLogoProps) {
  const size = INTRINSIC_SIZE[variant];

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={VARIANT_SOURCES[variant]}
      alt={decorative ? "" : alt}
      aria-hidden={decorative ? true : undefined}
      width={width ?? size.width}
      height={height ?? size.height}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      data-brand-logo="corecoord"
      data-brand-logo-variant={variant}
      className={cn("block shrink-0 object-contain", className)}
    />
  );
}

