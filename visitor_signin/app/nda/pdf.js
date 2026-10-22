export async function downloadPdf(rec) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF();

  // title and version
  pdf.setFontSize(18);
  pdf.text(rec.documentTitle, 20, 20);
  pdf.setFontSize(10);
  pdf.text(`Version ${rec.documentVersion}`, 20, 28);

  // the agreement text, split into lines that fit the page
  pdf.setFontSize(12);
  const lines = pdf.splitTextToSize(rec.documentText, 170);
  let y = 40;
  lines.forEach((line) => {
    if (y > 275) {
      pdf.addPage();
      y = 20;
    }
    pdf.text(line, 20, y);
    y += 6;
  });

  // name, time and signature picture
  y += 10;
  if (y > 220) {
    pdf.addPage();
    y = 20;
  }
  pdf.text(`Signed by: ${rec.visitorName}`, 20, y);
  pdf.text(`Date and time: ${new Date(rec.signedAt).toLocaleString()}`, 20, y + 8);
  pdf.text("Signature:", 20, y + 18);
  pdf.addImage(rec.signature, "PNG", 20, y + 22, 80, 32);

  const fileName = `${rec.documentTitle}_${rec.visitorName}`.replace(/\s+/g, "_");
  pdf.save(`${fileName}.pdf`);
}