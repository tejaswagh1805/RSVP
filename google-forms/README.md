# Creator pass Google Form

`CreatorPassForm.gs` connects the client's existing Google Form and forwards each submission into the RSVP DXB admin creator pass queue. It does not create or modify the form or its questions.

## One-time setup

1. Set `GOOGLE_FORM_WEBHOOK_SECRET` in the admin server environment to a random secret of at least 32 characters, then restart/redeploy the admin server.
2. Open the client's Google Form with an account that can edit it. Open its Apps Script project (Extensions > Apps Script) and paste in `CreatorPassForm.gs`.
3. Keep the supplied `formId`. Set `eventId` to the event ID from `/events/<event-id>` in the customer site. Set `webhookUrl` to the deployed admin host plus `/api/integrations/google-forms/creator-pass`. Set `webhookSecret` to the same value as the server environment variable.
4. Run `connectExistingCreatorPassForm` and authorize Google Forms and external-request permissions. This installs a submit trigger on the existing form.
5. Set `VITE_CREATOR_PASS_GOOGLE_FORM_URL` in the customer site's build/deployment environment to `https://docs.google.com/forms/d/1VvAsWM2fEU_4NILdJvtKy0D4cPkzTRbG9ODfe7bTwcM/viewform` and rebuild/redeploy the customer site. The event page shows an **Open Google Form** option alongside the built-in form.
6. Confirm the form asks for the applicant's name and phone/WhatsApp number. The script maps common question labels. Submissions missing a name or valid phone are rejected by the admin integration.

The account installing the trigger must have edit access to the client's form. If the connected account cannot access it, the form owner must install and authorize the script. A submitted form request enters the admin queue as **Pending**; submission itself does not accept a guest.
