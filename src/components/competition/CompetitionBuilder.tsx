"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import {
  deleteCompetition,
  duplicateCompetition,
  updateCompetition,
} from "@/actions/competition.actions";
import { createRoom, deleteRoom, duplicateRoom, updateRoom } from "@/actions/room.actions";
import type { CompetitionRecord } from "@/data/queries/competition.queries";
import type { RoomSummary } from "@/data/queries/room.queries";
import type { BadgeProps } from "@/components/ui/Badge";

const STATUS_BADGE: Record<CompetitionRecord["status"], BadgeProps["variant"]> = {
  DRAFT: "plain",
  READY: "accent",
  LIVE: "live",
  COMPLETED: "success",
};

const ROOM_STATUS_BADGE: Record<RoomSummary["status"], BadgeProps["variant"]> = {
  DRAFT: "plain",
  TESTING: "warn",
  READY: "accent",
  LIVE: "live",
  COMPLETED: "success",
};

const SECTIONS = [
  "Overview",
  "Rooms",
  "Settings",
] as const;

type Section = (typeof SECTIONS)[number];
type JoinMethod = "CODE" | "QR" | "BOTH";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function displayRoomStatus(status: RoomSummary["status"]) {
  return status;
}

function setupStats(rooms: RoomSummary[]) {
  return {
    rooms: rooms.length,
    teams: rooms.reduce((sum, room) => sum + room.teamCount, 0),
    participants: rooms.reduce((sum, room) => sum + room.participantCount, 0),
    rounds: rooms.reduce((sum, room) => sum + room.roundCount, 0),
    questions: rooms.reduce((sum, room) => sum + room.questionCount, 0),
    scenes: rooms.reduce((sum, room) => sum + room.sceneCount, 0),
  };
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}) {
  return (
    <label className="flex flex-col gap-[7px]">
      <span className="text-xs font-semibold text-ink-3">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={4}
          className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3.5 py-[11px] text-sm text-ink outline-none focus:border-accent/60 resize-none"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3.5 py-[11px] text-sm text-ink outline-none focus:border-accent/60"
        />
      )}
    </label>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex items-center gap-3 px-6 py-5 border-b border-line/[.07]">
      <span className="text-base font-bold text-ink">{title}</span>
      <button
        onClick={onClose}
        className="ml-auto w-[30px] h-[30px] rounded-lg flex items-center justify-center text-dim hover:bg-line/[.06] hover:text-ink-2 cursor-pointer"
      >
        <Icon name="x" size={15} />
      </button>
    </div>
  );
}

function PermissionToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2.5 text-[12.5px] text-ink-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-[var(--color-accent)]"
      />
      {label}
    </label>
  );
}

function JoinMethodPicker({
  value,
  onChange,
}: {
  value: JoinMethod;
  onChange: (value: JoinMethod) => void;
}) {
  const options: { label: string; value: JoinMethod }[] = [
    { label: "Room Code", value: "CODE" },
    { label: "QR Code", value: "QR" },
    { label: "Both", value: "BOTH" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-ink-3">Join method</span>
      <div className="grid grid-cols-3 gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`rounded-[10px] border px-3 py-2 text-[12px] font-semibold transition ${
              value === option.value
                ? "border-accent/55 bg-accent/15 text-ink"
                : "border-line/[.09] bg-line/[.035] text-mute-2 hover:text-ink-2"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <span className="text-[12.5px] text-danger-soft bg-danger/[.08] border border-danger/25 rounded-[10px] px-3 py-2">
      {error}
    </span>
  );
}

function EditCompetitionModal({
  competition,
  open,
  onClose,
}: {
  competition: CompetitionRecord;
  open: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(competition.title);
  const [description, setDescription] = useState(competition.description ?? "");
  const [language, setLanguage] = useState(competition.language);
  const [theme, setTheme] = useState(competition.theme);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    if (!title.trim()) return setError("Competition name is required.");
    startTransition(async () => {
      try {
        await updateCompetition(competition.id, {
          title: title.trim(),
          description: description.trim() || undefined,
          language: language.trim(),
          theme: theme.trim(),
        });
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update competition.");
      }
    });
  }

  return (
    <Modal open={open} onClose={() => !pending && onClose()} className="max-w-[560px]">
      <ModalHeader title="Edit competition" onClose={onClose} />
      <div className="px-6 py-5 flex flex-col gap-3.5">
        <Field label="Name" value={title} onChange={setTitle} />
        <Field label="Description" value={description} onChange={setDescription} multiline />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Language" value={language} onChange={setLanguage} />
          <Field label="Theme" value={theme} onChange={setTheme} />
        </div>
        <ErrorText error={error} />
      </div>
      <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line/[.07] bg-line/[.015]">
        <Button variant="plain" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} disabled={pending} className="disabled:opacity-60">
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </Modal>
  );
}

