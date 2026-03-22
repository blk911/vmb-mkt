"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import ResolverScoreBadge from "@/app/admin/markets/unknown-resolver/_components/ResolverScoreBadge";
import type {
  BestContactMethod,
  ContactConfidence,
  OutreachStatus,
  UnknownResolverRecord,
} from "@/lib/unknown-resolver/resolver-types";
import { saveContactEnrichment, saveOutreachRecordPatch } from "@/lib/unknown-resolver/resolver-storage";

type Props = {
  record: UnknownResolverRecord;
  onRefresh: () => void;
};

function ContactReadinessMini({ score }: { score: number | null }) {
  if (score == null) return <span className="text-[10px] text-neutral-400">—</span>;
  const tier = score >= 70 ? "bg-emerald-100 text-emerald-900 border-emerald-300" : score >= 40 ? "bg-amber-100 text-amber-900 border-amber-300" : "bg-neutral-200 text-neutral-800 border-neutral-400";
  return (
    <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${tier}`} title="Contact readiness">
      {score}
    </span>
  );
}

function ConfBadge({ c }: { c: ContactConfidence | null }) {
  if (!c) return <span className="text-[10px] text-neutral-400">—</span>;
  const cls = c === "high" ? "bg-emerald-50 text-emerald-900 border-emerald-300" : c === "medium" ? "bg-amber-50 text-amber-900 border-amber-300" : "bg-neutral-100 text-neutral-700 border-neutral-300";
  return (
    <span className={`rounded border px-1 py-0.5 text-[9px] font-bold uppercase ${cls}`}>{c}</span>
  );
}

function MethodBadge({ m }: { m: BestContactMethod }) {
  return (
    <span className="rounded bg-neutral-100 px-1 py-0.5 text-[9px] font-semibold uppercase text-neutral-700">{m}</span>
  );
}

const METHOD_OPTIONS: BestContactMethod[] = ["unknown", "phone", "email", "website", "instagram", "facebook"];
const CONF_OPTIONS: (ContactConfidence | "")[] = ["", "high", "medium", "low"];

export default function OutreachQueueRow({ record, onRefresh }: Props) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(record.phone ?? "");
  const [email, setEmail] = useState(record.email ?? "");
  const [websiteUrl, setWebsiteUrl] = useState(record.websiteUrl ?? "");
  const [bookingUrl, setBookingUrl] = useState(record.bookingUrl ?? "");
  const [instagramHandle, setInstagramHandle] = useState(record.instagramHandle ?? "");
  const [facebookUrl, setFacebookUrl] = useState(record.facebookUrl ?? "");
  const [contactConfidence, setContactConfidence] = useState<ContactConfidence | "">(record.contactConfidence ?? "");
  const [bestContactMethod, setBestContactMethod] = useState<BestContactMethod>(record.bestContactMethod ?? "unknown");
  const [contactSource, setContactSource] = useState(record.contactSource ?? "");
  const [firstTouchPlan, setFirstTouchPlan] = useState(record.firstTouchPlan ?? "");
  const [phoneScript, setPhoneScript] = useState(record.phoneScript ?? "");
  const [dmScript, setDmScript] = useState(record.dmScript ?? "");
  const [emailScript, setEmailScript] = useState(record.emailScript ?? "");
  const [operatorNote, setOperatorNote] = useState(record.operatorNote ?? "");

  useEffect(() => {
    setPhone(record.phone ?? "");
    setEmail(record.email ?? "");
    setWebsiteUrl(record.websiteUrl ?? "");
    setBookingUrl(record.bookingUrl ?? "");
    setInstagramHandle(record.instagramHandle ?? "");
    setFacebookUrl(record.facebookUrl ?? "");
    setContactConfidence(record.contactConfidence ?? "");
    setBestContactMethod(record.bestContactMethod ?? "unknown");
    setContactSource(record.contactSource ?? "");
    setFirstTouchPlan(record.firstTouchPlan ?? "");
    setPhoneScript(record.phoneScript ?? "");
    setDmScript(record.dmScript ?? "");
    setEmailScript(record.emailScript ?? "");
    setOperatorNote(record.operatorNote ?? "");
  }, [record]);

  const name = record.sourceName ?? record.normalizedName ?? "(unnamed)";

  const saveAll = useCallback(() => {
    saveContactEnrichment(record.id, {
      phone,
      email,
      websiteUrl,
      bookingUrl,
      instagramHandle,
      facebookUrl,
      contactConfidence: contactConfidence === "" ? null : contactConfidence,
      bestContactMethod,
      contactSource,
      firstTouchPlan,
      phoneScript,
      dmScript,
      emailScript,
    });
    saveOutreachRecordPatch(record.id, { operatorNote: operatorNote.trim() || null });
    onRefresh();
  }, [
    record.id,
    phone,
    email,
    websiteUrl,
    bookingUrl,
    instagramHandle,
    facebookUrl,
    contactConfidence,
    bestContactMethod,
    contactSource,
    firstTouchPlan,
    phoneScript,
    dmScript,
    emailScript,
    operatorNote,
    onRefresh,
  ]);

  const onStatusChange = (s: OutreachStatus) => {
    saveOutreachRecordPatch(record.id, { outreachStatus: s });
    onRefresh();
  };

  return (
    <Fragment>
      <tr className="cursor-pointer border-b border-neutral-100 align-top hover:bg-neutral-50/80" onClick={() => setOpen((o) => !o)}>
        <td className="whitespace-nowrap px-2 py-2 text-[11px] text-sky-800">{open ? "▼" : "▶"}</td>
        <td className="px-2 py-2 font-semibold">{name}</td>
        <td className="px-2 py-2">{record.city ?? "—"}</td>
        <td className="px-2 py-2">{record.systemScore != null ? <ResolverScoreBadge score={record.systemScore} /> : "—"}</td>
        <td className="px-2 py-2">
          <ContactReadinessMini score={record.contactReadinessScore} />
        </td>
        <td className="px-2 py-2">
          <ConfBadge c={record.contactConfidence} />
        </td>
        <td className="px-2 py-2">
          <MethodBadge m={record.bestContactMethod} />
        </td>
        <td className="px-2 py-2 font-medium uppercase">{record.operatorDecision ?? "—"}</td>
        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
          <select
            value={record.outreachStatus}
            onChange={(e) => onStatusChange(e.target.value as OutreachStatus)}
            className="max-w-[8rem] rounded border border-neutral-300 bg-white px-1 py-0.5 text-[10px]"
          >
            {(["new", "researching", "ready", "contacted", "ignored"] as const).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </td>
        <td className="whitespace-nowrap px-2 py-2 text-[10px] text-neutral-600">{record.promotedAt ? new Date(record.promotedAt).toLocaleString() : "—"}</td>
      </tr>
      {open ? (
        <tr className="border-b border-neutral-200 bg-neutral-50/90">
          <td colSpan={10} className="px-3 py-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Contact enrichment</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block text-[10px] text-neutral-600">
                    Phone
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-xs" />
                  </label>
                  <label className="block text-[10px] text-neutral-600">
                    Email
                    <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-xs" />
                  </label>
                  <label className="block text-[10px] text-neutral-600 sm:col-span-2">
                    Website URL
                    <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-xs" />
                  </label>
                  <label className="block text-[10px] text-neutral-600 sm:col-span-2">
                    Booking URL
                    <input value={bookingUrl} onChange={(e) => setBookingUrl(e.target.value)} className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-xs" />
                  </label>
                  <label className="block text-[10px] text-neutral-600">
                    Instagram handle
                    <input value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-xs" />
                  </label>
                  <label className="block text-[10px] text-neutral-600">
                    Facebook URL
                    <input value={facebookUrl} onChange={(e) => setFacebookUrl(e.target.value)} className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-xs" />
                  </label>
                  <label className="block text-[10px] text-neutral-600">
                    Contact confidence
                    <select
                      value={contactConfidence}
                      onChange={(e) => setContactConfidence(e.target.value as ContactConfidence | "")}
                      className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                    >
                      {CONF_OPTIONS.map((c) => (
                        <option key={c || "none"} value={c}>
                          {c === "" ? "—" : c}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[10px] text-neutral-600">
                    Best contact method
                    <select
                      value={bestContactMethod}
                      onChange={(e) => setBestContactMethod(e.target.value as BestContactMethod)}
                      className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-xs"
                    >
                      {METHOD_OPTIONS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[10px] text-neutral-600 sm:col-span-2">
                    Contact source (how you found it)
                    <input value={contactSource} onChange={(e) => setContactSource(e.target.value)} className="mt-0.5 w-full rounded border border-neutral-300 px-2 py-1 text-xs" />
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">Outreach tags & pitch</h3>
                <div className="flex flex-wrap gap-1">
                  {record.outreachTags.length > 0 ? (
                    record.outreachTags.map((t) => (
                      <span key={t} className="rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10px] font-medium text-neutral-700">
                        {t}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-neutral-400">No tags</span>
                  )}
                </div>
                <p className="text-xs text-neutral-700">
                  <span className="font-semibold text-neutral-500">Label:</span> {record.outreachLabel ?? "—"}
                </p>
                <p className="text-[11px] text-neutral-600">
                  <span className="font-semibold">Pitch:</span> {record.pitchLabel ?? "—"}
                </p>
                {record.lastEnrichedAt ? (
                  <p className="text-[10px] text-neutral-500">Last enriched: {new Date(record.lastEnrichedAt).toLocaleString()}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 rounded border border-neutral-200 bg-white p-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">First-touch plan</h3>
              <textarea
                value={firstTouchPlan}
                onChange={(e) => setFirstTouchPlan(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-xs text-neutral-800"
              />
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <label className="block text-[10px] font-semibold text-neutral-600">
                Phone script
                <textarea value={phoneScript} onChange={(e) => setPhoneScript(e.target.value)} rows={5} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 font-mono text-[11px]" />
              </label>
              <label className="block text-[10px] font-semibold text-neutral-600">
                DM script
                <textarea value={dmScript} onChange={(e) => setDmScript(e.target.value)} rows={5} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 font-mono text-[11px]" />
              </label>
              <label className="block text-[10px] font-semibold text-neutral-600">
                Email script
                <textarea value={emailScript} onChange={(e) => setEmailScript(e.target.value)} rows={5} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 font-mono text-[11px]" />
              </label>
            </div>

            <label className="mt-4 block text-[10px] font-semibold text-neutral-600">
              Notes
              <textarea value={operatorNote} onChange={(e) => setOperatorNote(e.target.value)} rows={2} className="mt-1 w-full rounded border border-neutral-300 px-2 py-1.5 text-xs" />
            </label>

            <div className="mt-3 rounded border border-dashed border-neutral-300 bg-neutral-50 px-2 py-2 text-[10px] text-neutral-600">
              <span className="font-semibold text-neutral-700">Status history:</span> Not tracked in v1 — future CRM sync.
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                saveAll();
              }}
              className="mt-3 rounded bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-800"
            >
              Save enrichment
            </button>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}
