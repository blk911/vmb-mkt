import crypto from "node:crypto";
import type { ManualIgCategoryGuess, ManualIgClusterItem } from "./types";

export function normalizeIgHandle(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "";

  const normalized = raw
    .replace(/^@+/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/\/+$/, "")
    .replace(/\s+/g, "_")
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "")
    .replace(/^[._]+|[._]+$/g, "");

  if (normalized) return normalized;

  return raw
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._]+/g, "")
    .replace(/^[._]+|[._]+$/g, "");
}

export function buildInstagramProfileUrl(handle: string): string | null {
  const normalizedHandle = normalizeIgHandle(handle);
  return normalizedHandle ? `https://www.instagram.com/${normalizedHandle}/` : null;
}

function hashId(prefix: string, value: string): string {
  return `${prefix}_${crypto.createHash("md5").update(value).digest("hex").slice(0, 12)}`;
}

function looksHumanLike(displayName: string, handle: string): boolean {
  const nameText = displayName.trim();
  if (/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/.test(nameText)) return true;
  if (/^[a-z]+[._]?[a-z0-9]+$/i.test(handle) && !/\d{4,}/.test(handle)) return true;
  return false;
}

export function guessManualIgCategory(handle: string, displayName: string): ManualIgCategoryGuess {
  const text = `${handle} ${displayName}`.toLowerCase();
  if (/\bhair|hairstylist|stylist|extensions?|colorist|balayage|blonding|barber\b/.test(text)) return "hair";
  if (/\bnail|nails|manicure|pedicure|apres|gelx\b/.test(text)) return "nails";
  if (/\blash|lashes|brow|brows|microblade|microblading\b/.test(text)) return "lashes";
  if (/\bsalon|beauty|spa|suite|studios\b/.test(text)) return "salon";
  if (/\brealtor|real\s*estate|homes|properties|broker\b/.test(text)) return "real_estate";
  if (/\bfitness|coach|gym|trainer|hotworx|pilates|yoga\b/.test(text)) return "fitness";
  if (/\bconnect|connector|community|network|agency|marketing|mentor\b/.test(text)) return "connector";
  if (looksHumanLike(displayName, handle)) return "client";
  return "unknown";
}

export function scoreManualIgConfidence(
  handle: string,
  displayName: string,
  category: ManualIgCategoryGuess
): number {
  const text = `${handle} ${displayName}`.toLowerCase();
  if (["hair", "nails", "lashes", "salon", "fitness", "real_estate"].includes(category)) {
    return /\bhair|nail|lash|salon|beauty|spa|fitness|coach|gym|realtor|real\s*estate|homes\b/.test(text) ? 0.94 : 0.82;
  }
  if (category === "connector") return 0.72;
  if (category === "client") return 0.62;
  return 0.34;
}

export function buildClusterId(originHandle: string): string {
  const normalized = normalizeIgHandle(originHandle) || "cluster";
  return `${normalized}_${Date.now().toString(36)}`;
}

export function parseManualIgClusterText(pastedText: string): Array<Pick<ManualIgClusterItem, "id" | "handle" | "displayName" | "rawLine" | "categoryGuess" | "confidence" | "status">> {
  const lines = pastedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const deduped = new Map<string, Pick<ManualIgClusterItem, "id" | "handle" | "displayName" | "rawLine" | "categoryGuess" | "confidence" | "status">>();
  for (let index = 0; index < lines.length; index += 2) {
    const rawHandle = lines[index] || "";
    const normalizedHandle = normalizeIgHandle(rawHandle);
    if (!normalizedHandle) continue;
    const displayName = (lines[index + 1] || rawHandle).trim();
    const categoryGuess = guessManualIgCategory(normalizedHandle, displayName);
    const confidence = scoreManualIgConfidence(normalizedHandle, displayName, categoryGuess);
    const item = {
      id: hashId("migci", normalizedHandle),
      handle: normalizedHandle,
      displayName,
      rawLine: `${rawHandle}\n${lines[index + 1] || rawHandle}`,
      categoryGuess,
      confidence,
      status: "unreviewed" as const,
    };
    if (!deduped.has(normalizedHandle)) deduped.set(normalizedHandle, item);
  }

  return [...deduped.values()];
}
