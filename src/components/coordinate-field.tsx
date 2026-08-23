import { CORECOORD_COORDINATE_FIELD } from "@/lib/brand";
import { cn } from "@/lib/utils";

export interface CoordinateFieldProps {
  className?: string;
  alt?: string;
  priority?: boolean;
}

/** Optional coordinate-field texture from the approved CORECOORD asset set. */
export function CoordinateField({ className, alt = "", priority = false }: CoordinateFieldProps) {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={CORECOORD_COORDINATE_FIELD}
      alt={alt}
      aria-hidden={alt ? undefined : true}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      data-brand-graphic="coordinate-field"
      className={cn("pointer-events-none block select-none", className)}
    />
  );
}

