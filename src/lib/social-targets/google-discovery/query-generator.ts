import { extractDomain } from "@/lib/social-targets/source-adapters/shared";

export type DiscoveryAnchor = {
  name: string;
  nameVariants?: string[];
  category?: string;
  city?: string;
  zone?: string;
  address?: string;
  phone?: string;
  website?: string;
};

export type GoogleQuery = {
  query: string;
  type:
    | "instagram"
    | "tiktok"
    | "linktree"
    | "website_social"
    | "phone_lookup"
    | "address_lookup"
    | "category_geo";
  confidenceHint: "high" | "medium" | "expansion";
  notes?: string;
};

export type GoogleDiscoveryPack = {
  queries: GoogleQuery[];
};

function cleanTerm(v?: string): string | undefined {
  if (!v) return undefined;
  const trimmed = v.trim().replace(/\s+/g, " ");
  return trimmed || undefined;
}

function quote(v: string): string {
  return `"${v.replace(/"/g, "").trim()}"`;
}

function normalizePhone(v?: string): string | undefined {
  if (!v) return undefined;
  const digits = v.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  if (digits.length === 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return digits;
}

function extractStreet(address?: string): string | undefined {
  if (!address) return undefined;
  const first = address.split(",")[0]?.trim();
  return first || undefined;
}

function pushUnique(target: GoogleQuery[], next: GoogleQuery): void {
  if (!next.query.trim()) return;
  if (target.some((q) => q.query.toLowerCase() === next.query.toLowerCase())) return;
  target.push(next);
}

function categoryTerms(category?: string): string[] {
  const cleaned = cleanTerm(category);
  if (!cleaned) return [];
  return cleaned
    .split(/[\/,|]/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.length > 1)
    .slice(0, 3);
}

export function buildGoogleDiscoveryPack(anchor: DiscoveryAnchor): GoogleDiscoveryPack {
  const queries: GoogleQuery[] = [];
  const name = cleanTerm(anchor.name);
  if (!name) return { queries };
  const geo = cleanTerm(anchor.city) ?? cleanTerm(anchor.zone);
  const variants = [name, ...(anchor.nameVariants ?? []).map(cleanTerm).filter((v): v is string => Boolean(v))]
    .map((v) => v.trim())
    .filter((v, idx, arr) => arr.findIndex((x) => x.toLowerCase() === v.toLowerCase()) === idx)
    .slice(0, 3);
  const domain = extractDomain(anchor.website);
  const phone = normalizePhone(anchor.phone);
  const street = extractStreet(anchor.address);

  for (const variant of variants) {
    if (geo) {
      pushUnique(queries, {
        query: `site:instagram.com ${quote(variant)} ${quote(geo)}`,
        type: "instagram",
        confidenceHint: "high",
        notes: "Name + geo anchored Instagram discovery",
      });
      pushUnique(queries, {
        query: `site:tiktok.com ${quote(variant)} ${quote(geo)}`,
        type: "tiktok",
        confidenceHint: "medium",
        notes: "Name + geo anchored TikTok discovery",
      });
      pushUnique(queries, {
        query: `site:linktr.ee ${quote(variant)} ${quote(geo)}`,
        type: "linktree",
        confidenceHint: "medium",
        notes: "Name + geo anchored Linktree discovery",
      });
      pushUnique(queries, {
        query: `instagram ${quote(variant)} ${quote(geo)}`,
        type: "instagram",
        confidenceHint: "medium",
        notes: "General Instagram lookup with geo",
      });
      pushUnique(queries, {
        query: `tiktok ${quote(variant)} ${quote(geo)}`,
        type: "tiktok",
        confidenceHint: "medium",
        notes: "General TikTok lookup with geo",
      });
    } else {
      pushUnique(queries, {
        query: `site:instagram.com ${quote(variant)}`,
        type: "instagram",
        confidenceHint: "medium",
        notes: "Name anchored Instagram discovery",
      });
      pushUnique(queries, {
        query: `site:tiktok.com ${quote(variant)}`,
        type: "tiktok",
        confidenceHint: "medium",
        notes: "Name anchored TikTok discovery",
      });
      pushUnique(queries, {
        query: `site:linktr.ee ${quote(variant)}`,
        type: "linktree",
        confidenceHint: "expansion",
        notes: "Name anchored Linktree discovery",
      });
    }
  }

  if (domain) {
    pushUnique(queries, {
      query: `${quote(domain)} instagram`,
      type: "website_social",
      confidenceHint: "high",
      notes: "Website-domain social linkage",
    });
    pushUnique(queries, {
      query: `${quote(domain)} tiktok`,
      type: "website_social",
      confidenceHint: "high",
      notes: "Website-domain social linkage",
    });
  }

  if (phone) {
    pushUnique(queries, {
      query: `${quote(phone)} instagram`,
      type: "phone_lookup",
      confidenceHint: "high",
      notes: "Phone anchored profile lookup",
    });
  }

  if (street && geo) {
    pushUnique(queries, {
      query: `${quote(street)} instagram ${quote(geo)}`,
      type: "address_lookup",
      confidenceHint: "medium",
      notes: "Address anchored profile lookup",
    });
  }

  for (const cat of categoryTerms(anchor.category)) {
    if (!geo) break;
    pushUnique(queries, {
      query: `site:instagram.com ${quote(cat)} ${quote(geo)}`,
      type: "category_geo",
      confidenceHint: "expansion",
      notes: "Category + geo expansion query",
    });
    pushUnique(queries, {
      query: `site:tiktok.com ${quote(cat)} ${quote(geo)}`,
      type: "category_geo",
      confidenceHint: "expansion",
      notes: "Category + geo expansion query",
    });
  }

  if (queries.length < 6 && geo) {
    pushUnique(queries, {
      query: `site:instagram.com ${quote(name)} ${quote(geo)} salon`,
      type: "category_geo",
      confidenceHint: "expansion",
      notes: "Fallback geo-anchored category expansion",
    });
    pushUnique(queries, {
      query: `site:tiktok.com ${quote(name)} ${quote(geo)} beauty`,
      type: "category_geo",
      confidenceHint: "expansion",
      notes: "Fallback geo-anchored category expansion",
    });
  }

  if (queries.length < 6) {
    const fallback: GoogleQuery[] = [
      {
        query: `site:instagram.com ${quote(name)}`,
        type: "instagram",
        confidenceHint: "medium",
        notes: "Fallback Instagram lookup",
      },
      {
        query: `site:tiktok.com ${quote(name)}`,
        type: "tiktok",
        confidenceHint: "medium",
        notes: "Fallback TikTok lookup",
      },
      {
        query: `site:linktr.ee ${quote(name)}`,
        type: "linktree",
        confidenceHint: "expansion",
        notes: "Fallback Linktree lookup",
      },
      {
        query: `${quote(name)} instagram`,
        type: "instagram",
        confidenceHint: "expansion",
        notes: "Fallback keyword lookup",
      },
      {
        query: `${quote(name)} tiktok`,
        type: "tiktok",
        confidenceHint: "expansion",
        notes: "Fallback keyword lookup",
      },
      {
        query: `${quote(name)} linktree`,
        type: "linktree",
        confidenceHint: "expansion",
        notes: "Fallback keyword lookup",
      },
    ];
    for (const q of fallback) {
      if (queries.length >= 6) break;
      pushUnique(queries, q);
    }
  }

  // Keep query packs deterministic and operator-friendly.
  return { queries: queries.slice(0, 12) };
}
