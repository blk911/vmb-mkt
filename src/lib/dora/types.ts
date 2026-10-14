export type DoraScope = "person" | "shop";
export type DoraStatus = "active" | "expired" | "review" | "unknown";
export type DoraOutcome = "not_checked" | "matched" | "no_match" | "ambiguous" | "insufficient_identity" | "blocked" | "unavailable" | "error";
export interface DoraLicenseClaim { prefix: string; number: string; sourceRef: string }
export interface DoraSubject {
  scope: DoraScope; name: string; firstName?: string; lastName?: string;
  city?: string; state?: string; postalCode?: string; licenseClaims?: DoraLicenseClaim[];
}
export interface DoraOfficialRow {
  firstname?: string; middlename?: string; lastname?: string; suffix?: string; entityname?: string;
  licensetype?: string; licensenumber?: string; licensestatusdescription?: string;
  city?: string; state?: string; mailzipcode?: string;
  licensefirstissuedate?: string; licenselastreneweddate?: string; licenseexpirationdate?: string;
  linktoverifylicense?: { url?: string };
}
export interface DoraLicenseMatch {
  name: string; licenseType: string; licenseNumber: string; licensePrefix: string; statusText: string;
  city: string; state: string; postalCode: string; sourceUrl: string; datasetUrl: string;
  expirationDate?: string; identity: "corroborated" | "review"; basis: string[]; conflicts: string[];
  sourceRows: number;
}
export interface DoraCheck {
  status: DoraStatus; outcome: DoraOutcome; attemptedAt?: string; checkedAt?: string; datasetUpdatedAt?: string; sourceUrl?: string;
  matches: DoraLicenseMatch[]; reasons: string[]; conflicts: string[]; truncated?: boolean;
}
/** A source cross-reference, never an employment, independence, ownership or review decision. */
export interface DoraCrossReference { schemaVersion: 1; personLicense: DoraCheck; shopRegistration: DoraCheck }
export interface DoraCrossReferenceRecord {
  schemaVersion: 1; catalogId: string; candidateKey?: string; fingerprint: string; runId: string;
  dora: DoraCrossReference; completedAt: string; nextAttemptAt: string;
}
