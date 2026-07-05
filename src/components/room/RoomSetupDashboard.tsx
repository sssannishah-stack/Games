"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { PublishPanel } from "@/components/room/PublishPanel";
import { PowerCardsPanel } from "@/components/power-card/PowerCardsPanel";
import { StorePanel } from "@/components/power-card/StorePanel";
import { InventoryPanel } from "@/components/power-card/InventoryPanel";
import { RequestsPanel } from "@/components/power-card/RequestsPanel";
import { startRoomEvent, startRoomTestMode, setRoomSelectedRounds } from "@/actions/room.actions";
import {
  createScene,
  deleteScene,
  duplicateScene,
  generateScenes,
  reorderScenes,
  updateScene,
} from "@/actions/scene.actions";
import {
  addParticipant,
  bulkCreateParticipants,
  createTeam,
  deleteTeam,
  duplicateTeam,
  moveParticipant,
  removeParticipant,
  updateTeam,
} from "@/actions/team.actions";
import type { RoomDetail } from "@/data/queries/room.queries";
import type { TeamRecord } from "@/data/queries/team.queries";
import type { RoundRecord } from "@/data/queries/round.queries";
import type { QuestionRecord } from "@/data/queries/question.queries";
import type { SceneRecord } from "@/data/queries/scene.queries";
import type {
  PowerCardRecord,
  CoinTransactionRecord,
  TeamPowerCardRecord,
  PowerCardRequestRecord,
} from "@/data/queries/powerCard.queries";
import type { BadgeProps } from "@/components/ui/Badge";
import type { SceneType } from "@/types/db";

const SECTIONS = ["Overview", "Teams", "Rounds", "Scenes", "Power Cards", "Settings"] as const;
const SWATCHES = ["#F5A93D", "#C98A5E", "#E8C84A", "#5EC9E8", "#B98AE8", "#E36A8A", "#3DD68C"];

type Section = (typeof SECTIONS)[number];

const ROOM_STATUS_BADGE: Record<RoomDetail["status"], BadgeProps["variant"]> = {
  DRAFT: "plain",
  TESTING: "warn",
  READY: "accent",
  LIVE: "live",
  COMPLETED: "success",
};

function displayRoomStatus(status: RoomDetail["status"]) {
  return status;
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

function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <span className="text-[12.5px] text-danger-soft bg-danger/[.08] border border-danger/25 rounded-[10px] px-3 py-2">
      {error}
    </span>
  );
}

