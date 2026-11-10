"use client";

import { createPortal } from "react-dom";
import { QRCodeSVG } from "qrcode.react";

/** Print-only A4 "table tent": the page is folded in half along the dashed
 * line and stood up, so the top half is printed upside down and both faces
 * read the right way round. Rendered into <body> (outside the app, which the
 * print stylesheet hides) in the event's theme; the --card-* colours stay
 * light even in dark mode. Hidden on screen. */
export default function TableTent({
  eventName,
  guestUrl,
  theme,
}: {
  eventName: string;
  guestUrl: string;
  theme: string;
}) {
  return createPortal(
    <div className="print-root" data-theme={theme} aria-hidden="true">
      <div className="tent-page">
        <div className="tent-half tent-flip">
          <Face eventName={eventName} guestUrl={guestUrl} />
        </div>
        <div className="tent-fold">
          <span>Fold here</span>
        </div>
        <div className="tent-half">
          <Face eventName={eventName} guestUrl={guestUrl} />
        </div>
      </div>
    </div>,
    document.body
  );
}

function Face({ eventName, guestUrl }: { eventName: string; guestUrl: string }) {
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
        <div className="mono tent-eyebrow">Scan to add your photos</div>
        <div className="hd tent-title" style={{ fontSize: titleSize }}>
          {eventName}
        </div>
        <p className="tent-sub">Every angle of the party, in one shared album.</p>
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
        <div className="tent-pill">No app · No login · Just scan</div>
      </div>
    </div>
  );
}
