"use client";
import { useEffect, useState } from "react";
import SignaturePad from "./SignaturePad";
import { getAgreement, addSigned, defaultAgreement } from "./agreementStore";
import { downloadPdf } from "./pdf";
import "./Nda.css";

function SignAgreement({ visitorName = "", onSigned }) {
  const [agreement, setAgreement] = useState(defaultAgreement);
  const [name, setName] = useState(visitorName);
  const [agreed, setAgreed] = useState(false);
  const [signature, setSignature] = useState("");
  const [error, setError] = useState("");
  const [record, setRecord] = useState(null);

  // load the saved agreement; also accept a name from the address (/nda?name=Ravi)
  useEffect(() => {
    setAgreement(getAgreement());
    const nameFromUrl = new URLSearchParams(window.location.search).get("name");
    if (nameFromUrl && !visitorName) setName(nameFromUrl);
  }, [visitorName]);

  function handleSubmit(e) {
    e.preventDefault();

    if (!name.trim()) return setError("Please enter your full name.");
    if (!agreed) return setError("Please tick the box to confirm you have read it.");
    if (!signature) return setError("Please sign in the box.");

    const rec = {
      id: crypto.randomUUID(),
      visitorName: name.trim(),
      documentTitle: agreement.title,
      documentVersion: agreement.version,
      documentText: agreement.text,
      signature,
      signedAt: new Date().toISOString(),
    };

    addSigned(rec);
    setRecord(rec);
    setError("");
    if (onSigned) onSigned(rec);
  }

  function reset() {
    setName(visitorName);
    setAgreed(false);
    setSignature("");
    setRecord(null);
  }

  // after signing
  if (record) {
    return (
      <div className="nda-page">
        <div className="nda-card nda-center">
          <h1>Thank you, {record.visitorName}!</h1>
          <p>Your signed copy is ready.</p>
          <button onClick={() => downloadPdf(record)}>
            Download signed copy (PDF)
          </button>
          <button className="nda-secondary" onClick={reset}>
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="nda-page">
      <div className="nda-card">
        <h1>{agreement.title}</h1>
        <p className="nda-sub">
          Version {agreement.version}. Please read before signing.
        </p>

        <div className="nda-text">{agreement.text}</div>

        <form onSubmit={handleSubmit}>
          <label>Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label className="nda-check">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            I have read and agree to this agreement
          </label>

          <label>Sign below</label>
          <SignaturePad onChange={setSignature} />

          {error && <p className="nda-error">{error}</p>}

          <button type="submit">Sign Agreement</button>
        </form>
      </div>
    </div>
  );
}

export default SignAgreement;