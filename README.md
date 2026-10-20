# RSVP DXB Admin

Admin only dashboard for applications, members, events, guest invitations, wall moderation, brand credits, and event door check-in.

## Stack

- React and Vite frontend
- Node.js and Express API
- Neon Postgres persistence through `@neondatabase/serverless`

The server starts with local demonstration data when `DATABASE_URL` is not set. That mode is useful for exploring the dashboard; changes reset when the server restarts. The local demo account is `tejas@rsvpdxb.local` with password `demo1234`.

To use Neon, copy `.env.example` to `.env`, set `DATABASE_URL` and the single admin name, email, and private password, then run the database setup command once. Use a password of at least 12 characters:

```powershell
Copy-Item .env.example .env
npm install
npm run db:setup
npm run dev
```

The development client runs on Vite and proxies `/api` requests to the Express server on port 4000. Production serves the built frontend from Express:

```powershell
npm run build
$env:NODE_ENV = 'production'
npm start
```

Neon setup creates the tables, inserts the prototype demonstration records if those IDs are not already present, and provisions both configured administrators. Admin sessions use an HTTP-only cookie and can be ended from the profile menu; “Switch admin” signs out and returns to the sign-in screen so the second administrator can sign in. Keep `.env` private.

## Guest invitations

Use **Programme → Invitations** to create an event invitation, copy its private RSVP link, review responses, export the guest list, or check in an accepted guest. Set `PUBLIC_SITE_URL` to the customer site's origin so invitation links point to the correct host. The customer React app serves `/rsvp/:token`; admin APIs stay in this authenticated dashboard. `db:setup` creates the `guest_invitations` table in the shared Neon database. Door staff can paste the QR contents / RSVP link into the invitation check-in field or check in an accepted guest from the list.

Creating an invitation submits an email through Amazon SES and a WhatsApp template message through Meta Cloud API when those providers are configured. For SES, set `AWS_REGION`, `SES_FROM_EMAIL`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` in the private `.env` for local development. The AWS identity needs permission to call `ses:SendEmail`; on AWS hosting, use an attached IAM role instead of static keys. Verify the sender identity/domain in SES and move the account out of the SES sandbox to send to unverified guest addresses. For WhatsApp, set the access token, phone-number ID, Graph API version, approved template name, and template language. The approved template must have four body parameters in this order: guest name, event title, event details, and private RSVP link. A matching template body could read: `Hi {{1}}, you're invited to {{2}}. Event details: {{3}}. RSVP here: {{4}}`. Phone numbers may be entered in international format; UAE local numbers beginning with `0` are normalized to `971`.

Provider acceptance does not guarantee inbox delivery or WhatsApp delivery. The invitation result reports each channel separately. If a provider is not configured or rejects a request, the page offers an email draft or WhatsApp link for manual sending. Keep provider secrets in the private `.env` file and never commit them.

## Infobip ticket request chatbot

The customer event cards open a WhatsApp chat with a prefilled event request. Set `VITE_RSVP_WHATSAPP_NUMBER` in the customer app's build environment to your Infobip sender number in international digits. The Express webhook at `/api/whatsapp/infobip/webhook` lists published future events and creates a Stripe Checkout link for the selected paid event. Set `INFOBIP_BASE_URL`, `INFOBIP_API_KEY`, `INFOBIP_WHATSAPP_SENDER`, and `INFOBIP_WEBHOOK_SECRET`. Configure the Infobip inbound-message webhook to POST to `https://YOUR-RENDER-HOST/api/whatsapp/infobip/webhook` with `Authorization: Bearer YOUR_INFOBIP_WEBHOOK_SECRET`.

For paid ticket checkout, set `STRIPE_SECRET_KEY` to your Stripe test secret (`sk_test_...`) while testing. In Stripe Dashboard, create a webhook endpoint at `https://rsvp-cytl.onrender.com/api/payments/stripe/webhook` and subscribe to `checkout.session.completed` and `checkout.session.async_payment_succeeded`; set `STRIPE_WEBHOOK_SECRET` to the endpoint's signing secret (`whsec_...`). Keep both values private. Set each event's ticket price and currency in the admin event record; free events remain confirmation-only. After payment, the webhook issues a token-protected PDF at `/api/tickets/:token.pdf` and sends it to the buyer's WhatsApp. Infobip document delivery requires a publicly reachable HTTPS file URL and may be limited by WhatsApp's 24-hour customer service window. Run `npm run db:setup` with the same `DATABASE_URL` after this schema change, then deploy the API. Test with Stripe test mode before switching to live keys.

Staging Render services shown for this setup are the API/dashboard at `https://rsvp-cytl.onrender.com` and customer app at `https://rsvp-dxb-customer.onrender.com`. In the existing `RSVP` service settings, set the variables from this project's `.env.example`, including `CLIENT_ORIGIN` and `PUBLIC_SITE_URL` pointing to the customer service. Apply the database schema once with `npm run db:setup` from this project using the same `DATABASE_URL`. In the existing `RSVP-DXB_customer` service, set `VITE_RSVP_WHATSAPP_NUMBER` to the Infobip sender's international phone number (digits only), then redeploy so Vite embeds it in the site. Configure the Infobip inbound webhook to use the API URL above.

The Render breadcrumb in the supplied screenshot says `Production`; `APP_ENV=staging` is only an app label and does not create an isolated Render staging environment. These free services can be used for testing, but they are the services currently marked Production in Render.

## Existing members and new registrations

The member application page is available at `/register`. It saves submissions in `applications` as pending review. Passwords are stored as scrypt hashes, never as plaintext. Approving an application creates the member directory row and transfers the password hash. Customer login is not part of this admin dashboard yet.

Import the existing member export after setting up the database:

```powershell
npm run db:import-members -- "C:\Users\Tejas\Downloads\rsvp-applications-2026-10-02.csv"
```

The importer maps `influencer` to Creators, `media` to Media, `tastemaker` to Tastemakers, and `brand` to Private Circle while retaining the original track value. It upserts by email and preserves the CSV profile, platform, follower, contact, tier, points, status, city, and joined fields. To validate a file without writing to Neon, run `node server/import-members.js --dry-run "path-to-file.csv"`.
