import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { CopyLinkButton } from "@/components/room/CopyLinkButton";

interface PublishPanelProps {
  roomCode: string;
  joinUrl: string;
  /** Real, scannable QR data URI generated server-side (in the page component) from the room's actual join URL. */
  qrDataUrl: string;
  /** True when this request came in over localhost/127.0.0.1 — that link only works on this machine. */
  localOnly?: boolean;
  /** A same-Wi-Fi alternative built from this machine's LAN IP, if one could be detected. */
  lanJoinUrl?: string | null;
}

/**
 * A Client Component can't import and render an async Server Component
 * directly — QR generation happens in the (server) page component instead,
 * and the resulting data URI is passed down as a plain string prop.
 */
export function PublishPanel({ roomCode, joinUrl, qrDataUrl, localOnly, lanJoinUrl }: PublishPanelProps) {
  return (
    <Card className="rounded-2xl p-5 flex flex-col items-center gap-3 text-center">
      <SectionLabel className="self-start text-[11px] tracking-[.12em]">
        <Icon name="qr-code" size={13} />
        PUBLISH — HOW TEAMS JOIN
      </SectionLabel>

      {localOnly && (
        <div className="w-full flex flex-col gap-1.5 text-left bg-warn/[.08] border border-warn/25 rounded-[10px] px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-warn">
            <Icon name="triangle-alert" size={13} />
            {lanJoinUrl ? "Localhost link won't reach other phones" : "No phone on another device can reach this"}
          </span>
          <span className="text-[11px] text-mute-2 leading-relaxed">
            {lanJoinUrl
              ? "You're viewing this on localhost — only this computer can open that address. Share the Wi-Fi link below instead (same network only)."
              : "This server is only reachable from this machine. Deploy the app or connect to a network to get a shareable link."}
          </span>
        </div>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element -- data URI, no next/image benefit */}
      <img src={qrDataUrl} alt={`QR code to join ${roomCode}`} width={168} height={168} className="rounded-xl" />
      <div className="flex flex-col gap-0.5">
        <span className="font-mono font-semibold text-[9px] tracking-[.12em] text-dim-2">
          ROOM CODE
        </span>
        <span className="font-mono font-bold text-2xl tracking-[.14em] text-ink">{roomCode}</span>
      </div>

      {lanJoinUrl ? (
        <div className="flex flex-col items-center gap-1">
          <span className="text-[9px] font-semibold tracking-[.1em] text-dim-2">
            SAME WI-FI LINK
          </span>
          <span className="text-[11px] text-mute-2 break-all px-2">{lanJoinUrl}</span>
        </div>
      ) : (
        <span className="text-[11px] text-mute-2 break-all px-2">{joinUrl}</span>
      )}

      <CopyLinkButton text={lanJoinUrl ?? joinUrl} />
    </Card>
  );
}
