"use client";

import { motion } from "motion/react";

const ORBIT_NODES = [
  { radius: 90, size: 10, duration: 14, delay: 0, label: "PR" },
  { radius: 130, size: 8, duration: 20, delay: -4, label: "●" },
  { radius: 130, size: 8, duration: 20, delay: -12, label: "●" },
  { radius: 165, size: 7, duration: 26, delay: -8, label: "●" },
  { radius: 165, size: 7, duration: 26, delay: -20, label: "●" },
];

/**
 * Decorative animated orbit for the login side panel.
 * Distinct from signup's static branch graph — communicates
 * "your workspace, always in motion."
 */
export function LoginVisual() {
  return (
    <div className="relative flex flex-col items-center gap-10 px-12 text-center">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground">
          Pick up right
          <br />
          <span className="text-gradient">where you left off.</span>
        </h2>
        <p className="mt-3 max-w-xs text-sm text-muted">
          Your rooms, reviews and conversations — waiting exactly as you left them.
        </p>
      </div>

      <div className="relative flex h-80 w-80 items-center justify-center">
        {[90, 130, 165].map((radius) => (
          <div
            key={radius}
            className="absolute rounded-full border border-border-strong/60"
            style={{ width: radius * 2, height: radius * 2 }}
            aria-hidden="true"
          />
        ))}

        <motion.div
          className="glass-panel absolute flex h-14 w-14 items-center justify-center rounded-full border-accent/40"
          animate={{ boxShadow: ["0 0 0px rgba(34,211,238,0.0)", "0 0 24px rgba(34,211,238,0.35)", "0 0 0px rgba(34,211,238,0.0)"] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <span className="font-mono text-sm font-semibold text-accent">.ly</span>
        </motion.div>

        {ORBIT_NODES.map((node, index) => (
          <motion.div
            key={index}
            className="absolute h-full w-full"
            style={{ originX: "50%", originY: "50%" }}
            animate={{ rotate: 360 }}
            transition={{ duration: node.duration, delay: node.delay, repeat: Infinity, ease: "linear" }}
          >
            <div
              className="absolute flex items-center justify-center rounded-full border border-accent-2/40 bg-background-2 font-mono text-[10px] text-accent-2"
              style={{
                width: node.size * 3,
                height: node.size * 3,
                top: `calc(50% - ${node.radius}px - ${node.size * 1.5}px)`,
                left: `calc(50% - ${node.size * 1.5}px)`,
              }}
            >
              {node.label}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
