import { Header } from "@/components/layout/Header";
import { Icon } from "@/components/ui/Icon";
import { Card } from "@/components/ui/Card";
import { CompetitionCard } from "@/components/competition/CompetitionCard";
import { CreateCompetitionButton } from "@/components/competition/CreateCompetitionButton";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { getCompetitionsByOwner } from "@/data/queries/competition.queries";

export default async function AdminCompetitionsPage() {
  const user = await requireUser();
  const competitions = await getCompetitionsByOwner(user.id);

  return (
    <>
      <Header
        title="Competitions"
        subtitle={
          competitions.length === 0
            ? "Nothing created yet"
            : `${competitions.length} competition${competitions.length > 1 ? "s" : ""}`
        }
        actions={<CreateCompetitionButton />}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {competitions.map((competition) => (
          <Card key={competition.id} className="rounded-2xl p-5 hover:border-line/[.14] transition-colors">
            <CompetitionCard competition={competition} />
          </Card>
        ))}
        <div className="rounded-2xl border-[1.5px] border-dashed border-line/[.13] flex items-center justify-center min-h-[84px]">
          <CreateCompetitionButton label="New competition" variant="outline" />
        </div>
      </div>
      {competitions.length === 0 && (
        <Card className="rounded-2xl p-8 flex flex-col items-center gap-2 text-center">
          <Icon name="trophy" size={22} className="text-accent" />
          <span className="text-sm text-mute-2">Competitions you create will show up here.</span>
        </Card>
      )}
    </>
  );
}
