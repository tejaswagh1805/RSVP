# Creator pass Google Form

`CreatorPassForm.gs` creates a Google Form and linked response spreadsheet, then forwards each response into the RSVP DXB admin creator pass queue.

## One-time setup

1. Set `GOOGLE_FORM_WEBHOOK_SECRET` in the admin server environment to a random secret of at least 32 characters, then restart/redeploy the admin server.
2. In Google Apps Script, create a project and paste in `CreatorPassForm.gs`.
3. Set `eventId` to the event ID from `/events/<event-id>` in the customer site. Set `webhookUrl` to the deployed admin host plus `/api/integrations/google-forms/creator-pass`. Set `webhookSecret` to the same value as the server environment variable.
4. Run `createCreatorPassForm` and grant the requested Google Forms, Sheets, trigger, and external-request permissions.
5. Copy the logged guest form URL and share it with creators. Responses appear in that event's **Review RSVPs → Creator pass requests** panel and in the linked spreadsheet.
6. Set `VITE_CREATOR_PASS_GOOGLE_FORM_URL` in the customer site's build/deployment environment to the guest form URL and rebuild/redeploy the customer site. The event page will then show an **Open Google Form** option alongside the built-in form.

Create one form per event so the event ID stays fixed in the script and guests cannot accidentally submit against the wrong event. A submitted form request enters the admin queue as **Pending**; Google Form submission itself does not accept a guest.
