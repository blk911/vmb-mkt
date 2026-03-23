/**
 * Attach validated high-confidence platform signals to existing entities only.
 * Never creates entities; never attaches medium/low-confidence matches.
 */
import type {
  AttachedPlatformSignal,
  LiveUnitForPlatformMatch,
  PlatformListing,
  PlatformSignalsRecord,
  PlatformType,
} from "./platform-signal-types";
import { matchPlatformListingToEntities } from "./platform-signal-matching";

function entityKey(e: LiveUnitForPlatformMatch): string {
  return (e.entity_id && e.entity_id.trim()) || e.live_unit_id;
}

function emptySignals(): PlatformSignalsRecord {
  return {};
}

/**
 * For each listing, match at most one entity at HIGH confidence.
 * At most one signal per platform per entity; does not overwrite an existing platform slot.
 */
export function attachPlatformSignals<T extends LiveUnitForPlatformMatch>(
  entities: T[],
  listings: PlatformListing[],
  nowIso: string = new Date().toISOString()
): Array<T & { platformSignals?: PlatformSignalsRecord }> {
  const keyedIndices = new Map<string, number>();
  entities.forEach((e, i) => {
    keyedIndices.set(entityKey(e), i);
  });

  const merged: Array<T & { platformSignals?: PlatformSignalsRecord }> = entities.map((e) => ({
    ...e,
  }));

  for (const listing of listings) {
    const hit = matchPlatformListingToEntities(listing, entities);
    if (!hit) continue;

    const idx = keyedIndices.get(hit.entityId);
    if (idx == null) continue;

    const platform = listing.platform as PlatformType;
    const row = merged[idx]!;
    const current = row.platformSignals ?? emptySignals();
    if (current[platform]) continue;

    const next: PlatformSignalsRecord = { ...current };
    const attached: AttachedPlatformSignal = {
      platform,
      bookingUrl: listing.bookingUrl,
      isBookable: true,
      serviceCount: listing.services.length,
      matchedAt: nowIso,
    };
    next[platform] = attached;
    merged[idx] = { ...row, platformSignals: next };
  }

  return merged.map((row) => {
    const ps = row.platformSignals;
    if (!ps || Object.keys(ps).length === 0) {
      const { platformSignals: _, ...rest } = row;
      return rest as T & { platformSignals?: PlatformSignalsRecord };
    }
    return row;
  });
}
