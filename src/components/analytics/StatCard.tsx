"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { AnalyticsHighlight } from "@/types";

/* Highlight tile — hardest question, fastest team, etc. */
export function StatCard({ stat, index = 0 }: { stat: AnalyticsHighlight; index?: number }) {
  return (
    <Card className="rounded-2xl p-[18px] flex flex-col gap-2">
      <SectionLabel>
        <Icon name={stat.icon} size={12} style={{ color: stat.iconColor }} />
        {stat.label}
      </SectionLabel>
      <span className="text-sm font-semibold text-ink">{stat.title}</span>
      <span className="text-xs text-mute-2">{stat.detail}</span>
      <div className="h-[5px] rounded-[3px] bg-line/[.07]">
        <motion.div
          className="h-[5px] rounded-[3px]"
          style={{ background: stat.barColor }}
          initial={{ width: 0 }}
          animate={{ width: `${stat.barPercent}%` }}
          transition={{ delay: 0.1 + index * 0.08, duration: 0.6, ease: [0.2, 0.9, 0.3, 1] }}
        />
      </div>
    </Card>
  );
}
