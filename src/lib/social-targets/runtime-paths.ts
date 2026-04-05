import path from "path";

export const RUNTIME_SOCIAL_TARGETS_FILE = path.join(process.cwd(), "runtime-data", "social-targets.generated.json");
export const RUNTIME_REFERRAL_EDGES_FILE = path.join(process.cwd(), "runtime-data", "referral-edges.generated.json");
export const RUNTIME_SOCIAL_TARGETS_BASELINE_FILE = path.join(process.cwd(), "runtime-data", "social-targets.baseline.v1.json");
export const RUNTIME_BASELINE_METRICS_FILE = path.join(process.cwd(), "runtime-data", "reports", "baseline-metrics.json");
export const RUNTIME_CURRENT_METRICS_FILE = path.join(process.cwd(), "runtime-data", "reports", "current-metrics.json");
export const RUNTIME_VALIDATION_COMPARE_FILE = path.join(process.cwd(), "runtime-data", "reports", "validation-compare.json");
export const RUNTIME_ADDRESS_EXPANSION_BASELINE_FILE = path.join(
  process.cwd(),
  "runtime-data",
  "reports",
  "address-expansion-baseline.json"
);
export const RUNTIME_ADDRESS_EXPANSION_QUALITY_SAMPLE_FILE = path.join(
  process.cwd(),
  "runtime-data",
  "reports",
  "address-expansion-quality-sample.json"
);
export const RUNTIME_ADDRESS_EXPANSION_REPORT_FILE = path.join(
  process.cwd(),
  "runtime-data",
  "reports",
  "address-expansion-report.json"
);
