"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { Kbd } from "@/components/ui/Kbd";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useMotionEnabled } from "@/components/motion/useMotionEnabled";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/actions/auth.actions";
import type { CurrentUser } from "@/lib/auth/getCurrentUser";

interface NavItem {
  icon: string;
  label: string;
  href: string;
  count?: string;
}

interface SidebarProps {
  user: CurrentUser;
  competitionsCount: number;
}

function buildNav(competitionsCount: number): { section: string; items: NavItem[] }[] {
  return [
    {
      section: "",
      items: [{ icon: "house", label: "Dashboard", href: "/admin" }],
    },
    {
      section: "BUILD",
      items: [
        { icon: "circle-question-mark", label: "Questions", href: "/admin/questions" },
        { icon: "list-ordered", label: "Rounds", href: "/admin/rounds" },
        { icon: "sparkles", label: "Power Cards", href: "/admin/power-cards" },
        {
          icon: "trophy",
          label: "Competitions",
          href: "/admin/competitions",
          count: String(competitionsCount),
        },
      ],
    },
    {
      section: "SYSTEM",
      items: [{ icon: "settings", label: "Settings", href: "/admin/settings" }],
    },
  ];
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const { enabled } = useMotionEnabled();
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center rounded-[9px] px-2.5 py-[7px] text-[13px]",
        active ? "text-ink-2 font-medium" : "text-mute hover:bg-line/[.05] hover:text-ink-2"
      )}
    >
      {/* Gliding active pill — a shared layoutId slides it between items. */}
      {active && (
        <motion.span
          layoutId="sidebarActive"
          className="absolute inset-0 rounded-[9px] bg-accent/[.14]"
          transition={enabled ? { type: "spring", stiffness: 520, damping: 40 } : { duration: 0 }}
        />
      )}
      <span className="relative z-[1] flex w-full items-center gap-2.5 transition-transform duration-150 group-hover:translate-x-0.5">
        <Icon
          name={item.icon}
          size={15}
          className={cn("transition-transform duration-150 group-hover:scale-110", active && "text-accent")}
        />
        {item.label}
        {item.count && (
          <span className="ml-auto font-mono font-medium text-[10.5px] text-dim-2">{item.count}</span>
        )}
      </span>
    </Link>
  );
}

export function Sidebar({ user, competitionsCount }: SidebarProps) {
  const pathname = usePathname();
  const NAV = buildNav(competitionsCount);
  const initials = user.name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="hidden lg:flex w-[252px] shrink-0 border-r border-line/[.06] bg-line/[.015] flex-col px-3.5 py-5 gap-2 min-h-screen sticky top-0 max-h-screen overflow-y-auto">
      {/* brand */}
      <div className="flex items-center gap-2.5 px-2 pb-3.5 pt-1">
        <div className="w-[34px] h-[34px] rounded-[10px] bg-[linear-gradient(135deg,#6C7BFA,#4E96D8)] flex items-center justify-center shadow-[0_4px_18px_rgba(108,123,250,.4)]">
          <Icon name="sparkles" size={17} className="text-white" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold text-[15px] text-ink-2 tracking-[-.01em]">Encore</span>
          <span className="text-[10.5px] text-dim tracking-[.02em]">Live Competition OS</span>
        </div>
      </div>

      {/* search */}
      <button className="flex items-center gap-2 bg-line/[.04] border border-line/[.07] rounded-[10px] px-2.5 py-[7px] text-dim text-[12.5px] cursor-pointer hover:bg-line/[.06]">
        <Icon name="search" size={14} />
        Search
        <Kbd className="ml-auto">⌘K</Kbd>
      </button>

      {NAV.map((group, index) => (
        <div key={group.section || `group-${index}`} className="flex flex-col gap-0.5">
          {group.section && (
            <div className="font-mono font-semibold text-[10px] tracking-[.14em] text-label px-2.5 pt-3 pb-1">
              {group.section}
            </div>
          )}
          {group.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href)}
            />
          ))}
        </div>
      ))}

      {/* footer */}
      <div className="mt-auto flex flex-col gap-0.5 pt-4">
        <div className="flex items-center gap-2.5 p-2.5 mt-2 rounded-xl bg-line/[.03] border border-line/[.06]">
          <div className="w-[30px] h-[30px] rounded-full bg-[linear-gradient(135deg,#E8A33D,#E36A8A)] flex items-center justify-center text-xs font-bold text-white shrink-0">
            {initials || "H"}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[12.5px] font-semibold text-ink-2 truncate">{user.name}</span>
            <span className="text-[10.5px] text-dim capitalize">{user.role.toLowerCase()}</span>
          </div>
          <div className="ml-auto flex items-center gap-0.5">
            <ThemeToggle className="w-7 h-7 border-0 bg-transparent" />
            <form action={logoutAction}>
              <button
                type="submit"
                title="Sign out"
                className="w-7 h-7 rounded-lg flex items-center justify-center text-dim-2 hover:text-ink-2 hover:bg-line/[.06] cursor-pointer"
              >
                <Icon name="log-out" size={14} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </aside>
  );
}
