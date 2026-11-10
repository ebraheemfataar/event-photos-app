import { ImageResponse } from "next/og";

// Link-preview card for the landing page.

export const alt = "Snap & Share — every angle of your party, in one shared album";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#F4F4F2",
          color: "#0E0E10",
          padding: "0 96px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 34, fontWeight: 600 }}>
          <div style={{ width: 56, height: 56, borderRadius: 999, background: "#0E0E10", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 30, height: 30, borderRadius: 999, border: "5px solid #FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 8, height: 8, borderRadius: 999, background: "#FFFFFF" }} />
            </div>
          </div>
          Snap &amp; Share
        </div>
        <div style={{ marginTop: 48, display: "flex", flexDirection: "column", fontSize: 84, fontWeight: 600, lineHeight: 1.02, letterSpacing: -3 }}>
          <span>Every angle of your party,</span>
          <span style={{ color: "#8A8A90" }}>in one shared album.</span>
        </div>
        <div style={{ marginTop: 40, display: "flex", alignItems: "center", gap: 14, fontSize: 32 }}>
          <div style={{ width: 18, height: 18, borderRadius: 999, background: "#FF5A1F" }} />
          Guests scan a QR code · no app, no login
        </div>
      </div>
    ),
    size
  );
}
