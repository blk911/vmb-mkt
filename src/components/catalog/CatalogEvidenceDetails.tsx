import { DoraCheckDetails } from "@/components/admin/pipeline/DoraEvidence";
import { ProfileLinks, SourceLink } from "@/components/admin/pipeline/ProfileEvidence";
import { profileFreshnessLabel, profileStatusLabel } from "@/lib/admin/pipeline/profile-presentation";
import { dateLabel, readable, type CatalogRecord } from "./catalog-ui-types";
import styles from "./CatalogWorkspace.module.css";

/** Secondary evidence stays available without repeating the quick-review profile. */
export default function CatalogEvidenceDetails({ record }: { record: CatalogRecord }) {
  const profile = record.profile;
  return <div className={styles.evidenceBody}>
    <dl className={styles.evidenceMetadata}>
      <div><dt>Review</dt><dd>{readable(record.reviewStatus)}</dd></div>
      <div><dt>Market / vertical</dt><dd>{record.market || "Unkwn"} · {record.vertical || "Unkwn"}</dd></div>
      {record.services.length ? <div><dt>Services</dt><dd>{record.services.join(", ")}</dd></div> : null}
      {record.area ? <div><dt>Area</dt><dd>{record.area}</dd></div> : null}
      <div><dt>Updated</dt><dd>{dateLabel(record.updatedAt)}</dd></div>
      <div><dt>Record ID</dt><dd>{record.id}</dd></div>
      {profile?.providerId ? <div><dt>Source provider ID</dt><dd>{profile.providerId}</dd></div> : null}
      {profile?.businessId ? <div><dt>Source business ID</dt><dd>{profile.businessId}</dd></div> : null}
    </dl>
    {record.conflicts?.length ? <section className={styles.warning}><h3>Source differences</h3><ul>{record.conflicts.map((conflict, index) => <li key={index}>{conflict}</li>)}</ul></section> : null}
    {record.dora?.personLicense ? <DoraCheckDetails check={record.dora.personLicense} label="Person license evidence" /> : null}
    {record.dora?.shopRegistration ? <DoraCheckDetails check={record.dora.shopRegistration} label="Shop registration evidence" /> : null}
    {record.linkedEntities?.length ? <section><h3>Linked entities</h3><p className={styles.muted}>A shared location does not establish a person’s identity.</p><ul className={styles.evidenceList}>{record.linkedEntities.map((entity, index) => <li key={`${entity.id}:${index}`}><strong>{entity.label || entity.id}</strong><span>{readable(entity.entityType)} · {readable(entity.relationship)} · {readable(entity.basis)}</span><small>{entity.id}</small></li>)}</ul></section> : null}
    {record.mapping ? <section><h3>Market and vertical sources</h3>{(["market", "vertical"] as const).map((field) => <div key={field} className={styles.sourceRefs}><strong>{field === "market" ? "Market" : "Vertical"} · {readable(record.mapping![field].status)}</strong>{record.mapping![field].reason ? <p>{readable(record.mapping![field].reason)}</p> : null}<ul className={styles.evidenceList}>{record.mapping![field].evidence.map((evidence, index) => <li key={`${evidence.sourceRef.collection}:${evidence.sourceRef.id}:${evidence.sourceField}:${index}`}><strong>{evidence.value}</strong><span>{readable(evidence.basis)} · {evidence.sourceField}</span><small>{evidence.sourceRef.collection} · {evidence.sourceRef.id}</small>{evidence.sourceUrl ? <SourceLink url={evidence.sourceUrl} label="Mapping source" /> : null}</li>)}</ul></div>)}</section> : null}
    {profile ? <section><h3>Profile sources and checks</h3><p className={styles.muted}>{profileStatusLabel(profile)} · {profileFreshnessLabel(profile)}{profile.lastAttemptAt ? ` · Checked ${dateLabel(profile.lastAttemptAt)}` : ""}</p>
      {profile.sourceContextUrl ? <SourceLink url={profile.sourceContextUrl} label="Original source" /> : null}
      {profile.bookingLinks.length ? <div className={styles.sourceGroup}><h4>Booking sources</h4><ProfileLinks links={profile.bookingLinks} /></div> : null}
      {profile.socialLinks.length ? <div className={styles.sourceGroup}><h4>Social sources</h4><ProfileLinks links={profile.socialLinks} /></div> : null}
      {profile.websiteLinks.length ? <div className={styles.sourceGroup}><h4>Website sources</h4><ProfileLinks links={profile.websiteLinks} /></div> : null}
      {profile.fieldEvidence?.length ? <ul className={styles.evidenceList}>{profile.fieldEvidence.map((fact, index) => <li key={`${fact.field}:${fact.value}:${index}`}><strong>{readable(fact.field)}: {fact.value}</strong><small>{fact.sourceField}{fact.sourceRef ? ` · ${fact.sourceRef}` : ""}</small>{fact.sourceUrl ? <SourceLink url={fact.sourceUrl} label="Fact source" /> : null}</li>)}</ul> : null}
      {profile.platformEvidence?.length ? <ul className={styles.evidenceList}>{profile.platformEvidence.map((fact, index) => <li key={`${fact.platform}:${index}`}><strong>{fact.platform} · {readable(fact.evidence)}</strong><span>{readable(fact.attribution)} · {fact.value}</span><small>{fact.sourceField}{fact.sourceRef ? ` · ${fact.sourceRef}` : ""}</small>{fact.sourceUrl ? <SourceLink url={fact.sourceUrl} label="Platform source" /> : null}</li>)}</ul> : null}
      {profile.reasons.length ? <ul className={styles.sourceRefs}>{profile.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul> : null}
      {profile.nextAttemptAt ? <p className={styles.muted}>Next eligible check: {dateLabel(profile.nextAttemptAt)}</p> : null}
      {profile.searchStatus === "unsupported" ? <p className={styles.muted}>Name + salon + platform search is unavailable. Missing links remain unresolved.</p> : null}
      {profile.observations.length ? <div className={styles.sourceGroup}><h4>Fetched observations</h4><ul className={styles.evidenceList}>{profile.observations.map((observation, index) => <li key={`${observation.sourceUrl}:${index}`}><strong>{readable(observation.outcome)}{observation.httpStatus ? ` (HTTP ${observation.httpStatus})` : ""}</strong><small>{dateLabel(observation.fetchedAt)}</small><SourceLink url={observation.sourceUrl} label="Observed source" />{observation.finalUrl && observation.finalUrl !== observation.sourceUrl ? <SourceLink url={observation.finalUrl} label="Final page" /> : null}{observation.claims.map((claim, claimIndex) => <span key={claimIndex}>{readable(claim.type)}: {claim.value}</span>)}</li>)}</ul></div> : null}
    </section> : null}
    {record.factClaims?.length ? <section><h3>Stored fact claims ({record.factClaims.length})</h3><ul className={styles.evidenceList}>{record.factClaims.map((fact) => <li key={fact.id}><strong>{readable(fact.kind)}</strong><span>{fact.value}</span><small>{readable(fact.attribution)} · {readable(fact.status)} · {fact.sourceField}</small>{fact.sourceUrl ? <SourceLink url={fact.sourceUrl} label="Fact source" /> : null}</li>)}</ul></section> : null}
    {record.evidence?.length ? <section><h3>Source evidence</h3><ul className={styles.evidenceList}>{record.evidence.map((evidence, index) => <li key={`${evidence.id}:${index}`}><strong>{evidence.label || readable(evidence.kind)}</strong><span>{readable(evidence.kind)} · {dateLabel(evidence.observedAt)}</span>{evidence.sourceUrl ? <SourceLink url={evidence.sourceUrl} label="Exact source" /> : null}</li>)}</ul></section> : null}
    {record.sourceRefs.length ? <section><h3>Source references ({record.sourceRefs.length})</h3><ul className={styles.sourceRefs}>{record.sourceRefs.map((source, index) => <li key={`${source.collection}:${source.id}:${index}`}>{readable(source.role)} · {source.collection} · {source.id}</li>)}</ul></section> : null}
    {record.reviewDecisions?.length ? <section><h3>Review decisions</h3><ul className={styles.evidenceList}>{record.reviewDecisions.map((decision, index) => <li key={`${decision.id}:${index}`}><strong>{readable(decision.lane)} · {readable(decision.status)}</strong><span>{dateLabel(decision.reviewedAt)}{decision.reviewedBy ? ` · ${decision.reviewedBy}` : ""}</span>{decision.targetId ? <small>Linked target: {decision.targetId}</small> : null}</li>)}</ul></section> : null}
  </div>;
}
