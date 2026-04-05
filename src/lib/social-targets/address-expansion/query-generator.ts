import type { AddressExpansionQueryCategory } from "@/types/social-target";
import type { AddressExpansionClassificationResult } from "@/lib/social-targets/address-expansion/classification";

export type AddressExpansionAnchor = {
  businessName?: string;
  category?: string;
  city?: string;
  zone?: string;
  address?: string;
  normalizedAddress?: string;
  phone?: string;
  website?: string;
  nameVariants?: string[];
  aggregatorHint?: string;
};

export type AddressExpansionQuery = {
  query: string;
  category: AddressExpansionQueryCategory;
  confidenceHint: "high" | "medium" | "expansion";
  notes?: string;
};

export type AddressExpansionQueryPack = {
  queries: AddressExpansionQuery[];
};

function quote(value: string): string {
  return `"${value.replace(/"/g, "").trim()}"`;
}

function clean(value?: string): string | undefined {
  if (!value) return undefined;
  const out = value.trim().replace(/\s+/g, " ");
  return out || undefined;
}

function pushUnique(list: AddressExpansionQuery[], item: AddressExpansionQuery): void {
  if (!item.query.trim()) return;
  if (list.some((q) => q.query.toLowerCase() === item.query.toLowerCase())) return;
  list.push(item);
}

function splitAddress(address?: string): { street?: string; streetNumber?: string } {
  const cleaned = clean(address);
  if (!cleaned) return {};
  const first = cleaned.split(",")[0]?.trim();
  if (!first) return {};
  const numberMatch = first.match(/^\d+[A-Za-z]?/);
  return {
    street: first,
    streetNumber: numberMatch?.[0],
  };
}

function categoryVariants(category?: string): string[] {
  const raw = (clean(category) ?? "").toLowerCase();
  const base = new Set<string>();
  if (!raw) {
    ["hair", "nails", "lashes", "brows", "spa"].forEach((x) => base.add(x));
  } else {
    base.add(raw);
    if (raw.includes("hair")) {
      base.add("stylist");
      base.add("barber");
    }
    if (raw.includes("nail")) base.add("nails");
    if (raw.includes("lash")) base.add("lashes");
    if (raw.includes("brow")) base.add("brows");
    if (raw.includes("spa")) {
      base.add("esthetician");
      base.add("massage");
    }
  }
  return [...base].slice(0, 8);
}

const AGGREGATOR_BRANDS = [
  "Sola",
  "Phenix",
  "Salons by JC",
  "MySalon Suite",
  "Image Studios",
  "Spectra",
] as const;

const BOOKING_DOMAINS = [
  "site:glossgenius.com",
  "site:vagaro.com",
  "site:styleseat.com",
  "site:booksy.com",
  "site:fresha.com",
  "site:square.site",
] as const;

const SOCIAL_DOMAINS = ["site:instagram.com", "site:tiktok.com", "site:linktr.ee"] as const;