function DeleteCompetitionModal({
  competition,
  open,
  onClose,
}: {
  competition: CompetitionRecord;
  open: boolean;
  onClose: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteCompetition(competition.id, confirmation);
        router.push("/admin");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete competition.");
      }
    });
  }

  return (
    <Modal open={open} onClose={() => !pending && onClose()} className="max-w-[520px]">
      <ModalHeader title="Delete Competition?" onClose={onClose} />
      <div className="px-6 py-5 flex flex-col gap-3.5">
        <div className="text-[13px] text-mute-2 leading-relaxed">
          This removes this competition and its rooms, including room teams, participants, scores, scenes, and live history.
        </div>
        <Field label="Type DELETE to confirm" value={confirmation} onChange={setConfirmation} />
        <ErrorText error={error} />
      </div>
      <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line/[.07] bg-line/[.015]">
        <Button variant="plain" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={submit}
          disabled={pending || confirmation !== "DELETE"}
          className="disabled:opacity-50"
        >
          {pending ? "Deleting..." : "Delete"}
        </Button>
      </div>
    </Modal>
  );
}

function CreateRoomModal({
  competitionId,
  open,
  onClose,
}: {
  competitionId: string;
  open: boolean;
  onClose: () => void;
}) {
  const emptyPermissions = {
    viewLeaderboard: true,
    viewTeamScore: true,
    buyPowers: true,
    requestLifelines: true,
  };
  const [name, setName] = useState("Main Event Room");
  const [joinMethod, setJoinMethod] = useState<JoinMethod>("BOTH");
  const [permissions, setPermissions] = useState(emptyPermissions);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    if (!name.trim()) return setError("Room name is required.");
    startTransition(async () => {
      try {
        await createRoom({ competitionId, name: name.trim(), joinMethod, permissions });
        setName("Main Event Room");
        setJoinMethod("BOTH");
        setPermissions(emptyPermissions);
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not create room.");
      }
    });
  }

  return (
    <Modal open={open} onClose={() => !pending && onClose()} className="max-w-[560px]">
      <ModalHeader title="Create room" onClose={onClose} />
      <div className="px-6 py-5 flex flex-col gap-4">
        <Field label="Room name" value={name} onChange={setName} placeholder="Main Event Room" />
        <div className="rounded-xl border border-line/[.08] bg-line/[.03] px-3.5 py-3">
          <span className="text-xs font-semibold text-ink-3">Room code</span>
          <div className="text-[12.5px] text-mute-2 mt-1">Auto-generated when the room is saved.</div>
        </div>
        <JoinMethodPicker value={joinMethod} onChange={setJoinMethod} />
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-ink-3">Allow participants to</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <PermissionToggle
              label="See leaderboard"
              checked={permissions.viewLeaderboard}
              onChange={(checked) => setPermissions((p) => ({ ...p, viewLeaderboard: checked }))}
            />
            <PermissionToggle
              label="See team score"
              checked={permissions.viewTeamScore}
              onChange={(checked) => setPermissions((p) => ({ ...p, viewTeamScore: checked }))}
            />
            <PermissionToggle
              label="Buy powers"
              checked={permissions.buyPowers}
              onChange={(checked) => setPermissions((p) => ({ ...p, buyPowers: checked }))}
            />
            <PermissionToggle
              label="Request powers"
              checked={permissions.requestLifelines}
              onChange={(checked) => setPermissions((p) => ({ ...p, requestLifelines: checked }))}
            />
          </div>
        </div>
        <ErrorText error={error} />
      </div>
      <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line/[.07] bg-line/[.015]">
        <Button variant="plain" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} disabled={pending} className="disabled:opacity-60">
          {pending ? "Saving..." : "Save room"}
        </Button>
      </div>
    </Modal>
  );
}

