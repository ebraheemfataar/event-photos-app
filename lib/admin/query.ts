// Admin albums table: URL query shape and row type. Import-free, so the
// browser table component and the server can both use it.

export type AdminEventRow = {
  id: string;
  name: string;
  created_at: string;
  is_active: boolean;
  plan: string;
  expires_at: string | null;
  legacy_uncapped: boolean;
  photos: number;
  contributors: number;
  last_upload: string | null;
  storage_bytes: number;
  total_count: number;
};


export const ADMIN_PAGE_SIZES = [10, 25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;

export const ADMIN_STATUSES = ["all", "live", "closed", "expired"] as const;
export type AdminStatus = (typeof ADMIN_STATUSES)[number];
export const ADMIN_SORTS = ["created", "name", "photos", "guests", "storage", "last_upload"] as const;
export type AdminSort = (typeof ADMIN_SORTS)[number];

export const ADMIN_PLAN_FILTERS = ["free", "small", "medium", "unlimited", "early"] as const;
export type AdminPlanFilter = (typeof ADMIN_PLAN_FILTERS)[number];

export type AdminListQuery = {
  q: string;
  page: number;
  per: number;
  status: AdminStatus;
  sort: AdminSort;
  desc: boolean;
  plan: AdminPlanFilter | null;
};

export const DEFAULT_ADMIN_QUERY: AdminListQuery = {
  q: "",
  page: 1,
  per: DEFAULT_PAGE_SIZE,
  status: "all",
  sort: "created",
  desc: true,
  plan: null,
};

/** Reads ?q=&page=&per=&status=&plan=&sort=&dir= safely (unknown → defaults). */
export function parseAdminQuery(p: Record<string, string | undefined>): AdminListQuery {
  const one = <T extends string>(list: readonly T[], v: string | undefined): T | null =>
    (list as readonly string[]).includes(v ?? "") ? (v as T) : null;
  const per = Number(p.per);
  return {
    q: (p.q ?? "").slice(0, 100),
    page: Math.max(1, Number(p.page) || 1),
    per: (ADMIN_PAGE_SIZES as readonly number[]).includes(per) ? per : DEFAULT_PAGE_SIZE,
    status: one(ADMIN_STATUSES, p.status) ?? "all",
    sort: one(ADMIN_SORTS, p.sort) ?? "created",
    desc: p.dir !== "asc",
    plan: one(ADMIN_PLAN_FILTERS, p.plan),
  };
}

/** Cookie remembering whether the admin overview cards are hidden. */
export const OVERVIEW_COOKIE = "admin_overview";
