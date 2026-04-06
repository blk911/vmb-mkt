import { buildOperatorQualitySummary, loadMasterOperatorsForQualitySummary } from "../src/lib/operators/quality-summary";

function printSummary() {
  const operators = loadMasterOperatorsForQualitySummary();
  const summary = buildOperatorQualitySummary(operators);

  console.log("========================================");
  console.log("Operator Quality Summary");
  console.log("========================================");
  console.log(`Total operators:             ${summary.totalOperators}`);
  console.log(`Hot:                         ${summary.hotCount}`);
  console.log(`Shelved:                     ${summary.shelvedCount}`);
  console.log(`Discard:                     ${summary.discardCount}`);
  console.log("----------------------------------------");
  console.log(`With Instagram:              ${summary.withInstagramCount}`);
  console.log(`With Booking:                ${summary.withBookingCount}`);
  console.log(`With Website:                ${summary.withWebsiteCount}`);
  console.log(`With IG + Booking:           ${summary.withInstagramAndBookingCount}`);
  console.log("----------------------------------------");
  console.log(`With directory evidence:     ${summary.withDirectoryEvidenceCount}`);
  console.log(`With container evidence:     ${summary.withContainerEvidenceCount}`);
  console.log(`Unknown/junk names:          ${summary.unknownNameCount}`);
  console.log(`Suspicious cities:           ${summary.suspiciousCityCount}`);
  console.log("----------------------------------------");
  console.log(`Extracted name improvements: ${summary.extractedNameImprovementCount}`);
  console.log(`Extracted city improvements: ${summary.extractedCityImprovementCount}`);
  console.log("========================================");
}

printSummary();