function EditRoomModal({
  room,
  open,
  onClose,
}: {
  room: RoomSummary;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(room.name);
  const [joinMethod, setJoinMethod] = useState<JoinMethod>(room.settings.joinMethod);
  const [permissions, setPermissions] = useState(room.settings.permissions);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    setError(null);
    if (!name.trim()) return setError("Room name is required.");
    startTransition(async () => {
      try {
        await updateRoom(room.id, { name: name.trim(), joinMethod, permissions });
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not update room.");
      }
    });
  }

  return (
    <Modal open={open} onClose={() => !pending && onClose()} className="max-w-[560px]">
      <ModalHeader title="Edit room" onClose={onClose} />
      <div className="px-6 py-5 flex flex-col gap-4">
        <Field label="Room name" value={name} onChange={setName} />
        <JoinMethodPicker value={joinMethod} onChange={setJoinMethod} />
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-ink-3">Allow participants to</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <PermissionToggle
              label="See leaderboard"
              checked={permissions.viewLeaderboard}
              onChange={(checked) => setPermissions((p) => ({ ...p, viewLeaderboard: checked }))}
            />
            <PermissionToggle
              label="See team score"
              checked={permissions.viewTeamScore}
              onChange={(checked) => setPermissions((p) => ({ ...p, viewTeamScore: checked }))}
            />
            <PermissionToggle
              label="Buy powers"
              checked={permissions.buyPowers}
              onChange={(checked) => setPermissions((p) => ({ ...p, buyPowers: checked }))}
            />
            <PermissionToggle
              label="Request powers"
              checked={permissions.requestLifelines}
              onChange={(checked) => setPermissions((p) => ({ ...p, requestLifelines: checked }))}
            />
          </div>
        </div>
        <ErrorText error={error} />
      </div>
      <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line/[.07] bg-line/[.015]">
        <Button variant="plain" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} disabled={pending} className="disabled:opacity-60">
          {pending ? "Saving..." : "Save room"}
        </Button>
      </div>
    </Modal>
  );
}

function DeleteRoomModal({
  room,
  open,
  onClose,
}: {
  room: RoomSummary | null;
  open: boolean;
  onClose: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!room) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteRoom(room.id, confirmation);
        setConfirmation("");
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not delete room.");
      }
    });
  }

  return (
    <Modal open={open && room !== null} onClose={() => !pending && onClose()} className="max-w-[500px]">
      <ModalHeader title="Delete room?" onClose={onClose} />
      <div className="px-6 py-5 flex flex-col gap-3.5">
        <div className="text-[13px] text-mute-2 leading-relaxed">
          This removes the room setup, teams, participants, rounds, questions, scores, and live history.
        </div>
        <Field label="Type DELETE to confirm" value={confirmation} onChange={setConfirmation} />
        <ErrorText error={error} />
      </div>
      <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line/[.07] bg-line/[.015]">
        <Button variant="plain" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={submit}
          disabled={pending || confirmation !== "DELETE"}
          className="disabled:opacity-50"
        >
          {pending ? "Deleting..." : "Delete room"}
        </Button>
      </div>
    </Modal>
  );
}

function CompetitionHeader({
  competition,
  onEdit,
  onDelete,
}: {
  competition: CompetitionRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function duplicate() {
    startTransition(async () => {
      const { id } = await duplicateCompetition(competition.id);
      router.push(`/admin/competitions/${id}`);
    });
  }

  return (
    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2 text-[12.5px] text-mute-2 flex-wrap">
          <Link href="/admin/competitions" className="hover:text-ink-2">
            Competitions
          </Link>
          <Icon name="chevron-right" size={13} className="text-faint" />
          <span className="text-ink-2 font-medium truncate">{competition.title}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl md:text-[30px] font-bold tracking-[-.02em] text-ink">
            {competition.title}
          </h1>
          <Badge variant={STATUS_BADGE[competition.status]}>{competition.status}</Badge>
        </div>
        <span className="text-[13px] text-mute-2 max-w-[680px] leading-relaxed">
          {competition.description || "Create rooms for each playable event group."}
        </span>
      </div>
      <div className="flex flex-wrap gap-2 lg:ml-auto">
        <Button variant="subtle" onClick={onEdit}>
          <Icon name="pencil" size={14} />
          Edit
        </Button>
        <Button variant="subtle" onClick={duplicate} disabled={pending}>
          <Icon name="copy" size={14} />
          {pending ? "Duplicating..." : "Duplicate"}
        </Button>
        <Button variant="danger" onClick={onDelete}>
          <Icon name="trash-2" size={14} />
          Delete
        </Button>
        <Button variant="primary" onClick={() => document.getElementById("rooms-section")?.scrollIntoView()}>
          <Icon name="arrow-right" size={14} />
          Start Setup
        </Button>
      </div>
    </div>
  );
}

function SetupProgress({ rooms }: { rooms: RoomSummary[] }) {
  const stats = setupStats(rooms);
  const items = [
    { label: "Competition Created", done: true },
    { label: "Room Added", done: stats.rooms > 0 },
    { label: "Teams Added", done: stats.teams > 0 },
    { label: "Rounds Selected", done: stats.rounds > 0 },
    { label: "Questions Added", done: stats.questions > 0 },
    { label: "Scene Flow Ready", done: stats.scenes > 0 },
  ];
  const complete = items.filter((item) => item.done).length;
  const percent = Math.round((complete / items.length) * 100);

  return (
    <Card className="rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-[14px] font-bold text-ink-2">Setup Progress</span>
          <span className="text-[12px] text-mute-2">Create rooms first. Teams and rounds come next.</span>
        </div>
        <span className="font-mono text-[18px] font-bold text-ink">{percent}%</span>
      </div>
      <div className="h-2 rounded-full bg-line/[.06] overflow-hidden">
        <div className="h-full bg-accent rounded-full" style={{ width: `${percent}%` }} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-[12px] text-ink-3">
            <Icon
              name={item.done ? "circle-check" : "circle"}
              size={14}
              className={item.done ? "text-success" : "text-dim-2"}
            />
            {item.label}
          </div>
        ))}
      </div>
    </Card>
  );
}

