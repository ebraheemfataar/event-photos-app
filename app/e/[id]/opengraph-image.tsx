import { ImageResponse } from "next/og";
import { getEvent } from "@/lib/data";
import { createServiceClient } from "@/lib/supabase/server";
import { formatEventDate, monogram } from "@/lib/eventDetails";
import { THEMES } from "@/lib/themes";

// WhatsApp / social link-preview card for a guest album: the event name in
// its theme colours, with the host's cover (never a guest photo) or the
// monogram. Only rendered for events that exist and are open.

export const alt = "Shared photo album";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getEvent(id);
  const open = event?.is_active ? event : null;
  const [bg, ink, accent] = THEMES.find((t) => t.id === open?.theme)?.swatches ?? THEMES[0].swatches;

  let cover: string | null = null;
  if (open?.cover_path) {
    if (open.cover_path.startsWith("https://")) cover = open.cover_path;
    else {
      const { data } = await createServiceClient().storage.from("event-photos").download(open.cover_path);
      if (data && data.size < 4_000_000) {
        const b64 = Buffer.from(await data.arrayBuffer()).toString("base64");
        cover = `data:${data.type || "image/jpeg"};base64,${b64}`;
      }
    }
  }

  const name = open?.name ?? "Snap & Share";
  const date = formatEventDate(open?.event_date ?? null);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", background: bg, color: ink, padding: "0 80px", gap: 64 }}>
        <div
          style={{
            width: 320,
            height: 320,
            borderRadius: 999,
            padding: 10,
            background: `linear-gradient(135deg, ${accent}, ${bg})`,
            display: "flex",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 999,
              border: `8px solid ${bg}`,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: accent,
              color: ink,
              fontSize: 110,
              fontWeight: 600,
            }}
          >
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" width={284} height={284} style={{ objectFit: "cover", width: "100%", height: "100%" }} />
            ) : (
              monogram(name)
            )}
          </div>
        </div>
        {/* 1200 − 2×80 padding − 320 circle − 64 gap */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20, width: 656 }}>
          <div style={{ fontSize: 26, letterSpacing: 4, textTransform: "uppercase", opacity: 0.7 }}>
            {open ? "Shared photo album" : "Shared photo albums"}
          </div>
          <div style={{ fontSize: name.length > 40 ? 56 : name.length > 18 ? 68 : 80, fontWeight: 600, lineHeight: 1.05, letterSpacing: -2, lineClamp: 3 }}>{name}</div>
          {date && <div style={{ fontSize: 30, opacity: 0.75 }}>{date}</div>}
          <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 14, fontSize: 30 }}>
            <div style={{ width: 18, height: 18, borderRadius: 999, background: accent }} />
            Add your photos · no app, no login
          </div>
          <div style={{ marginTop: 24, fontSize: 24, opacity: 0.6 }}>Snap &amp; Share</div>
        </div>
      </div>
    ),
    size
  );
}