function TeamEditorModal({
  roomId,
  team,
  open,
  onClose,
}: {
  roomId: string;
  team?: TeamRecord;
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState(team?.name ?? "");
  const [color, setColor] = useState(team?.color ?? SWATCHES[0]);
  const [members, setMembers] = useState<string[]>(
    team?.members.length ? team.members.map((member) => member.name) : [""]
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function updateMember(index: number, value: string) {
    setMembers((current) => current.map((member, i) => (i === index ? value : member)));
  }

  function reset() {
    setName("");
    setColor(SWATCHES[0]);
    setMembers([""]);
    setError(null);
  }

  function submit() {
    setError(null);
    if (!name.trim()) return setError("Team name is required.");

    startTransition(async () => {
      try {
        const input = {
          roomId,
          name: name.trim(),
          color,
          members: members.map((member) => member.trim()).filter(Boolean),
        };
        if (team) {
          await updateTeam({ ...input, teamId: team.id });
        } else {
          await createTeam(input);
        }
        if (!team) reset();
        onClose();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save team.");
      }
    });
  }

  return (
    <Modal open={open} onClose={() => !pending && onClose()} className="max-w-[540px]">
      <ModalHeader title={team ? "Edit team" : "Create team"} onClose={onClose} />
      <div className="px-6 py-5 flex flex-col gap-3.5 max-h-[70dvh] overflow-y-auto">
        <label className="flex flex-col gap-[7px]">
          <span className="text-xs font-semibold text-ink-3">Team name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Team A"
            autoFocus
            className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3.5 py-[11px] text-sm text-ink outline-none focus:border-accent/60"
          />
        </label>

        <div className="flex flex-col gap-[7px]">
          <span className="text-xs font-semibold text-ink-3">Color</span>
          <div className="flex gap-2 flex-wrap">
            {SWATCHES.map((swatch) => (
              <button
                key={swatch}
                onClick={() => setColor(swatch)}
                className={`w-7 h-7 rounded-full cursor-pointer transition ${
                  color === swatch ? "ring-2 ring-ink ring-offset-2 ring-offset-card" : ""
                }`}
                style={{ background: swatch }}
              />
            ))}
          </div>
        </div>

        <MemberListEditor members={members} setMembers={setMembers} updateMember={updateMember} />
        <ErrorText error={error} />
      </div>
      <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line/[.07] bg-line/[.015]">
        <Button variant="plain" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="primary" onClick={submit} disabled={pending} className="disabled:opacity-60">
          {pending ? "Saving..." : "Save team"}
        </Button>
      </div>
    </Modal>
  );
}

function MemberListEditor({
  members,
  setMembers,
  updateMember,
}: {
  members: string[];
  setMembers: (updater: (members: string[]) => string[]) => void;
  updateMember: (index: number, value: string) => void;
}) {
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");

  function importBulk() {
    const names = bulkText
      .split(/\r?\n/)
      .map((name) => name.trim())
      .filter(Boolean);
    if (names.length === 0) return;
    setMembers((current) => [...current.filter((member) => member.trim()), ...names]);
    setBulkText("");
    setBulkOpen(false);
  }

  return (
    <div className="flex flex-col gap-[7px]">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-ink-3">Members</span>
        <button
          onClick={() => setBulkOpen((value) => !value)}
          className="ml-auto text-[11px] font-semibold text-accent hover:brightness-125"
        >
          Bulk add
        </button>
      </div>

      {members.map((member, index) => (
        <div key={index} className="flex gap-1.5">
          <input
            value={member}
            onChange={(event) => updateMember(index, event.target.value)}
            placeholder={`Member ${index + 1}`}
            className="flex-1 bg-line/[.04] border border-line/[.09] rounded-[10px] px-3 py-2 text-sm text-ink outline-none focus:border-accent/60"
          />
          {members.length > 1 && (
            <button
              onClick={() => setMembers((current) => current.filter((_, i) => i !== index))}
              className="w-9 h-9 rounded-[10px] flex items-center justify-center text-dim hover:bg-line/[.06] hover:text-danger-soft cursor-pointer"
            >
              <Icon name="x" size={14} />
            </button>
          )}
        </div>
      ))}

      <button
        onClick={() => setMembers((current) => [...current, ""])}
        className="flex items-center justify-center gap-1.5 border-[1.5px] border-dashed border-line/[.14] rounded-[10px] py-2 text-mute-2 text-[11.5px] hover:border-accent hover:text-ink-2 cursor-pointer transition-colors"
      >
        <Icon name="plus" size={12} />
        Add member
      </button>

      {bulkOpen && (
        <div className="flex flex-col gap-2 rounded-xl bg-line/[.03] border border-line/[.08] p-3">
          <textarea
            value={bulkText}
            onChange={(event) => setBulkText(event.target.value)}
            placeholder={"Amit\nRahul\nJay\nMeet"}
            rows={5}
            className="bg-line/[.04] border border-line/[.09] rounded-[10px] px-3 py-2 text-sm text-ink outline-none focus:border-accent/60 resize-none"
          />
          <Button variant="subtle" size="sm" onClick={importBulk}>
            Import names
          </Button>
        </div>
      )}
    </div>
  );
}

function DeleteTeamModal({
  roomId,
  team,
  open,
  onClose,
}: {
  roomId: string;
  team: TeamRecord | null;
  open: boolean;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    if (!team) return;
    startTransition(async () => {
      await deleteTeam(team.id, roomId);
      onClose();
      router.refresh();
    });
  }

  return (
    <Modal open={open && team !== null} onClose={() => !pending && onClose()} className="max-w-[460px]">
      <ModalHeader title="Delete team?" onClose={onClose} />
      <div className="px-6 py-5 text-[13px] text-mute-2 leading-relaxed">
        This removes {team?.name} and its members from this room.
      </div>
      <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-line/[.07] bg-line/[.015]">
        <Button variant="plain" onClick={onClose} disabled={pending}>
          Cancel
        </Button>
        <Button variant="danger" onClick={submit} disabled={pending}>
          {pending ? "Deleting..." : "Delete team"}
        </Button>
      </div>
    </Modal>
  );
}

function TextField({
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
          rows={3}
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

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-[7px]">
      <span className="text-[11px] font-semibold text-ink-3">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="bg-line/[.04] border border-line/[.09] rounded-[10px] px-2 py-2 text-sm text-ink outline-none"
      />
    </label>
  );
}

function RoomOverview({
  room,
  onCreateTeam,
  joinUrl,
  localOnly,
  lanJoinUrl,
  qrDataUrl,
}: {
  room: RoomDetail;
  onCreateTeam: () => void;
  joinUrl: string;
  localOnly: boolean;
  lanJoinUrl: string | null;
  qrDataUrl: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const stats = [
    ["Teams", room.teamCount],
    ["Participants", room.participantCount],
    ["Rounds", room.roundCount],
    ["Questions", room.questionCount],
  ];
  const setupReady = room.teamCount > 0 && room.roundCount > 0 && room.questionCount > 0;

  function goLive() {
    if (room.status === "LIVE") {
      router.push(`/host/${room.id}`);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await startRoomEvent(room.id);
        router.push(`/host/${room.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start the event.");
      }
    });
  }

  function testMode() {
    if (room.status === "TESTING") {
      router.push(`/host/${room.id}`);
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await startRoomTestMode(room.id);
        router.push(`/host/${room.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start test mode.");
      }
    });
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-4 items-start">
      <Card className="rounded-2xl p-6 flex flex-col gap-5">
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant={ROOM_STATUS_BADGE[room.status]}>{displayRoomStatus(room.status)}</Badge>
          <span className="font-mono text-[12px] text-mute-2 bg-line/[.04] border border-line/[.08] rounded-md px-2 py-1">
            {room.roomCode}
          </span>
          <span className="text-[12px] text-mute-2">{room.name}</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-line/[.035] border border-line/[.07] p-3">
              <span className="text-[11px] text-dim">{label}</span>
              <div className="text-2xl font-bold text-ink mt-1">{value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" onClick={onCreateTeam}>
            <Icon name="plus" size={14} />
            Add Team
          </Button>
          <Button
            variant="subtle"
            disabled={!setupReady || pending}
            onClick={testMode}
            className="disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Icon name="flask-conical" size={14} />
            {pending ? "Starting..." : room.status === "TESTING" ? "Open Test Console" : "Test Mode"}
          </Button>
          <Button
            variant="success"
            disabled={!setupReady || pending}
            onClick={goLive}
            className="disabled:opacity-45 disabled:cursor-not-allowed"
          >
            <Icon name="radio" size={14} />
            {pending ? "Starting..." : room.status === "LIVE" ? "Open Host Console" : "Start Live"}
          </Button>
        </div>

        {!setupReady && (
          <span className="text-[12px] text-mute-2">
            Start Live unlocks after teams, rounds and questions are ready.
          </span>
        )}
        <ErrorText error={error} />
      </Card>

      <PublishPanel
        roomCode={room.roomCode}
        joinUrl={joinUrl}
        localOnly={localOnly}
        lanJoinUrl={lanJoinUrl}
        qrDataUrl={qrDataUrl}
      />
    </div>
  );
}

function TeamCard({
  team,
  economyEnabled,
  onOpen,
  onEdit,
  onDelete,
}: {
  team: TeamRecord;
  economyEnabled: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const preview = team.members.slice(0, 2).map((member) => member.name);
  const more = Math.max(0, team.members.length - preview.length);

  return (
    <Card className="rounded-2xl p-5 flex flex-col gap-4 hover:border-line/[.14] transition-colors">
      <button onClick={onOpen} className="flex items-start gap-3 text-left">
        <span
          className="w-10 h-10 rounded-[12px] flex items-center justify-center text-white font-bold shrink-0"
          style={{ background: team.color ?? "#6C7BFA" }}
        >
          {team.name.charAt(0).toUpperCase()}
        </span>
        <span className="flex flex-col min-w-0">
          <span className="text-[15px] font-bold text-ink-2 truncate">{team.name}</span>
          <span className="text-[11.5px] text-mute-2">{team.members.length} members</span>
        </span>
      </button>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-line/[.035] border border-line/[.07] p-3">
          <span className="text-[10px] text-dim">Score</span>
          <div className="font-mono text-lg font-bold text-ink">{team.score}</div>
        </div>
        <div className="rounded-xl bg-line/[.035] border border-line/[.07] p-3">
          <span className="text-[10px] text-dim">Coins</span>
          <div className="font-mono text-lg font-bold text-ink">
            {economyEnabled ? team.coins : "-"}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-semibold text-dim">Members</span>
        {team.members.length === 0 ? (
          <span className="text-[12px] text-mute-2">This team has no members yet</span>
        ) : (
          <div className="text-[12px] text-ink-3 leading-relaxed">
            {preview.join(", ")}
            {more > 0 && <span className="text-mute-2"> +{more} more</span>}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mt-auto">
        <Button variant="subtle" size="sm" onClick={onEdit}>
          Edit
        </Button>
        <Button variant="subtle" size="sm" onClick={onOpen}>
          Manage
        </Button>
        <Button variant="danger" size="sm" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </Card>
  );
}

function TeamDrawer({
  roomId,
  teams,
  team,
  economyEnabled,
  onClose,
}: {
  roomId: string;
  teams: TeamRecord[];
  team: TeamRecord | null;
  economyEnabled: boolean;
  onClose: () => void;
}) {
  const [newMember, setNewMember] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(team?.name ?? "");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!team) return null;
  const activeTeam = team;

  function refresh() {
    router.refresh();
  }

  function addOne() {
    if (!newMember.trim()) return;
    startTransition(async () => {
      await addParticipant({ roomId, teamId: activeTeam.id, name: newMember.trim() });
      setNewMember("");
      refresh();
    });
  }

  function addBulk() {
    const names = bulkText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    if (names.length === 0) return;
    startTransition(async () => {
      await bulkCreateParticipants({ roomId, teamId: activeTeam.id, names });
      setBulkText("");
      refresh();
    });
  }

  function rename() {
    if (!name.trim()) return;
    startTransition(async () => {
      await updateTeam({
        roomId,
        teamId: activeTeam.id,
        name: name.trim(),
        color: activeTeam.color,
        members: activeTeam.members.map((member) => member.name),
      });
      setRenaming(false);
      refresh();
    });
  }

  return (
    <Drawer open={team !== null} onClose={onClose}>
      <div className="flex flex-col h-full overflow-hidden">
        <div
          className="px-6 pt-5 pb-4 border-b border-line/[.06]"
          style={{
            background: `linear-gradient(140deg, color-mix(in oklab, ${team.color ?? "#6C7BFA"} 14%, transparent), transparent 60%)`,
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-[46px] h-[46px] rounded-[14px] flex items-center justify-center text-[17px] font-bold text-white"
              style={{ background: team.color ?? "#6C7BFA" }}
            >
              {team.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              {renaming ? (
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="bg-line/[.06] border border-line/[.12] rounded-[10px] px-3 py-2 text-sm text-ink outline-none"
                />
              ) : (
                <span className="text-lg font-bold text-ink tracking-[-.015em] truncate">
                  {team.name}
                </span>
              )}
              <span className="text-[11.5px] text-mute">{team.members.length} members</span>
            </div>
            <button
              onClick={onClose}
              className="ml-auto w-[30px] h-[30px] rounded-lg flex items-center justify-center text-dim hover:bg-line/[.06] hover:text-ink-2 cursor-pointer"
            >
              <Icon name="x" size={15} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <div className="bg-line/[.04] border border-line/[.08] rounded-xl px-3.5 py-2.5">
              <span className="font-mono font-semibold text-[9px] tracking-[.12em] text-dim-2">
                SCORE
              </span>
              <div className="font-mono font-bold text-xl text-ink">{team.score}</div>
            </div>
            <div className="bg-line/[.04] border border-line/[.08] rounded-xl px-3.5 py-2.5">
              <span className="font-mono font-semibold text-[9px] tracking-[.12em] text-dim-2">
                COINS
              </span>
              <div className="font-mono font-bold text-xl text-ink">
                {economyEnabled ? team.coins : "-"}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            {renaming ? (
              <Button variant="primary" size="sm" onClick={rename} disabled={pending}>
                Save name
              </Button>
            ) : (
              <Button variant="subtle" size="sm" onClick={() => setRenaming(true)}>
                Rename Team
              </Button>
            )}
          </div>
        </div>

        <div className="px-6 py-4 flex flex-col gap-4 overflow-y-auto">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-mono font-semibold tracking-[.12em] text-label">
              MEMBERS
            </span>
            {team.members.length === 0 ? (
              <div className="rounded-xl bg-line/[.03] border border-line/[.08] p-4 text-center">
                <div className="text-sm font-semibold text-ink">This team has no members yet</div>
                <div className="text-[12px] text-mute-2 mt-1">Add names below.</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {team.members.map((member, index) => (
                  <div
                    key={`${member.name}-${index}`}
                    className="flex items-center gap-2 bg-line/[.035] border border-line/[.08] rounded-xl px-3 py-2"
                  >
                    <span className="text-[13px] text-ink-2 flex-1 truncate">{member.name}</span>
                    <select
                      value={team.id}
                      onChange={(event) => {
                        const target = event.target.value;
                        if (target === team.id) return;
                        startTransition(async () => {
                          await moveParticipant({
                            roomId,
                            fromTeamId: team.id,
                            toTeamId: target,
                            memberIndex: index,
                          });
                          refresh();
                        });
                      }}
                      className="bg-line/[.04] border border-line/[.1] rounded-[8px] px-2 py-1 text-[11px] text-ink outline-none"
                    >
                      {teams.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          await removeParticipant({ roomId, teamId: team.id, memberIndex: index });
                          refresh();
                        })
                      }
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-dim hover:text-danger-soft hover:bg-danger/10"
                    >
                      <Icon name="trash-2" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-mono font-semibold tracking-[.12em] text-label">
              ADD MEMBER
            </span>
            <div className="flex gap-2">
              <input
                value={newMember}
                onChange={(event) => setNewMember(event.target.value)}
                placeholder="Member name"
                className="flex-1 bg-line/[.04] border border-line/[.09] rounded-[10px] px-3 py-2 text-sm text-ink outline-none focus:border-accent/60"
              />
              <Button variant="primary" onClick={addOne} disabled={pending}>
                Add
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-mono font-semibold tracking-[.12em] text-label">
              BULK ADD
            </span>
            <textarea
              value={bulkText}
              onChange={(event) => setBulkText(event.target.value)}
              placeholder={"Amit\nRahul\nJay\nMeet"}
              rows={5}
              className="bg-line/[.04] border border-line/[.09] rounded-[10px] px-3 py-2 text-sm text-ink outline-none focus:border-accent/60 resize-none"
            />
            <Button variant="subtle" onClick={addBulk} disabled={pending}>
              Import names
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <Card className="rounded-xl p-4">
              <div className="text-[12px] font-semibold text-ink-2">Power Inventory</div>
              <div className="text-[11.5px] text-mute-2 mt-1">Placeholder for a later step.</div>
            </Card>
            <Card className="rounded-xl p-4">
              <div className="text-[12px] font-semibold text-ink-2">Score History</div>
              <div className="text-[11.5px] text-mute-2 mt-1">Placeholder for a later step.</div>
            </Card>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function TeamGrid({
  room,
  teams,
  onCreate,
}: {
  room: RoomDetail;
  teams: TeamRecord[];
  onCreate: () => void;
}) {
  const [editingTeam, setEditingTeam] = useState<TeamRecord | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<TeamRecord | null>(null);
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);
  const [pendingTeamId, setPendingTeamId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const openTeam = teams.find((team) => team.id === openTeamId) ?? null;

  function duplicate(team: TeamRecord) {
    setPendingTeamId(team.id);
    startTransition(async () => {
      await duplicateTeam(team.id, room.id);
      setPendingTeamId(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <span className="text-[15px] font-bold text-ink-2">Teams</span>
          <span className="text-[12px] text-mute-2">Create teams and add participant names.</span>
        </div>
        <Button variant="primary" onClick={onCreate}>
          <Icon name="plus" size={14} />
          Create Team
        </Button>
      </div>

      {teams.length === 0 ? (
        <Card className="rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center">
          <div className="w-14 h-14 rounded-[18px] bg-accent/10 border border-dashed border-accent/45 flex items-center justify-center">
            <Icon name="users" size={24} className="text-accent" />
          </div>
          <span className="text-[15px] font-bold text-ink">No teams yet</span>
          <span className="text-xs text-mute-2 max-w-[340px] leading-relaxed">
            Create teams that will compete in this room.
          </span>
          <Button variant="primary" onClick={onCreate}>
            <Icon name="plus" size={14} />
            Create Team
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {teams.map((team) => (
            <div key={team.id} className="flex flex-col gap-2">
              <TeamCard
                team={team}
                economyEnabled={room.economyEnabled}
                onOpen={() => setOpenTeamId(team.id)}
                onEdit={() => setEditingTeam(team)}
                onDelete={() => setDeletingTeam(team)}
              />
              <Button
                variant="plain"
                size="sm"
                onClick={() => duplicate(team)}
                disabled={pending && pendingTeamId === team.id}
                className="self-start"
              >
                <Icon name="copy" size={12} />
                {pending && pendingTeamId === team.id ? "Duplicating..." : "Duplicate"}
              </Button>
            </div>
          ))}
        </div>
      )}

      {editingTeam && (
        <TeamEditorModal
          roomId={room.id}
          team={editingTeam}
          open={editingTeam !== null}
          onClose={() => setEditingTeam(null)}
        />
      )}
      <DeleteTeamModal
        roomId={room.id}
        team={deletingTeam}
        open={deletingTeam !== null}
        onClose={() => setDeletingTeam(null)}
      />
      <TeamDrawer
        roomId={room.id}
        teams={teams}
        team={openTeam}
        economyEnabled={room.economyEnabled}
        onClose={() => setOpenTeamId(null)}
      />
    </div>
  );
}

function RoundPicker({
  room,
  libraryRounds,
}: {
  room: RoomDetail;
  libraryRounds: RoundRecord[];
}) {
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [pending, startTransition] = useTransition();
  const roundById = new Map(libraryRounds.map((round) => [round.id, round]));
  const selected = room.selectedRounds
    .map((id) => roundById.get(id))
    .filter((round): round is RoundRecord => Boolean(round));
  const categories = [...new Set(libraryRounds.map((round) => round.category || "Custom"))].sort();
  const available = libraryRounds.filter((round) => {
    const matchesSearch = `${round.title} ${round.description ?? ""}`.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = categoryFilter === "ALL" || (round.category || "Custom") === categoryFilter;
    return !room.selectedRounds.includes(round.id) && matchesSearch && matchesCategory;
  });

  function apply(nextIds: string[]) {
    startTransition(async () => {
      await setRoomSelectedRounds(room.id, nextIds);
    });
  }

  function add(roundId: string) {
    apply([...room.selectedRounds, roundId]);
  }

  function remove(roundId: string) {
    apply(room.selectedRounds.filter((id) => id !== roundId));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= selected.length) return;
    const next = [...room.selectedRounds];
    [next[index], next[target]] = [next[target], next[index]];
    apply(next);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-bold text-ink-2">Available rounds</span>
          <Link href="/admin/rounds" className="text-[11.5px] font-semibold text-accent hover:brightness-125">
            Manage library
          </Link>
        </div>
        {libraryRounds.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_160px] gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search rounds"
              className="bg-line/[.04] border border-line/[.09] rounded-[10px] px-3 py-2 text-sm text-ink outline-none"
            />
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="bg-line/[.04] border border-line/[.09] rounded-[10px] px-2 py-2 text-sm text-ink outline-none"
            >
              <option value="ALL" className="bg-surface">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category} className="bg-surface">
                  {category}
                </option>
              ))}
            </select>
          </div>
        )}
        {available.length === 0 ? (
          <Card className="rounded-2xl p-6 text-center text-mute-2 text-[13px]">
            {libraryRounds.length === 0
              ? "No rounds in your library yet."
              : "All of your rounds are already selected."}
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {available.map((round) => (
              <Card key={round.id} className="rounded-xl p-3 flex items-center gap-3">
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-semibold text-ink-2 truncate">{round.title}</span>
                  <span className="text-[11px] text-mute-2">
                    {round.category} - {round.roundType.replace(/_/g, " ")} - {round.questionCount} questions
                  </span>
                </div>
                <Button variant="subtle" size="sm" className="ml-auto shrink-0" onClick={() => add(round.id)} disabled={pending}>
                  Add
                </Button>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-[15px] font-bold text-ink-2">Selected rounds</span>
        {selected.length === 0 ? (
          <Card className="rounded-2xl p-6 text-center text-mute-2 text-[13px]">
            No rounds selected yet — this room has nothing to run.
          </Card>
        ) : (
          <div className="flex flex-col gap-2">
            {selected.map((round, index) => (
              <Card key={round.id} className="rounded-xl p-3 flex items-center gap-3">
                <span className="font-mono text-[11px] font-bold text-accent bg-accent/10 border border-accent/25 rounded-lg px-2 py-1">
                  {index + 1}
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-[13px] font-semibold text-ink-2 truncate">{round.title}</span>
                  <span className="text-[11px] text-mute-2">
                    {round.category} - {round.roundType.replace(/_/g, " ")} - {round.questionCount} questions
                  </span>
                </div>
                <div className="ml-auto flex gap-1 shrink-0">
                  <Link href={`/admin/rounds/${round.id}`}>
                    <Button variant="plain" size="sm">
                      Edit
                    </Button>
                  </Link>
                  <Button variant="plain" size="sm" onClick={() => move(index, -1)} disabled={index === 0 || pending}>
                    Up
                  </Button>
                  <Button
                    variant="plain"
                    size="sm"
                    onClick={() => move(index, 1)}
                    disabled={index === selected.length - 1 || pending}
                  >
                    Down
                  </Button>
                  <Button variant="danger" size="sm" onClick={() => remove(round.id)} disabled={pending}>
                    Remove
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SceneBuilder({
  room,
  rounds,
  questions,
  scenes,
}: {
  room: RoomDetail;
  rounds: RoundRecord[];
  questions: QuestionRecord[];
  scenes: SceneRecord[];
}) {
  const [selectedId, setSelectedId] = useState(scenes[0]?.id ?? "");
  const selected = scenes.find((scene) => scene.id === selectedId) ?? scenes[0] ?? null;
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function refresh() {
    router.refresh();
  }

  function generate() {
    startTransition(async () => {
      await generateScenes(room.id);
      refresh();
    });
  }

  function add(type: SceneType) {
    startTransition(async () => {
      const { id } = await createScene({ roomId: room.id, type, title: type.replace(/_/g, " ") });
      setSelectedId(id);
      refresh();
    });
  }

  function remove(scene: SceneRecord) {
    startTransition(async () => {
      await deleteScene(scene.id, room.id);
      refresh();
    });
  }

  function duplicate(scene: SceneRecord) {
    startTransition(async () => {
      const { id } = await duplicateScene(scene.id, room.id);
      setSelectedId(id);
      refresh();
    });
  }

  function move(index: number, direction: -1 | 1) {
    const next = [...scenes];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    startTransition(async () => {
      await reorderScenes(room.id, next.map((scene) => scene.id));
      refresh();
    });
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_340px] gap-4 min-h-[620px]">
      <Card className="rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-bold text-ink-2">Scene Timeline</span>
          <Button variant="subtle" size="sm" onClick={generate} disabled={pending}>
            Generate
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {(["WELCOME", "RULES", "ROUND_INTRO", "QUESTION", "DRAWING", "LEADERBOARD", "BREAK", "WINNER"] as SceneType[]).map((type) => (
            <Button key={type} variant="plain" size="sm" onClick={() => add(type)} disabled={pending}>
              + {type.replace(/_/g, " ")}
            </Button>
          ))}
        </div>

        {scenes.length === 0 ? (
          <div className="flex-1 rounded-xl border border-dashed border-line/[.12] flex flex-col items-center justify-center gap-3 text-center p-6">
            <span className="text-[15px] font-bold text-ink">Create your event flow</span>
            <Button variant="primary" onClick={generate} disabled={pending}>
              Generate From Rounds
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 overflow-y-auto">
            {scenes.map((scene, index) => (
              <div
                key={scene.id}
                className={`rounded-xl border p-3 flex flex-col gap-2 cursor-pointer ${
                  selected?.id === scene.id
                    ? "border-accent/55 bg-accent/10"
                    : "border-line/[.08] bg-line/[.03]"
                }`}
                onClick={() => setSelectedId(scene.id)}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-dim">{index + 1}</span>
                  <span className="text-[12.5px] font-semibold text-ink-2 truncate">{scene.title}</span>
                  <span className="ml-auto text-[10px] text-mute-2">{scene.status}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="plain" size="sm" onClick={(event) => { event.stopPropagation(); move(index, -1); }} disabled={index === 0 || pending}>
                    Up
                  </Button>
                  <Button variant="plain" size="sm" onClick={(event) => { event.stopPropagation(); move(index, 1); }} disabled={index === scenes.length - 1 || pending}>
                    Down
                  </Button>
                  <Button variant="plain" size="sm" onClick={(event) => { event.stopPropagation(); duplicate(scene); }} disabled={pending}>
                    Copy
                  </Button>
                  <Button variant="plain" size="sm" onClick={(event) => { event.stopPropagation(); remove(scene); }} disabled={pending}>
                    Del
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ScenePreview scene={selected} questions={questions} />
      <SceneInspector
        roomId={room.id}
        scene={selected}
        rounds={rounds}
        questions={questions}
        onSaved={refresh}
      />
    </div>
  );
}

function ScenePreview({
  scene,
  questions,
}: {
  scene: SceneRecord | null;
  questions: QuestionRecord[];
}) {
  const question = scene?.questionId ? questions.find((item) => item.id === scene.questionId) : null;
  return (
    <Card className="rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono font-semibold tracking-[.12em] text-label">SCENE PREVIEW</span>
        <span className="text-[11px] text-mute-2">Mobile / Desktop</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-4 flex-1">
        <div className="rounded-[28px] border-[6px] border-[#232634] bg-[#11131d] p-4 min-h-[460px] flex flex-col">
          <span className="self-center text-[10px] text-accent bg-accent/15 rounded-full px-3 py-1">
            {scene?.type ?? "NO SCENE"}
          </span>
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
            <div className="text-2xl font-bold text-ink">{question?.question || scene?.title || "Create your event flow"}</div>
            {question?.media?.url && <div className="text-sm text-mute-2">{question.media.type}: {question.media.name}</div>}
          </div>
        </div>
        <div className="rounded-2xl border border-line/[.08] bg-line/[.03] p-6 flex flex-col justify-center gap-3">
          <span className="text-[11px] font-mono text-label">DESKTOP PREVIEW</span>
          <div className="text-3xl font-bold text-ink">{question?.question || scene?.title || "No scene selected"}</div>
          <div className="text-sm text-mute-2">{scene?.type?.replace(/_/g, " ") ?? "Generate scenes from rounds."}</div>
        </div>
      </div>
    </Card>
  );
}

function SceneInspector({
  roomId,
  scene,
  rounds,
  questions,
  onSaved,
}: {
  roomId: string;
  scene: SceneRecord | null;
  rounds: RoundRecord[];
  questions: QuestionRecord[];
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(scene?.title ?? "");
  const [type, setType] = useState<SceneType>(scene?.type ?? "WELCOME");
  const [roundId, setRoundId] = useState(scene?.roundId ?? "");
  const [questionId, setQuestionId] = useState(scene?.questionId ?? "");
  const [timer, setTimer] = useState(Number(scene?.settings?.timer ?? 30));
  const [enabled, setEnabled] = useState(Boolean(scene?.settings?.enabled ?? true));

  if (!scene) {
    return (
      <Card className="rounded-2xl p-6 flex items-center justify-center text-center text-mute-2">
        Select a scene to edit its inspector settings.
      </Card>
    );
  }
  const activeScene = scene;

  function save() {
    startTransition(async () => {
      await updateScene(activeScene.id, {
        roomId,
        type,
        title,
        roundId: roundId || null,
        questionId: questionId || null,
        content: activeScene.content,
        settings: { ...activeScene.settings, timer, enabled, showTimer: true, showAnswerButton: true },
      });
      onSaved();
    });
  }

  return (
    <Card className="rounded-2xl p-5 flex flex-col gap-4">
      <span className="text-[11px] font-mono font-semibold tracking-[.12em] text-label">SCENE INSPECTOR</span>
      <TextField label="Scene title" value={title} onChange={setTitle} />
      <label className="flex flex-col gap-[7px]">
        <span className="text-xs font-semibold text-ink-3">Type</span>
        <select value={type} onChange={(event) => setType(event.target.value as SceneType)} className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3 py-2 text-sm text-ink outline-none">
          {(["WAITING","WELCOME","RULES","ROUND_INTRO","QUESTION","HINT","ANSWER_REVEAL","DRAWING","LEADERBOARD","BREAK","BROADCAST","WINNER"] as SceneType[]).map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-[7px]">
        <span className="text-xs font-semibold text-ink-3">Round</span>
        <select value={roundId} onChange={(event) => setRoundId(event.target.value)} className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3 py-2 text-sm text-ink outline-none">
          <option value="">None</option>
          {rounds.map((round) => <option key={round.id} value={round.id}>{round.title}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-[7px]">
        <span className="text-xs font-semibold text-ink-3">Question</span>
        <select value={questionId} onChange={(event) => setQuestionId(event.target.value)} className="bg-line/[.04] border border-line/[.1] rounded-[11px] px-3 py-2 text-sm text-ink outline-none">
          <option value="">None</option>
          {questions.map((question) => <option key={question.id} value={question.id}>{question.question || question.media?.name}</option>)}
        </select>
      </label>
      <NumberField label="Timer" value={timer} onChange={setTimer} />
      <label className="flex items-center gap-2 text-[12.5px] text-ink-3">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="accent-[var(--color-accent)]" />
        Enabled
      </label>
      <Button variant="primary" onClick={save} disabled={pending}>
        {pending ? "Saving..." : "Save Scene"}
      </Button>
    </Card>
  );
}

function ComingSoon({ section }: { section: Section }) {
  return (
    <Card className="rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center">
      <div className="w-12 h-12 rounded-2xl bg-line/[.04] border border-line/[.08] flex items-center justify-center">
        <Icon name="construction" size={21} className="text-mute-2" />
      </div>
      <span className="text-[15px] font-bold text-ink">{section} coming soon</span>
      <span className="text-xs text-mute-2 max-w-[360px] leading-relaxed">
        Room-level production settings will live here for V1.
      </span>
    </Card>
  );
}

const POWER_STORE_TABS = ["Cards", "Team Inventory", "Requests", "Economy Settings"] as const;
type PowerStoreTab = (typeof POWER_STORE_TABS)[number];

function PowerStoreSection({
  room,
  teams,
  cards,
  purchases,
  ownedCards,
  requests,
}: {
  room: RoomDetail;
  teams: TeamRecord[];
  cards: PowerCardRecord[];
  purchases: CoinTransactionRecord[];
  ownedCards: TeamPowerCardRecord[];
  requests: PowerCardRequestRecord[];
}) {
  const [tab, setTab] = useState<PowerStoreTab>("Cards");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5 border-b border-line/[.07] pb-0.5">
        {POWER_STORE_TABS.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`px-3 py-2 text-[12.5px] font-medium rounded-t-lg transition-colors cursor-pointer ${
              tab === item
                ? "text-ink-2 border-b-2 border-accent"
                : "text-mute-2 hover:text-ink-3"
            }`}
          >
            {item}
            {item === "Requests" &&
              requests.filter((r) => r.status === "REQUESTED").length > 0 && (
                <span className="ml-1.5 font-mono text-[10px] text-accent">
                  {requests.filter((r) => r.status === "REQUESTED").length}
                </span>
              )}
          </button>
        ))}
      </div>

      {tab === "Cards" && (
        <PowerCardsPanel
          roomId={room.id}
          cards={cards}
          economyEnabled={room.economyEnabled}
          teamCount={teams.length}
        />
      )}
      {tab === "Team Inventory" && <InventoryPanel teams={teams} cards={cards} ownedCards={ownedCards} />}
      {tab === "Requests" && <RequestsPanel requests={requests} />}
      {tab === "Economy Settings" && (
        <StorePanel
          roomId={room.id}
          storeStatus={room.storeStatus}
          teams={teams}
          cards={cards}
          purchases={purchases}
        />
      )}
    </div>
  );
}

export function RoomSetupDashboard({
  room,
  teams,
  rounds,
  libraryRounds,
  questions,
  scenes,
  cards,
  purchases,
  ownedCards,
  requests,
  joinUrl,
  localOnly,
  lanJoinUrl,
  qrDataUrl,
}: {
  room: RoomDetail;
  teams: TeamRecord[];
  rounds: RoundRecord[];
  libraryRounds: RoundRecord[];
  questions: QuestionRecord[];
  scenes: SceneRecord[];
  cards: PowerCardRecord[];
  purchases: CoinTransactionRecord[];
  ownedCards: TeamPowerCardRecord[];
  requests: PowerCardRequestRecord[];
  joinUrl: string;
  localOnly: boolean;
  lanJoinUrl: string | null;
  qrDataUrl: string;
}) {
  const [section, setSection] = useState<Section>("Overview");
  const [createTeamOpen, setCreateTeamOpen] = useState(false);
  const content = useMemo(() => {
    if (section === "Overview") {
      return (
        <RoomOverview
          room={room}
          onCreateTeam={() => setCreateTeamOpen(true)}
          joinUrl={joinUrl}
          localOnly={localOnly}
          lanJoinUrl={lanJoinUrl}
          qrDataUrl={qrDataUrl}
        />
      );
    }
    if (section === "Teams") {
      return <TeamGrid room={room} teams={teams} onCreate={() => setCreateTeamOpen(true)} />;
    }
    if (section === "Rounds") {
      return <RoundPicker room={room} libraryRounds={libraryRounds} />;
    }
    if (section === "Scenes") {
      return <SceneBuilder room={room} rounds={rounds} questions={questions} scenes={scenes} />;
    }
    if (section === "Power Cards") {
      return (
        <PowerStoreSection
          room={room}
          teams={teams}
          cards={cards}
          purchases={purchases}
          ownedCards={ownedCards}
          requests={requests}
        />
      );
    }
    return <ComingSoon section={section} />;
  }, [
    cards,
    joinUrl,
    lanJoinUrl,
    libraryRounds,
    localOnly,
    qrDataUrl,
    ownedCards,
    purchases,
    questions,
    requests,
    room,
    rounds,
    scenes,
    section,
    teams,
  ]);

  return (
    <>
      <div className="flex items-center gap-2 text-[12.5px] text-mute-2 flex-wrap">
        <Link href={`/admin/competitions/${room.competitionId}`} className="hover:text-ink-2">
          {room.competitionTitle}
        </Link>
        <Icon name="chevron-right" size={13} className="text-faint" />
        <span className="text-ink-2 font-medium">{room.name}</span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span className="text-[22px] font-bold text-ink-2 tracking-[-.02em]">{room.name}</span>
          <span className="text-[13px] text-mute-2">{room.roomCode} - setup teams, rounds and questions.</span>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <Badge variant={ROOM_STATUS_BADGE[room.status]}>{displayRoomStatus(room.status)}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2">
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

      <TeamEditorModal
        roomId={room.id}
        open={createTeamOpen}
        onClose={() => setCreateTeamOpen(false)}
      />
    </>
  );
}
