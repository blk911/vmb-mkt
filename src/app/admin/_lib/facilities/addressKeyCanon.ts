export function normText(s: unknown) {
  return String(s ?? "").toUpperCase().trim().replace(/\s+/g, " ");
}

export function normZip(s: unknown) {
  return String(s ?? "").trim();
}

export function stripPunct(s: string) {
  return s.replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
}

const DIR_MAP: Record<string, string> = {
  NORTH: "N",
  SOUTH: "S",
  EAST: "E",
  WEST: "W",
  N: "N",
  S: "S",
  E: "E",
  W: "W",
};

const SUFFIX_MAP: Record<string, string> = {
  STREET: "ST",
  ST: "ST",
  AVENUE: "AVE",
  AVE: "AVE",
  ROAD: "RD",
  RD: "RD",
  BOULEVARD: "BLVD",
  BLVD: "BLVD",
  DRIVE: "DR",
  DR: "DR",
  LANE: "LN",
  LN: "LN",
  COURT: "CT",
  CT: "CT",
  PARKWAY: "PKWY",
  PKWY: "PKWY",
  CIRCLE: "CIR",
  CIR: "CIR",
  PLACE: "PL",
  PL: "PL",
  TERRACE: "TER",
  TER: "TER",
  HIGHWAY: "HWY",
  HWY: "HWY",
};

export function splitAddressKey(
  addressKey: string
): { street: string; city: string; state: string; zip: string } | null {
  const parts = String(addressKey || "")
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 4) return null;
  return { street: parts[0], city: parts[1], state: parts[2], zip: parts[3] };
}

function canonicalizeStreetLoose(streetRaw: string) {
  // normalize punctuation/spacing
  let s = stripPunct(normText(streetRaw));

  // tokenize
  const toks = s.split(" ").filter(Boolean);

  // normalize directionals anywhere they occur as standalone tokens
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (DIR_MAP[t]) toks[i] = DIR_MAP[t];
  }

  // normalize common suffixes
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (SUFFIX_MAP[t]) toks[i] = SUFFIX_MAP[t];
  }

  return toks.join(" ").replace(/\s+/g, " ").trim();
}

export function stripUnitTokensLoose(streetRaw: string) {
  // First canonicalize street, then strip units
  let s = canonicalizeStreetLoose(streetRaw);

  // Remove explicit unit forms
  s = s.replace(/\b(STE|SUITE|UNIT)\b\s*[A-Z0-9\-]+/g, "").trim();
  s = s.replace(/#\s*[A-Z0-9\-]+/g, "").trim();

  // Remove trailing suite-like token (C-108, F8, 1E, etc.)
  s = s.replace(/\s+[A-Z]{1,2}\-?\d{1,4}[A-Z0-9\-]*$/g, "").trim();

  return s.replace(/\s+/g, " ").trim();
}

export function makeAddressKeyLooseNorm(addressKey: string) {
  const p = splitAddressKey(addressKey);
  if (!p) return "";
  const street = canonicalizeStreetLoose(p.street);
  return `${street} | ${normText(p.city)} | ${normText(p.state)} | ${normZip(p.zip)}`;
}

export function makeAddressKeyLooseBase(addressKey: string) {
  const p = splitAddressKey(addressKey);
  if (!p) return "";
  const streetBase = stripUnitTokensLoose(p.street);
  return `${streetBase} | ${normText(p.city)} | ${normText(p.state)} | ${normZip(p.zip)}`;
}
