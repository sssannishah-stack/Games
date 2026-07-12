"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { appendStroke, clearBoard } from "@/actions/drawing.actions";

interface Stroke {
  kind: "STROKE" | "CLEAR";
  color: string;
  width: number;
  erase: boolean;
  points: number[]; // flat, normalized [x0,y0,x1,y1,…]
}

interface Identity {
  teamId?: string | null;
  participantId?: string | null;
}

interface LiveDrawBoardProps {
  roomId: string;
  roomCode: string;
  /** When true, this device holds the pen (host, or the assigned team's captain). */
  canDraw: boolean;
  identity: Identity;
  /** ~how often to pull new strokes, ms. */
  pollMs?: number;
  className?: string;
}

const PALETTE = ["#e6e1d5", "#6C7BFA", "#3DD68C", "#F5B93D", "#E36A8A", "#111318"];
const WIDTHS = [3, 6, 12];

/**
 * The live drawing surface. Strokes are polled from
 * /api/live/[roomCode]/drawing (append-only, replayed in `seq` order, with a
 * CLEAR row wiping the board). When `canDraw`, pointer input builds a stroke
 * that's drawn locally for instant feedback and committed on release — the
 * server echo is idempotent, so a briefly double-drawn path is invisible.
 *
 * Sync is poll-paced (not <50ms real-time): watchers see the drawing fill in
 * every poll tick, which is the honest ceiling of Encore's polling model.
 */
