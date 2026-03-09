import fs from "fs";
import path from "node:path";
import { readTargetList } from "@/app/admin/_lib/targets/store";
import { dataRootAbs } from "@/backend/lib/paths/data-root";

const TECH_PATH = path.join(
  dataRootAbs(),
  "co",
  "dora",
  "denver_metro",
  "places",
  "derived",
  "tech_index.v4_facilities.v1.json"
);

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export default async function TargetsPrintPage({ searchParams }: { searchParams: { listId?: string } }) {
  const listId = (searchParams?.listId || "").trim();
  const list = listId ? await readTargetList(listId) : null;

  const techIndex = fs.existsSync(TECH_PATH) ? readJson(TECH_PATH) : { tech: [] };
  const tech = (techIndex.tech || []) as any[];
  const byId = new Map<string, any>();
  for (const t of tech) byId.set(String(t.id), t);

  const techIds = list
    ? list.items
        .filter((item) => item.kind === "tech")
        .map((item) => String(item.refId || "").trim())
        .filter(Boolean)
    : [];

  const rows = list
    ? techIds.map((id: string) => byId.get(String(id))).filter(Boolean)
    : [];

  return (
    <div style={{ padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial" }}>
      <script dangerouslySetInnerHTML={{ __html: "setTimeout(() => window.print(), 250);" }} />

      <h1 style={{ margin: 0 }}>Target List Print</h1>
      <div style={{ marginTop: 6, opacity: 0.8 }}>
        {list ? (
          <>
            <b>{list.name}</b> · {list.id} · {rows.length} targets
          </>
        ) : (
          <>Missing listId</>
        )}
      </div>

      <hr style={{ margin: "16px 0" }} />

      {rows.map((t: any) => {
        const place = t?.places?.best || {};
        const premise = t?.premise || {};
        const phone = (premise.phone || place.phone || "").toString().trim();
        const website = (premise.website || place.website || "").toString().trim();
        const dora = Number(t?.techSignals?.doraLicenses || 0);

        return (
          <div key={t.id} style={{ padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.10)" }}>
            <div style={{ fontWeight: 800 }}>{t.displayName}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{t.addressKey}</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Segment: <b>{t.segment}</b> · DORA: <b>{dora}</b> · Place: <b>{place.name || "(none)"}</b>
            </div>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {phone ? <>Phone: <b>{phone}</b> · </> : null}
              {website ? <>Website: <b>{website}</b></> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
