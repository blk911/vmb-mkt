"use client";

import { useState } from "react";

type PreviewResponse = {
  operator: {
    id: string;
    name: string;
    city?: string;
    status: string;
    confidenceScore: number;
    canonical: {
      instagram?: string;
      booking?: string;
      website?: string;
    };
  };
  outreach: {
    eligible: boolean;
    reason: string;
    preferredChannel: string;
  };
  message: null | {
    subject: string;
    shortMessage: string;
    dmMessage: string;
  };
};

export default function OperatorOutreachPanel({ operatorId }: { operatorId: string }) {
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handlePreview() {
    setLoading(true);
    setOpen(true);

    const res = await fetch(`/api/operators/message-preview?id=${encodeURIComponent(operatorId)}`);
    const json = await res.json();

    setData(json);
    setLoading(false);
  }

  return (
    <div>
      <button
        onClick={handlePreview}
        style={{
          padding: "6px 10px",
          border: "1px solid #ccc",
          borderRadius: 8,
          background: "#fff",
          cursor: "pointer",
        }}
      >
        Preview Outreach
      </button>

      {open && (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            border: "1px solid #e5e5e5",
            borderRadius: 10,
            background: "#fafafa",
            maxWidth: 720,
          }}
        >
          {loading && <div>Loading...</div>}

          {!loading && data && (
            <>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{data.operator.name} — outreach preview</div>

              <div style={{ marginBottom: 8 }}>
                Eligible: <strong>{String(data.outreach.eligible)}</strong>
                {" · "}
                Reason: <strong>{data.outreach.reason}</strong>
                {" · "}
                Channel: <strong>{data.outreach.preferredChannel}</strong>
              </div>

              {data.message ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>Subject</div>
                    <div>{data.message.subject}</div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 600 }}>Short message</div>
                    <div>{data.message.shortMessage}</div>
                  </div>

                  <div>
                    <div style={{ fontWeight: 600 }}>DM message</div>
                    <div>{data.message.dmMessage}</div>
                  </div>
                </div>
              ) : (
                <div>No message generated because this operator is not outreach-eligible yet.</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