export function LiveDrawBoard({ roomId, roomCode, canDraw, identity, pollMs = 900, className }: LiveDrawBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Authoritative strokes since the last CLEAR, plus locally-finished strokes
  // still awaiting their server echo (dropped by age — see the poll effect).
  const committedRef = useRef<Stroke[]>([]);
  const pendingRef = useRef<{ at: number; stroke: Stroke }[]>([]);
  const sinceRef = useRef(0);
  const questionRef = useRef<string | null>(null);

  // The in-progress stroke the drawer is laying down right now.
  const liveRef = useRef<Stroke | null>(null);
  const drawingRef = useRef(false);

  const [tool, setTool] = useState<{ color: string; width: number; erase: boolean }>({
    color: PALETTE[0],
    width: WIDTHS[1],
    erase: false,
  });
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const [busy, setBusy] = useState(false);

  const paintStroke = useCallback((ctx: CanvasRenderingContext2D, s: Stroke, w: number, h: number) => {
    if (s.kind !== "STROKE" || s.points.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = s.erase ? "destination-out" : "source-over";
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(1, s.width) * (w / 1000); // width authored against a 1000px reference
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(s.points[0] * w, s.points[1] * h);
    for (let i = 2; i < s.points.length; i += 2) ctx.lineTo(s.points[i] * w, s.points[i + 1] * h);
    if (s.points.length === 2) ctx.lineTo(s.points[0] * w + 0.1, s.points[1] * h + 0.1); // a dot
    ctx.stroke();
    ctx.restore();
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    for (const s of committedRef.current) paintStroke(ctx, s, w, h);
    for (const p of pendingRef.current) paintStroke(ctx, p.stroke, w, h);
    if (liveRef.current) paintStroke(ctx, liveRef.current, w, h);
  }, [paintStroke]);

  // Keep the backing store matched to the displayed size (crisp lines, correct
  // aspect) and redraw everything at the new resolution.
  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = wrap.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    redraw();
  }, [redraw]);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(() => resize());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [resize]);

  // Poll new strokes.
  useEffect(() => {
    let alive = true;
    let timer: number | undefined;

    const tick = async () => {
      try {
        const res = await fetch(`/api/live/${roomCode}/drawing?since=${sinceRef.current}`, {
          cache: "no-store",
        });
        if (!alive) return;
        const data = (await res.json()) as {
          active: boolean;
          questionId: string | null;
          strokes: Stroke[] & { seq?: number }[];
          revision: number;
        };

        // New drawing question → blank slate. This batch was fetched against
        // the *old* since-cursor and may be partial, so discard it entirely and
        // let the next tick pull the fresh question's full history from since=0.
        if (data.questionId !== questionRef.current) {
          questionRef.current = data.questionId;
          committedRef.current = [];
          pendingRef.current = [];
          sinceRef.current = 0;
          liveRef.current = null;
          redraw();
          if (alive) timer = window.setTimeout(tick, pollMs);
          return;
        }

        const incoming = (data.strokes ?? []) as Array<Stroke & { seq: number }>;
        if (incoming.length) {
          for (const s of incoming) {
            if (s.kind === "CLEAR") {
              committedRef.current = [];
              pendingRef.current = [];
            } else {
              committedRef.current.push(s);
            }
            sinceRef.current = Math.max(sinceRef.current, s.seq);
          }
          // Anything I finished >2s ago is surely echoed now — stop shadow-drawing it.
          pendingRef.current = pendingRef.current.filter((p) => Date.now() - p.at < 2000);
          redraw();
        } else {
          pendingRef.current = pendingRef.current.filter((p) => Date.now() - p.at < 2000);
        }
      } catch {
        // transient — just try again next tick
      }
      if (alive) timer = window.setTimeout(tick, pollMs);
    };

    tick();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [roomCode, pollMs, redraw]);

  // ---- Drawer input ----
  const pointFromEvent = (e: React.PointerEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return [Math.round(x * 1e4) / 1e4, Math.round(y * 1e4) / 1e4];
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!canDraw) return;
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drawingRef.current = true;
    const t = toolRef.current;
    liveRef.current = { kind: "STROKE", color: t.color, width: t.width, erase: t.erase, points: pointFromEvent(e) };
    redraw();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!canDraw || !drawingRef.current || !liveRef.current) return;
    e.preventDefault();
    const [x, y] = pointFromEvent(e);
    const pts = liveRef.current.points;
    // Skip near-duplicate points to keep strokes light.
    const lx = pts[pts.length - 2];
    const ly = pts[pts.length - 1];
    if (Math.abs(x - lx) < 0.002 && Math.abs(y - ly) < 0.002) return;
    pts.push(x, y);
    redraw();
  };

  const finishStroke = async () => {
    if (!drawingRef.current || !liveRef.current) return;
    drawingRef.current = false;
    const stroke = liveRef.current;
    liveRef.current = null;
    if (stroke.points.length < 2) {
      redraw();
      return;
    }
    // Keep showing it locally until the server echo lands.
    pendingRef.current.push({ at: Date.now(), stroke });
    redraw();
    try {
      await appendStroke({
        roomId,
        teamId: identity.teamId ?? undefined,
        participantId: identity.participantId ?? undefined,
        color: stroke.color,
        width: stroke.width,
        erase: stroke.erase,
        points: stroke.points,
      });
    } catch {
      // On failure, drop the shadow copy so we don't imply it saved.
      pendingRef.current = pendingRef.current.filter((p) => p.stroke !== stroke);
      redraw();
    }
  };

  const onClear = async () => {
    if (!canDraw || busy) return;
    setBusy(true);
    try {
      committedRef.current = [];
      pendingRef.current = [];
      liveRef.current = null;
      redraw();
      await clearBoard({
        roomId,
        teamId: identity.teamId ?? undefined,
        participantId: identity.participantId ?? undefined,
      });
    } catch {
      /* next poll reconciles */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <div
        ref={wrapRef}
        className="relative w-full aspect-square rounded-[20px] overflow-hidden border border-line/[.12] bg-[#14161e] shadow-[inset_0_2px_16px_rgba(0,0,0,.35)]"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={finishStroke}
          onPointerLeave={finishStroke}
          onPointerCancel={finishStroke}
          className="absolute inset-0 h-full w-full"
          style={{ touchAction: "none", cursor: canDraw ? "crosshair" : "default" }}
        />
        {!canDraw && (
          <span className="pointer-events-none absolute top-2.5 left-2.5 rounded-md bg-black/35 px-2 py-[3px] font-mono text-[9.5px] text-white/70">
            watching · live
          </span>
        )}
      </div>

      {canDraw && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-line/[.1] bg-line/[.03] p-2">
          {PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setTool((t) => ({ ...t, color: c, erase: false }))}
              className={`h-6 w-6 rounded-full border-2 transition ${
                tool.color === c && !tool.erase ? "border-white scale-110" : "border-line/[.2]"
              }`}
              style={{ background: c }}
              aria-label={`color ${c}`}
            />
          ))}
          <span className="mx-1 h-5 w-px bg-line/[.14]" />
          {WIDTHS.map((w) => (
            <button
              key={w}
              onClick={() => setTool((t) => ({ ...t, width: w }))}
              className={`flex h-7 w-7 items-center justify-center rounded-lg transition ${
                tool.width === w ? "bg-line/[.16]" : "bg-line/[.05]"
              }`}
              aria-label={`width ${w}`}
            >
              <span className="rounded-full bg-current" style={{ width: w + 2, height: w + 2 }} />
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-line/[.14]" />
          <button
            onClick={() => setTool((t) => ({ ...t, erase: !t.erase }))}
            className={`flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-bold transition ${
              tool.erase ? "bg-warn/20 text-warn" : "bg-line/[.05] text-mute-2"
            }`}
          >
            ⌫ Erase
          </button>
          <button
            onClick={onClear}
            disabled={busy}
            className="ml-auto flex h-7 items-center gap-1 rounded-lg bg-danger/[.12] px-2.5 text-[11px] font-bold text-danger-soft transition hover:bg-danger/20 disabled:opacity-50"
          >
            🗑 Clear
          </button>
        </div>
      )}
    </div>
  );
}
