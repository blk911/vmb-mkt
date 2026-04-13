export interface ParsedSolaTenantInput {
  tenantName: string;
  suite?: string;
  phone?: string;
  websiteUrl?: string;
  instagramUrl?: string;
  bookingUrl?: string;
}

function normalizeLine(input: string): string {
  return input.trim();
}

function ensureUrl(value: string): string {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function normalizeInstagramUrl(value: string): string | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  if (raw.startsWith("@")) {
    return `https://www.instagram.com/${raw.replace(/^@+/, "").trim()}/`;
  }
  const normalized = ensureUrl(raw);
  if (/instagram\.com/i.test(normalized)) return normalized;
  return undefined;
}

function normalizePhone(value: string): string | undefined {
  const raw = value.trim();
  return /\+?\d[\d\s().-]{6,}/.test(raw) ? raw : undefined;
}

function normalizeSuite(value: string): string | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  const match = raw.match(/\b(?:suite|ste|studio|unit|rm)\b[:\s-]*(.+)$/i);
  if (match?.[1]) return match[1].trim();
  return undefined;
}

function classifyUrl(value: string): Pick<ParsedSolaTenantInput, "websiteUrl" | "instagramUrl" | "bookingUrl"> {
  const normalized = ensureUrl(value.trim());
  if (/instagram\.com/i.test(normalized)) return { instagramUrl: normalized };
  if (/(glossgenius|vagaro|booksy|schedulicity|square\.site|styleseat|boulevard|phorest|fresha)/i.test(normalized)) {
    return { bookingUrl: normalized };
  }
  return { websiteUrl: normalized };
}

export function guessSolaTenantCategory(input: string): string {
  const text = input.toLowerCase();
  if (text.includes("nail")) return "nails";
  if (text.includes("lash") || text.includes("brow")) return "lashes";
  if (text.includes("hair")) return "hair";
  if (text.includes("spa") || text.includes("skin") || text.includes("facial")) return "spa/skin";
  return "unknown";
}

function parseTenantBlock(block: string): ParsedSolaTenantInput | null {
  const lines = block
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);
  if (!lines.length) return null;

  let tenantName = "";
  let suite: string | undefined;
  let phone: string | undefined;
  let websiteUrl: string | undefined;
  let instagramUrl: string | undefined;
  let bookingUrl: string | undefined;

  for (const line of lines) {
    const labeledMatch = line.match(/^(tenant|name|suite|phone|instagram|ig|website|site|booking)\s*:\s*(.+)$/i);
    const value = labeledMatch?.[2]?.trim() || line;
    const label = labeledMatch?.[1]?.toLowerCase();

    if (!tenantName && (!label || label === "tenant" || label === "name")) {
      if (!/^https?:\/\//i.test(value) && !value.startsWith("@") && !normalizePhone(value) && !normalizeSuite(value)) {
        tenantName = value;
        continue;
      }
    }

    if (!suite && (label === "suite" || normalizeSuite(value))) {
      suite = normalizeSuite(value) || value;
      continue;
    }

    if (!phone && (label === "phone" || normalizePhone(value))) {
      phone = normalizePhone(value);
      if (phone) continue;
    }

    if (label === "instagram" || label === "ig" || value.startsWith("@")) {
      instagramUrl = normalizeInstagramUrl(value) || instagramUrl;
      continue;
    }

    if (label === "website" || label === "site" || /^https?:\/\//i.test(value) || /^[a-z0-9.-]+\.[a-z]{2,}/i.test(value)) {
      const classified = classifyUrl(value);
      websiteUrl = classified.websiteUrl || websiteUrl;
      instagramUrl = classified.instagramUrl || instagramUrl;
      bookingUrl = classified.bookingUrl || bookingUrl;
      continue;
    }

    if (label === "booking") {
      bookingUrl = ensureUrl(value);
      continue;
    }

    if (!tenantName) tenantName = value;
  }

  if (!tenantName) return null;
  return {
    tenantName,
    suite,
    phone,
    websiteUrl,
    instagramUrl,
    bookingUrl,
  };
}

export function parseSolaTenantText(input: string): ParsedSolaTenantInput[] {
  const raw = input.trim();
  if (!raw) return [];

  const hasBlankBlocks = /\r?\n\s*\r?\n/.test(raw);
  if (!hasBlankBlocks) {
    return raw
      .split(/\r?\n/)
      .map(normalizeLine)
      .filter(Boolean)
      .map((tenantName) => ({ tenantName }));
  }

  return raw
    .split(/\r?\n\s*\r?\n/)
    .map((block) => parseTenantBlock(block))
    .filter((row): row is ParsedSolaTenantInput => Boolean(row));
}
