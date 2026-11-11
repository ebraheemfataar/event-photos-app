"use client";

import { useSyncExternalStore } from "react";

// Phase 2c guest identity: a random id per browser, no login. The server
// only ever stores its hash (photos.guest_hash). It's a bearer secret for
// "delete my own photo", so it's never put in a URL or shown to anyone.
//
// The ids of photos shared from this browser are remembered too, only to
// decide where to show "Delete my photo"; the server re-checks every delete.

const GUEST_KEY = "snap-guest-id";
const MINE_KEY = "snap-my-photos";
const MAX_REMEMBERED = 500;
const CHANGE = "snap-my-photos-change";

let memoryGuestId: string | null = null;

export function getGuestId(): string {
  try {
    let id = localStorage.getItem(GUEST_KEY);
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem(GUEST_KEY, id);
    }
    return id;
  } catch {
    // Private mode / storage blocked: works for this visit only.
    return (memoryGuestId ??= crypto.randomUUID());
  }
}

function readMine(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(MINE_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeMine(list: string[]) {
  try {
    localStorage.setItem(MINE_KEY, JSON.stringify(list.slice(-MAX_REMEMBERED)));
  } catch {
    // Ignore: the button just won't show after a reload.
  }
  cached = null;
  window.dispatchEvent(new Event(CHANGE));
}

export function rememberMyPhoto(photoId: string) {
  writeMine([...readMine().filter((id) => id !== photoId), photoId]);
}

export function forgetMyPhoto(photoId: string) {
  writeMine(readMine().filter((id) => id !== photoId));
}

// useSyncExternalStore needs a stable snapshot between changes.
let cached: { raw: string; set: ReadonlySet<string> } | null = null;
const EMPTY: ReadonlySet<string> = new Set();

function snapshot(): ReadonlySet<string> {
  let raw = "[]";
  try {
    raw = localStorage.getItem(MINE_KEY) ?? "[]";
  } catch {}
  if (cached?.raw !== raw) cached = { raw, set: new Set(readMine()) };
  return cached.set;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Ids of photos shared from this browser (empty during server render). */
export function useMyPhotoIds(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
