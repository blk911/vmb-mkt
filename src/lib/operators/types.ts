export type SourceRecord = {
  name?: string;
  city?: string;
  category?: string;
  website?: string;
  phone?: string;
  instagram?: string;
  booking?: string;
  address?: string;
  source: "google" | "instagram" | "booking";
};

export type OperatorRecord = {
  id: string;
  name: string;
  city?: string;
  category?: string;
  sources: {
    google?: SourceRecord;
    instagram?: SourceRecord;
    booking?: SourceRecord;
  };
  canonical: {
    instagram?: string;
    booking?: string;
    website?: string;
    phone?: string;
  };
  validation: {
    instagramStatus: "valid" | "dead" | "missing";
    bookingStatus: "valid" | "dead" | "missing";
    websiteStatus: "valid" | "dead" | "missing";
  };
  status: "hot" | "shelved" | "discard";
  confidenceScore: number;
  lastUpdatedAt: string;
};
