"use client";

import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { DEFAULT_CARD_TEXT, type CardText } from "@/lib/cardText";

/** Print-only A4 "table tent": the page is folded in half along the dashed
 * line and stood up, so the top half is printed upside down and both faces
 * read the right way round. Rendered into <body> (outside the app, which the
 * print stylesheet hides) in the event's theme; the --card-* colours stay
 * light even in dark mode. Hidden on screen. */
export default function TableTent({
  eventName,
  guestUrl,
  theme,
  badge = false,
  text = DEFAULT_CARD_TEXT,
}: {
  eventName: string;
  guestUrl: string;
  theme: string;
  badge?: boolean;
  /** The three lines a host can change (lib/cardText.ts). */
  text?: CardText;
}) {
  return createPortal(
    <div className="print-root" data-theme={theme} aria-hidden="true">
      <div className="tent-page">
        <div className="tent-half tent-flip">
          <TentFace eventName={eventName} guestUrl={guestUrl} badge={badge} text={text} />
        </div>
        <div className="tent-fold">
          <span>Fold here</span>
        </div>
        <div className="tent-half">
          <TentFace eventName={eventName} guestUrl={guestUrl} badge={badge} text={text} />
        </div>
      </div>
    </div>,
    document.body
  );
}

/** One face of the tent (also the on-screen preview in TableCardEditor). */
export function TentFace({ eventName, guestUrl, badge, text }: { eventName: string; guestUrl: string; badge: boolean; text: CardText }) {
  const titleSize = eventName.length > 34 ? "22pt" : eventName.length > 18 ? "28pt" : "34pt";
  return (
    <div className="tent-face">
      <div className="tent-qr">
        <span className="tent-corner tl" />
        <span className="tent-corner tr" />
        <span className="tent-corner bl" />
        <span className="tent-corner br" />
        <QRCodeSVG value={guestUrl} size={512} marginSize={0} fgColor="currentColor" bgColor="transparent" style={{ width: "100%", height: "100%" }} />
      </div>
      <div className="tent-text">
        <div className="mono tent-eyebrow">{text.eyebrow}</div>
        <div className="hd tent-title" style={{ fontSize: titleSize }}>
          {eventName}
        </div>
        <p className="tent-sub">{text.message}</p>
        <ol className="tent-steps">
          <li>
            <b>1</b>Open your phone camera
          </li>
          <li>
            <b>2</b>Point it at the code
          </li>
          <li>
            <b>3</b>Add your photos
          </li>
        </ol>
        <div className="tent-pill">{text.pill}</div>
        {badge && <div className="tent-badge">Made with Snap & Share</div>}
      </div>
    </div>
  );
}
