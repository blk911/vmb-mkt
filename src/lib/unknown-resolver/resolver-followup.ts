import type {
  OutreachActivityOutcome,
  OutreachActivityType,
  OutreachStatus,
  UnknownResolverRecord,
} from "./resolver-types";

/** Map a logged activity to pipeline status. */
export function deriveStatusFromActivity(
  _activityType: OutreachActivityType,
  outcome: OutreachActivityOutcome
): OutreachStatus {
  switch (outcome) {
    case "closed_won":
      return "closed_won";
    case "interested":
      return "interested";
    case "not_now":
      return "not_now";
    case "closed_lost":
    case "bad_fit":
      return "ignored";
    case "no_answer":
      return "follow_up_due";
    case "left_message":
    case "sent":
      return "awaiting_response";
    case "replied":
      return "awaiting_response";
    case "attempted":
      return "attempted";
    case "other":
    default:
      return "attempted";
  }
}

/**
 * Suggested next follow-up time from outcome. Returns null when no auto-schedule.
 * no_answer +2d, left_message +3d, sent +3d, interested +1d, not_now +14d;
 * replied / closed_won / closed_lost / bad_fit → none.
 */
export function deriveNextFollowUpAt(outcome: OutreachActivityOutcome, now: Date): string | null {
  const d = new Date(now.getTime());
  switch (outcome) {
    case "no_answer":
      d.setDate(d.getDate() + 2);
      return d.toISOString();
    case "left_message":
      d.setDate(d.getDate() + 3);
      return d.toISOString();
    case "sent":
      d.setDate(d.getDate() + 3);
      return d.toISOString();
    case "interested":
      d.setDate(d.getDate() + 1);
      return d.toISOString();
    case "not_now":
      d.setDate(d.getDate() + 14);
      return d.toISOString();
    case "replied":
    case "closed_won":
    case "closed_lost":
    case "bad_fit":
      return null;
    case "attempted":
    case "other":
    default:
      return null;
  }
}

const TERMINAL: OutreachStatus[] = ["closed_won", "ignored"];

/** True when nextFollowUpAt is in the past (or now) and lead is not terminal. */
export function isFollowUpDue(record: UnknownResolverRecord, now: Date): boolean {
  if (record.nextFollowUpAt == null) return false;
  if (TERMINAL.includes(record.outreachStatus)) return false;
  return new Date(record.nextFollowUpAt).getTime() <= now.getTime();
}

/** Has any outbound touch been logged. */
export function hasLoggedContact(record: UnknownResolverRecord): boolean {
  return record.lastContactAt != null;
}
