import "dotenv/config";
import express from "express";
import cors from "cors";
import { neon } from "@neondatabase/serverless";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  sendInvitationEmail,
  sendInvitationWhatsApp,
} from "./invitation-delivery.js";
import {
  clearSessionCookie,
  createSessionToken,
  getSessionToken,
  hashPassword,
  hashSessionToken,
  setSessionCookie,
  verifyPassword,
} from "./auth.js";
import { createTicketPdf } from "./ticket-pdf.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const sql =
  databaseUrl && !/USER:PASSWORD|@HOST\/DBNAME/i.test(databaseUrl)
    ? neon(databaseUrl)
    : null;
if (databaseUrl && !sql)
  console.warn(
    "DATABASE_URL still contains the example placeholder; API is using demo data. Update the project-root .env to use Neon.",
  );
const now = () =>
  new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
const sessionLifetime = 7 * 24 * 60 * 60 * 1000;
const demoSessions = new Map();
const dashboardTrack = {
  influencer: "Creators",
  creator: "Creators",
  media: "Media",
  tastemaker: "Tastemakers",
  brand: "Private Circle",
};
const normalizeTrack = (track) =>
  dashboardTrack[
    String(track || "")
      .trim()
      .toLowerCase()
  ] || String(track || "Creators").trim();
const text = (value, max = 500) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
const demoAdmins = sql
  ? []
  : await Promise.all(
      [
        {
          id: "admin-1",
          name: process.env.ADMIN_1_NAME || "Tejas Nair",
          email: (
            process.env.ADMIN_1_EMAIL || "tejas@rsvpdxb.local"
          ).toLowerCase(),
          password: process.env.ADMIN_1_PASSWORD || "demo1234",
          role: "Owner",
        },
      ].map(async (admin) => ({
        ...admin,
        passwordHash: await hashPassword(admin.password),
      })),
    );

app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({
  limit: "3mb",
  verify(req, _res, buffer) {
    if (req.originalUrl === "/api/payments/stripe/webhook") req.rawBody = Buffer.from(buffer);
  },
}));

async function currentAdmin(req) {
  const token = getSessionToken(req);
  if (!token) return null;
  const tokenHash = hashSessionToken(token);
  if (!sql) {
    const session = demoSessions.get(tokenHash);
    if (!session || session.expiresAt <= Date.now()) {
      demoSessions.delete(tokenHash);
      return null;
    }
    const { password, passwordHash, ...admin } =
      demoAdmins.find((item) => item.id === session.adminId) || {};
    return admin.id ? admin : null;
  }
  const rows =
    await sql`SELECT a.id, a.name, a.email, a.role FROM admin_sessions s JOIN admin_users a ON a.id = s.admin_id WHERE s.token_hash = ${tokenHash} AND s.expires_at > NOW() AND a.active = TRUE LIMIT 1`;
  return rows[0] || null;
}

const demo = {
  applications: [
    {
      id: "app-1",
      name: "Layla Haddad",
      email: "layla@thegulfedit.com",
      track: "Media",
      city: "Dubai",
      detail: "Senior editor, The Gulf Edit — food & travel",
      followers: "—",
      submitted: "2026-09-29",
      status: "pending",
    },
    {
      id: "app-2",
      name: "Omar Rashid",
      email: "omar.creates@gmail.com",
      track: "Creators",
      city: "Dubai",
      detail: "Lifestyle & fashion, IG + TikTok",
      followers: "128k",
      submitted: "2026-09-29",
      status: "pending",
    },
    {
      id: "app-3",
      name: "Chef Marco Vitale",
      email: "marco@casavitale.ae",
      track: "Tastemakers",
      city: "Dubai",
      detail: "Executive chef, Casa Vitale",
      followers: "22k",
      submitted: "2026-09-28",
      status: "pending",
    },
    {
      id: "app-4",
      name: "A. Al Suwaidi",
      email: "office@alsuwaidi-group.ae",
      track: "Private Circle",
      city: "Abu Dhabi",
      detail: "Referred by member #0142 — assistant contact on file",
      followers: "Private",
      submitted: "2026-09-27",
      status: "pending",
    },
    {
      id: "app-5",
      name: "Sofia Mendes",
      email: "sofia@luxereport.co",
      track: "Creators",
      city: "Dubai",
      detail: "Beauty creator — YouTube + IG",
      followers: "41k",
      submitted: "2026-09-26",
      status: "pending",
    },
  ],
  members: [
    {
      id: "m1",
      name: "Tejas Nair",
      track: "Creators",
      rank: "Gold",
      points: 640,
      events: 18,
      city: "Dubai",
    },
    {
      id: "m2",
      name: "Hala Zayed",
      track: "Media",
      rank: "Diamond",
      points: 1180,
      events: 31,
      city: "Dubai",
    },
    {
      id: "m3",
      name: "Rami Fawaz",
      track: "Tastemakers",
      rank: "Silver",
      points: 310,
      events: 9,
      city: "Sharjah",
    },
    {
      id: "m4",
      name: "Private #0142",
      track: "Private Circle",
      rank: "Bronze",
      points: 0,
      events: 6,
      city: "Dubai",
    },
    {
      id: "m5",
      name: "Nadia Khan",
      track: "Creators",
      rank: "Platinum",
      points: 2740,
      events: 58,
      city: "Dubai",
    },
    {
      id: "m6",
      name: "Jon Abela",
      track: "Media",
      rank: "Silver",
      points: 220,
      events: 7,
      city: "Dubai",
    },
  ],
  events: [
    {
      id: "atlantis-chef-table",
      title: "Chef's Table at Ossiano",
      brand: "Atlantis The Royal",
      date: "2026-10-03",
      time: "19:30",
      venue: "Ossiano, Atlantis The Royal",
      area: "Palm Jumeirah",
      category: "Dining",
      tracks: ["Media", "Tastemakers"],
      capacity: 24,
      confirmed: 21,
      status: "published",
    },
    {
      id: "jumeirah-spring-launch",
      title: "Spring Collection Launch",
      brand: "Maison Dalia",
      date: "2026-10-04",
      time: "20:00",
      venue: "Alserkal Avenue, Warehouse 42",
      area: "Al Quoz",
      category: "Fashion",
      tracks: ["Creators", "Media"],
      capacity: 120,
      confirmed: 120,
      status: "published",
    },
    {
      id: "dubai-hills-preview",
      title: "Private Residence Preview",
      brand: "Vantage Developments",
      date: "2026-10-08",
      time: "18:00",
      venue: "Dubai Hills Estate",
      area: "Dubai Hills",
      category: "Property",
      tracks: ["Private Circle"],
      capacity: 16,
      confirmed: 9,
      status: "published",
    },
    {
      id: "marina-sunset-session",
      title: "Sunset Listening Session",
      brand: "Nuvo Audio",
      date: "2026-10-11",
      time: "17:30",
      venue: "Bluewaters Terrace",
      area: "Bluewaters",
      category: "Music",
      tracks: ["Creators", "Tastemakers"],
      capacity: 80,
      confirmed: 54,
      status: "published",
    },
    {
      id: "difc-art-night",
      title: "Collectors Night",
      brand: "Gallery Seventeen",
      date: "2026-10-16",
      time: "19:00",
      venue: "DIFC Gate Village 9",
      area: "DIFC",
      category: "Art",
      tracks: ["Private Circle", "Tastemakers"],
      capacity: 40,
      confirmed: 28,
      status: "published",
    },
    {
      id: "beach-club-opening",
      title: "Season Opening Brunch",
      brand: "Sirene Beach Club",
      date: "2026-10-18",
      time: "13:00",
      venue: "Jumeirah Beach Road",
      area: "Jumeirah",
      category: "Nightlife",
      tracks: ["Creators", "Media", "Tastemakers"],
      capacity: 200,
      confirmed: 142,
      status: "pending",
    },
  ],
  wall: [
    {
      id: "w1",
      brand: "Sirene Beach Club",
      type: "Places Just Opened",
      body: "Six places just opened for Season Opening Brunch this Saturday. First come, first served.",
      posted: "2h ago",
      boosted: true,
      status: "live",
      eventId: "beach-club-opening",
    },
    {
      id: "w2",
      brand: "Maison Dalia",
      type: "New Event",
      body: "Spring Collection Launch — Alserkal Avenue, 4 October. Creators and fashion press only.",
      posted: "5h ago",
      boosted: false,
      status: "live",
      eventId: "jumeirah-spring-launch",
    },
    {
      id: "w3",
      brand: "Nuvo Audio",
      type: "Member Offer",
      body: "20% member discount on the terrace menu all October. Show your digital pass.",
      posted: "Yesterday",
      boosted: false,
      status: "live",
    },
    {
      id: "w4",
      brand: "Atlantis The Royal",
      type: "Recap",
      body: "Thank you to everyone who joined last week's Chef's Table. 41 pieces of content collected.",
      posted: "2 days ago",
      boosted: false,
      status: "live",
    },
    {
      id: "w5",
      brand: "Gallery Seventeen",
      type: "Sponsored",
      body: "Collectors Night at DIFC — a curator-led evening with the artists present.",
      posted: "Pending review",
      boosted: false,
      status: "pending",
      eventId: "difc-art-night",
    },
  ],
  clients: [
    {
      id: "b1",
      name: "Atlantis The Royal",
      package: "Signature",
      credits: 42,
      events: 11,
      status: "active",
    },
    {
      id: "b2",
      name: "Maison Dalia",
      package: "Launch",
      credits: 8,
      events: 3,
      status: "active",
    },
    {
      id: "b3",
      name: "Sirene Beach Club",
      package: "Season",
      credits: 26,
      events: 7,
      status: "active",
    },
    {
      id: "b4",
      name: "Vantage Developments",
      package: "Private",
      credits: 15,
      events: 2,
      status: "trial",
    },
    {
      id: "b5",
      name: "Nuvo Audio",
      package: "Launch",
      credits: 4,
      events: 1,
      status: "active",
    },
  ],
  guests: [
    {
      id: "g1",
      name: "Tejas Nair",
      track: "Creators",
      eventId: "marina-sunset-session",
      plusOnes: 1,
      code: "RSVP-4471",
    },
    {
      id: "g2",
      name: "Hala Zayed",
      track: "Media",
      eventId: "marina-sunset-session",
      plusOnes: 0,
      code: "RSVP-2208",
    },
    {
      id: "g3",
      name: "Rami Fawaz",
      track: "Tastemakers",
      eventId: "marina-sunset-session",
      plusOnes: 1,
      code: "RSVP-9014",
    },
    {
      id: "g4",
      name: "Nadia Khan",
      track: "Creators",
      eventId: "marina-sunset-session",
      plusOnes: 2,
      code: "RSVP-7731",
    },
    {
      id: "g5",
      name: "Jon Abela",
      track: "Media",
      eventId: "marina-sunset-session",
      plusOnes: 0,
      code: "RSVP-5520",
    },
  ],
  guestInvitations: [],
};

