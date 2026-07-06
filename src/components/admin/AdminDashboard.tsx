import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Reveal } from "@/components/motion/Reveal";
import { NumberTicker } from "@/components/motion/NumberTicker";
import { CompetitionCard } from "@/components/competition/CompetitionCard";
import { CreateCompetitionButton } from "@/components/competition/CreateCompetitionButton";
import { getCompetitionsByOwner } from "@/data/queries/competition.queries";
import { countQuestionsByOwner } from "@/data/queries/question.queries";
import { countRoundsByOwner } from "@/data/queries/round.queries";
import type { CurrentUser } from "@/lib/auth/getCurrentUser";

const RECENT_LIMIT = 6;

function firstName(name: string) {
  return name.split(" ")[0];
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const linkButtonClass =
  "inline-flex items-center justify-center gap-2 font-medium transition cursor-pointer select-none whitespace-nowrap bg-line/[.04] border border-line/[.09] text-ink-3 hover:bg-line/[.08] text-[12.5px] rounded-[10px] px-3.5 py-2";

function StatTile({
  icon,
  iconColor,
  label,
  value,
  index,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value: number;
  index: number;
}) {
  return (
    <Reveal index={index} hover>
      <Card className="rounded-2xl p-[18px] flex items-center gap-3.5 hover:border-line/[.14] hover:shadow-[0_10px_30px_rgba(0,0,0,.25)] transition-[border-color,box-shadow]">
        <div
          className="w-10 h-10 rounded-[11px] flex items-center justify-center border shrink-0"
          style={{
            background: `color-mix(in oklab, ${iconColor} 12%, transparent)`,
            borderColor: `color-mix(in oklab, ${iconColor} 22%, transparent)`,
          }}
        >
          <Icon name={icon} size={18} style={{ color: iconColor }} />
        </div>
        <div className="flex flex-col gap-px min-w-0">
          <NumberTicker
            value={value}
            className="text-2xl font-bold text-ink tracking-[-.02em] tabular-nums"
          />
          <span className="text-[11.5px] text-mute-2 truncate">{label}</span>
        </div>
      </Card>
    </Reveal>
  );
}

export async function AdminDashboard({ user }: { user: CurrentUser }) {
  const [competitions, questionCount, roundCount] = await Promise.all([
    getCompetitionsByOwner(user.id),
    countQuestionsByOwner(user.id),
    countRoundsByOwner(user.id),
  ]);

  const liveCount = competitions.filter((c) => c.status === "LIVE").length;
  const recent = competitions.slice(0, RECENT_LIMIT);
  const hasMore = competitions.length > RECENT_LIMIT;

  return (
    <>
      <div className="relative rounded-2xl border border-line/[.07] bg-[linear-gradient(120deg,color-mix(in_oklab,var(--color-accent)_10%,transparent),var(--color-card)_60%)] px-6 py-7 md:px-7 overflow-hidden">
        <div className="absolute -right-24 -top-24 w-[280px] h-[280px] rounded-full bg-[radial-gradient(circle,rgba(108,123,250,.16),transparent_70%)] pointer-events-none" />
        <div className="relative flex flex-col gap-1.5">
          <span className="text-[26px] font-bold text-ink tracking-[-.02em] leading-tight">
            {greeting()}, {firstName(user.name)}
          </span>
          <span className="text-[13.5px] text-mute-2">
            Prepare and run your live competitions.
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile icon="trophy" iconColor="#6C7BFA" label="Competitions" value={competitions.length} index={0} />
        <StatTile icon="radio" iconColor="#FF6B6B" label="Live events" value={liveCount} index={1} />
        <StatTile icon="circle-question-mark" iconColor="#7EB5F0" label="Questions" value={questionCount} index={2} />
        <StatTile icon="list-ordered" iconColor="#2FBFA7" label="Rounds" value={roundCount} index={3} />
      </div>

      <Card className="rounded-2xl p-4 flex flex-col gap-3">
        <SectionLabel className="text-[11px] tracking-[.12em]">QUICK ACTIONS</SectionLabel>
        <div className="flex gap-2.5 flex-wrap">
          <CreateCompetitionButton />
          <Link href="/admin/questions" className={linkButtonClass}>
            <Icon name="plus" size={14} />
            Create Question
          </Link>
          <Link href="/admin/rounds" className={linkButtonClass}>
            <Icon name="plus" size={14} />
            Create Round
          </Link>
        </div>
      </Card>

      {competitions.length === 0 ? (
        <Card className="rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-14 h-14 rounded-[18px] bg-accent/10 border border-dashed border-accent/45 flex items-center justify-center animate-enc-float">
            <Icon name="trophy" size={24} className="text-accent" />
          </div>
          <span className="text-[15px] font-bold text-ink">Create your first competition</span>
          <span className="text-xs text-mute-2 max-w-[320px] leading-relaxed">
            Your first show is a few minutes away. Create a competition, then add rooms, teams, rounds and questions.
          </span>
          <div className="mt-1">
            <CreateCompetitionButton />
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-ink-2">Recent competitions</span>
            <span className="text-[11px] font-mono text-dim">{competitions.length}</span>
            {hasMore && (
              <Link
                href="/admin/competitions"
                className="ml-auto text-[12px] font-medium text-accent hover:opacity-80 flex items-center gap-1"
              >
                View all
                <Icon name="arrow-right" size={13} />
              </Link>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {recent.map((c, i) => (
              <Reveal key={c.id} index={i} hover>
                <Card className="rounded-2xl p-5 hover:border-line/[.14] hover:shadow-[0_12px_34px_rgba(0,0,0,.28)] transition-[border-color,box-shadow]">
                  <CompetitionCard competition={c} />
                </Card>
              </Reveal>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
