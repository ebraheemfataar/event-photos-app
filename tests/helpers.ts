import fs from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

export const BASE = process.env.E2E_BASE_URL;
export const SEED_EVENT = "00000000-0000-4000-8000-000000000001";
export const SEED_HOST_TOKEN = "00000000-0000-4000-8000-0000000000aa";

/** Local-stack keys from .env.development.local (written by `npm run db:env`).
 * E2E tests only ever run against the local stack. */
export function localEnv() {
  const env: Record<string, string> = {};
  if (fs.existsSync(".env.development.local")) {
    for (const line of fs.readFileSync(".env.development.local", "utf8").split(/\r?\n/)) {
      const i = line.indexOf("=");
      if (i > 0 && !line.startsWith("#")) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
  }
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url?.startsWith("http://127.0.0.1")) {
    throw new Error("E2E tests need .env.development.local pointing at the local stack (npm run db:env).");
  }
  return { url, anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY };
}

/** Resolves once the album page has joined its realtime channel. Register
 * before navigating. */
export function waitForAlbumSubscription(page: Page): Promise<void> {
  return new Promise((resolve) => {
    page.on("websocket", (ws) => {
      if (!ws.url().includes("/realtime/")) return;
      ws.on("framereceived", (f) => {
        const text = String(f.payload);
        if (text.includes("realtime:event:") && text.includes("phx_reply") && text.includes('"status":"ok"')) {
          resolve();
        }
      });
    });
  });
}

/** A small real JPEG made in the browser. */
export async function makeJpeg(page: Page, color = "#FF5A1F"): Promise<Buffer> {
  const bytes = await page.evaluate(async (fill) => {
    const c = document.createElement("canvas");
    c.width = 1200;
    c.height = 900;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 1200, 900);
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), "image/jpeg", 0.9));
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, color);
  return Buffer.from(bytes);
}

/** Put a photo straight into the seed album with the service key, as if
 * another guest had finished an upload. (Since 0010 anon can't upload
 * directly; the real browser flow is tested in upload.spec.ts.) */
export async function seedPhoto(guestName: string, jpeg: Buffer, guestHash: string | null = null) {
  const { url, serviceKey } = localEnv();
  const service = createClient(url, serviceKey);
  const id = randomUUID();
  const path = `${SEED_EVENT}/${id}.jpg`;
  const up = await service.storage.from("event-photos").upload(path, jpeg, { contentType: "image/jpeg" });
  expect(up.error).toBeNull();
  const ins = await service.from("photos").insert({
    id,
    event_id: SEED_EVENT,
    storage_path: path,
    guest_name: guestName,
    content_type: "image/jpeg",
    guest_hash: guestHash,
  });
  expect(ins.error).toBeNull();
  return { id, path };
}

/** How the server stores a browser's guest id (lib/uploadActions.ts). */
export function guestHash(guestId: string) {
  return createHash("sha256").update(`guest:${guestId}`).digest("hex");
}