const tableFor = {
  applications: "applications",
  members: "members",
  events: "events",
  wall: "wall_posts",
  clients: "clients",
  guests: "guests",
};
const selectFor = {
  applications:
    'SELECT id, name, email, track, city, detail, followers, profile_url AS "profileUrl", handle, platform, mobile, outlet, application_role AS role, all_profiles AS "allProfiles", source_track AS "sourceTrack", submitted::text AS submitted, status FROM applications ORDER BY submitted DESC',
  members:
    'SELECT id, name, email, track, source_track AS "sourceTrack", rank, points, events, city, profile_url AS "profileUrl", handle, platform, followers, mobile, outlet, member_role AS role, all_profiles AS "allProfiles", status, joined::text AS joined FROM members ORDER BY name',
  events:
    'SELECT id, title, brand, venue, date::text AS date, time, area, category, tracks, capacity, confirmed, ticket_price AS \"ticketPrice\", ticket_currency AS \"ticketCurrency\", dress_code AS \"dressCode\", about, included, who_is_invited AS \"whoIsInvited\", host_note AS \"hostNote\", status FROM events ORDER BY date',
  wall_posts:
    'SELECT id, brand, type, body, posted, boosted, status, event_id AS "eventId" FROM wall_posts ORDER BY created_at DESC',
  clients:
    "SELECT id, name, package, credits, events, status FROM clients ORDER BY name",
  guests:
    `SELECT id, name, track, event_id AS "eventId", plus_ones AS "plusOnes", code, checked_in_at AS "checkedInAt", status FROM guests
     UNION ALL
     SELECT 'ticket-' || r.id AS id, COALESCE(NULLIF(r.guest_name, ''), 'WhatsApp guest') AS name, 'Ticket' AS track, r.event_id AS "eventId", 0 AS "plusOnes", r.ticket_token AS code, r.checked_in_at::text AS "checkedInAt", r.status
     FROM ticket_requests r WHERE r.ticket_token IS NOT NULL AND r.status IN ('approved', 'paid')
     ORDER BY name`,
};
const getRows = async (table) => {
  if (sql) return sql.query(selectFor[table]);
  const rows = structuredClone(demo[table]);
  return ["applications", "members"].includes(table)
    ? rows.map(({ passwordHash: _passwordHash, ...row }) => row)
    : rows;
};

