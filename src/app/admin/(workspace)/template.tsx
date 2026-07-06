"use client";

import { motion } from "framer-motion";
import { useMotionEnabled } from "@/components/motion/useMotionEnabled";

/**
 * Route template — re-mounts on every navigation within the admin workspace,
 * giving each page a quick fade + rise entrance. It becomes the flex container
 * for the page (mirroring WorkspaceShell's <main>) so section spacing is kept.
 */
export default function WorkspaceTemplate({ children }: { children: React.ReactNode }) {
  const { enabled } = useMotionEnabled();

  if (!enabled) {
    return <div className="flex flex-1 flex-col gap-6">{children}</div>;
  }

  return (
    <motion.div
      className="flex flex-1 flex-col gap-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.2, 0.9, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
