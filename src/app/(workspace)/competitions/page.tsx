import { redirect } from "next/navigation";

// Legacy path. Competitions now live exclusively under /admin/*.
export default function LegacyCompetitionsPage() {
  redirect("/admin/competitions");
}
