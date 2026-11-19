import type { Event, Photo } from "@/lib/types";
import type { AddOn, Plan } from "@/lib/plans";

// Mock album for /demo and the landing page. Photos are from Unsplash
// (free to use under the Unsplash License). Every URL shares one query string
// so next.config.ts can allow exactly that `search` value.

export const DEMO_EVENT_ID = "demo";
export const DEMO_EVENT_NAME = "Sam & Alex's Wedding";
export const UNSPLASH_SEARCH = "?auto=format&fit=crop&w=1600&q=80";

export function unsplash(id: string) {
  return `https://images.unsplash.com/photo-${id}${UNSPLASH_SEARCH}`;
}

/** The demo event with every detail filled in (cover, poster, note, links),
 * so /demo shows the whole event-info feature. Links go to example.com. */
export function demoEvent(createdAt: string): Event {
  return {
    id: DEMO_EVENT_ID,
    name: DEMO_EVENT_NAME,
    is_active: true,
    created_at: createdAt,
    theme: "classic",
    event_date: "2026-11-14",
    note: "Snap the speeches, the dance floor and anything that makes you smile. 📸",
    cover_path: unsplash("1606216794074-735e91aa2c92"),
    poster_path: unsplash("1519741497674-611481863552"),
    links: [
      { label: "Gift registry", url: "https://example.com/registry" },
      { label: "Our story", url: "https://example.com/our-story" },
    ],
    plan: "small",
    expires_at: new Date(new Date(createdAt).getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    extra_contributors: 0,
    legacy_uncapped: false,
  };
}

export const DEMO_ADD_ONS: AddOn[] = [
  { id: "keep_1yr", name: "Keep for 1 more year", price_cents: 4900, extra_contributors: 0, extra_retention_days: 365, stackable: false, sort_order: 1 },
  { id: "guests_50", name: "+50 guests", price_cents: 7900, extra_contributors: 50, extra_retention_days: 0, stackable: true, sort_order: 2 },
];

/** Plan sheet contents for /demo?as=host (no database). Mirrors the seeded
 * `plans` table in 0011_plans.sql. */
export const DEMO_PLANS: Plan[] = [
  { id: "free", name: "Free", price_cents: 0, max_contributors: 20, retention_days: 30, shows_badge: true, sort_order: 1 },
  { id: "small", name: "Small", price_cents: 14900, max_contributors: 100, retention_days: 90, shows_badge: true, sort_order: 2 },
  { id: "medium", name: "Medium", price_cents: 39900, max_contributors: 300, retention_days: 365, shows_badge: false, sort_order: 3 },
  { id: "unlimited", name: "Unlimited", price_cents: 79900, max_contributors: null, retention_days: null, shows_badge: false, sort_order: 4 },
];

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
    thumb_path: null,
    created_at: new Date(now - minutesAgo * 60_000).toISOString(),
  }));
}
