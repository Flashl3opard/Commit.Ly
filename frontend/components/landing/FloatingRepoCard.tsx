"use client";

import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/lib/hooks/useReducedMotion";

type FloatingRepoCardProps = {
  children: ReactNode;
  className?: string;
  /** How strongly this card reacts to pointer movement; higher = more movement. */
  depth?: number;
  /** Base float animation delay so cards don't bob in sync. */
  floatDelay?: number;
  scrollParallax?: MotionValue<number>;
};

export function FloatingRepoCard({
  children,
  className = "",
  depth = 0.2,
  floatDelay = 0,
  scrollParallax,
}: FloatingRepoCardProps) {
  const reduced = usePrefersReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 50, damping: 18, mass: 0.4 });
  const springY = useSpring(pointerY, { stiffness: 50, damping: 18, mass: 0.4 });
  const offsetX = useTransform(springX, [-1, 1], [-14 * depth * 5, 14 * depth * 5]);
  const offsetY = useTransform(springY, [-1, 1], [-10 * depth * 5, 10 * depth * 5]);

  useEffect(() => {
    if (reduced) return;

    function handlePointerMove(event: PointerEvent) {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      pointerX.set(x);
      pointerY.set(y);
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [reduced, pointerX, pointerY]);

  if (reduced) {
    return (
      <div className={`glass-panel rounded-xl px-4 py-3 shadow-2xl ${className}`}>{children}</div>
    );
  }

  return (
    <motion.div
      className={`glass-panel rounded-xl px-4 py-3 shadow-2xl ${className}`}
      style={{
        x: offsetX,
        y: scrollParallax ?? offsetY,
      }}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{
        opacity: 1,
        scale: 1,
        translateY: [0, -6, 0],
      }}
      transition={{
        opacity: { duration: 0.6, delay: floatDelay },
        scale: { duration: 0.6, delay: floatDelay },
        translateY: {
          duration: 4.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: floatDelay,
        },
      }}
    >
      {children}
    </motion.div>
  );
}
