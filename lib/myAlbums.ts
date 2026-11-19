"use client";

import { useSyncExternalStore } from "react";

// Phase 7a, "Your albums on this device": every album opened with a valid
// host link is remembered in this browser (id + host token), so the home page
// can list them. No login. Cleared with the browser's site data; the host
// link stays the real key. The server re-checks every token (lib/albumActions).

const KEY = "snap-my-albums";
const CHANGE = "snap-my-albums-change";
const MAX = 50;

export type SavedAlbum = { id: string; token: string; name: string; savedAt: number };

function read(): SavedAlbum[] {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(list)
      ? list.filter((a) => a && typeof a.id === "string" && typeof a.token === "string").slice(0, MAX)
      : [];
  } catch {
    return [];
  }
}

function write(list: SavedAlbum[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // Storage blocked: the list just won't persist.
  }
  cache = null;
  window.dispatchEvent(new Event(CHANGE));
}

/** Most recent first; re-opening an album moves it to the top. */
export function rememberAlbum(album: { id: string; token: string; name: string }) {
  write([{ ...album, savedAt: Date.now() }, ...read().filter((a) => a.id !== album.id)]);
}

export function forgetAlbum(id: string) {
  write(read().filter((a) => a.id !== id));
}

let cache: { raw: string; list: SavedAlbum[] } | null = null;
const EMPTY: SavedAlbum[] = [];

function snapshot(): SavedAlbum[] {
  let raw = "[]";
  try {
    raw = localStorage.getItem(KEY) ?? "[]";
  } catch {}
  if (cache?.raw !== raw) cache = { raw, list: read() };
  return cache.list;
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Albums saved in this browser (empty during server render). */
export function useMyAlbums(): SavedAlbum[] {
  return useSyncExternalStore(subscribe, snapshot, () => EMPTY);
}
