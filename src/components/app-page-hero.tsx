import type { ReactNode } from "react";
import { CoordinateField } from "@/components/coordinate-field";
import { cn } from "@/lib/utils";

interface AppPageHeroProps {
  children: ReactNode;
  className?: string;
}

export function AppPageHero({ children, className }: AppPageHeroProps) {
  return (
    <section className={cn("relative overflow-hidden bg-reverse-background pt-11 pb-8.5 text-white", className)}>
      <CoordinateField className="absolute top-0 right-0 h-full w-1/2 object-cover opacity-15 mix-blend-screen" />
      <div className="relative z-10 w-full px-7">{children}</div>
    </section>
  );
}
