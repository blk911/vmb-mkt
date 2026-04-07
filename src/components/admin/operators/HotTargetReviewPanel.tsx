"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OperatorReviewState } from "@/lib/operators/review-types";

type HotTargetReviewPanelProps = {
  operatorId: string;
  canonicalName: string;
  city?: string;
  instagram?: string;
  booking?: string;
  website?: string;
  evidenceCount: number;
  sourceTypes: string;
  evidenceTypes: string;
  reviewState: OperatorReviewState;
  reviewNotes?: string;
};

type ReviewApiResponse = {
  ok: boolean;
  error?: string;
};

export default function HotTargetReviewPanel(props: HotTargetReviewPanelProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState(props.reviewNotes || "");
  const [message, setMessage] = useState<string>("");
  const [open, setOpen] = useState(false);

  async function submit(action: "markReady" | "shelveByReview" | "addReviewNote") {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/operators/review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operatorId: props.operatorId,
          action,
          reviewNotes: note,
        }),
      });
      const json = (await res.json()) as ReviewApiResponse;
      if (!res.ok || !json.ok) {
        setMessage(json.error || "Failed to save review");
      } else {
        setMessage("Saved");
        router.refresh();
      }
    } catch {
      setMessage("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 8, maxWidth: 260, background: "#fafafa" }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
        <button disabled={loading} onClick={() => submit("markReady")} style={{ fontSize: 12 }}>
          Ready
        </button>
        <button disabled={loading} onClick={() => submit("shelveByReview")} style={{ fontSize: 12 }}>
          Shelve
        </button>
        <button onClick={() => setOpen((v) => !v)} style={{ fontSize: 12 }}>
          {open ? "Hide" : "Review"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: open ? 8 : 0, fontSize: 12 }}>
        {props.instagram ? (
          <a href={props.instagram} target="_blank" rel="noreferrer">
            IG
          </a>
        ) : null}
        {props.booking ? (
          <a href={props.booking} target="_blank" rel="noreferrer">
            Booking
          </a>
        ) : null}
        {props.website ? (
          <a href={props.website} target="_blank" rel="noreferrer">
            Website
          </a>
        ) : null}
      </div>

      {open ? (
        <>
          <div style={{ fontSize: 11, color: "#444", marginBottom: 6 }}>Review: {props.reviewState}</div>
          <div style={{ fontSize: 11, color: "#444", marginBottom: 6 }}>Evidence: {props.evidenceCount}</div>
          <div style={{ fontSize: 11, color: "#444", marginBottom: 6 }} title={props.sourceTypes}>
            Source: {props.sourceTypes || "-"}
          </div>
          <div style={{ fontSize: 11, color: "#444", marginBottom: 8 }} title={props.evidenceTypes}>
            Evidence: {props.evidenceTypes || "-"}
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Review note"
              style={{ width: "100%", fontSize: 12 }}
            />
            <button disabled={loading} onClick={() => submit("addReviewNote")} style={{ fontSize: 12 }}>
              Save note
            </button>
          </div>
        </>
      ) : null}

      {message ? <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>{message}</div> : null}
    </div>
  );
}

