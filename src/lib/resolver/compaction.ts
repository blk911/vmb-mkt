import type { EvidenceRecord } from "@/lib/evidence/types";
import { normalizeCity, normalizeDomain, normalizeName } from "./normalize";
import type { ResolverOperator } from "./types";

export type ResolverCompactionSummary = {
  preCompactionOperatorCount: number;
  postCompactionOperatorCount: number;
  compactedDuplicateCount: number;
};

type DisjointSet = {
  parent: number[];
  find: (x: number) => number;
  union: (a: number, b: number) => void;
};

const SHARED_PLATFORM_HOSTS = [
  "instagram.com",
  "facebook.com",
  "tiktok.com",
  "x.com",
  "twitter.com",
  "glossgenius.com",
  "vagaro.com",
  "styleseat.com",
  "booksy.com",
  "fresha.com",
  "square.site",
  "solasalonstudios.com",
  "phenixsalonsuites.com",
  "mysalonsuite.com",
  "salonlofts.com",
];

function createDisjointSet(size: number): DisjointSet {
  const parent = Array.from({ length: size }, (_, i) => i);
  const find = (x: number): number => {
    if (parent[x] === x) return x;
    parent[x] = find(parent[x]);
    return parent[x];
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  return { parent, find, union };
}

function normalizedBookingKey(value?: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    const pathParts = url.pathname.split("/").filter(Boolean);
    if (!pathParts.length) return "";
    const firstPath = pathParts.slice(0, 3).join("/");
    return `${url.hostname.replace(/^www\./, "").toLowerCase()}/${firstPath}`;
  } catch {
    return "";
  }
}

function isSharedHost(host: string): boolean {
  const value = host.toLowerCase();
  return SHARED_PLATFORM_HOSTS.some((x) => value === x || value.endsWith(`.${x}`));
}

function normalizedInstagramHandle(value?: string): string {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!url.hostname.toLowerCase().includes("instagram.com")) return "";
    const handle = url.pathname.split("/").filter(Boolean)[0] || "";
    return handle.toLowerCase().replace(/^@/, "");
  } catch {
    return "";
  }
}

function isProvisionalName(value?: string): boolean {
  const text = normalizeName(value);
  if (!text) return true;
  if (!text.includes(" ")) return true;
  return /(profile|provider|staff|member|artist|book|booking|detail|services?)/.test(text);
}

function isCompactionSafeName(value?: string): boolean {
  const name = normalizeName(value);
  if (!name || name.length < 4) return false;
  if (/(sola salons?|phenix salon suites?|my salon suite|salon lofts?)/.test(name)) return false;
  return true;
}

function reviewRank(value?: ResolverOperator["reviewState"]): number {
  if (value === "ready") return 3;
  if (value === "shelved_by_review") return 2;
  return 1;
}

function sourceStrength(row: EvidenceRecord): number {
  let score = 0;
  if (row.source === "booking") score += 10;
  if (row.source === "website") score += 8;
  if (row.source === "instagram") score += 7;
  if (row.source === "directory") score += 5;
  if (row.evidenceType === "direct_operator") score += 8;
  if (row.booking) score += 6;
  if (row.instagram) score += 4;
  if (row.website) score += 4;
  if (row.name && !isProvisionalName(row.name)) score += 4;
  return score;
}

function mergeEvidence(a: EvidenceRecord[], b: EvidenceRecord[]): EvidenceRecord[] {
  const map = new Map<string, EvidenceRecord>();
  for (const row of [...a, ...b]) {
    if (row.id) map.set(row.id, row);
  }
  return [...map.values()];
}

function preferField(current: string | undefined, candidate: string | undefined, sourceRows: EvidenceRecord[]): string | undefined {
  if (!candidate) return current;
  if (!current) return candidate;
  if (current === candidate) return current;
  const sorted = [...sourceRows].sort((x, y) => sourceStrength(y) - sourceStrength(x));
  const top = sorted.find((row) => row.booking === candidate || row.website === candidate || row.instagram === candidate || row.name === candidate);
  const topCurrent = sorted.find((row) => row.booking === current || row.website === current || row.instagram === current || row.name === current);
  return (top ? sourceStrength(top) : 0) >= (topCurrent ? sourceStrength(topCurrent) : 0) ? candidate : current;
}

