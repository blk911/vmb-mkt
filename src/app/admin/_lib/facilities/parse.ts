import type { FacilitySeedRow } from "./normalize";
import { normSpace, normUpper } from "./normalize";

/**
 * Minimal CSV parser that handles:
 * - commas inside quotes
 * - double quotes escaping as ""
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"') {
      // "" -> literal "
      const next = line[i + 1];
      if (inQuotes && next === '"') {
        cur += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseJsonl(text: string): FacilitySeedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const rows: FacilitySeedRow[] = [];
  for (const l of lines) {
    try {
      const obj = JSON.parse(l);
      rows.push(obj);
    } catch {
      // Mark invalid; caller can decide to fallback to smart parsing
      rows.push({
        brand: "",
        address1: "",
        city: "",
        state: "",
        zip: "",
        locationLabel: `INVALID_JSON: ${l}`,
      } as any);
    }
  }
  return rows;
}

/**
 * CSV expectations:
 * Header row REQUIRED.
 * Supported columns (case-insensitive):
 * brand, locationLabel, address1, address2, city, state, zip, category, source, phone, website
 */
export function parseCsv(text: string): FacilitySeedRow[] {
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!rawLines.length) return [];

  const header = splitCsvLine(rawLines[0]).map((h) => normSpace(h).toLowerCase());
  const idx = (name: string) => header.indexOf(name.toLowerCase());

  const rows: FacilitySeedRow[] = [];

  for (let i = 1; i < rawLines.length; i++) {
    const cols = splitCsvLine(rawLines[i]);
    const get = (key: string) => {
      const j = idx(key);
      if (j < 0) return "";
      return cols[j] ?? "";
    };

    rows.push({
      brand: get("brand"),
      locationLabel: get("locationlabel") || get("location_label"),
      address1: get("address1") || get("street") || get("address"),
      address2: get("address2") || get("unit") || get("suite"),
      city: get("city"),
      state: get("state"),
      zip: get("zip"),
      category: get("category"),
      source: get("source"),
      phone: get("phone"),
      website: get("website"),
    });
  }

  return rows;
}

/**
 * Smart parser for location-finder style text blocks like:
 *   Castle Pines
 *   7280 Lagae Rd Ste D, Castle Rock, CO 80108
 *   Opens soon
 *   ...
 *
 * Heuristic:
 * - capture "label" lines (no comma, not "mi", not "Opens")
 * - capture address lines matching: "<street>, <city>, <ST> <ZIP>"
 * - when an address line is found, emit a row using the last known label
 */
export function parseLocatorText(
  text: string,
  defaults?: Partial<FacilitySeedRow>
): FacilitySeedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => normSpace(l))
    .filter(Boolean);

  const out: FacilitySeedRow[] = [];
  let pendingLabel = "";

  const isNoise = (s: string) => {
    const x = s.toLowerCase();
    if (x.includes("opens")) return true;
    if (x.endsWith(" mi") || x.includes(" mi ")) return true;
    if (x === "map") return true;
    if (x === "•" || x === "-" || x === "—") return true;
    return false;
  };

  // Example address line: "3698 W 44th Ave, Denver, CO 80211"
  const addrRe =
    /^(?<street>.+?),\s*(?<city>.+?),\s*(?<state>[A-Z]{2})\s*(?<zip>\d{5})(?:-\d{4})?$/;

  const splitUnit = (street: string): { address1: string; address2?: string } => {
    const s = street.trim();

    // normalize common unit keywords; keep remainder as address2
    const m = s.match(/\b(ste|suite|unit)\b\.?\s+(.+)$/i);
    if (m) {
      const kw = m[1].toUpperCase() === "SUITE" ? "STE" : m[1].toUpperCase();
      const before = s.slice(0, m.index).trim();
      const after = (m[2] ?? "").trim();
      return { address1: before, address2: `${kw} ${after}`.trim() };
    }

    // Pattern: "... Rd C-108" (no keyword)
    const m2 = s.match(/^(.*)\s([A-Z]\-?\d+[A-Z0-9\-]*)$/i);
    if (m2) {
      const before = (m2[1] ?? "").trim();
      const token = (m2[2] ?? "").trim();
      // treat as unit only if token looks suite-like
      if (/^[A-Z]\-?\d+/.test(token) || /^(\d+[A-Z]?)$/.test(token)) {
        return { address1: before, address2: token };
      }
    }

    return { address1: s };
  };

  for (const line of lines) {
    if (isNoise(line)) continue;

    const m = line.match(addrRe);
    if (m?.groups) {
      const streetRaw = normSpace(m.groups.street);
      const city = normUpper(m.groups.city);
      const state = normUpper(m.groups.state);
      const zip = normSpace(m.groups.zip);

      const { address1, address2 } = splitUnit(streetRaw);

      const row: FacilitySeedRow = {
        brand: defaults?.brand || "",
        locationLabel: pendingLabel || defaults?.locationLabel || "",
        address1,
        address2,
        city,
        state,
        zip,
        category: defaults?.category,
        source: defaults?.source,
      };

      out.push(row);
      pendingLabel = ""; // reset after emission
      continue;
    }

    // if it isn't an address, treat it as a potential label
    // label lines: no comma, not noise
    if (!line.includes(",")) {
      pendingLabel = line;
    }
  }

  return out;
}

/**
 * One entry point used by the API:
 * - if format=csv -> parseCsv
 * - if format=jsonl -> parseJsonl; if most rows are INVALID_JSON, fallback to parseLocatorText
 */
export function parseSmart(
  text: string,
  format: "jsonl" | "csv",
  defaults?: Partial<FacilitySeedRow>
) {
  if (format === "csv") return parseCsv(text);

  const rows = parseJsonl(text);
  const invalid = rows.filter((r: any) =>
    String(r?.locationLabel ?? "").startsWith("INVALID_JSON:")
  ).length;
  const ratio = rows.length ? invalid / rows.length : 0;

  // If user pasted locator text, jsonl parse will be mostly invalid.
  if (rows.length && ratio >= 0.5) {
    return parseLocatorText(text, defaults);
  }
  return rows;
}
