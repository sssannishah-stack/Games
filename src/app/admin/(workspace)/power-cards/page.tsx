import { requireUser } from "@/lib/auth/getCurrentUser";
import { getPowerCardsByOwner } from "@/data/queries/powerCard.queries";
import { seedDefaultPowerCards } from "@/actions/powerCard.actions";
import { PowerCardLibraryBoard } from "@/components/power-card/PowerCardLibraryBoard";

export default async function AdminPowerCardsPage() {
  const user = await requireUser();
  await seedDefaultPowerCards();
  const cards = await getPowerCardsByOwner(user.id);

  return <PowerCardLibraryBoard cards={cards} />;
}
