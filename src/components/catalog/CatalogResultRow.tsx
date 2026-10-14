import { ProfileLinks } from "@/components/admin/pipeline/ProfileEvidence";
import { CompactPlatform, CompactReviewStatus, CompactValue, compactText } from "@/components/admin/pipeline/CompactProfile";
import { DoraStatus } from "@/components/admin/pipeline/DoraEvidence";
import type { CatalogRecord } from "./catalog-ui-types";
import styles from "./CatalogWorkspace.module.css";

export default function CatalogResultRow({ row, selected, onToggle, onOpen }: { row: CatalogRecord; selected: boolean; onToggle: () => void; onOpen: () => void }) {
  const name = row.displayName || "record";
  return <tr data-selected={selected}>
    <td className={styles.checkboxCell}><input type="checkbox" aria-label={`Select ${name}`} checked={selected} onChange={onToggle} /></td>
    <td><CompactPlatform profile={row.profile} /></td>
    <td className={styles.centerCell}><ProfileLinks links={(row.profile?.bookingLinks || []).filter((link) => link.kind !== "directory")} kind="booking" compact /></td>
    <td className={styles.centerCell}><ProfileLinks links={row.profile?.socialLinks || []} kind="social" compact /></td>
    <td className={styles.nameCell}>{row.entityType === "business" ? <span className={styles.muted} title="Business / location record, not an individual person">—</span> : <button className={styles.recordLink} title={`Open provider record: ${name}`} onClick={onOpen}>{compactText(row.providerName || row.displayName)}</button>}</td>
    <td className={styles.nameCell}>{row.entityType === "business" ? <button className={styles.recordLink} title={`Open business / location record: ${name}`} onClick={onOpen}>{compactText(row.businessName || row.displayName)}</button> : <CompactValue value={row.businessName} />}</td>
    <td className={styles.wrapCell}><CompactValue value={row.services.join(", ")} /></td>
    <td className={styles.wrapCell}><CompactValue value={row.area} /></td>
    <td><CompactValue value={[row.city, row.state].filter(Boolean).join(", ")} /></td>
    <td><CompactValue value={row.postalCode} /></td>
    <td className={styles.centerCell}><CompactReviewStatus status={row.reviewStatus} />{row.conflicts.length ? <span className={styles.conflictLabel} title={`${row.conflicts.length} unresolved source differences. Open details.`}> · {row.conflicts.length}?</span> : null}</td>
    <td className={styles.centerCell}><DoraStatus check={row.dora?.personLicense} label="Person license" /></td>
    <td className={styles.centerCell}><DoraStatus check={row.dora?.shopRegistration} label="Shop registration" /></td>
    <td><button className={styles.textButton} aria-label={`Details for ${name}`} onClick={onOpen}>Details</button></td>
  </tr>;
}
