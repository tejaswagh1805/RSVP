const escapePdf = (value) => String(value ?? "")
  .normalize("NFKD")
  .replace(/[^\x20-\x7E]/g, "?")
  .replace(/[\\()]/g, "\\$&");

export function createTicketPdf(ticket) {
  const lines = [
    "RSVP DXB  |  EVENT TICKET",
    "",
    `Event: ${ticket.eventTitle}`,
    `Date: ${ticket.date}${ticket.time ? ` at ${ticket.time}` : ""}`,
    `Venue: ${ticket.venue || "See event details"}`,
    `Guest: ${ticket.guestName || "WhatsApp guest"}`,
    `Ticket reference: ${ticket.id}`,
    `Paid: ${ticket.amount} ${ticket.currency}`,
    "",
    "Present this ticket at the event entrance.",
    "Keep the ticket reference available for verification.",
  ];
  const commands = ["BT", "/F1 20 Tf", "54 748 Td"];
  lines.forEach((line, index) => {
    if (index) commands.push("0 -30 Td", "/F1 12 Tf");
    commands.push(`(${escapePdf(line)}) Tj`);
  });
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "ascii")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "ascii"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "ascii");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, "ascii");
}
