import type { ParseConfidence, ParsedCandidateRow, SourceIntakeRecord } from "./types";

const ROLE_LABELS = [
  "Owner",
  "Manager",
  "Master Stylist",
  "Lead",
  "Protege",
  "Stylist",
  "Assistant",
  "Colorist",
  "Barber",
  "Esthetician",
  "Nail Tech",
] as const;

const PRICE_RE = /\$?\d+(?:\.\d{2})?/;

function isPriceLine(line: string): boolean {
  return PRICE_RE.test(line.trim());
}

function isRoleLikeLine(line: string): boolean {
  const normalized = line.trim().toLowerCase();
  return ROLE_LABELS.some((role) => normalized.includes(role.toLowerCase()));
}

function looksLikeNameLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || isPriceLine(trimmed) || isRoleLikeLine(trimmed)) return false;
  if (trimmed.includes("@") || trimmed.includes("http")) return false;
  const cleaned = trimmed.replace(/[.'’-]/g, " ");
  if (!/^[A-Za-z][A-Za-z\s'-]+$/.test(trimmed)) return false;
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 4) return false;
  return tokens.every((token) => /^[A-Z][a-z]+$/.test(token) || /^[A-Z]$/.test(token));
}

export function normalizeWhitespace(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitIntoLogicalBlocks(rawText: string): string[] {
  const normalized = normalizeWhitespace(rawText);
  if (!normalized) return [];

  const blankSeparated = normalized
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blankSeparated.length > 1) return blankSeparated;

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: string[] = [];
  let current: string[] = [];

  const pushCurrent = () => {
    const text = current.join("\n").trim();
    if (text) blocks.push(text);
    current = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const hasName = current.some(looksLikeNameLine);
    const hasPrice = current.some(isPriceLine);
    if (current.length > 0 && looksLikeNameLine(line) && hasName && (hasPrice || current.length >= 2)) {
      pushCurrent();
    }
    current.push(line);
    if (isPriceLine(line)) {
      pushCurrent();
    }
  }
  pushCurrent();

  return blocks.filter(Boolean);
}

export function extractName(block: string): { displayName: string; firstName?: string; lastName?: string } | null {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  const nameLine = lines.find(looksLikeNameLine);
  if (!nameLine) return null;
  const parts = nameLine.split(/\s+/).filter(Boolean);
  if (!parts.length) return null;
  return {
    displayName: nameLine,
    firstName: parts[0],
    lastName: parts.length > 1 ? parts.slice(1).join(" ") : undefined,
  };
}

export function extractRole(block: string): string | undefined {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.find((line) => isRoleLikeLine(line) && !looksLikeNameLine(line));
}

export function extractPrice(block: string): { priceText?: string; priceValue?: number | null } {
  const match = block.match(PRICE_RE);
  if (!match) return { priceValue: null };
  const priceText = match[0].startsWith("$") ? match[0] : `$${match[0]}`;
  const numeric = Number.parseFloat(match[0].replace(/^\$/, ""));
  return {
    priceText,
    priceValue: Number.isFinite(numeric) ? numeric : null,
  };
}

function deriveConfidence(nameFound: boolean, roleLabel?: string, priceText?: string): ParseConfidence {
  if (nameFound && roleLabel && priceText) return "high";
  if (nameFound && (roleLabel || priceText)) return "medium";
  return "low";
}

export function parseSourceIntakeText(intake: SourceIntakeRecord): ParsedCandidateRow[] {
  const blocks = splitIntoLogicalBlocks(intake.rawText);
  const rows: ParsedCandidateRow[] = [];

  for (const [index, block] of blocks.entries()) {
    const name = extractName(block);
    if (!name?.displayName) continue;
    const roleLabel = extractRole(block);
    const { priceText, priceValue } = extractPrice(block);
    const parseWarnings: string[] = [];
    if (!roleLabel) parseWarnings.push("missing_role");
    if (!priceText) parseWarnings.push("missing_price");
    const parseConfidence = deriveConfidence(true, roleLabel, priceText);

    rows.push({
      id: `${intake.id}_cand_${String(index + 1).padStart(2, "0")}`,
      intakeId: intake.id,
      ordinal: index + 1,
      rawBlock: block,
      displayName: name.displayName,
      firstName: name.firstName,
      lastName: name.lastName,
      roleLabel,
      priceText,
      priceValue,
      parseConfidence,
      parseWarnings: parseWarnings.length ? parseWarnings : undefined,
      reviewAction: "pending",
    });
  }

  return rows;
}