export function buildAddressExpansionQueryPack(
  anchor: AddressExpansionAnchor,
  classification?: AddressExpansionClassificationResult
): AddressExpansionQueryPack {
  const queries: AddressExpansionQuery[] = [];
  const businessName = clean(anchor.businessName);
  const city = clean(anchor.city) ?? clean(anchor.zone);
  const fullAddress = clean(anchor.address) ?? clean(anchor.normalizedAddress);
  const phone = clean(anchor.phone);
  const { street, streetNumber } = splitAddress(fullAddress);
  const variantSeed: string[] = [
    ...(businessName ? [businessName] : []),
    ...(anchor.nameVariants ?? []).map(clean).filter((x): x is string => Boolean(x)),
  ];
  const variants = variantSeed
    .filter((x, i, arr) => arr.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i)
    .slice(0, 3);
  const categories = categoryVariants(anchor.category);
  const likelyMulti = classification?.isLikelyMultiTenant ?? false;
  const aggregatorHint = clean(anchor.aggregatorHint) ?? classification?.aggregatorType?.replace(/_/g, " ");

  // Layer A: direct address/operator queries
  if (fullAddress) {
    for (const cat of categories.slice(0, 4)) {
      pushUnique(queries, {
        query: `${quote(fullAddress)} ${quote(cat)}`,
        category: "address_stylist",
        confidenceHint: "high",
        notes: "Direct address + category operator lookup",
      });
    }
    pushUnique(queries, {
      query: `${quote(fullAddress)} salon`,
      category: "address_salons",
      confidenceHint: "high",
      notes: "Direct address salon lookup",
    });
    if (street && streetNumber) {
      pushUnique(queries, {
        query: `${quote(streetNumber)} ${quote(street)} suite hair`,
        category: "address_suites",
        confidenceHint: "medium",
        notes: "Address suite + category variant",
      });
    }
  }

  // Layer B: suite / aggregator detection
  if (fullAddress || city) {
    const anchorText = fullAddress ? quote(fullAddress) : city ? quote(city) : "";
    if (anchorText) {
      pushUnique(queries, {
        query: `${anchorText} "salon suites"`,
        category: "address_suites",
        confidenceHint: "high",
        notes: "Suite detection at address/geo",
      });
      pushUnique(queries, {
        query: `${anchorText} "suite rental"`,
        category: "address_suites",
        confidenceHint: "medium",
        notes: "Suite rental signal",
      });
      for (const brand of AGGREGATOR_BRANDS) {
        pushUnique(queries, {
          query: `${anchorText} ${quote(brand)}`,
          category: "aggregator_brand",
          confidenceHint: likelyMulti ? "high" : "medium",
          notes: "Aggregator brand match",
        });
      }
      if (aggregatorHint) {
        pushUnique(queries, {
          query: `${anchorText} ${quote(aggregatorHint)}`,
          category: "aggregator_brand",
          confidenceHint: "high",
          notes: "Known aggregator hint expansion",
        });
      }
    }
  }

  // Layer C: booking platform digs
  for (const domain of BOOKING_DOMAINS) {
    for (const cat of categories.slice(0, 3)) {
      const baseTerms: string[] = [domain];
      if (fullAddress) baseTerms.push(quote(fullAddress));
      if (city) baseTerms.push(quote(city));
      if (businessName) baseTerms.push(quote(businessName));
      baseTerms.push(quote(cat));
      pushUnique(queries, {
        query: baseTerms.join(" "),
        category: "booking_platform",
        confidenceHint: "medium",
        notes: "Booking domain + address/category expansion",
      });
    }
  }

  // Layer D: social platform digs
  for (const domain of SOCIAL_DOMAINS) {
    const socialVariants = variants.length ? variants : businessName ? [businessName] : [];
    for (const variant of socialVariants) {
      const terms = [domain, quote(variant)];
      if (city) terms.push(quote(city));
      if (fullAddress) terms.push(quote(fullAddress));
      pushUnique(queries, {
        query: terms.join(" "),
        category: "social_platform",
        confidenceHint: "medium",
        notes: "Social domain operator search with geo anchors",
      });
    }
  }

  // Layer E: directory expansion
  if (fullAddress || city) {
    const addr = fullAddress ? quote(fullAddress) : city ? quote(city) : "";
    pushUnique(queries, {
      query: `site:yelp.com ${addr} salon`,
      category: "directory_expansion",
      confidenceHint: "expansion",
      notes: "Directory adjacency expansion",
    });
    pushUnique(queries, {
      query: `${addr} "beauty directory"`,
      category: "directory_expansion",
      confidenceHint: "expansion",
      notes: "Directory trace expansion",
    });
  }

  // Layer F: businesses-at-address queries
  if (fullAddress || street) {
    const addr = fullAddress ? quote(fullAddress) : street ? quote(street) : "";
    pushUnique(queries, {
      query: `${addr} businesses`,
      category: "address_businesses",
      confidenceHint: "medium",
      notes: "Who else is at this address",
    });
    pushUnique(queries, {
      query: `${addr} tenant operator salon`,
      category: "address_businesses",
      confidenceHint: "medium",
      notes: "Tenant/operator expansion",
    });
    pushUnique(queries, {
      query: `${addr} reviews`,
      category: "address_businesses",
      confidenceHint: "expansion",
      notes: "Review trace expansion",
    });
  }

  // Category + geo expansion
  if (city) {
    for (const cat of categories.slice(0, 4)) {
      pushUnique(queries, {
        query: `${quote(cat)} ${quote(city)} ${quote("salon suites")}`,
        category: "category_geo_expansion",
        confidenceHint: likelyMulti ? "high" : "expansion",
        notes: "Category + geo suite cluster expansion",
      });
    }
  }

  if (phone) {
    pushUnique(queries, {
      query: `${quote(phone)} stylist`,
      category: "address_stylist",
      confidenceHint: "high",
      notes: "Phone anchored operator lookup",
    });
  }

  // Keep deterministic and practical.
  return { queries: queries.slice(0, 28) };
}