function mergeOperators(rows: ResolverOperator[]): ResolverOperator {
  const sorted = [...rows].sort((a, b) => b.confidenceScore - a.confidenceScore);
  const base = { ...sorted[0] };
  base.compactedFromCount = rows.length;
  for (let i = 1; i < sorted.length; i += 1) {
    const row = sorted[i];
    base.sources = mergeEvidence(base.sources, row.sources);
    base.canonicalName = preferField(base.canonicalName, row.canonicalName, base.sources);
    base.canonicalAddress = preferField(base.canonicalAddress, row.canonicalAddress, base.sources);
    base.canonicalCity = preferField(base.canonicalCity, row.canonicalCity, base.sources);
    base.canonicalPhone = preferField(base.canonicalPhone, row.canonicalPhone, base.sources);
    base.canonicalWebsite = preferField(base.canonicalWebsite, row.canonicalWebsite, base.sources);
    base.canonicalInstagram = preferField(base.canonicalInstagram, row.canonicalInstagram, base.sources);
    base.canonicalBooking = preferField(base.canonicalBooking, row.canonicalBooking, base.sources);
    if (!base.parentContainerId && row.parentContainerId) base.parentContainerId = row.parentContainerId;
    base.isContainer = Boolean(base.isContainer || row.isContainer);
    if (reviewRank(row.reviewState) > reviewRank(base.reviewState)) {
      base.reviewState = row.reviewState;
      base.reviewNotes = row.reviewNotes;
    } else if (!base.reviewNotes && row.reviewNotes) {
      base.reviewNotes = row.reviewNotes;
    }
    base.confidenceScore = Math.max(base.confidenceScore, row.confidenceScore);
    if (row.createdAt < base.createdAt) base.createdAt = row.createdAt;
    if (row.updatedAt > base.updatedAt) base.updatedAt = row.updatedAt;
  }
  return base;
}

function applyKeyUnions(
  operators: ResolverOperator[],
  ds: DisjointSet,
  buildKeys: (op: ResolverOperator) => string[]
): void {
  const keyToIndex = new Map<string, number>();
  operators.forEach((op, idx) => {
    for (const key of buildKeys(op)) {
      if (!key) continue;
      const existing = keyToIndex.get(key);
      if (existing === undefined) keyToIndex.set(key, idx);
      else ds.union(existing, idx);
    }
  });
}

export function compactResolverOperators(operators: ResolverOperator[]): {
  operators: ResolverOperator[];
  summary: ResolverCompactionSummary;
} {
  const ds = createDisjointSet(operators.length);

  applyKeyUnions(operators, ds, (op) => {
    const name = isCompactionSafeName(op.canonicalName) ? normalizeName(op.canonicalName) : "";
    const city = normalizeCity(op.canonicalCity);
    if (!name || !city) return [];
    return [`name_city:${name}|${city}`];
  });

  applyKeyUnions(operators, ds, (op) => {
    const domain = normalizeDomain(op.canonicalWebsite);
    if (!domain || isSharedHost(domain)) return [];
    if (!op.canonicalName || !isCompactionSafeName(op.canonicalName)) return [];
    return domain ? [`domain:${domain}`] : [];
  });

  applyKeyUnions(operators, ds, (op) => {
    const booking = normalizedBookingKey(op.canonicalBooking);
    if (!booking || booking.split("/").length < 3) return [];
    return booking ? [`booking:${booking}`] : [];
  });

  applyKeyUnions(operators, ds, (op) => {
    const handle = normalizedInstagramHandle(op.canonicalInstagram);
    return handle ? [`instagram:${handle}`] : [];
  });

  applyKeyUnions(operators, ds, (op) => {
    const name = normalizeName(op.canonicalName);
    if (!op.parentContainerId || !name) return [];
    return [`parent_child:${op.parentContainerId}|${name}`];
  });

  applyKeyUnions(operators, ds, (op) => {
    const key = [
      normalizeName(op.canonicalName),
      normalizeCity(op.canonicalCity),
      normalizedBookingKey(op.canonicalBooking),
      normalizedInstagramHandle(op.canonicalInstagram),
      normalizeDomain(op.canonicalWebsite),
      op.parentContainerId || "",
    ].join("|");
    return key.replace(/\|/g, "").length ? [`exact:${key}`] : [];
  });

  const groups = new Map<number, ResolverOperator[]>();
  operators.forEach((op, idx) => {
    const root = ds.find(idx);
    const bucket = groups.get(root) || [];
    bucket.push(op);
    groups.set(root, bucket);
  });

  const compacted = [...groups.values()].map((rows) => mergeOperators(rows));
  const preCompactionOperatorCount = operators.length;
  const postCompactionOperatorCount = compacted.length;
  return {
    operators: compacted,
    summary: {
      preCompactionOperatorCount,
      postCompactionOperatorCount,
      compactedDuplicateCount: Math.max(0, preCompactionOperatorCount - postCompactionOperatorCount),
    },
  };
}