async function sendInfobipWhatsApp(to, textMessage, events = []) {
  const base = String(process.env.INFOBIP_BASE_URL || "").trim().replace(/\/$/, "");
  const apiKey = String(process.env.INFOBIP_API_KEY || "").trim();
  const sender = String(process.env.INFOBIP_WHATSAPP_SENDER || "").trim();
  if (!base || !apiKey || !sender) return;
  const payload = events.length
    ? {
        from: sender,
        to,
        content: {
          body: { text: textMessage },
          action: {
            title: "View events",
            sections: [{ rows: events.slice(0, 10).map((event) => ({
              id: event.id,
              title: event.title.slice(0, 24),
              description: `${event.date} · ${event.ticketPrice} ${event.ticketCurrency}`.slice(0, 72),
            })) }],
          },
        },
      }
    : { from: sender, to, content: { text: textMessage } };
  const response = await fetch(`${base}/whatsapp/1/message/${events.length ? "interactive/list" : "text"}`, {
    method: "POST", headers: { Authorization: `App ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Infobip WhatsApp returned HTTP ${response.status}`);
}

async function sendInfobipWhatsAppPayment(to, checkoutUrl, event, guestName, amount, currency) {
  const base = String(process.env.INFOBIP_BASE_URL || "").trim().replace(/\/$/, "");
  const apiKey = String(process.env.INFOBIP_API_KEY || "").trim();
  const sender = String(process.env.INFOBIP_WHATSAPP_SENDER || "").trim();
  if (!base || !apiKey || !sender) throw new Error("Infobip WhatsApp is not configured.");

  const details = [
    `Event: ${event.title}`,
    `Date: ${event.date}${event.time ? ` · ${event.time}` : ""}`,
    event.venue ? `Venue: ${event.venue}` : "",
    guestName ? `Guest: ${guestName}` : "",
    `Total: ${Number(amount).toFixed(2)} ${currency}`,
    "\nTap Pay now to complete secure payment. Your PDF ticket will be sent to this chat after payment is confirmed.",
  ].filter(Boolean).join("\n");

  const apiHost = String(process.env.RENDER_EXTERNAL_URL || "https://rsvp-cytl.onrender.com").replace(/\/$/, "");
  const eventImage = event.imageData ? `${apiHost}/api/events/${encodeURIComponent(event.id)}/image` : "";
  const response = await fetch(`${base}/whatsapp/1/message/interactive/url-button`, {
    method: "POST",
    headers: { Authorization: `App ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      from: sender,
      to,
      content: {
        header: eventImage
          ? { type: "IMAGE", mediaUrl: eventImage }
          : { type: "TEXT", text: "RSVP DXB · Ticket checkout" },
        body: { text: details },
        footer: { text: "Secure checkout powered by Stripe" },
        action: { displayText: "Pay now", url: checkoutUrl },
      },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Infobip payment button returned HTTP ${response.status}: ${await response.text()}`);
}

async function sendInfobipTicket(to, pdfUrl, filename, caption) {
  const base = String(process.env.INFOBIP_BASE_URL || "").trim().replace(/\/$/, "");
  const apiKey = String(process.env.INFOBIP_API_KEY || "").trim();
  const sender = String(process.env.INFOBIP_WHATSAPP_SENDER || "").trim();
  if (!base || !apiKey || !sender) throw new Error("Infobip WhatsApp is not configured.");
  const response = await fetch(`${base}/whatsapp/1/message/document`, {
    method: "POST",
    headers: { Authorization: `App ${apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ from: sender, to, content: { mediaUrl: pdfUrl, caption, filename } }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Infobip document send returned HTTP ${response.status}: ${await response.text()}`);
}

async function createStripeCheckout({ requestId, event, amount, currency }) {
  const secret = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!secret) throw new Error("Stripe is not configured.");
  const site = String(process.env.PUBLIC_SITE_URL || "https://rsvp-dxb-customer.onrender.com").replace(/\/$/, "");
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isFinite(cents) || cents <= 0) throw new Error("Ticket price must be greater than zero to take payment.");
  const form = new URLSearchParams({
    mode: "payment",
    success_url: `${site}/events/${encodeURIComponent(event.id)}?payment=success`,
    cancel_url: `${site}/events/${encodeURIComponent(event.id)}?payment=cancelled`,
    client_reference_id: requestId,
    "metadata[ticket_request_id]": requestId,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": String(currency).toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(cents),
    "line_items[0][price_data][product_data][name]": `RSVP DXB ticket: ${event.title}`,
    "line_items[0][price_data][product_data][description]": `${event.date}${event.venue ? ` · ${event.venue}` : ""}`,
  });
  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `Stripe returned HTTP ${response.status}`);
  return data;
}

function verifyStripeSignature(req) {
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  const header = req.get("stripe-signature") || "";
  if (!secret || !req.rawBody) return false;
  const parts = Object.fromEntries(header.split(",").map((part) => {
    const [key, ...value] = part.split("=");
    return [key, value.join("=")];
  }));
  const timestamp = Number(parts.t);
  if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300 || !parts.v1) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${req.rawBody}`).digest();
  const received = Buffer.from(parts.v1, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

app.get("/api/health", (_req, res) =>
  res.json({ ok: true, database: Boolean(sql) }),
);
app.get("/api/events/:id/image", async (req, res, next) => {
  try {
    if (!sql) return res.status(404).end();
    const rows = await sql`SELECT image_data AS "imageData" FROM events WHERE id = ${req.params.id} LIMIT 1`;
    const match = String(rows[0]?.imageData || "").match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/i);
    if (!match) return res.status(404).end();
    res.set({ "Content-Type": match[1].toLowerCase(), "Cache-Control": "public, max-age=3600" });
    res.send(Buffer.from(match[2], "base64"));
  } catch (error) { next(error); }
});
app.get("/api/pay/:requestId", async (req, res, next) => {
  try {
    if (!sql) return res.status(404).send("Checkout not found.");
    const secret = String(process.env.STRIPE_SECRET_KEY || "").trim();
    if (!secret) return res.status(503).send("Checkout is temporarily unavailable.");
    const rows = await sql`SELECT stripe_session_id AS "sessionId", status FROM ticket_requests WHERE id = ${req.params.requestId} LIMIT 1`;
    if (!rows[0]?.sessionId || rows[0].status !== "awaiting_payment") return res.status(404).send("This checkout is no longer available.");
    const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(rows[0].sessionId)}`, {
      headers: { Authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(10000),
    });
    const session = await response.json();
    if (!response.ok || !session.url) return res.status(410).send("This checkout link has expired. Please request a new ticket link in WhatsApp.");
    res.set("Cache-Control", "no-store").redirect(303, session.url);
  } catch (error) { next(error); }
});
app.get("/api/tickets/:token.pdf", async (req, res, next) => {
  try {
    if (!sql) return res.status(404).json({ error: "Ticket not found." });
    const rows = await sql`SELECT r.id, r.ticket_token AS "ticketToken", r.phone, r.guest_name AS "guestName", r.amount, r.currency, e.title AS "eventTitle", e.date::text AS date, e.time, e.venue FROM ticket_requests r JOIN events e ON e.id = r.event_id WHERE r.ticket_token = ${req.params.token} AND r.status IN ('paid', 'approved') LIMIT 1`;
    if (!rows[0]) return res.status(404).json({ error: "Ticket not found." });
    const pdf = createTicketPdf(rows[0]);
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="RSVP-DXB-${rows[0].id}.pdf"`, "Cache-Control": "private, no-store" });
    res.send(pdf);
  } catch (error) { next(error); }
});
app.post("/api/payments/stripe/webhook", async (req, res) => {
  if (!verifyStripeSignature(req)) return res.status(400).send("Invalid Stripe signature.");
  const event = req.body;
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event?.type)) return res.sendStatus(200);
  const session = event.data?.object;
  if (session?.payment_status !== "paid") return res.sendStatus(200);
  try {
    if (!sql) throw new Error("Database is not configured.");
    const requestId = String(session.metadata?.ticket_request_id || session.client_reference_id || "");
    if (!requestId) throw new Error("Stripe session has no ticket request metadata.");
    const token = randomBytes(24).toString("hex");
    const rows = await sql`UPDATE ticket_requests r SET status = 'paid', stripe_session_id = ${session.id}, paid_at = COALESCE(r.paid_at, NOW()), ticket_token = COALESCE(r.ticket_token, ${token}) FROM events e WHERE r.id = ${requestId} AND r.event_id = e.id AND r.status IN ('awaiting_payment', 'paid') AND r.stripe_session_id = ${session.id} AND r.amount = ${Number(session.amount_total || 0) / 100} AND lower(r.currency) = lower(${session.currency || ''}) RETURNING r.id, r.phone, r.guest_name AS "guestName", r.amount, r.currency, r.ticket_token AS "ticketToken", r.ticket_delivered_at AS "ticketDeliveredAt", e.title AS "eventTitle", e.date::text AS date, e.time, e.venue`;
    const ticket = rows[0];
    if (!ticket) throw new Error("No matching ticket request for the paid Stripe Checkout session.");
    if (ticket.ticketDeliveredAt) return res.sendStatus(200);
    const host = String(process.env.RENDER_EXTERNAL_URL || "https://rsvp-cytl.onrender.com").replace(/\/$/, "");
    const pdfUrl = `${host}/api/tickets/${ticket.ticketToken}.pdf`;
    await sendInfobipTicket(ticket.phone, pdfUrl, `RSVP-DXB-${ticket.id}.pdf`, `Payment received for ${ticket.eventTitle}. Your ticket is attached.`);
    await sql`UPDATE ticket_requests SET ticket_delivered_at = NOW() WHERE id = ${ticket.id}`;
    res.sendStatus(200);
  } catch (error) {
    console.error("Stripe ticket fulfillment failed:", error?.message || error);
    res.status(500).send("Ticket fulfillment will be retried.");
  }
});
app.post("/api/whatsapp/infobip/webhook", async (req, res, next) => {
  try {
    const secret = String(process.env.INFOBIP_WEBHOOK_SECRET || "").trim();
    if (!secret || req.get("authorization") !== `Bearer ${secret}`)
      return res.status(401).json({ error: "Unauthorized webhook." });
    // Infobip can deliver either a results array or a single message object.
    // Process first so provider retries can recover from transient send/API errors.
    const inbound = Array.isArray(req.body)
      ? req.body
      : Array.isArray(req.body.results)
        ? req.body.results
        : req.body.result
          ? [req.body.result]
          : [req.body];
    for (const item of inbound) {
      if (item.integrationType && item.integrationType !== "WHATSAPP") continue;
      const phone = String(item.from || "").replace(/\D/g, "");
      const message = item.message || {};
      const input = String(
        message.text || message.text?.text || message.interactive?.listReply?.id ||
        message.interactive?.listReply?.title || message.button?.payload ||
        message.button?.text || message.buttonReply?.payload || message.buttonReply?.title ||
        item.text || item.text?.text || item.interactive?.listReply?.id || "",
      ).trim();
      if (!phone || !input) continue;
      const directEventMatch = input.match(/^rsvpdxb\s+event\s+(.+)$/i);
      if (!directEventMatch && /^(rsvpdxb(?:\s+events?)?|hi|hello|start|events|ticket|request)$/i.test(input)) {
        const events = sql
          ? await sql`SELECT id, title, date::text AS date, ticket_price AS "ticketPrice", ticket_currency AS "ticketCurrency" FROM events WHERE status = 'published' AND date >= CURRENT_DATE ORDER BY date LIMIT 10`
          : demo.events.filter((event) => event.status === "published").map((event) => ({ ...event, ticketPrice: event.ticketPrice || 0, ticketCurrency: "AED" })).slice(0, 10);
        if (!events.length) await sendInfobipWhatsApp(phone, "Welcome to RSVP DXB. There are no events open for ticket requests right now.");
        else await sendInfobipWhatsApp(phone, "Welcome to RSVP DXB! Choose an event to request your ticket:", events);
        continue;
      }
      const directEventValue = directEventMatch?.[1].trim() || "";
      const selectedEventId = directEventMatch ? directEventValue : input;
      const selectedEventTitle = directEventMatch
        ? directEventValue
        : input.split(/\r?\n/)[0].replace(/\s+\d{4}-\d{2}-\d{2}.*$/, "").trim();
      const event = sql
        ? (await sql`SELECT id, title, date::text AS date, time, venue, image_data AS "imageData", ticket_price AS "ticketPrice", ticket_currency AS "ticketCurrency", status FROM events WHERE (id = ${selectedEventId} OR lower(title) = lower(${selectedEventTitle})) AND status = 'published' AND date >= CURRENT_DATE LIMIT 1`)[0]
        : demo.events.find((row) => (row.id === selectedEventId || row.title.toLowerCase() === selectedEventTitle.toLowerCase()) && row.status === "published" && row.date >= new Date().toISOString().slice(0, 10));
      if (!event) {
        await sendInfobipWhatsApp(phone, "Please send “events” to see the current list, then select an event.");
        continue;
      }
      const id = `ticket-${text(item.messageId, 100) || randomBytes(12).toString("hex")}`;
      const amount = Number(event.ticketPrice || 0);
      const currency = event.ticketCurrency || "AED";
      if (!sql) {
        await sendInfobipWhatsApp(phone, `We received your request for ${event.title}. Payment checkout is available after the RSVP API is connected to Neon and Stripe.`);
        continue;
      }
      await sql`INSERT INTO ticket_requests (id, event_id, phone, guest_name, amount, currency) VALUES (${id}, ${event.id}, ${phone}, ${text(item.contact?.name, 120)}, ${amount}, ${currency}) ON CONFLICT (id) DO NOTHING`;
      if (amount <= 0) {
        await sendInfobipWhatsApp(phone, `Your request for ${event.title} is received. This event is currently free; the team will confirm your ticket.`);
        continue;
      }
      try {
        const checkout = await createStripeCheckout({ requestId: id, event, amount, currency });
        await sql`UPDATE ticket_requests SET status = 'awaiting_payment', stripe_session_id = ${checkout.id} WHERE id = ${id} AND status = 'pending'`;
        const guestName = text(item.contact?.name, 120);
        const apiHost = String(process.env.RENDER_EXTERNAL_URL || "https://rsvp-cytl.onrender.com").replace(/\/$/, "");
        const shortCheckoutUrl = `${apiHost}/api/pay/${encodeURIComponent(id)}`;
        try {
          await sendInfobipWhatsAppPayment(phone, shortCheckoutUrl, event, guestName, amount, currency);
        } catch (error) {
          console.error("Infobip payment button send failed:", error?.message || error);
          const details = [
            `Ticket checkout: ${event.title}`,
            `Date: ${event.date}${event.time ? ` · ${event.time}` : ""}`,
            event.venue ? `Venue: ${event.venue}` : "",
            guestName ? `Guest: ${guestName}` : "",
            `Total: ${amount.toFixed(2)} ${currency}`,
            `Pay securely: ${shortCheckoutUrl}`,
            "Your PDF ticket will be sent here after payment is confirmed.",
          ].filter(Boolean).join("\n");
          await sendInfobipWhatsApp(phone, details);
        }
      } catch (error) {
        console.error("Stripe Checkout creation failed:", error?.message || error);
        await sendInfobipWhatsApp(phone, `Your request for ${event.title} is saved, but checkout could not be started. Please contact the RSVP DXB team.`);
      }
    }
    res.sendStatus(200);
  } catch (error) {
    if (!res.headersSent) next(error);
    else console.error("Infobip webhook processing failed:", error?.message || error);
  }
});
app.get("/api/ticket-requests", async (req, res, next) => {
  try {
    if (!(await currentAdmin(req))) return res.status(401).json({ error: "Sign in to view ticket requests." });
    if (!sql) return res.json([]);
    const rows = await sql`SELECT r.id, r.phone, r.guest_name AS "guestName", r.amount, r.currency, r.status, r.paid_at AS "paidAt", r.ticket_delivered_at AS "ticketDeliveredAt", r.checked_in_at AS "checkedInAt", r.created_at AS "createdAt", e.id AS "eventId", e.title AS "eventTitle" FROM ticket_requests r JOIN events e ON e.id = r.event_id ORDER BY r.created_at DESC`;
    res.json(rows);
  } catch (error) { next(error); }
});
app.post("/api/ticket-requests/:id/approve", async (req, res, next) => {
  try {
    if (!(await currentAdmin(req))) return res.status(401).json({ error: "Sign in to approve ticket requests." });
    if (!sql) return res.status(503).json({ error: "Ticket delivery requires the connected database." });
    const rows = await sql`UPDATE ticket_requests r SET status = 'approved', ticket_token = COALESCE(r.ticket_token, ${randomBytes(24).toString("hex")}) FROM events e WHERE r.id = ${req.params.id} AND r.event_id = e.id AND r.amount = 0 AND r.status IN ('pending', 'approved') RETURNING r.id, r.phone, r.status, r.ticket_token AS "ticketToken", r.ticket_delivered_at AS "ticketDeliveredAt", e.title AS "eventTitle"`;
    const ticket = rows[0];
    if (!ticket) return res.status(409).json({ error: "Only a pending free ticket request can be approved here. Paid tickets are issued after Stripe confirms payment." });
    if (ticket.ticketDeliveredAt) return res.json({ status: ticket.status, ticketDeliveredAt: ticket.ticketDeliveredAt, message: "Ticket was already sent." });
    const host = String(process.env.RENDER_EXTERNAL_URL || "https://rsvp-cytl.onrender.com").replace(/\/$/, "");
    await sendInfobipTicket(ticket.phone, `${host}/api/tickets/${ticket.ticketToken}.pdf`, `RSVP-DXB-${ticket.id}.pdf`, `Your free ticket for ${ticket.eventTitle} is confirmed.`);
    const delivered = await sql`UPDATE ticket_requests SET ticket_delivered_at = NOW() WHERE id = ${ticket.id} RETURNING ticket_delivered_at AS "ticketDeliveredAt"`;
    res.json({ status: ticket.status, ticketDeliveredAt: delivered[0]?.ticketDeliveredAt, message: "Approved and PDF ticket sent to the guest's WhatsApp." });
  } catch (error) { next(error); }
});
app.get("/api/auth/me", async (req, res, next) => {
  try {
    res.json({ admin: await currentAdmin(req), demoMode: !sql });
  } catch (error) {
    next(error);
  }
});
app.post("/api/auth/login", async (req, res, next) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");
    const admin = sql
      ? (
          await sql`SELECT id, name, email, password_hash, role FROM admin_users WHERE lower(email) = ${email} AND active = TRUE LIMIT 1`
        )[0]
      : demoAdmins.find((item) => item.email === email);
    const passwordHash = admin?.password_hash || admin?.passwordHash;
    if (!admin || !(await verifyPassword(password, passwordHash)))
      return res.status(401).json({ error: "Email or password is incorrect." });
    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + sessionLifetime);
    if (sql) {
      await sql`DELETE FROM admin_sessions WHERE expires_at <= NOW()`;
      await sql`INSERT INTO admin_sessions (token_hash, admin_id, expires_at) VALUES (${tokenHash}, ${admin.id}, ${expiresAt.toISOString()})`;
    } else
      demoSessions.set(tokenHash, {
        adminId: admin.id,
        expiresAt: expiresAt.getTime(),
      });
    setSessionCookie(res, token, Math.floor(sessionLifetime / 1000));
    const {
      password: _password,
      passwordHash: _passwordHash,
      password_hash: _databasePasswordHash,
      ...safeAdmin
    } = admin;
    res.json({ admin: safeAdmin, demoMode: !sql });
  } catch (error) {
    next(error);
  }
});
app.post("/api/auth/logout", async (req, res, next) => {
  try {
    const token = getSessionToken(req);
    if (token) {
      const tokenHash = hashSessionToken(token);
      if (sql)
        await sql`DELETE FROM admin_sessions WHERE token_hash = ${tokenHash}`;
      else demoSessions.delete(tokenHash);
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
app.post("/api/register", async (req, res, next) => {
  try {
    const name = text(req.body.name, 160);
    const email = text(req.body.email, 254).toLowerCase();
    const password = String(req.body.password || "");
    const track = normalizeTrack(req.body.track);
    const city = text(req.body.city, 120) || "Dubai";
    if (!name || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res
        .status(400)
        .json({ error: "Enter your name and a valid email address." });
    if (password.length < 12)
      return res
        .status(400)
        .json({ error: "Password must be at least 12 characters." });
    if (!["Media", "Creators", "Tastemakers", "Private Circle"].includes(track))
      return res.status(400).json({ error: "Choose a valid member track." });
    const profileUrl = text(req.body.profileUrl, 500);
    if (profileUrl) {
      try {
        if (!["http:", "https:"].includes(new URL(profileUrl).protocol))
          throw new Error("invalid protocol");
      } catch {
        return res
          .status(400)
          .json({ error: "Profile URL must start with http:// or https://." });
      }
    }
    if (sql) {
      const existing =
        await sql`SELECT email FROM members WHERE lower(email) = ${email} UNION ALL SELECT email FROM applications WHERE lower(email) = ${email} LIMIT 1`;
      if (existing.length)
        return res
          .status(409)
          .json({
            error: "An account or application already uses this email.",
          });
    } else if (
      [...demo.members, ...demo.applications].some(
        (row) => row.email?.toLowerCase() === email,
      )
    ) {
      return res
        .status(409)
        .json({ error: "An account or application already uses this email." });
    }
    const passwordHash = await hashPassword(password);
    const application = {
      id: `application-${crypto.randomUUID()}`,
      name,
      email,
      track,
      city,
      detail: text(req.body.role, 180),
      followers: String(
        Math.max(0, Number.parseInt(req.body.followers, 10) || 0),
      ),
      profileUrl,
      handle: text(req.body.handle, 120),
      platform: text(req.body.platform, 80),
      mobile: text(req.body.mobile, 40),
      outlet: text(req.body.outlet, 160),
      role: text(req.body.role, 160),
      allProfiles: text(req.body.allProfiles, 2000),
      sourceTrack: track,
      submitted: new Date().toISOString().slice(0, 10),
      status: "pending",
    };
    if (sql) {
      await sql`INSERT INTO applications (id, name, email, track, city, detail, followers, profile_url, handle, platform, mobile, outlet, application_role, all_profiles, source_track, password_hash, submitted, status) VALUES (${application.id}, ${name}, ${email}, ${track}, ${city}, ${application.detail}, ${application.followers}, ${application.profileUrl}, ${application.handle}, ${application.platform}, ${application.mobile}, ${application.outlet}, ${application.role}, ${application.allProfiles}, ${track}, ${passwordHash}, CURRENT_DATE, 'pending')`;
    } else {
      application.passwordHash = passwordHash;
      demo.applications.unshift(application);
    }
    res
      .status(201)
      .json({
        ok: true,
        status: "pending",
        message: "Your application was submitted for admin review.",
      });
  } catch (error) {
    next(error);
  }
});
app.use("/api", async (req, res, next) => {
  if (req.path === "/health" || req.path.startsWith("/auth/")) return next();
  try {
    const admin = await currentAdmin(req);
    if (!admin)
      return res
        .status(401)
        .json({ error: "Your admin session has ended. Sign in again." });
    req.admin = admin;
    next();
  } catch (error) {
    next(error);
  }
});
app.get("/api/dashboard", async (_req, res, next) => {
  try {
    if (sql) {
      const [counts] = await sql`
        SELECT
          (SELECT COUNT(*)::int FROM applications WHERE status = 'pending') AS "pendingApplications",
          (SELECT COUNT(*)::int FROM members) AS members,
          (SELECT COALESCE(SUM(confirmed), 0)::int FROM events WHERE status = 'published') AS "weeklyRsvps",
          (SELECT COUNT(*)::int FROM guests WHERE checked_in_at IS NOT NULL) AS "checkedIn",
          (SELECT COUNT(*)::int FROM guests) AS expected,
          (SELECT COUNT(*)::int FROM events WHERE status = 'pending') AS "pendingEvents",
          (SELECT COUNT(*)::int FROM wall_posts WHERE status = 'pending') AS "pendingPosts",
          (SELECT COUNT(*)::int FROM clients WHERE credits < 10) AS "lowCreditClients"
      `;
      return res.json(counts);
    }
    const [applications, members, events, guests, clients, wall] =
      await Promise.all([
        getRows(tableFor.applications),
        getRows(tableFor.members),
        getRows(tableFor.events),
        getRows(tableFor.guests),
        getRows(tableFor.clients),
        getRows(tableFor.wall),
      ]);
    const live = events.filter((event) => event.status === "published");
    res.json({
      pendingApplications: applications.filter(
        (item) => item.status === "pending",
      ).length,
      members: members.length,
      weeklyRsvps: live.reduce(
        (sum, event) => sum + Number(event.confirmed || 0),
        0,
      ),
      checkedIn: guests.filter((guest) => guest.checkedInAt).length,
      expected: guests.length,
      pendingEvents: events.filter((event) => event.status === "pending")
        .length,
      pendingPosts: wall.filter((post) => post.status === "pending").length,
      lowCreditClients: clients.filter((client) => client.credits < 10).length,
    });
  } catch (error) {
    next(error);
  }
});
for (const [resource, table] of Object.entries(tableFor))
  app.get(
    `/api/${resource === "guests" ? "door/guests" : resource}`,
    async (_req, res, next) => {
      try {
        const rows = await getRows(table);
        if (table !== "guests") return res.json(rows);
        const invitations = sql
          ? await sql`SELECT id, guest_name AS name, 'Invited guest' AS track, event_id AS "eventId", plus_ones AS "plusOnes", checked_in_at AS "checkedInAt", status, TRUE AS "isInvitation" FROM guest_invitations ORDER BY created_at DESC`
          : demo.guestInvitations.map(({ tokenHash: _tokenHash, guestName, ...guest }) => ({ ...guest, name: guestName, track: "Invited guest", isInvitation: true }));
        res.json([...rows, ...invitations]);
      } catch (error) {
        next(error);
      }
    },
  );

app.get("/api/guest-invitations", async (req, res, next) => {
  try {
    const eventId = text(req.query.eventId, 180);
    if (!eventId) return res.status(400).json({ error: "Choose an event." });
    if (!sql)
      return res.json(
        demo.guestInvitations
          .filter((guest) => guest.eventId === eventId)
          .map(({ tokenHash: _tokenHash, ...guest }) => guest),
      );
    const rows =
      await sql`SELECT id, event_id AS "eventId", guest_name AS "guestName", email, phone, table_no AS "tableNo", status, plus_ones AS "plusOnes", to_char(checked_in_at AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD HH24:MI') AS "checkedInAt", created_at AS "createdAt" FROM guest_invitations WHERE event_id = ${eventId} ORDER BY created_at DESC`;
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/guest-invitations", async (req, res, next) => {
  try {
    const eventId = text(req.body.eventId, 180);
    const guestName = text(req.body.guestName, 120);
    const email = text(req.body.email, 254);
    const phone = text(req.body.phone, 40);
    const tableNo = text(req.body.tableNo, 40);
    if (guestName.length < 2)
      return res.status(400).json({ error: "Enter the guest's name." });
    if (!email && !phone)
      return res.status(400).json({ error: "Enter an email address or WhatsApp number." });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: "Enter a valid email address." });
    const event = sql
      ? (await sql`SELECT id, title, date::text AS date, time, venue, area FROM events WHERE id = ${eventId} LIMIT 1`)[0]
      : demo.events.find((item) => item.id === eventId);
    if (!event)
      return res.status(404).json({ error: "Choose an existing event." });
    const id = crypto.randomUUID();
    const token = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    if (sql)
      await sql`INSERT INTO guest_invitations (id, event_id, token_hash, guest_name, email, phone, table_no) VALUES (${id}, ${eventId}, ${tokenHash}, ${guestName}, ${email}, ${phone}, ${tableNo})`;
    else
      demo.guestInvitations.unshift({
        id,
        eventId,
        guestName,
        email,
        phone,
        tableNo,
        status: "pending",
        plusOnes: 0,
        checkedInAt: null,
        tokenHash,
      });
    const siteOrigin = String(
      process.env.PUBLIC_SITE_URL || "https://rsvpdxb.com",
    )
      .trim()
      .replace(/\/$/, "");
    const invitationUrl = `${siteOrigin}/rsvp/${token}`;
    const [emailDelivery, whatsappDelivery] = await Promise.all([
      sendInvitationEmail({ guestName, email, event, invitationUrl, tableNo }),
      sendInvitationWhatsApp({ guestName, phone, event, invitationUrl }),
    ]);
    res
      .status(201)
      .json({
        id,
        token,
        invitationUrl,
        delivery: { email: emailDelivery, whatsapp: whatsappDelivery },
      });
  } catch (error) {
    next(error);
  }
});

