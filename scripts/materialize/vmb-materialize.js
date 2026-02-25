#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * VMB DORA Materializer (city-level rollups)
 *
 * Inputs:
 *   --sourceDir <dir>   (required) contains:
 *     REG__SANITIZED.csv
 *     BAR_-_Barber_-_All_Statuses.csv
 *     COS_-_Cosmetologist_-_All_Statuses.csv
 *     COZ_-_Esthetician_-_All_Statuses.csv
 *     HST_-_Hair_Stylist_-_All_Statuses.csv
 *     MAN_-_Nail_Technician_-_All_Statuses.csv
 *     MT_-_Massage_Therapist_-_All_Statuses.csv
 *
 *   --outDir <dir>      (required) writes tables:
 *     vmb_address_rollup.json
 *     vmb_licensees_attached.json
 *     vmb_attach_candidates.json
 *     manifest.vmb.json
 *
 * NOTE:
 * - This is a Patch-1 restore to unblock the dashboard.
 * - Keys are CITY+STATE ("DENVER CO") to match current rollup.addressKey.
 */

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  const v = process.argv[i + 1];
  if (!v || v.startsWith("--")) return null;
  return v;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), "utf8");
}

function up(s) {
  return (s ?? "").toString().trim().toUpperCase();
}

function normState(v) {
  const s = up(v);
  if (!s) return "";
  if (s === "COLORADO") return "CO";
  if (/^[A-Z]{2}$/.test(s)) return s;
  return s.slice(0, 2);
}

function normCity(v) {
  return up(v).replace(/\s+/g, " ").trim();
}

function normCityState(city, state) {
  const c = normCity(city);
  let s = normState(state);
  if (!s && c) s = "CO"; // default for CO DORA
  if (!c) return "";
  return s ? `${c} ${s}` : c;
}

/**
 * Tolerant CSV reader: skips bad rows instead of failing.
 * Mirrors your earlier behavior (salvaged parse).
 */
async function readCsvRows(filePath) {
  const txt = fs.readFileSync(filePath, "utf8");
  const lines = txt.split(/\r?\n/);
  if (!lines.length) return { rows: [], badRowsSkipped: 0 };

  // Find header line (first non-empty)
  let headerLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] && lines[i].trim()) {
      headerLineIdx = i;
      break;
    }
  }
  if (headerLineIdx === -1) return { rows: [], badRowsSkipped: 0 };

  const headerText = lines[headerLineIdx];
  let headers = [];
  try {
    headers = parse(headerText, {
      relax_quotes: true,
      relax_column_count: true,
      skip_empty_lines: true,
    })[0];
  } catch {
    // very rare; fallback split
    headers = headerText.split(",").map((h) => h.trim());
  }

  const rows = [];
  let badRowsSkipped = 0;

  // Parse each subsequent line as a 1-record CSV
  for (let i = headerLineIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line || !line.trim()) continue;

    try {
      const rec = parse(line, {
        relax_quotes: true,
        relax_column_count: true,
        skip_empty_lines: true,
      })[0];

      const obj = {};
      for (let c = 0; c < headers.length; c++) {
        const key = (headers[c] ?? "").toString();
        obj[key] = rec[c] ?? "";
      }
      rows.push(obj);
    } catch {
      badRowsSkipped++;
    }
  }

  console.log(`CSV rows parsed: ${rows.length} from ${path.basename(filePath)}`);
  return { rows, badRowsSkipped };
}

function licenseeId(l) {
  const id = (l["License Number"] || l["License"] || "").toString().trim();
  if (id) return id;
  const name = (l["Formatted Name"] || l["Entity Name"] || "").toString().trim();
  const city = (l["City"] || "").toString().trim();
  return `${name}|${city}`.trim();
}

