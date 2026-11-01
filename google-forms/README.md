# Creator pass requests

Creator pass requests now use the RSVP DXB customer site directly. The request button opens the selected event page and its event-specific form; no Google Form URL or Apps Script sync is required for new requests.

The form collects name, email, WhatsApp number, Instagram handle, Instagram follower count, and address. Requests are stored in `event_ticket_inquiries` with the selected `event_id` and `request_type = 'creator_pass'`. Admins review them from the event's RSVP review panel and can accept, waitlist, or decline.

The former Google Form integration script is retained for historical Google responses and legacy use. New website submissions do not pass through Google Forms.

Deploy both the customer site and admin dashboard after applying migration `0026_creator_pass_applicant_details.sql` (the admin migration runner also includes this schema update). Then submit a creator pass request for each event and confirm it appears in that event's admin review panel.

# New account applications and event enquiries

`PublicIntakeForms.gs` creates two Google Forms in the Google account where the script is run:

- **RSVP DXB — New Member Application**: collects a profile, track, and optional event interests. It does not ask for a password. A response creates a pending row in `applications`; selecting events also creates `event_interest` rows in `event_ticket_inquiries`.
- **RSVP DXB — Event Interest & Enquiry**: collects contact details and selected published events. Each event is added to its event's RSVP review panel under **Google Form event enquiries**.

The intake endpoint rejects duplicate submissions by Google response ID. Before creating an application, it checks both `members` and `applications`; an existing account or pending application is not created or changed. Existing members continue to sign in normally. Admin approval creates a new member and emails a one-time password setup link (valid for 30 minutes) to Google Form applicants.

## Connect and publish the forms

1. Deploy the admin code and run `npm run db:migrate` from `RSVP_admin_dashboard` against the shared database. This applies `005_google_form_event_interest.sql`.
2. Create a standalone Apps Script project at [script.google.com](https://script.google.com), add the contents of `PublicIntakeForms.gs`, and save it.
3. In **Project Settings → Script Properties**, add `GOOGLE_FORM_WEBHOOK_SECRET` with the same 32+ character value configured for the admin service in AWS SSM at `/rsvp/prod/admin-env`. Do not paste the secret in chat or commit it to source control.
4. In the Apps Script function selector, choose `createRsvpDxbPublicIntakeForms` and click **Run**. Approve the Google Forms, external request, and email permissions. The execution log prints both edit links and public response links.
5. Add the two public response URLs as repository **Actions variables** named `VITE_RSVP_NEW_MEMBER_FORM_URL` and `VITE_RSVP_EVENT_INTEREST_FORM_URL`, then deploy the customer site. The register page will direct new applicants to the account form; event pages will show **Ask about this event**.
6. When new events are published, run `refreshRsvpDxbPublicIntakeEventChoices` in Apps Script so they appear in both forms.

The deployed webhook secret must be present before the Apps Script trigger can sync. The Forms are created in the Google account that runs the script; this repository cannot create or publish them directly in a user's Google account.
