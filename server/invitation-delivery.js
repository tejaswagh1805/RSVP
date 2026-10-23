import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const htmlEscape = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);

const eventDateLabel = (date) => {
  const value = String(date ?? "").slice(0, 10);
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00Z`)
    : null;
  return parsed && !Number.isNaN(parsed.getTime())
    ? new Intl.DateTimeFormat("en-AE", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(parsed)
    : value;
};

export const invitationEventDetails = (event) => {
  const date = eventDateLabel(event.date);
  const venue = [event.venue, event.area].filter(Boolean).join(", ");
  return [date, event.time, venue].filter(Boolean).join(" · ") || "Dubai";
};

const providerMessage = async (response, provider) => {
  if (response.ok) return null;
  const payload = await response.json().catch(() => ({}));
  const detail =
    payload?.message || payload?.error?.message || payload?.error || "";
  return String(detail || `${provider} returned HTTP ${response.status}.`).slice(
    0,
    240,
  );
};

export async function sendInvitationEmail({ guestName, email, event, invitationUrl, tableNo }) {
  if (!email) return { status: "skipped", message: "No email address was provided." };
  const region = String(process.env.SES_REGION || process.env.AWS_REGION || "").trim();
  const from = String(process.env.SES_FROM_EMAIL || "").trim();
  if (!region || !from)
    return {
      status: "not_configured",
      message: "Email delivery is not configured. Set SES_REGION and SES_FROM_EMAIL.",
    };

  const title = String(event.title || "You're invited");
  const details = invitationEventDetails(event);
  const tableLine = tableNo ? `Your table: ${tableNo}` : "";
  const text = [
    `Dear ${guestName},`,
    "",
    `You are invited to ${title} with RSVP DXB.`,
    details,
    tableLine,
    "",
    `Please respond using your private RSVP link: ${invitationUrl}`,
    "",
    "We look forward to seeing you.",
    "RSVP DXB",
  ].filter((line) => line !== "").join("\n");
  const safeGuest = htmlEscape(guestName);
  const safeTitle = htmlEscape(title);
  const safeDetails = htmlEscape(details);
  const safeTableLine = tableLine ? `<p>${htmlEscape(tableLine)}</p>` : "";
  const safeUrl = htmlEscape(invitationUrl);
  const html = `<!doctype html><html><body style="margin:0;background:#f3e3cb;color:#2e1c10;font-family:Arial,sans-serif"><main style="max-width:560px;margin:32px auto;padding:36px 28px;background:#fbf3e7;border:1px solid #d2b995;border-radius:12px"><p style="color:#86501f;font-size:12px;letter-spacing:2px;text-transform:uppercase">RSVP DXB</p><h1 style="font-size:28px;font-weight:500">You are invited, ${safeGuest}</h1><p>We would love to welcome you to <strong>${safeTitle}</strong>.</p><p>${safeDetails}</p>${safeTableLine}<p style="margin:28px 0"><a href="${safeUrl}" style="display:inline-block;padding:13px 22px;border-radius:10px;background:#86501f;color:#fff6e9;text-decoration:none">View your invitation</a></p><p style="font-size:12px;color:#705238">We look forward to seeing you.<br />RSVP DXB</p></main></body></html>`;

  try {
    const ses = new SESClient({ region });
    await ses.send(new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Charset: "UTF-8", Data: `You're invited to ${title} | RSVP DXB` },
        Body: {
          Text: { Charset: "UTF-8", Data: text },
          Html: { Charset: "UTF-8", Data: html },
        },
      },
    }));
    return {
      status: "submitted",
      message: "Accepted by Amazon SES; inbox delivery is not confirmed.",
    };
  } catch (error) {
    const detail = String(error?.message || "").trim();
    return {
      status: "failed",
      message: detail.slice(0, 240) || "Could not send through Amazon SES. Check AWS credentials, region, and SES permissions.",
    };
  }
}

const normalizeWhatsAppNumber = (phone) => {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `971${digits.slice(1)}`;
  return /^\d{8,15}$/.test(digits) ? digits : "";
};

export async function sendInvitationWhatsApp({ guestName, phone, event, invitationUrl }) {
  if (!phone) return { status: "skipped", message: "No WhatsApp number was provided." };
  const accessToken = String(process.env.WHATSAPP_ACCESS_TOKEN || "").trim();
  const phoneNumberId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  const apiVersion = String(process.env.WHATSAPP_GRAPH_API_VERSION || "").trim();
  const templateName = String(process.env.WHATSAPP_TEMPLATE_NAME || "").trim();
  const language = String(process.env.WHATSAPP_TEMPLATE_LANGUAGE || "en_US").trim();
  if (!accessToken || !phoneNumberId || !apiVersion || !templateName)
    return {
      status: "not_configured",
      message: "WhatsApp delivery needs Meta Cloud API credentials and an approved invitation template.",
    };
  if (!/^v\d+\.\d+$/.test(apiVersion))
    return { status: "not_configured", message: "Set WHATSAPP_GRAPH_API_VERSION, for example vXX.0." };
  const recipient = normalizeWhatsAppNumber(phone);
  if (!recipient)
    return {
      status: "failed",
      message: "Enter a valid international number, such as +971 50 123 4567.",
    };

  const templateParameters = [
    guestName,
    event.title || "RSVP DXB event",
    invitationEventDetails(event),
    invitationUrl,
  ].map((text) => ({ type: "text", text: String(text) }));
  try {
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(phoneNumberId)}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient,
          type: "template",
          template: {
            name: templateName,
            language: { code: language },
            components: [{ type: "body", parameters: templateParameters }],
          },
        }),
        signal: AbortSignal.timeout(10000),
      },
    );
    const error = await providerMessage(response, "WhatsApp Cloud API");
    return error
      ? { status: "failed", message: error }
      : {
          status: "submitted",
          message: "Accepted by WhatsApp; delivery to the recipient is not confirmed.",
        };
  } catch {
    return {
      status: "failed",
      message: "Could not reach WhatsApp Cloud API. Check server network access and try again.",
    };
  }
}
