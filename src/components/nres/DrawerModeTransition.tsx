import { motion, useReducedMotion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

export type DrawerMode = "cohort" | "patient";

type DrawerLayer = DrawerMode;

interface DrawerModeTransitionProps {
  activeMode: DrawerMode;
  layer: DrawerLayer;
  children: React.ReactNode;
  className?: string;
  ariaHidden?: boolean;
  transitionKey?: string;
  onTransitionEnd?: () => void;
}

const standardEase = [0.4, 0, 0.2, 1] as const;

export const DrawerModeTransition = ({
  activeMode,
  layer,
  children,
  className,
  ariaHidden,
  transitionKey,
  onTransitionEnd,
}: DrawerModeTransitionProps) => {
  const reducedMotion = useReducedMotion();
  const active = activeMode === layer;

  const variants: Variants = reducedMotion
    ? {
        active: { opacity: 1, scale: 1, y: 0 },
        inactive: { opacity: 0, scale: 1, y: 0 },
      }
    : layer === "cohort"
      ? {
          active: { opacity: 1, scale: 1, y: 0 },
          inactive: { opacity: 0, scale: 0.97, y: 0 },
        }
      : {
          active: { opacity: 1, scale: 1, y: 0 },
          inactive: { opacity: 0, scale: 1, y: 8 },
        };

  const duration = reducedMotion ? 0.1 : active ? 0.24 : 0.22;
  const delay = reducedMotion ? 0 : activeMode === "patient" && layer === "patient" && active ? 0.05 : 0;

  return (
    <motion.div
      key={transitionKey ?? layer}
      initial={false}
      animate={active ? "active" : "inactive"}
      variants={variants}
      transition={{ duration, delay, ease: standardEase }}
      onAnimationComplete={() => {
        if (active) onTransitionEnd?.();
      }}
      aria-hidden={ariaHidden}
      role={layer === "patient" ? "region" : undefined}
      aria-live={layer === "patient" ? "polite" : undefined}
      className={cn(
        "absolute inset-0 flex min-h-0 origin-top flex-col bg-background will-change-transform",
        active ? "pointer-events-auto" : "pointer-events-none",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};