app.post("/api/door/guest-invitations/:id/check-in", async (req, res, next) => {
  try {
    let guest;
    let justCheckedIn = false;
    if (sql) {
      const updated =
        await sql`UPDATE guest_invitations SET checked_in_at = NOW() WHERE id = ${req.params.id} AND status = 'accepted' AND checked_in_at IS NULL RETURNING id, guest_name AS "guestName", plus_ones AS "plusOnes", checked_in_at AS "checkedInAt"`;
      guest = updated[0];
      justCheckedIn = Boolean(guest);
      if (!guest)
        guest = (
          await sql`SELECT guest_name AS "guestName", plus_ones AS "plusOnes", checked_in_at AS "checkedInAt", status FROM guest_invitations WHERE id = ${req.params.id} LIMIT 1`
        )[0];
    } else {
      guest = demo.guestInvitations.find((item) => item.id === req.params.id);
      if (guest?.status === "accepted" && !guest.checkedInAt) {
        guest.checkedInAt = new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        });
        justCheckedIn = true;
      }
    }
    if (!guest)
      return res.status(404).json({ error: "Guest invitation not found." });
    if (guest.status && guest.status !== "accepted")
      return res
        .status(409)
        .json({ error: "This guest has not accepted the invitation." });
    if (!justCheckedIn && guest.checkedInAt)
      return res
        .status(409)
        .json({ error: `${guest.guestName} is already checked in.` });
    res.json({
      ok: true,
      guestName: guest.guestName,
      plusOnes: Number(guest.plusOnes || 0),
      id: guest.id,
      checkedInAt: guest.checkedInAt,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/door/guest-pass", async (req, res, next) => {
  try {
    const code = String(req.body.code || "").trim();
    const eventId = text(req.body.eventId, 180);
    let token = code;
    try {
      const parsed = new URL(code);
      token =
        parsed.pathname.match(/^\/rsvp\/([A-Za-z0-9_-]{32,100})\/?$/)?.[1] ||
        "";
    } catch {
      token = code.match(/^\/?rsvp\/([A-Za-z0-9_-]{32,100})\/?$/)?.[1] || code;
    }
    if (!/^[A-Za-z0-9_-]{32,100}$/.test(token))
      return res.status(404).json({ error: "Guest pass not found." });
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const guest = sql
      ? (
          await sql`SELECT id, guest_name AS "guestName" FROM guest_invitations WHERE token_hash = ${tokenHash} AND (${eventId} = '' OR event_id = ${eventId}) LIMIT 1`
        )[0]
      : demo.guestInvitations.find((item) => item.tokenHash === tokenHash && (!eventId || item.eventId === eventId));
    if (!guest) return res.status(404).json({ error: "Guest pass not found." });
    const rows = sql
      ? await sql`UPDATE guest_invitations SET checked_in_at = NOW() WHERE id = ${guest.id} AND status = 'accepted' AND checked_in_at IS NULL RETURNING id, guest_name AS "guestName", plus_ones AS "plusOnes", checked_in_at AS "checkedInAt"`
      : (() => {
          if (guest.status !== "accepted") return [];
          if (guest.checkedInAt)
            return [{ already: true, guestName: guest.guestName }];
          guest.checkedInAt = new Date().toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          });
          return [{ id: guest.id, guestName: guest.guestName, plusOnes: guest.plusOnes, checkedInAt: guest.checkedInAt }];
        })();
    if (rows[0]?.already)
      return res
        .status(409)
        .json({ error: `${rows[0].guestName} is already checked in.` });
    if (!rows[0]) {
      const current = sql
        ? (
            await sql`SELECT status, checked_in_at AS "checkedInAt", guest_name AS "guestName" FROM guest_invitations WHERE id = ${guest.id}`
          )[0]
        : guest;
      if (current?.status !== "accepted")
        return res
          .status(409)
          .json({ error: "This guest has not accepted the invitation." });
      if (current?.checkedInAt)
        return res
          .status(409)
          .json({ error: `${current.guestName} is already checked in.` });
      return res
        .status(409)
        .json({
          error: "Guest check-in could not be completed. Please retry.",
        });
    }
    res.json({
      ok: true,
      id: rows[0].id || guest.id,
      guestName: rows[0].guestName,
      plusOnes: Number(rows[0].plusOnes || 0),
      checkedInAt: rows[0].checkedInAt || new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    });
  } catch (error) {
    next(error);
  }
});