function OverviewCard({ competition, rooms }: { competition: CompetitionRecord; rooms: RoomSummary[] }) {
  const stats = setupStats(rooms);
  const statCards = [
    { label: "Rooms", value: stats.rooms },
    { label: "Teams", value: stats.teams },
    { label: "Rounds", value: stats.rounds },
    { label: "Participants", value: stats.participants },
    { label: "Total Rounds", value: stats.rounds },
  ];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
      <Card className="rounded-2xl p-5 flex flex-col gap-4">
        <span className="text-[11px] font-mono font-semibold tracking-[.12em] text-label">
          COMPETITION DETAILS
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-dim">Name</span>
            <span className="text-sm font-semibold text-ink-2">{competition.title}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-dim">Language</span>
            <span className="text-sm font-semibold text-ink-2">{competition.language}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-dim">Theme</span>
            <span className="text-sm font-semibold text-ink-2">{competition.theme}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-dim">Created</span>
            <span className="text-sm font-semibold text-ink-2">{formatDate(competition.createdAt)}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-dim">Description</span>
          <span className="text-[13px] text-mute-2 leading-relaxed">
            {competition.description || "No description added."}
          </span>
        </div>
      </Card>

      <Card className="rounded-2xl p-5 flex flex-col gap-4">
        <span className="text-[11px] font-mono font-semibold tracking-[.12em] text-label">
          STATISTICS
        </span>
        <div className="grid grid-cols-2 gap-3">
          {statCards.map((stat) => (
            <div key={stat.label} className="rounded-xl bg-line/[.035] border border-line/[.07] p-3">
              <span className="text-[11px] text-dim">{stat.label}</span>
              <div className="text-2xl font-bold text-ink mt-1">{stat.value}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function RoomCard({
  room,
  onEdit,
  onDelete,
}: {
  room: RoomSummary;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function duplicate() {
    startTransition(async () => {
      await duplicateRoom(room.id);
      router.refresh();
    });
  }

  return (
    <Card className="rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-[15px] font-bold text-ink-2 truncate">{room.name}</span>
          <span className="font-mono text-[12px] text-mute-2 bg-line/[.04] border border-line/[.08] rounded-md px-2 py-1 self-start">
            {room.roomCode}
          </span>
        </div>
        <Badge size="sm" variant={ROOM_STATUS_BADGE[room.status]} className="ml-auto">
          {displayRoomStatus(room.status)}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11.5px] text-mute-2">
        <span>{room.teamCount} teams</span>
        <span>{room.participantCount} participants</span>
        <span>{room.roundCount} rounds</span>
        <span>{room.sceneCount} scenes</span>
      </div>

      <div className="text-[11px] text-dim">
        Join: {room.settings.joinMethod} · Leaderboard {room.settings.permissions.viewLeaderboard ? "on" : "off"}
      </div>

      <div className="flex flex-wrap gap-2 mt-auto">
        <Link
          href={`/admin/rooms/${room.id}`}
          className="inline-flex items-center justify-center gap-2 font-medium transition cursor-pointer select-none whitespace-nowrap bg-line/[.04] border border-line/[.09] text-ink-3 hover:bg-line/[.08] text-[12.5px] rounded-[10px] px-3.5 py-2"
        >
          Setup Room
        </Link>
        <Link
          href={`/host/${room.id}`}
          className="inline-flex items-center justify-center gap-2 font-medium transition cursor-pointer select-none whitespace-nowrap bg-accent text-white text-[12.5px] rounded-[10px] px-3.5 py-2 hover:brightness-110"
        >
          Go Live
        </Link>
        <Button variant="subtle" size="md" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="subtle" size="md" onClick={duplicate} disabled={pending}>
          {pending ? "Duplicating..." : "Duplicate"}
        </Button>
        <Button variant="danger" size="md" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </Card>
  );
}

function RoomsTab({ competitionId, rooms }: { competitionId: string; rooms: RoomSummary[] }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomSummary | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<RoomSummary | null>(null);

  return (
    <div id="rooms-section" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-[15px] font-bold text-ink-2">Rooms</span>
          <span className="text-[12px] text-mute-2">Rooms are the actual playable event spaces.</span>
        </div>
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Icon name="plus" size={14} />
          Create Room
        </Button>
      </div>

      {rooms.length === 0 ? (
        <Card className="rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-14 h-14 rounded-[18px] bg-accent/10 border border-dashed border-accent/45 flex items-center justify-center">
            <Icon name="radio" size={24} className="text-accent" />
          </div>
          <span className="text-[15px] font-bold text-ink">No rooms created</span>
          <span className="text-xs text-mute-2 max-w-[360px] leading-relaxed">
            Create your first event room to add teams, select rounds, build scenes, and go live.
          </span>
          <Button variant="primary" onClick={() => setCreateOpen(true)}>
            <Icon name="plus" size={14} />
            Create Room
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              onEdit={() => setEditingRoom(room)}
              onDelete={() => setDeletingRoom(room)}
            />
          ))}
        </div>
      )}

      <CreateRoomModal
        competitionId={competitionId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
      {editingRoom && (
        <EditRoomModal
          room={editingRoom}
          open={editingRoom !== null}
          onClose={() => setEditingRoom(null)}
        />
      )}
      <DeleteRoomModal
        room={deletingRoom}
        open={deletingRoom !== null}
        onClose={() => setDeletingRoom(null)}
      />
    </div>
  );
}

function SettingsCard({
  competition,
  onEdit,
  onDelete,
}: {
  competition: CompetitionRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-4">
      <Card className="rounded-2xl p-5 flex flex-col gap-4">
        <span className="text-[11px] font-mono font-semibold tracking-[.12em] text-label">
          COMPETITION SETTINGS
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-dim">Name</span>
            <span className="text-sm font-semibold text-ink-2">{competition.title}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-dim">Language</span>
            <span className="text-sm font-semibold text-ink-2">{competition.language}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-dim">Theme</span>
            <span className="text-sm font-semibold text-ink-2">{competition.theme}</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] text-dim">Status</span>
            <span className="text-sm font-semibold text-ink-2">{competition.status}</span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] text-dim">Description</span>
          <span className="text-[13px] text-mute-2 leading-relaxed">
            {competition.description || "No description added."}
          </span>
        </div>
        <div>
          <Button variant="subtle" onClick={onEdit}>
            <Icon name="pencil" size={14} />
            Edit Settings
          </Button>
        </div>
      </Card>

      <Card className="rounded-2xl p-5 flex flex-col gap-3 border-danger/25">
        <span className="text-[11px] font-mono font-semibold tracking-[.12em] text-danger-soft">
          DANGER ZONE
        </span>
        <span className="text-sm font-bold text-ink-2">Delete Competition</span>
        <span className="text-[12.5px] text-mute-2 leading-relaxed">
          Deletes this competition and all rooms under it. Reusable question and round libraries are not deleted.
        </span>
        <Button variant="danger" onClick={onDelete} className="self-start">
          <Icon name="trash-2" size={14} />
          Delete Competition
        </Button>
      </Card>
    </div>
  );
}

export function CompetitionBuilder({
  competition,
  rooms,
}: {
  competition: CompetitionRecord;
  rooms: RoomSummary[];
}) {
  const [section, setSection] = useState<Section>("Overview");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const content = useMemo(() => {
    if (section === "Overview") return <OverviewCard competition={competition} rooms={rooms} />;
    if (section === "Rooms") return <RoomsTab competitionId={competition.id} rooms={rooms} />;
    return (
      <SettingsCard
        competition={competition}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />
    );
  }, [competition, rooms, section]);

  return (
    <>
      <CompetitionHeader
        competition={competition}
        onEdit={() => setEditOpen(true)}
        onDelete={() => setDeleteOpen(true)}
      />
      <SetupProgress rooms={rooms} />

      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
        {SECTIONS.map((item) => (
          <button
            key={item}
            onClick={() => setSection(item)}
            className={`rounded-xl border px-3 py-3 text-[12.5px] font-semibold transition ${
              section === item
                ? "border-accent/55 bg-accent/15 text-ink"
                : "border-line/[.08] bg-line/[.03] text-mute-2 hover:text-ink-2 hover:bg-line/[.05]"
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {content}

      <EditCompetitionModal
        competition={competition}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
      <DeleteCompetitionModal
        competition={competition}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}
