import { ImageResponse } from "next/og";

// Home-screen icon (iOS "Add to Home Screen"). Placeholder mark, same as
// app/icon.svg: swap both when the final logo exists.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0E0E10" }}>
        <div style={{ width: 96, height: 96, borderRadius: 999, border: "14px solid #FFFFFF", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 34, height: 34, borderRadius: 999, background: "#FF5A1F" }} />
        </div>
      </div>
    ),
    size
  );
}
