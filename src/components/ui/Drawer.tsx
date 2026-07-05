"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

/* Right-side drawer, as used for Team Inventory and the Question editor. */
export function Drawer({ open, onClose, children, className }: DrawerProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-[rgba(4,5,7,.55)] backdrop-blur-[2px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            className={cn(
              "relative w-full max-w-[460px] bg-drawer border-l border-line/[.09] shadow-[-30px_0_80px_rgba(0,0,0,.5)] flex flex-col overflow-hidden",
              className
            )}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
