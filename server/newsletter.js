import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.SES_REGION || process.env.AWS_REGION || "eu-north-1" });

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

export async function sendNewsletterCampaignEmail({ email, subject, body, imageUrl = '', eventUrl = '', eventTitle = '', unsubscribeUrl }) {
  const from = String(process.env.SES_FROM_EMAIL || "").trim() || "RSVP DXB <vinitahirani@rsvpdxb.com>";

  const paragraphs = body.split(/\n{2,}/).map((paragraph) =>
    `<p style="margin:0 0 16px;line-height:1.7">${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`,
  ).join("");
  const image = imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(subject)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;margin:0 0 24px;border-radius:10px;border:0">` : '';
  const heroImage = image && eventUrl ? `<a href="${escapeHtml(eventUrl)}" target="_blank" style="display:block;text-decoration:none" aria-label="View ${escapeHtml(eventTitle || subject)}">${image}</a>` : image;
  const eventCta = eventUrl ? `<div style="margin:28px 0 8px;padding:24px;background:#f4e5ce;border:1px solid #e0c49d;border-radius:12px;text-align:center"><p style="margin:0 0 15px;color:#705238;font-size:13px;line-height:1.5">${eventTitle ? `Discover ${escapeHtml(eventTitle)}` : 'Your next RSVP starts here'}</p><a href="${escapeHtml(eventUrl)}" target="_blank" style="display:inline-block;padding:14px 24px;background:#85501f;border:1px solid #85501f;border-radius:7px;color:#fffaf0;font-size:15px;font-weight:bold;line-height:1.2;text-decoration:none">View event &amp; RSVP&nbsp; &#8594;</a></div>` : '';
  const html = `<!doctype html><html><body style="margin:0;padding:24px 12px;background:#f3e3cb;color:#2e1c10;font-family:Arial,Helvetica,sans-serif"><main style="max-width:600px;margin:0 auto;padding:34px 30px;background:#fbf3e7;border:1px solid #d2b995;border-radius:14px"><p style="margin:0 0 22px;color:#80512f;font-size:13px;letter-spacing:2px;font-weight:bold">RSVP DXB</p><h1 style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:30px;font-weight:500;line-height:1.2">${escapeHtml(subject)}</h1>${heroImage}${paragraphs}${eventCta}<hr style="border:0;border-top:1px solid #dfc9a9;margin:28px 0 18px"><p style="margin:0;color:#705238;font-size:12px;line-height:1.6">You are receiving this because you opted in to RSVP DXB email updates.<br><a href="${escapeHtml(unsubscribeUrl)}" style="color:#80512f">Unsubscribe from future emails</a></p></main></body></html>`;
  const text = `${subject}\n\n${imageUrl ? `Campaign image: ${imageUrl}\n\n` : ''}${body}${eventUrl ? `\n\n${eventTitle ? `${eventTitle} — ` : ''}View event & RSVP: ${eventUrl}` : ''}\n\nYou are receiving this because you opted in to RSVP DXB email updates.\nUnsubscribe: ${unsubscribeUrl}`;
  await ses.send(new SendEmailCommand({
    Source: from,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Charset: "UTF-8", Data: subject },
      Body: {
        Text: { Charset: "UTF-8", Data: text },
        Html: { Charset: "UTF-8", Data: html },
      },
    },
  }));
}