app.patch("/api/applications/:id", async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["approved", "rejected"].includes(status))
      return res.status(400).json({ error: "Choose approved or rejected." });
    if (!sql) {
      const item = demo.applications.find((row) => row.id === req.params.id);
      if (!item)
        return res.status(404).json({ error: "Application not found." });
      item.status = status;
      if (
        status === "approved" &&
        !demo.members.some((member) => member.email === item.email)
      )
        demo.members.unshift({
          id: `m-${item.id}`,
          name: item.name,
          email: item.email,
          track: item.track,
          sourceTrack: item.sourceTrack || item.track,
          rank: "Bronze",
          points: 10,
          events: 0,
          city: item.city,
          profileUrl: item.profileUrl || "",
          handle: item.handle || "",
          platform: item.platform || "",
          followers: Number(item.followers) || 0,
          mobile: item.mobile || "",
          outlet: item.outlet || "",
          role: item.role || "",
          allProfiles: item.allProfiles || "",
          status: "approved",
          joined: item.submitted,
          passwordHash: item.passwordHash,
        });
      const { passwordHash: _passwordHash, ...safeItem } = item;
      return res.json(safeItem);
    }
    const rows =
      await sql`UPDATE applications SET status = ${status}, updated_at = NOW() WHERE id = ${req.params.id} RETURNING id, name, email, track, city, detail, followers, profile_url, handle, platform, mobile, outlet, application_role, all_profiles, source_track, password_hash, submitted, status`;
    const item = rows[0];
    if (!item) return res.status(404).json({ error: "Application not found." });
    if (status === "approved")
      await sql`INSERT INTO members (name, email, track, source_track, rank, points, events, city, profile_url, handle, platform, followers, mobile, outlet, member_role, all_profiles, status, joined, password_hash) VALUES (${item.name}, ${item.email}, ${item.track}, ${item.source_track || item.track}, 'Bronze', 10, 0, ${item.city}, ${item.profile_url || ""}, ${item.handle || ""}, ${item.platform || ""}, ${Number.parseInt(item.followers, 10) || 0}, ${item.mobile || ""}, ${item.outlet || ""}, ${item.application_role || ""}, ${item.all_profiles || ""}, 'approved', ${item.submitted}, ${item.password_hash}) ON CONFLICT (email) DO NOTHING`;
    const { password_hash: _passwordHash, ...safeItem } = item;
    res.json(safeItem);
  } catch (error) {
    next(error);
  }
});

