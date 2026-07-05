import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

/** Minimal sticky top bar for the public marketing site. */
export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-base/70 border-b border-line/[.06]">
      <div className="max-w-[1180px] mx-auto flex items-center gap-3 px-4 md:px-8 h-14 md:h-16">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[9px] bg-[linear-gradient(135deg,#6C7BFA,#4E96D8)] flex items-center justify-center shadow-[0_4px_16px_rgba(108,123,250,.4)] shrink-0">
            <Icon name="sparkles" size={15} className="text-white" />
          </div>
          <span className="font-bold text-[15px] text-ink tracking-[-.01em]">Encore</span>
        </Link>

        <nav className="hidden md:flex items-center gap-6 ml-8 text-[13.5px] text-mute-2">
          <a href="#features" className="hover:text-ink-2 transition-colors">
            Features
          </a>
          <a href="#how-it-works" className="hover:text-ink-2 transition-colors">
            How it works
          </a>
          <a href="#use-cases" className="hover:text-ink-2 transition-colors">
            Use cases
          </a>
        </nav>

        <ThemeToggle className="ml-auto w-9 h-9" />
      </div>
    </header>
  );
}
