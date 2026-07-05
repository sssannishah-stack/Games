"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "@/lib/database/mongodb";
import { EventLog } from "@/models";
import { requireUser } from "@/lib/auth/getCurrentUser";
import { assertRoomOwnership } from "@/lib/authz";

export async function sendBroadcast(roomId: string, message: string): Promise<void> {
  const text = message.trim();
  if (!text) throw new Error("Broadcast message is required.");
  if (text.length > 180) throw new Error("Broadcasts must be 180 characters or less.");

  const user = await requireUser();
  await assertRoomOwnership(roomId, user.id);
  await connectToDatabase();

  await EventLog.create({
    roomId,
    type: "BROADCAST_SENT",
    metadata: {
      message: text,
      createdBy: user.id,
    },
  });

  revalidatePath(`/host/${roomId}`);
}
