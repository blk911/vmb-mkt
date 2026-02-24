export const metadata = { title: "Targets — VMB" };

export default function Page() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Targets</h1>
      <p style={{ opacity: 0.8, marginTop: 8 }}>
        This route was missing from main. We restored the route so Vercel can render again.
      </p>

      <div style={{ marginTop: 16 }}>
        <a href="/admin/vmb/places/sweep" style={{ textDecoration: "underline" }}>
          Go to Places Sweep
        </a>
      </div>
    </div>
  );
}
