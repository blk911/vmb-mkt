// Centralize admin navigation so operator tooling is organized by workflow and
// business domain rather than by the order features were added over time.
export type AdminNavSectionKey =
  | "home"
  | "platform"
  | "markets"
  | "operators"
  | "prospecting"
  | "intake"
  | "data";

export interface AdminNavItem {
  label: string;
  href: string;
  description?: string;
  section: AdminNavSectionKey;
  isPrimary?: boolean;
  isBeta?: boolean;
}

export interface AdminNavGroup {
  key: AdminNavSectionKey;
  label: string;
  description: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    key: "platform",
    label: "Platform",
    description: "Core admin workspaces and top-level system consoles.",
    items: [
      {
        label: "VMB Admin",
        href: "/admin/vmb",
        description: "VMB control surface for rollups, review flows, and related ops tooling.",
        section: "platform",
        isPrimary: true,
      },
    ],
  },
  {
    key: "markets",
    label: "Markets",
    description: "Zone planning, market operations, and sales-target workflows.",
    items: [
      {
        label: "Markets",
        href: "/admin/markets",
        description: "Primary market console for zones, members, and targeting work.",
        section: "markets",
        isPrimary: true,
      },
    ],
  },
  {
    key: "operators",
    label: "Operators",
    description: "Resolver-backed operator review, child analysis, and surface recovery.",
    items: [
      {
        label: "Operator Console",
        href: "/admin/operators",
        description: "Review resolver-backed operators, status, evidence, and review state.",
        section: "operators",
        isPrimary: true,
      },
      {
        label: "Child Operators",
        href: "/admin/operators/children",
        description: "Inspect resolved versus provisional child operators and lineage.",
        section: "operators",
      },
      {
        label: "Ready Core",
        href: "/admin/operators/ready",
        description: "Filter ready-core operators by city, category, and preferred surface.",
        section: "operators",
      },
      {
        label: "Surface Recovery",
        href: "/admin/operators/surface-recovery",
        description: "Review the operator surface recovery queue and prioritization.",
        section: "operators",
      },
    ],
  },
  {
    key: "prospecting",
    label: "Prospecting / Social",
    description: "Network-mapped prospecting, social seeds, and outward-facing target queues.",
    items: [
      {
        label: "IG Clusters",
        href: "/admin/manual-ig-clusters",
        description: "Stage copied Instagram follow networks before accepting any handles downstream.",
        section: "prospecting",
        isPrimary: true,
      },
      {
        label: "Social Targets",
        href: "/admin/social-targets",
        description: "Review social-target records, referrals, and computed priority scores.",
        section: "prospecting",
      },
      {
        label: "Outreach Queue",
        href: "/admin/markets/outreach-queue",
        description: "Work queue for outreach-ready market targets.",
        section: "prospecting",
      },
      {
        label: "DORA Targets",
        href: "/admin/dora/targets",
        description: "Saved DORA-linked targets available to broader targeting workflows.",
        section: "prospecting",
      },
    ],
  },
  {
    key: "intake",
    label: "Intake / Review",
    description: "Imports, copy-paste intakes, review queues, and review-only tooling.",
    items: [
      {
        label: "Source Intake",
        href: "/admin/source-intake",
        description: "Stage and process structured source text without mutating canonicals directly.",
        section: "intake",
        isPrimary: true,
      },
      {
        label: "Places Review",
        href: "/admin/vmb/places/review",
        description: "Review places candidates and adjudicate storefront confidence.",
        section: "intake",
      },
      {
        label: "Places Sweep",
        href: "/admin/vmb/places/sweep",
        description: "Bulk sweep review for places decisions and cleanup.",
        section: "intake",
      },
      {
        label: "Facilities Import",
        href: "/admin/vmb/facilities/import",
        description: "Import and review facility-linked source material.",
        section: "intake",
      },
      {
        label: "Tech",
        href: "/admin/vmb/tech",
        description: "Operator-adjacent tech and review workspace.",
        section: "intake",
      },
      {
        label: "DORA Confirm",
        href: "/admin/dora/confirm",
        description: "Resolve DORA confirmation queue items before promotion.",
        section: "intake",
      },
    ],
  },
  {
    key: "data",
    label: "Data / Pipeline",
    description: "Rollups, datasets, facility indexes, and materialized pipeline outputs.",
    items: [
      {
        label: "Rollups",
        href: "/admin/vmb/rollups",
        description: "Review VMB rollups and drill into location-level aggregates.",
        section: "data",
        isPrimary: true,
      },
      {
        label: "Live Units",
        href: "/admin/live-units",
        description: "Inspect the live-units dataset, trace details, and review state.",
        section: "data",
      },
      {
        label: "DORA Facilities",
        href: "/admin/dora/facilities",
        description: "Facility-level DORA admin tooling and supporting data views.",
        section: "data",
      },
    ],
  },
];

export const ADMIN_TOP_NAV = [
  { key: "home" as const, label: "Admin Home", href: "/admin" },
  { key: "platform" as const, label: "VMB", href: "/admin/vmb" },
  { key: "markets" as const, label: "Markets", href: "/admin/markets" },
  { key: "operators" as const, label: "Operators", href: "/admin/operators" },
  { key: "prospecting" as const, label: "Prospecting", href: "/admin/manual-ig-clusters" },
  { key: "intake" as const, label: "Intake", href: "/admin/source-intake" },
  { key: "data" as const, label: "Data", href: "/admin/vmb/rollups" },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

export function getAdminNavGroups(): AdminNavGroup[] {
  return ADMIN_NAV_GROUPS;
}

export function getAdminActiveSection(pathname: string): AdminNavSectionKey {
  if (pathname === "/admin") return "home";

  let bestMatch: { section: AdminNavSectionKey; hrefLength: number } | null = null;
  for (const item of ADMIN_NAV_ITEMS) {
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      if (!bestMatch || item.href.length > bestMatch.hrefLength) {
        bestMatch = { section: item.section, hrefLength: item.href.length };
      }
    }
  }

  return bestMatch?.section || "home";
}
