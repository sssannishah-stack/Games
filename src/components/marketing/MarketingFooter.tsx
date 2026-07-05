import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export function MarketingFooter() {
  return (
    <footer className="border-t border-line/[.06] py-7 md:py-10 px-4 md:px-5">
      <div className="max-w-[1180px] mx-auto flex flex-col sm:flex-row items-center gap-3 sm:gap-0 justify-between text-[12.5px] text-mute-2 text-center sm:text-left">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <div className="w-6 h-6 rounded-[7px] bg-[linear-gradient(135deg,#6C7BFA,#4E96D8)] flex items-center justify-center">
            <Icon name="sparkles" size={11} className="text-white" />
          </div>
          <span className="font-semibold text-ink-3">Encore</span>
          <span className="text-dim">— Live Competition OS</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/join" className="hover:text-ink-2 transition-colors">
            Join a room
          </Link>
        </div>
      </div>
    </footer>
  );
}
