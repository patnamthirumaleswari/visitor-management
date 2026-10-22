"use client";

export default function PrintControls({ signedOut }: { signedOut: boolean }) {
  return (
    <div className="no-print stack" style={{ marginBottom: 16 }}>
      {signedOut && <p className="notice" style={{ margin: 0 }}>This visitor has signed out. The badge is shown for reference.</p>}
      <div className="row">
        <a className="button secondary" href="/admin">Back</a>
        <button onClick={() => window.print()}>Print badge</button>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        In the print window choose the label printer and paper size 62 × 100 mm. On a normal printer it prints at the top of the page.
      </p>
    </div>
  );
}
