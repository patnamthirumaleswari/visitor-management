"use client";
import { useEffect, useState } from "react";
import {
  getAgreement,
  saveAgreement,
  getSigned,
  defaultAgreement,
} from "./agreementStore";
import { downloadPdf } from "./pdf";
import "./Nda.css";

function AgreementEditor() {
  const [form, setForm] = useState(defaultAgreement);
  const [signed, setSigned] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setForm(getAgreement());
    setSigned(getSigned());
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setMessage("");
  }

  function handleSave(e) {
    e.preventDefault();
    saveAgreement(form);
    setMessage("Agreement saved. New visitors will see this version.");
  }

  return (
    <div className="nda-page">
      <div className="nda-card">
        <h1>Manage Agreement</h1>
        <p className="nda-sub">Write the NDA or agreement visitors must sign.</p>

        <form onSubmit={handleSave}>
          <label>Title</label>
          <input
            type="text"
            name="title"
            value={form.title}
            onChange={handleChange}
            required
          />

          <label>Version (change it when you edit the text)</label>
          <input
            type="text"
            name="version"
            value={form.version}
            onChange={handleChange}
            required
          />

          <label>Agreement text</label>
          <textarea
            name="text"
            rows={10}
            value={form.text}
            onChange={handleChange}
            required
          />

          {message && <p className="nda-success">{message}</p>}

          <button type="submit">Save Agreement</button>
        </form>

        <h2 className="nda-h2">Signed agreements ({signed.length})</h2>
        {signed.length === 0 ? (
          <p className="nda-sub">Nobody has signed yet.</p>
        ) : (
          <table className="nda-table">
            <thead>
              <tr>
                <th>Visitor</th>
                <th>Version</th>
                <th>Signed at</th>
                <th>PDF</th>
              </tr>
            </thead>
            <tbody>
              {signed.map((s) => (
                <tr key={s.id}>
                  <td>{s.visitorName}</td>
                  <td>{s.documentVersion}</td>
                  <td>{new Date(s.signedAt).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="nda-link"
                      onClick={() => downloadPdf(s)}
                    >
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AgreementEditor;