async function main() {
  const sourceDir = arg("--sourceDir");
  const outDir = arg("--outDir");

  if (!sourceDir || !outDir) {
    console.error("Usage:");
    console.error("  node vmb-materialize.js --sourceDir <dir> --outDir <dir>");
    process.exit(1);
  }

  const repoRoot = process.cwd();
  ensureDir(outDir);

  console.log("== VMB materialize ==");
  console.log("repoRoot :", repoRoot);
  console.log("sourceDir:", path.resolve(sourceDir));
  console.log("outDir   :", path.resolve(outDir));
  console.log("tool     :", __filename);

  // --- REG ---
  const regPath = path.join(sourceDir, "REG__SANITIZED.csv");
  if (!fs.existsSync(regPath)) {
    throw new Error(`Missing REG__SANITIZED.csv at ${regPath}`);
  }
  console.log("REG file:", regPath);
  console.log("Reading REG:", regPath);
  const { rows: regRows, badRowsSkipped: regBad } = await readCsvRows(regPath);
  console.log(`REG parsed rows (salvaged): ${regRows.length} (badRowsSkipped=${regBad})`);

  // --- License CSVs discovery ---
  console.log("Reading license CSVs:");
  const allFiles = fs.readdirSync(sourceDir);
  const licenseCsvs = allFiles
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .filter((f) => !f.toUpperCase().startsWith("REG"))
    .map((f) => path.join(sourceDir, f));

  if (licenseCsvs.length === 0) {
    console.warn("⚠️ No license CSVs found (excluding REG).");
  } else {
    console.log(`  found ${licenseCsvs.length} license CSV(s):`);
    for (const p of licenseCsvs) console.log("   -", p);
  }

  let licensees = [];
  let licBadTotal = 0;
  for (const p of licenseCsvs) {
    const { rows, badRowsSkipped } = await readCsvRows(p);
    licensees.push(...rows);
    licBadTotal += badRowsSkipped || 0;
    console.log(`  parsed ${path.basename(p)}: rows=${rows.length} badRowsSkipped=${badRowsSkipped || 0}`);
  }
  console.log(`License parsed rows (union): ${licensees.length} (badRowsSkipped=${licBadTotal})`);

  // --- Build city-level rollups from REG (best “facility” signal we have in Patch 1) ---
  // rollups keyed by CITY+STATE, and businessName defaults to key until address-level comes later.
  const rollupMap = new Map(); // key -> rollup row

  function getOrMakeRollup(key) {
    if (!rollupMap.has(key)) {
      const [city, state] = key.split(" ");
      rollupMap.set(key, {
        rollupKey: key,
        addressKey: key,
        businessName: key,
        city: (city || "").toString(),
        state: (state || "").toString(),
        zip5: "",
        primaryRegLicenseNumber: "",
        regLicenseNumbers: [],
        primaryVertical: "UNKNOWN",
        segment: "SINGLE_SHOP",
        sizeBand: "SMALL_0_6",
        attachedTechCount: 0,
        candidatesCount: 0,
        laborDensityScore: 0,
        laborDensityBucket: "LOW",
        laborDensityText: "",
        // Patch 1 fields
        hasReg: false,
        regCount: 0,
      });
    }
    return rollupMap.get(key);
  }

  // --- PATCH 1: attach REG presence (city-level) ---
  const regByKey = new Map(); // key -> {count, licenseNumbers:Set}
  for (const rr of regRows) {
    const key = normCityState(rr["City"] || rr.City, rr["State"] || rr.State);
    if (!key) continue;

    const lic = (
      rr["License Number"] ||
      rr["License"] ||
      rr["LicenseNumber"] ||
      rr["License_Number"] ||
      ""
    )
      .toString()
      .trim();

    if (!regByKey.has(key)) regByKey.set(key, { count: 0, licenseNumbers: new Set() });
    const bucket = regByKey.get(key);
    bucket.count += 1;
    if (lic) bucket.licenseNumbers.add(lic);
  }

  // ensure rollups include all reg keys
  for (const key of regByKey.keys()) getOrMakeRollup(key);

  let rollupsWithReg = 0;
  for (const [key, hit] of regByKey.entries()) {
    const r = getOrMakeRollup(key);
    r.hasReg = true;
    r.regCount = hit.count;
    const nums = Array.from(hit.licenseNumbers);
    r.regLicenseNumbers = nums.slice(0, 25);
    r.primaryRegLicenseNumber = r.regLicenseNumbers[0] || "";
    rollupsWithReg++;
  }

  console.log("🏷️ REG join complete:", {
    regRows: regRows.length,
    regKeys: regByKey.size,
    rollups: rollupMap.size,
    rollupsWithReg,
  });

  // --- Attach licensees to rollups by CITY+STATE (tech clusters) ---
  const rollupByKey = rollupMap;

  const attached = [];
  const candidates = [];

  const attachedSetByKey = new Map(); // key -> Set(ids)
  const candSetByKey = new Map();

  for (const l of licensees) {
    const key = normCityState(l["City"] || l.City, l["State"] || l.State);
    if (!key) continue;

    const id = licenseeId(l) || JSON.stringify(l);

    if (rollupByKey.has(key)) {
      if (!attachedSetByKey.has(key)) attachedSetByKey.set(key, new Set());
      attachedSetByKey.get(key).add(id);

      attached.push({
        ...l,
        addressKey: key,
        rollupKey: key,
      });
    } else {
      // Candidate = licensee city/state that did not appear in REG rollups.
      // Patch 1.3 behavior:
      //   - If candidate is in CO, create a minimal rollup row so UI can surface it.
      //   - If out-of-state, keep it in candidates output but do not pollute CO rollups.
      const st = normState(l["State"] || l.State);
      const isCO = !st || st === "CO";

      if (!candSetByKey.has(key)) candSetByKey.set(key, new Set());
      candSetByKey.get(key).add(id);

      candidates.push({
        ...l,
        addressKey: key,
        rollupKey: "",
      });

      if (isCO) {
        // Create a rollup entry so "Candidates" tab can show it.
        const r = getOrMakeRollup(key);
        // If it has no REG, keep it explicit.
        if (!r.hasReg) {
          r.segment = r.segment || "CAND_ONLY";
          r.primaryVertical = r.primaryVertical || "UNKNOWN";
        }
      }
    }
  }

  // write counts back to rollups
  let techMatchedDistinct = 0;
  for (const [key, set] of attachedSetByKey.entries()) {
    const r = getOrMakeRollup(key);
    r.attachedTechCount = set.size;
    techMatchedDistinct += 1;
  }

  let candDistinct = 0;
  for (const [key, set] of candSetByKey.entries()) {
    candDistinct += set.size;

    // Patch 1.3: candidatesCount is now reliable because we create CO rollups above.
    if (rollupByKey.has(key)) {
      const r = getOrMakeRollup(key);
      r.candidatesCount = set.size;
    }
  }

  // simple labor density score for Patch 1:
  // prefer tech count; later we can refine with address-level.
  for (const r of rollupByKey.values()) {
    const t = Number(r.attachedTechCount) || 0;
    r.laborDensityScore = t;
    r.laborDensityBucket = t >= 25 ? "HIGH" : t >= 8 ? "MED" : t > 0 ? "LOW" : "LOW";
    r.laborDensityText = t >= 25 ? "High technician cluster" : t >= 8 ? "Medium technician cluster" : t > 0 ? "Some technicians" : "";
  }

  // --- PATCH 2B: Load Franchise Registry ---
  const franchiseRegistryPath = path.join(repoRoot, "backend", "data", "reference", "franchise_registry.json");
  let franchiseRegistry = { brands: [] };
  if (fs.existsSync(franchiseRegistryPath)) {
    try {
      const registryText = fs.readFileSync(franchiseRegistryPath, "utf8");
      franchiseRegistry = JSON.parse(registryText);
      console.log(`📋 Loaded franchise registry: ${franchiseRegistry.brands?.length || 0} brands`);
    } catch (e) {
      console.warn("⚠️ Failed to load franchise registry:", e.message);
    }
  } else {
    console.warn("⚠️ Franchise registry not found at:", franchiseRegistryPath);
  }

  // Helper: Match facility name against franchise brand aliases
  function matchFranchiseBrand(facilityName, ownerName, aliases) {
    const hay = `${facilityName || ""} ${ownerName || ""}`
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ");
    return aliases.some((a) => hay.includes(a.toLowerCase()));
  }

  // Helper: Check if facility is corp-owned (stub for now)
  function isCorpOwnedFacility(row) {
    // TODO: Implement when corp registry is available
    return false;
  }

  // --- PH1: Segment classification ---
  // Order matters: corp_owned > corp_franchise > indie
  for (const r of rollupByKey.values()) {
    // Check corp_owned first
    if (isCorpOwnedFacility(r)) {
      r.segment = "corp_owned";
      r.segmentReason = "corp_owned_detected";
      continue;
    }

    // Check franchise registry
    let matchedBrand = null;
    if (franchiseRegistry.brands && franchiseRegistry.brands.length > 0) {
      for (const brand of franchiseRegistry.brands) {
        const facilityName = r.businessName || r.addressKey || "";
        const ownerName = ""; // TODO: Add owner name when available
        if (matchFranchiseBrand(facilityName, ownerName, brand.aliases || [])) {
          matchedBrand = brand;
          break;
        }
      }
    }

    if (matchedBrand) {
      r.segment = "corp_franchise";
      r.franchiseBrandId = matchedBrand.brandId;
      r.segmentReason = `franchise_matched:${matchedBrand.brandId}`;
      continue;
    }

    // Default to indie
    if (r.hasReg) {
      r.segment = "indie";
      r.segmentReason = "facility_with_reg";
    } else if (r.attachedTechCount > 0) {
      r.segment = "indie";
      r.segmentReason = "candidate_only_with_techs";
    } else {
      r.segment = "indie";
      r.segmentReason = "candidate_only";
    }
  }

  // Log segment distribution
  const segmentCounts = {};
  for (const r of rollupByKey.values()) {
    segmentCounts[r.segment] = (segmentCounts[r.segment] || 0) + 1;
  }
  console.log("🏷️ Segment classification:", segmentCounts);

  const rollups = Array.from(rollupByKey.values());

  console.log("🔧 attach join: licensees -> rollups (addressKey)", {
    rollups: rollups.length,
    rollupKeys: rollupByKey.size,
    licensees: licensees.length,
    attachedRowsOut: attached.length,
    candidateRowsOut: candidates.length,
    techMatchedDistinct,
    candDistinct,
  });

  // --- outputs ---
  const outRollups = path.join(outDir, "vmb_address_rollup.json");
  const outAttached = path.join(outDir, "vmb_licensees_attached.json");
  const outCandidates = path.join(outDir, "vmb_attach_candidates.json");
  const outManifest = path.join(outDir, "manifest.vmb.json");

  writeJson(outRollups, rollups);
  console.log("✅ Wrote:", outRollups);

  writeJson(outCandidates, candidates);
  console.log("✅ Wrote:", outCandidates);

  writeJson(outAttached, attached);
  console.log("✅ Wrote:", outAttached);

  const manifest = {
    ok: true,
    mode: "csv",
    sourceDir: path.resolve(sourceDir),
    outDir: path.resolve(outDir),
    updatedAt: new Date().toISOString(),
    inputs: {
      reg: { path: regPath, rows: regRows.length, badRowsSkipped: regBad },
      licenseFiles: licenseCsvs.map((p) => ({ path: p, exists: fs.existsSync(p) })),
    },
    outputs: {
      rollups: { path: outRollups, rows: rollups.length },
      licensees_attached: { path: outAttached, rows: attached.length },
      attach_candidates: { path: outCandidates, rows: candidates.length },
    },
    counts: {
      regKeys: regByKey.size,
      rollupsWithReg,
      licensees: licensees.length,
      techMatchedDistinct,
    },
  };

  writeJson(outManifest, manifest);
  console.log("✅ Manifest:", outManifest);
}

main().catch((e) => {
  console.error("Materialize FAILED:", e?.stack || e?.message || e);
  process.exit(1);
});
