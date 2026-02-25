import RollupsClient from "./RollupsClient";

export const dynamic = "force-dynamic";

export default function RollupsPage() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 22, fontWeight: 900 }}>Rollups</h1>
      <RollupsClient />
    </div>
  );
}
