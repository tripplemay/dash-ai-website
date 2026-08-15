"use client";

import { useEffect } from "react";
import { motion, stagger, useAnimate } from "framer-motion";
import { cn } from "@/lib/utils";

/** Aceternity UI · TextGenerateEffect（copy-paste 引入，适配中文按字切分） */
export const TextGenerateEffect = ({
  words,
  className,
  filter = true,
  duration = 0.5,
}: {
  words: string;
  className?: string;
  filter?: boolean;
  duration?: number;
}) => {
  const [scope, animate] = useAnimate();
  const hasSpace = words.includes(" ");
  const units = hasSpace ? words.split(" ") : Array.from(words);

  useEffect(() => {
    animate(
      "span",
      { opacity: 1, filter: filter ? "blur(0px)" : "none" },
      { duration: duration ?? 1, delay: stagger(0.06) }
    );
  }, [scope.current, animate, filter, duration]);

  return (
    <div className={cn("font-bold", className)}>
      <motion.div ref={scope}>
        {units.map((unit, idx) => (
          <motion.span
            key={unit + idx}
            className="opacity-0"
            style={{ filter: filter ? "blur(10px)" : "none" }}
          >
            {unit}
            {hasSpace ? " " : ""}
          </motion.span>
        ))}
      </motion.div>
    </div>
  );
};
