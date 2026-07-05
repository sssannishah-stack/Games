import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";

/* Lightweight stand-in for workspace routes not yet designed.
   Keeps sidebar navigation functional without inventing new UI. */
export function Placeholder({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: string;
}) {
  return (
    <>
      <Header title={title} subtitle={subtitle} />
      <Card className="rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center flex-1">
        <div className="w-14 h-14 rounded-[18px] bg-accent/10 border border-dashed border-accent/45 flex items-center justify-center">
          <Icon name={icon} size={24} className="text-accent" />
        </div>
        <span className="text-[15px] font-bold text-ink">{title}</span>
        <span className="text-xs text-mute-2 max-w-[320px] leading-relaxed">{subtitle}</span>
      </Card>
    </>
  );
}
