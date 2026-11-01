# Creator pass Google Form

`CreatorPassForm.gs` connects the client's existing Google Form and forwards each submission into the RSVP DXB admin creator pass queue. It does not create or modify the form or its questions.

## One-time setup

1. Set `GOOGLE_FORM_WEBHOOK_SECRET` in the admin server runtime configuration (AWS SSM parameter `/rsvp/prod/admin-env`) to a random secret of at least 32 characters, then redeploy/restart the admin server. Never commit the secret.
2. Open the existing form (`formId` is already set below) with an account that can edit it. In Extensions > Apps Script, paste in `CreatorPassForm.gs`.
3. Replace `webhookSecret` with the exact secret configured in step 1.
4. Run `connectExistingCreatorPassForm` and authorize Google Forms and external-request permissions. This adds a required event dropdown populated from all published events accepting creator passes, installs the submit trigger, and refreshes the event list every six hours.
5. Run `syncExistingCreatorPassResponses` once to import responses Google already recorded. Responses submitted before the event dropdown existed use the PATAAKHA legacy event ID; new submissions use the event selected in the form. Pending duplicate phone numbers are ignored.
6. The form asks for name and mobile number; the script maps those fields. Submissions missing a name or valid phone are rejected by the admin integration.

The account installing the trigger must have edit access to the client's form. If the connected account cannot access it, the form owner must install and authorize the script. A submitted form request enters the admin queue as **Pending**; submission itself does not accept a guest. Until these one-time Google and AWS configuration steps are completed, Google Forms responses will not appear in the admin queue.
