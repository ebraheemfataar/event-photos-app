import type { Photo } from "@/lib/types";

// Mock album for /demo and the landing page. Photos are from Unsplash
// (free to use under the Unsplash License). Every URL shares one query string
// so next.config.ts can allow exactly that `search` value.

export const DEMO_EVENT_ID = "demo";
export const DEMO_EVENT_NAME = "Sam & Alex's Wedding";
export const UNSPLASH_SEARCH = "?auto=format&fit=crop&w=1600&q=80";

export function unsplash(id: string) {
  return `https://images.unsplash.com/photo-${id}${UNSPLASH_SEARCH}`;
}

/** [unsplash id, guest name, prompt id, minutes ago] — newest first. */
const SEED: [string, string | null, string | null, number][] = [
  ["1583939003579-730e3918a45a", "Thandi", "with-the-host", 2],
  ["1504609813442-a8924e83f76e", "Noor", "dance-floor", 5],
  ["1541532713592-79a0317b6b77", "Sipho", "cheers", 9],
  ["1559599101-f09722fb4948", "Aisha", "made-you-laugh", 14],
  ["1504196606672-aef5c9cefc92", "Sipho", "live-music", 18],
  ["1527529482837-4698179dc6ce", "Jamie", "cheers", 23],
  ["1525772764200-be829a350797", "Ravi", "decor-detail", 31],
  ["1517457373958-b7bdd4587205", "Ravi", "dance-floor", 38],
  ["1606216794074-735e91aa2c92", "Liam", "with-the-host", 44],
  ["1528605248644-14dd04022da1", "Zara", "candid", 52],
  ["1529156069898-49953e39b3ac", "Sipho", "group-photo", 61],
  ["1501281668745-f7f57925c3b4", "Jamie", "live-music", 70],
  ["1519671482749-fd09be7ccebf", "Zara", "cheers", 78],
  ["1519741497674-611481863552", "Noor", "best-dressed", 86],
  ["1543269865-cbf427effbad", "Liam", "made-you-laugh", 95],
  ["1533174072545-7a4b6ad7a6c3", "Mia", "dance-floor", 104],
  ["1530023367847-a683933f4172", "Aisha", "decor-detail", 118],
  ["1511285560929-80b456fea0bc", "Aisha", "with-the-host", 131],
  ["1465495976277-4387d4b0b4c6", "Mia", "candid", 146],
  ["1516450360452-9312f5e86fc7", "Thandi", "live-music", 160],
  ["1522673607200-164d1b6ce486", null, "decor-detail", 175],
  ["1520854221256-17451cc331bf", "Thandi", "see-you-soon", 190],
  ["1511632765486-a01980e01a18", "Jamie", "see-you-soon", 205],
];

export function demoPhotos(now = Date.now()): Photo[] {
  return SEED.map(([id, guest, prompt, minutesAgo], i) => ({
    id: `demo-${i}`,
    event_id: DEMO_EVENT_ID,
    storage_path: unsplash(id),
    guest_name: guest,
    content_type: "image/jpeg",
    prompt_id: prompt,
    created_at: new Date(now - minutesAgo * 60_000).toISOString(),
  }));
}
