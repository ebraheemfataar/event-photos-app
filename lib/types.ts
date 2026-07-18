export type Event = {
  id: string;
  name: string;
  host_token: string;
  is_active: boolean;
  created_at: string;
};

export type Photo = {
  id: string;
  event_id: string;
  storage_path: string;
  guest_name: string | null;
  content_type: string | null;
  created_at: string;
};
