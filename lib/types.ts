import type { ThemeId } from "@/lib/themes";

// host_token is deliberately absent: since 0003_lock_down_host_token.sql anon
// can't select it. It's only ever returned once, by the create_event RPC.
export type Event = {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  // Event details (0008_event_details.sql)
  theme: ThemeId;
  event_date: string | null; // YYYY-MM-DD
  note: string | null;
  cover_path: string | null;
  poster_path: string | null;
  links: EventLink[];
};

export type EventLink = { label: string; url: string };

export type Photo = {
  id: string;
  event_id: string;
  storage_path: string;
  guest_name: string | null;
  content_type: string | null;
  prompt_id: string | null;
  created_at: string;
};
