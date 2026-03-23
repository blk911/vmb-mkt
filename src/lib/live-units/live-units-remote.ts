/**
 * Production-oriented remote loaders for Live Units (HTTP JSON, Firestore doc).
 */
import "server-only";
import { extractRowsArray } from "./live-units-parse";

export type HttpLoadResult = {
  ok: boolean;
  status?: number;
  rowCount: number;
  error?: string;
  sanitizedUrl: string;
};

export function sanitizeUrlForTrace(url: string): string {
  try {
    const u = new URL(url);
    u.search = "";
    u.hash = "";
    return u.toString();
  } catch {
    return "[invalid-url]";
  }
}

export async function loadRowsFromHttpJsonUrl(url: string): Promise<{
  rows: unknown[];
  result: HttpLoadResult;
}> {
  const sanitizedUrl = sanitizeUrlForTrace(url);
  const headers: HeadersInit = {
    Accept: "application/json",
  };
  const bearer = process.env.LIVE_UNITS_JSON_BEARER_TOKEN?.trim();
  if (bearer) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${bearer}`;
  }
  const extraHeader = process.env.LIVE_UNITS_JSON_AUTH_HEADER?.trim();
  if (extraHeader) {
    const idx = extraHeader.indexOf(":");
    if (idx > 0) {
      const k = extraHeader.slice(0, idx).trim();
      const v = extraHeader.slice(idx + 1).trim();
      if (k) (headers as Record<string, string>)[k] = v;
    }
  }

  try {
    const res = await fetch(url, {
      headers,
      cache: "no-store",
    });
    const text = await res.text();
    if (!res.ok) {
      return {
        rows: [],
        result: {
          ok: false,
          status: res.status,
          rowCount: 0,
          error: `HTTP ${res.status}`,
          sanitizedUrl,
        },
      };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        rows: [],
        result: {
          ok: false,
          rowCount: 0,
          error: `JSON parse: ${msg}`,
          sanitizedUrl,
        },
      };
    }
    const rows = extractRowsArray(parsed);
    return {
      rows,
      result: {
        ok: true,
        status: res.status,
        rowCount: rows.length,
        sanitizedUrl,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      rows: [],
      result: {
        ok: false,
        rowCount: 0,
        error: msg,
        sanitizedUrl,
      },
    };
  }
}

export async function loadRowsFromFirestoreDocument(
  collectionId: string,
  documentId: string
): Promise<{ rows: unknown[]; ok: boolean; error?: string; path: string }> {
  const path = `${collectionId}/${documentId}`;
  try {
    const { adminDb } = await import("@/lib/admin/firestoreAdmin");
    const snap = await adminDb().collection(collectionId).doc(documentId).get();
    if (!snap.exists) {
      return { rows: [], ok: false, error: "document not found", path };
    }
    const data = snap.data();
    const rows = extractRowsArray(data);
    return { rows, ok: true, path };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { rows: [], ok: false, error: msg, path };
  }
}
