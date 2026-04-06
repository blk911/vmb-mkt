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
    <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 10, maxWidth: 420, background: "#fafafa" }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{props.canonicalName}</div>
      <div style={{ fontSize: 12, color: "#444", marginBottom: 4 }}>City: {props.city || "-"}</div>
      <div style={{ fontSize: 12, color: "#444", marginBottom: 4 }}>Review: {props.reviewState}</div>
      <div style={{ fontSize: 12, color: "#444", marginBottom: 4 }}>Evidence count: {props.evidenceCount}</div>
      <div style={{ fontSize: 12, color: "#444", marginBottom: 4 }}>Source types: {props.sourceTypes || "-"}</div>
      <div style={{ fontSize: 12, color: "#444", marginBottom: 8 }}>Evidence types: {props.evidenceTypes || "-"}</div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
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

      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <button disabled={loading} onClick={() => submit("markReady")}>
          Approve Ready
        </button>
        <button disabled={loading} onClick={() => submit("shelveByReview")}>
          Shelve
        </button>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Review note"
          style={{ width: "100%" }}
        />
        <button disabled={loading} onClick={() => submit("addReviewNote")}>
          Save note
        </button>
      </div>

      {message ? <div style={{ marginTop: 8, fontSize: 12, color: "#555" }}>{message}</div> : null}
    </div>
  );
}