app.post("/api/events", async (req, res, next) => {
  try {
    const title = text(req.body.title, 180);
    const brand = text(req.body.brand, 180);
    const venue = text(req.body.venue, 240);
    const area = text(req.body.area, 120);
    const date = text(req.body.date, 10);
    const time = text(req.body.time, 40);
    const category = text(req.body.category, 80) || "Dining";
    const capacity = Number(req.body.capacity || 80);
    const ticketPrice = Number(req.body.ticketPrice || 0);
    const ticketCurrency = text(req.body.ticketCurrency, 3).toUpperCase() || "AED";
    const status = String(req.body.status || "draft");
    const allowedTracks = [
      "Media",
      "Creators",
      "Tastemakers",
      "Private Circle",
    ];
    const tracks = Array.isArray(req.body.tracks)
      ? [
          ...new Set(
            req.body.tracks
              .map((item) => text(item, 40))
              .filter((item) => allowedTracks.includes(item)),
          ),
        ]
      : [];
    const dressCode = text(req.body.dressCode, 180);
    const about = text(req.body.about, 5000);
    const included = Array.isArray(req.body.included)
      ? req.body.included
          .map((item) => text(item, 300))
          .filter(Boolean)
          .slice(0, 30)
      : [];
    const whoIsInvited = text(req.body.whoIsInvited, 1500);
    const hostNote = text(req.body.hostNote, 1500);
    const imageDataList = Array.isArray(req.body.imageDataList)
      ? req.body.imageDataList.map((value) => String(value || ""))
      : req.body.imageData ? [String(req.body.imageData)] : [];
    const imageData = imageDataList[0] || "";
    if (!title || !brand || !/^\d{4}-\d{2}-\d{2}$/.test(date))
      return res
        .status(400)
        .json({ error: "Event title, brand and a valid date are required." });
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100000)
      return res
        .status(400)
        .json({ error: "Enter a guest capacity above zero." });
    if (!Number.isFinite(ticketPrice) || ticketPrice < 0 || !/^[A-Z]{3}$/.test(ticketCurrency))
      return res.status(400).json({ error: "Enter a valid ticket price and three-letter currency." });
    if (!["draft", "published", "pending", "closed"].includes(status))
      return res.status(400).json({ error: "Invalid event status." });
    if (
      imageDataList.length > 5 ||
      imageDataList.some((image) => !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(image)) ||
      imageDataList.reduce((total, image) => total + image.length, 0) > 2_100_000
    )
      return res
        .status(400)
        .json({ error: "Use up to 5 JPG, PNG or WebP images, 1.5 MB total." });
    const id = `event-${crypto.randomUUID()}`;
    const event = {
      id,
      title,
      brand,
      venue,
      area,
      date,
      time,
      capacity,
      confirmed: 0,
      ticketPrice,
      ticketCurrency,
      category,
      tracks,
      dressCode,
      about,
      included,
      whoIsInvited,
      hostNote,
      imageData,
      imageDataList,
      status,
    };
    if (!sql) demo.events.unshift(event);
    else
      await sql`INSERT INTO events (id, title, brand, venue, date, time, area, capacity, confirmed, ticket_price, ticket_currency, category, tracks, dress_code, about, included, who_is_invited, host_note, image_data, image_gallery, status) VALUES (${id}, ${title}, ${brand}, ${venue}, ${date}, ${time}, ${area}, ${capacity}, 0, ${ticketPrice}, ${ticketCurrency}, ${category}, ${tracks}, ${dressCode}, ${about}, ${included}, ${whoIsInvited}, ${hostNote}, ${imageData}, ${imageDataList}, ${status})`;
    res.status(201).json(event);
  } catch (error) {
    next(error);
  }
});
app.patch("/api/events/:id", async (req, res, next) => {
  try {
    const { status } = req.body;
    const hasPriceUpdate = Object.hasOwn(req.body, "ticketPrice") || Object.hasOwn(req.body, "ticketCurrency");
    if (hasPriceUpdate) {
      const ticketPrice = Number(req.body.ticketPrice);
      const ticketCurrency = String(req.body.ticketCurrency || "AED").toUpperCase();
      if (!Number.isFinite(ticketPrice) || ticketPrice < 0 || !/^[A-Z]{3}$/.test(ticketCurrency))
        return res.status(400).json({ error: "Enter a valid non-negative ticket price and 3-letter currency." });
      if (!sql) {
        const item = demo.events.find((row) => row.id === req.params.id);
        if (!item) return res.status(404).json({ error: "Event not found." });
        item.ticketPrice = ticketPrice;
        item.ticketCurrency = ticketCurrency;
        return res.json(item);
      }
      const rows = await sql`UPDATE events SET ticket_price = ${ticketPrice}, ticket_currency = ${ticketCurrency}, updated_at = NOW() WHERE id = ${req.params.id} RETURNING *`;
      if (!rows[0]) return res.status(404).json({ error: "Event not found." });
      return res.json(rows[0]);
    }
    if (!["published", "closed", "pending", "draft"].includes(status))
      return res.status(400).json({ error: "Invalid event status." });
    if (!sql) {
      const item = demo.events.find((row) => row.id === req.params.id);
      if (!item) return res.status(404).json({ error: "Event not found." });
      item.status = status;
      return res.json(item);
    }
    const rows =
      await sql`UPDATE events SET status = ${status}, updated_at = NOW() WHERE id = ${req.params.id} RETURNING *`;
    if (!rows[0]) return res.status(404).json({ error: "Event not found." });
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.patch("/api/wall/:id", async (req, res, next) => {
  try {
    const { action } = req.body;
    if (!["approve", "boost", "remove"].includes(action))
      return res
        .status(400)
        .json({ error: "Choose approve, boost or remove." });
    if (!sql) {
      const index = demo.wall.findIndex((row) => row.id === req.params.id);
      if (index < 0) return res.status(404).json({ error: "Post not found." });
      if (action === "remove") demo.wall.splice(index, 1);
      else if (action === "approve")
        demo.wall[index] = {
          ...demo.wall[index],
          status: "live",
          posted: "Just now",
        };
      else demo.wall[index].boosted = !demo.wall[index].boosted;
      return res.json({ ok: true });
    }
    if (action === "remove")
      await sql`DELETE FROM wall_posts WHERE id = ${req.params.id}`;
    if (action === "approve")
      await sql`UPDATE wall_posts SET status = 'live', posted = 'Just now', updated_at = NOW() WHERE id = ${req.params.id}`;
    if (action === "boost")
      await sql`UPDATE wall_posts SET boosted = NOT boosted, updated_at = NOW() WHERE id = ${req.params.id}`;
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.post("/api/clients/:id/credits", async (req, res, next) => {
  try {
    const amount = Number(req.body.amount);
    if (!Number.isInteger(amount) || amount <= 0 || amount > 10000)
      return res.status(400).json({ error: "Enter a valid credit amount." });
    if (!sql) {
      const item = demo.clients.find((row) => row.id === req.params.id);
      if (!item) return res.status(404).json({ error: "Client not found." });
      item.credits += amount;
      return res.json(item);
    }
    const rows =
      await sql`UPDATE clients SET credits = credits + ${amount}, updated_at = NOW() WHERE id = ${req.params.id} RETURNING *`;
    if (!rows[0]) return res.status(404).json({ error: "Client not found." });
    res.json(rows[0]);
  } catch (error) {
    next(error);
  }
});

app.post("/api/door/scan", async (req, res, next) => {
  try {
    const code = String(req.body.code || "")
      .trim()
      .toUpperCase();
    if (!code) return res.status(400).json({ error: "Enter an RSVP code." });
    const eventId = text(req.body.eventId, 180);
    if (/^[A-F0-9]{48}$/.test(code) && sql) {
      const checkedIn = await sql`UPDATE ticket_requests SET checked_in_at = NOW() WHERE upper(ticket_token) = ${code} AND status IN ('approved', 'paid') AND checked_in_at IS NULL AND (${eventId} = '' OR event_id = ${eventId}) RETURNING id, guest_name AS "guestName", checked_in_at AS "checkedInAt"`;
      if (checkedIn[0]) {
        const name = checkedIn[0].guestName || "WhatsApp guest";
        return res.json({ tone: "green", title: `Welcome ${name.split(" ")[0]}`, detail: "Ticket validated · entry recorded" });
      }
      const existingTicket = (await sql`SELECT guest_name AS "guestName", checked_in_at AS "checkedInAt", status FROM ticket_requests WHERE upper(ticket_token) = ${code} AND (${eventId} = '' OR event_id = ${eventId}) LIMIT 1`)[0];
      if (existingTicket?.checkedInAt) return res.json({ tone: "amber", title: "Already scanned", detail: `${existingTicket.guestName || "Guest"} has already checked in.` });
      if (existingTicket && !["approved", "paid"].includes(existingTicket.status)) return res.json({ tone: "red", title: "Ticket not valid", detail: "This ticket has not been approved or paid." });
      if (existingTicket) return res.json({ tone: "red", title: "Wrong event", detail: "This ticket belongs to a different event." });
      const ticketForAnotherEvent = eventId ? (await sql`SELECT id FROM ticket_requests WHERE upper(ticket_token) = ${code} LIMIT 1`)[0] : null;
      if (ticketForAnotherEvent) return res.json({ tone: "red", title: "Wrong event", detail: "This ticket belongs to a different event." });
    }
    let guest;
    let justCheckedIn = false;
    if (!sql)
      guest = demo.guests.find((row) => row.code.toUpperCase() === code);
    else {
      const checkedInAt = now();
      const updated =
        await sql`UPDATE guests SET checked_in_at = ${checkedInAt} WHERE upper(code) = ${code} AND checked_in_at IS NULL RETURNING id, name, track, plus_ones AS "plusOnes", checked_in_at AS "checkedInAt"`;
      guest = updated[0];
      justCheckedIn = Boolean(guest);
      if (!guest) {
        const existing =
          await sql`SELECT id, name, track, plus_ones AS "plusOnes", checked_in_at AS "checkedInAt" FROM guests WHERE upper(code) = ${code} LIMIT 1`;
        guest = existing[0];
      }
    }
    if (!guest)
      return res.json({
        tone: "red",
        title: "Not on list",
        detail: `No guest found for ${code}`,
      });
    if (guest.checkedInAt && !justCheckedIn)
      return res.json({
        tone: "amber",
        title: "Already scanned",
        detail: `${guest.name} checked in at ${guest.checkedInAt}`,
      });
    if (!sql) guest.checkedInAt = now();
    res.json({
      tone: "green",
      title: `Welcome ${guest.name.split(" ")[0]}`,
      detail: `Entry for ${Number(guest.plusOnes) + 1} · ${guest.track} · +20 points`,
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/door/walk-ins", async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    if (!name)
      return res.status(400).json({ error: "Guest name is required." });
    const guest = {
      id: `walkin-${crypto.randomUUID()}`,
      name,
      track: "Walk-in",
      eventId: req.body.eventId || null,
      plusOnes: Math.max(0, Number(req.body.plusOnes || 1) - 1),
      code: `WALK-${crypto.randomUUID().slice(0, 6).toUpperCase()}`,
      checkedInAt: null,
      status: "pending_review",
    };
    if (!sql) demo.guests.unshift(guest);
    else
      await sql`INSERT INTO guests (id, name, track, event_id, plus_ones, code, status) VALUES (${guest.id}, ${name}, 'Walk-in', ${guest.eventId}, ${guest.plusOnes}, ${guest.code}, 'pending_review')`;
    res.status(201).json(guest);
  } catch (error) {
    next(error);
  }
});

app.get("/api/*path", (_req, res) =>
  res.status(404).json({ error: "API route not found." }),
);
app.use((error, _req, res, _next) => {
  console.error(error);
  const missingSchema = error.message?.includes("does not exist");
  const hasCauseCode = (candidate, codes) => {
    for (let current = candidate; current; current = current.cause) {
      if (codes.has(current.code)) return true;
    }
    return false;
  };
  const databaseUnavailable =
    error.message?.includes("fetch failed") ||
    hasCauseCode(
      error,
      new Set(["UND_ERR_CONNECT_TIMEOUT", "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT"]),
    );
  res
    .status(databaseUnavailable ? 503 : 500)
    .json({
      error: missingSchema
        ? "Neon tables are not set up yet. Run npm run db:setup after adding DATABASE_URL."
        : databaseUnavailable
          ? "The database is temporarily unreachable. Check your network or proxy connection, then try again."
          : "Something went wrong while loading this data.",
    });
});

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
if (process.env.NODE_ENV === "production" && !sql)
  throw new Error(
    "DATABASE_URL must be configured before starting the admin portal in production.",
  );
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(root, "dist")));
  app.get("*path", (_req, res) =>
    res.sendFile(path.join(root, "dist", "index.html")),
  );
}

app.listen(port, "0.0.0.0", () =>
  console.log(
    `RSVP DXB API listening on port ${port}${sql ? " · Neon connected" : " · demo data mode"}`,
  ),
);
