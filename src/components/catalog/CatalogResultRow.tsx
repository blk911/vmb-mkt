import { CompactValue, compactText } from "@/components/admin/pipeline/CompactProfile";
import { DoraLicenseMark } from "@/components/admin/pipeline/DoraEvidence";
import BookingPlatformLinks, { CatalogContactLinks } from "./BookingPlatformLinks";
import type { CatalogRecord } from "./catalog-ui-types";
import styles from "./CatalogWorkspace.module.css";

export function catalogRowName(row: Pick<CatalogRecord, "entityType" | "businessName" | "providerName" | "displayName">) {
  return compactText((row.entityType === "business" ? row.businessName : row.providerName) || row.displayName);
}

export default function CatalogResultRow({ row, selected, onToggle, onOpen }: { row: CatalogRecord; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  const business = row.entityType === "business";
  const name = catalogRowName(row);
  const businessName = compactText(row.businessName);
  const showBusiness = !business && businessName !== "Unkwn" && businessName.toLocaleLowerCase() !== name.toLocaleLowerCase();
  const nameLabel = `Open ${business ? "business / location" : "provider"} record: ${name}${showBusiness ? `, ${businessName}` : ""}`;
  const location = [[row.city, row.state].filter(Boolean).join(", "), row.postalCode].filter(Boolean).join(" ");
  const licenseLabel = business ? "Shop registration" : "Person license";
  return <tr data-selected={selected}>
    <td className={styles.checkboxCell}><input type="checkbox" aria-label={`Select ${name}`} checked={selected} onChange={onToggle} /></td>
    <td className={styles.nameCell}><button className={styles.recordLink} title={nameLabel} aria-label={nameLabel} onClick={onOpen}><span className="block truncate">{name}</span>{showBusiness ? <span className={`${styles.muted} block truncate`} title={businessName}>{businessName}</span> : null}</button></td>
    <td><BookingPlatformLinks profile={row.profile} /></td>
    <td className={styles.centerCell}><CatalogContactLinks profile={row.profile} /></td>
    <td><CompactValue value={location} /></td>
    <td className={styles.centerCell}><DoraLicenseMark check={business ? row.dora?.shopRegistration : row.dora?.personLicense} label={licenseLabel} /></td>
  </tr>;
}
