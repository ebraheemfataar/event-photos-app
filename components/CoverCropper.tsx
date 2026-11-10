"use client";

import { useEffect, useRef, useState } from "react";

const VIEW = 280; // on-screen crop square, px
const OUT = 1024; // saved cover, px (square)
const MAX_ZOOM = 4;

type Loaded = { img: HTMLImageElement; url: string; w: number; h: number };

/** Frame the cover before it's uploaded: drag to move, slider / wheel /
 * pinch to zoom. The circle shows exactly what the profile picture will show;
 * the saved file is the square around it, so link previews match too.
 * Logos (PNG / WebP / GIF) stay PNG to keep transparency; photos become JPEG.
 * If the browser can't decode the file (e.g. HEIC outside Safari),
 * `onUnsupported` hands the original back to be uploaded as-is. */
export default function CoverCropper({
  file,
  onCancel,
  onConfirm,
  onUnsupported,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
  onUnsupported: () => void;
}) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    let alive = true;
    img.onload = () => alive && setLoaded({ img, url, w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => alive && onUnsupported();
    img.src = url;
    return () => {
      alive = false;
      URL.revokeObjectURL(url);
    };
    // Only when the file changes; the callbacks are stable enough for this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  const base = loaded ? VIEW / Math.min(loaded.w, loaded.h) : 1;
  const dispW = loaded ? loaded.w * base * zoom : VIEW;
  const dispH = loaded ? loaded.h * base * zoom : VIEW;

  // Keep the image covering the square.
  function clamp(o: { x: number; y: number }, w = dispW, h = dispH) {
    const mx = (w - VIEW) / 2;
    const my = (h - VIEW) / 2;
    return { x: Math.max(-mx, Math.min(mx, o.x)), y: Math.max(-my, Math.min(my, o.y)) };
  }

  function applyZoom(next: number) {
    if (!loaded) return;
    const z = Math.max(1, Math.min(MAX_ZOOM, next));
    // Zoom around the centre: scale the offset with the image.
    const ratio = z / zoom;
    setZoom(z);
    setOffset((o) => clamp({ x: o.x * ratio, y: o.y * ratio }, loaded.w * base * z, loaded.h * base * z));
  }

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const now = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, now);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      applyZoom(pinch.current.zoom * (Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.dist));
      return;
    }
    setOffset((o) => clamp({ x: o.x + now.x - prev.x, y: o.y + now.y - prev.y }));
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  }

  async function confirm() {
    if (!loaded) return;
    const scale = base * zoom;
    const size = VIEW / scale; // source pixels shown in the square
    const sx = loaded.w / 2 - (VIEW / 2 + offset.x) / scale;
    const sy = loaded.h / 2 - (VIEW / 2 + offset.y) / scale;
    const out = Math.min(OUT, Math.round(size)) || OUT;
    const canvas = document.createElement("canvas");
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext("2d");
    if (!ctx) return onUnsupported();
    const keepAlpha = /png|webp|gif/.test(file.type);
    if (!keepAlpha) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, out, out);
    }
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(loaded.img, sx, sy, size, size, 0, 0, out, out);
    const type = keepAlpha ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.9));
    if (!blob) return onUnsupported();
    onConfirm(new File([blob], `cover.${keepAlpha ? "png" : "jpg"}`, { type }));
  }

  return (
    <div className="flex flex-col items-center gap-4 rounded-[22px] border border-line bg-surface p-4">
      <p className="text-center text-sm text-ink-2">Drag to position · pinch or slide to zoom</p>
      <div
        role="img"
        aria-label="Cover crop preview"
        className="relative cursor-grab touch-none select-none overflow-hidden rounded-[20px] bg-surface-3 active:cursor-grabbing"
        style={{ width: VIEW, height: VIEW }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={(e) => applyZoom(zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}
      >
        {loaded ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={loaded.url}
            alt=""
            draggable={false}
            className="pointer-events-none absolute max-w-none"
            style={{
              width: dispW,
              height: dispH,
              left: VIEW / 2 - dispW / 2 + offset.x,
              top: VIEW / 2 - dispH / 2 + offset.y,
            }}
          />
        ) : (
          <div className="skeleton absolute inset-0" />
        )}
        {/* Dim everything outside the circle the profile picture shows. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ boxShadow: "0 0 0 200px rgba(0,0,0,0.5)", outline: "2px solid rgba(255,255,255,0.9)", outlineOffset: -2 }}
        />
      </div>
      <input
        type="range"
        min={1}
        max={MAX_ZOOM}
        step={0.01}
        value={zoom}
        onChange={(e) => applyZoom(Number(e.target.value))}
        aria-label="Zoom"
        className="w-full max-w-[280px] accent-[var(--ink)]"
        disabled={!loaded}
      />
      <div className="grid w-full grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-12 rounded-full border border-line-strong text-[15px] font-semibold transition-colors hover:bg-surface-3"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={!loaded}
          className="h-12 rounded-full bg-btn text-[15px] font-semibold text-btn-ink transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          Use this
        </button>
      </div>
    </div>
  );
}
