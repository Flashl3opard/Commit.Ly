"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useScroll, useSpring, useTransform } from "motion/react";
import { usePrefersReducedMotion } from "@/lib/hooks/useReducedMotion";

const NODES = [
  { top: "14%", left: "62%", size: 5, delay: 0 },
  { top: "38%", left: "78%", size: 4, delay: 0.4 },
  { top: "58%", left: "58%", size: 6, delay: 0.8 },
  { top: "22%", left: "40%", size: 3, delay: 1.2 },
  { top: "70%", left: "82%", size: 4, delay: 1.6 },
  { top: "8%", left: "85%", size: 3, delay: 2 },
];

/**
 * Layered hero background: graphite gradient, technical grid, and glowing
 * particle nodes. Scroll moves layers at different speeds (parallax);
 * pointer position nudges the node layer for a subtle sense of depth.
 * Fully static when prefers-reduced-motion is set.
 */
export function ParallaxBackground() {
  const reduced = usePrefersReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  const { scrollY } = useScroll();
  const gradientY = useTransform(scrollY, [0, 1000], [0, 40]);
  const gridY = useTransform(scrollY, [0, 1000], [0, 90]);
  const nodesScrollY = useTransform(scrollY, [0, 1000], [0, 140]);

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 40, damping: 20, mass: 0.5 });
  const springY = useSpring(pointerY, { stiffness: 40, damping: 20, mass: 0.5 });
  const nodesX = useTransform(springX, [-1, 1], [-18, 18]);
  const nodesYFromPointer = useTransform(springY, [-1, 1], [-14, 14]);

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
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 900px 550px at 65% 25%, rgba(34,211,238,0.08), transparent 65%), linear-gradient(180deg, #06080b, #0c1117)",
          }}
        />
        <div className="bg-grid absolute inset-0 opacity-40" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <motion.div
        className="absolute inset-0"
        style={{
          y: gradientY,
          background:
            "radial-gradient(ellipse 900px 550px at 65% 25%, rgba(34,211,238,0.08), transparent 65%), linear-gradient(180deg, #06080b, #0c1117)",
        }}
      />
      <motion.div className="bg-grid absolute -inset-x-10 -inset-y-10 opacity-40" style={{ y: gridY }} />
      <motion.div className="absolute inset-0" style={{ y: nodesScrollY, x: nodesX }}>
        {NODES.map((node, index) => (
          <motion.span
            key={index}
            className="absolute rounded-full bg-accent"
            style={{
              top: node.top,
              left: node.left,
              width: node.size,
              height: node.size,
              y: nodesYFromPointer,
              boxShadow: "0 0 12px 2px rgba(34,211,238,0.6)",
            }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{
              duration: 3.5,
              repeat: Infinity,
              ease: "easeInOut",
              delay: node.delay,
            }}
          />
        ))}
      </motion.div>
    </div>
  );
}
