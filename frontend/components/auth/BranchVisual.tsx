"use client";

import { motion } from "motion/react";

/**
 * Decorative animated repository/branch graph for the signup side panel.
 * Purely visual — communicates "build together, ship together."
 */
export function BranchVisual() {
  return (
    <div className="relative flex flex-col items-center gap-10 px-12 text-center">
      <div>
        <h2 className="text-3xl font-semibold tracking-tight text-balance text-foreground">
          Build together.
          <br />
          <span className="text-gradient">Ship together.</span>
        </h2>
        <p className="mt-3 max-w-xs text-sm text-muted">
          Every branch, every review, every conversation — in one workspace.
        </p>
      </div>

      <svg width="280" height="200" viewBox="0 0 280 200" fill="none" aria-hidden="true">
        <motion.path
          d="M40 100 H120"
          stroke="rgba(148,199,224,0.25)"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
        <motion.path
          d="M120 100 C 150 100, 150 50, 180 50"
          stroke="url(#branchGradient)"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
        />
        <motion.path
          d="M120 100 C 150 100, 150 150, 180 150"
          stroke="url(#branchGradient)"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
        />
        <motion.path
          d="M180 50 C 210 50, 210 100, 240 100"
          stroke="rgba(148,199,224,0.25)"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
        />
        <motion.path
          d="M180 150 C 210 150, 210 100, 240 100"
          stroke="rgba(148,199,224,0.25)"
          strokeWidth="2"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, delay: 0.9, ease: "easeOut" }}
        />

        <defs>
          <linearGradient id="branchGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
        </defs>

        {[
          { cx: 40, cy: 100, delay: 0 },
          { cx: 120, cy: 100, delay: 0.3 },
          { cx: 180, cy: 50, delay: 0.6 },
          { cx: 180, cy: 150, delay: 0.7 },
          { cx: 240, cy: 100, delay: 1.1 },
        ].map((node, index) => (
          <motion.circle
            key={index}
            cx={node.cx}
            cy={node.cy}
            r="6"
            fill="#0c1117"
            stroke="#22d3ee"
            strokeWidth="2"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: node.delay }}
          />
        ))}
      </svg>
    </div>
  );
}
