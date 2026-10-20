import QRCode from 'qrcode';

const escapePdf = (value) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[^\x20-\x7E]/g, '?')
  .replace(/[\\()]/g, '\\$&');

const text = (value, x, y, size = 12, color = '0.16 0.15 0.13') =>
  `BT ${color} rg /F1 ${size} Tf ${x} ${y} Td (${escapePdf(value)}) Tj ET`;

function drawQr(token, x, y, side) {
  const matrix = QRCode.create(String(token), { errorCorrectionLevel: 'Q' }).modules;
  const quiet = 4;
  const unit = side / (matrix.size + quiet * 2);
  const commands = ['1 1 1 rg', `${x} ${y} ${side} ${side} re f`, '0 0 0 rg'];
  for (let row = 0; row < matrix.size; row += 1) {
    let start = -1;
    for (let col = 0; col <= matrix.size; col += 1) {
      const dark = col < matrix.size && matrix.get(row, col);
      if (dark && start < 0) start = col;
      if (!dark && start >= 0) {
        const rectX = x + (quiet + start) * unit;
        const rectY = y + side - (quiet + row + 1) * unit;
        commands.push(`${rectX.toFixed(2)} ${rectY.toFixed(2)} ${((col - start) * unit).toFixed(2)} ${unit.toFixed(2)} re f`);
        start = -1;
      }
    }
  }
  return commands;
}

export function createTicketPdf(ticket) {
  const qrSide = 168;
  const commands = [
    '0.98 0.97 0.94 rg 0 0 595 842 re f',
    '0.10 0.12 0.12 rg 0 728 595 114 re f',
    text('RSVP DXB', 48, 790, 13, '0.83 0.68 0.40'),
    text('EVENT TICKET', 48, 756, 24, '1 1 1'),
    '0.83 0.68 0.40 RG 48 711 m 547 711 l S',
    '1 1 1 rg 40 154 515 526 re f',
    '0.88 0.84 0.75 RG 40 154 515 526 re S',
    text('EVENT', 62, 644, 9, '0.47 0.39 0.25'),
    text(ticket.eventTitle, 62, 610, 24),
    text(`${ticket.date}${ticket.time ? `  ·  ${ticket.time}` : ''}`, 62, 578, 12, '0.35 0.33 0.29'),
    text(ticket.venue || 'See event details', 62, 555, 12, '0.35 0.33 0.29'),
    '0.90 0.87 0.80 RG 62 530 m 533 530 l S',
    text('GUEST', 62, 498, 9, '0.47 0.39 0.25'),
    text(ticket.guestName || 'WhatsApp guest', 62, 470, 18),
    text(`WhatsApp: ${ticket.phone || '—'}`, 62, 447, 10, '0.35 0.33 0.29'),
    text('TICKET TYPE', 62, 425, 9, '0.47 0.39 0.25'),
    text(Number(ticket.amount) === 0 ? 'Complimentary' : 'Paid admission', 62, 400, 13),
    text(`${ticket.amount} ${ticket.currency}`, 62, 377, 12, '0.35 0.33 0.29'),
    text('SCAN AT THE DOOR', 354, 568, 10, '0.47 0.39 0.25'),
    ...drawQr(ticket.ticketToken, 350, 382, qrSide),
    text('One-time entry validation', 354, 359, 9, '0.35 0.33 0.29'),
    text('TICKET REFERENCE', 62, 306, 9, '0.47 0.39 0.25'),
    text(ticket.id, 62, 283, 11),
    '0.90 0.87 0.80 RG 62 253 m 533 253 l S',
    text('Present this ticket at the entrance. The QR code is unique to this ticket.', 62, 219, 10, '0.35 0.33 0.29'),
    text('A ticket can be checked in once only.', 62, 199, 10, '0.35 0.33 0.29'),
    text('RSVP DXB  ·  Dubai, UAE', 48, 88, 10, '0.47 0.39 0.25'),
  ];
  const stream = commands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'ascii'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'ascii');
}
