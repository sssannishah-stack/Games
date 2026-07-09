"use client";

import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string; // width etc.
}

export function Modal({ open, onClose, children, className }: ModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="absolute inset-0 bg-[rgba(4,5,7,.62)] backdrop-blur-[4px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className={cn(
              // Theme-aware surface: dark panel in the dark theme, light panel
              // in the bright theme. Must NOT be hardcoded dark — the content
              // uses flip-aware text tokens (text-ink etc.), so a fixed dark
              // panel renders dark-on-dark and vanishes in the bright theme.
              "relative w-full max-w-[680px] bg-elev/[.96] border border-line/10 rounded-[20px] shadow-[0_40px_120px_rgba(0,0,0,.7)] backdrop-blur-[20px] overflow-hidden",
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
