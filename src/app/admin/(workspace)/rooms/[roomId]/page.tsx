import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { RoomSetupDashboard } from "@/components/room/RoomSetupDashboard";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { getBaseUrl, isLocalHost, getLanAddress } from "@/lib/baseUrl";
import { getRoomById } from "@/data/queries/room.queries";
import { getTeamsByRoom } from "@/data/queries/team.queries";
import { getRoundsByOwner, getSelectedRoundsForRoom } from "@/data/queries/round.queries";
import { getQuestionsForRoomRounds } from "@/data/queries/question.queries";
import { getScenesByRoom } from "@/data/queries/scene.queries";
import {
  getPowerCardsByOwner,
  getCoinTransactionsByRoom,
  getTeamPowerCardsByRoom,
  getPowerCardRequestsByRoom,
} from "@/data/queries/powerCard.queries";
import { seedDefaultPowerCards } from "@/actions/powerCard.actions";

export default async function AdminRoomSetupPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = await params;
  const user = await requireUser();
  const room = await getRoomById(roomId, user.id);
  if (!room) notFound();

  await seedDefaultPowerCards();
  const [teams, rounds, libraryRounds, scenes, cards, purchases, requests, baseUrl] = await Promise.all([
    getTeamsByRoom(roomId),
    getSelectedRoundsForRoom(room.selectedRounds),
    getRoundsByOwner(user.id),
    getScenesByRoom(roomId),
    getPowerCardsByOwner(user.id),
    getCoinTransactionsByRoom(roomId),
    getPowerCardRequestsByRoom(roomId),
    getBaseUrl(),
  ]);
  const [questions, ownedCards] = await Promise.all([
    getQuestionsForRoomRounds(room.selectedRounds),
    getTeamPowerCardsByRoom(teams.map((t) => t.id)),
  ]);

  const joinUrl = `${baseUrl}/play/${room.roomCode}`;

  // Warn when the link only reaches this machine (dev on localhost), and
  // offer the LAN address so phones on the same Wi-Fi can actually join.
  const localOnly = isLocalHost(baseUrl);
  const lanJoinUrl = localOnly
    ? (() => {
        const lan = getLanAddress();
        if (!lan) return null;
        const port = baseUrl.split(":").pop();
        return `http://${lan}:${port}/play/${room.roomCode}`;
      })()
    : null;

  // QR generation is async and must happen here (a Server Component) — a
  // Client Component can't import and render an async component directly.
  const qrDataUrl = await QRCode.toDataURL(lanJoinUrl ?? joinUrl, {
    margin: 1,
    width: 168,
    color: { dark: "#0B0C10", light: "#FFFFFF" },
  });

  return (
    <RoomSetupDashboard
      room={room}
      teams={teams}
      rounds={rounds}
      libraryRounds={libraryRounds}
      questions={questions}
      scenes={scenes}
      cards={cards}
      purchases={purchases}
      ownedCards={ownedCards}
      requests={requests}
      joinUrl={joinUrl}
      localOnly={localOnly}
      lanJoinUrl={lanJoinUrl}
      qrDataUrl={qrDataUrl}
    />
  );
}
