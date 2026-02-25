export type Segment =
  | "CORP_OWNED"
  | "CORP_FRANCHISE"
  | "INDIE"
  | "SOLO_AT_SALON"
  | "SOLO_AT_SOLO"
  | "UNKNOWN";

export type AddressTruthRow = {
  addressId: string;
  addressKey: string;
  cityKey: string;
  cityLabel: string;
  zip5: string;

  // Facility registration at this address
  regCount: number;
  facilityIds: string[];

  // Tech licensees at this address
  techCount: number;
  techIds: string[];

  // Classification
  seg: Segment;
  brandKey?: string; // franchise brand id (e.g. "sola", "phenix")
  corpKey?: string; // corp owner id (later)
  cand: 0 | 1; // candidate flag for PH1 targeting

  // explainability
  reasons: string[];
};

export type CityTruthRow = {
  cityKey: string;
  cityLabel: string;

  regCount: number; // sum(regCount) across addresses
  techCount: number; // sum(techCount) across addresses

  // derived metrics
  techPerReg: number; // safe division, never 9999 due to reg==0 without reason
  addrCount: number; // number of addresses in city rollup

  // classification rollups
  candCount: number; // number of address rows flagged cand=1
  segSummary: Record<string, number>; // counts by seg
  brandSummary?: Record<string, number>;

  // explainability
  reasons: string[];
};
