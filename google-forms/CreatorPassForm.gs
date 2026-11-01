// Paste this file into a new Google Apps Script project and fill in the config.
const CREATOR_PASS_FORM_CONFIG = {
  formTitle: "RSVP DXB Creator Pass Request",
  eventId: "REPLACE_WITH_EVENT_ID",
  webhookUrl: "https://REPLACE_WITH_ADMIN_HOST/api/integrations/google-forms/creator-pass",
  webhookSecret: "REPLACE_WITH_THE_SAME_32_PLUS_CHARACTER_SECRET_AS_GOOGLE_FORM_WEBHOOK_SECRET",
};

function createCreatorPassForm() {
  const config = CREATOR_PASS_FORM_CONFIG;
  if (config.eventId.startsWith("REPLACE_") || config.webhookUrl.includes("REPLACE_") || config.webhookSecret.includes("REPLACE_") || config.webhookSecret.length < 32) {
    throw new Error("Fill in eventId, webhookUrl, and webhookSecret before running this function.");
  }

  const form = FormApp.create(config.formTitle);
  form.setDescription("Request a creator pass for this RSVP DXB event. Submitting a request does not guarantee a place. The team reviews each profile and will follow up.");
  form.setConfirmationMessage("Thank you. Your creator pass request has been sent to the RSVP DXB team for review.");
  form.setAcceptingResponses(true);
  form.addTextItem().setTitle("Full name").setRequired(true);
  form.addTextItem().setTitle("Email address (optional)").setRequired(false);
  form.addTextItem().setTitle("WhatsApp phone number with country code").setHelpText("Example: +971501234567").setRequired(true);
  form.addTextItem().setTitle("Instagram or creator profile link (optional)").setRequired(false);
  form.addParagraphTextItem().setTitle("Why would you like to attend? (optional)").setRequired(false);

  const responseSheet = SpreadsheetApp.create(`${config.formTitle} responses`);
  form.setDestination(FormApp.DestinationType.SPREADSHEET, responseSheet.getId());
  PropertiesService.getScriptProperties().setProperties({
    CREATOR_PASS_FORM_ID: form.getId(),
    CREATOR_PASS_EVENT_ID: config.eventId,
    CREATOR_PASS_WEBHOOK_URL: config.webhookUrl,
    CREATOR_PASS_WEBHOOK_SECRET: config.webhookSecret,
  });
  ScriptApp.newTrigger("forwardCreatorPassRequest").forForm(form).onFormSubmit().create();

  console.log(`Guest form: ${form.getPublishedUrl()}`);
  console.log(`Form editor: ${form.getEditUrl()}`);
  console.log(`Response sheet: ${responseSheet.getUrl()}`);
}

function forwardCreatorPassRequest(event) {
  const properties = PropertiesService.getScriptProperties();
  const answers = Object.fromEntries(event.response.getItemResponses().map((itemResponse) => [
    itemResponse.getItem().getTitle(),
    String(itemResponse.getResponse() || "").trim(),
  ]));
  const response = UrlFetchApp.fetch(properties.getProperty("CREATOR_PASS_WEBHOOK_URL"), {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${properties.getProperty("CREATOR_PASS_WEBHOOK_SECRET")}` },
    payload: JSON.stringify({
      eventId: properties.getProperty("CREATOR_PASS_EVENT_ID"),
      name: answers["Full name"] || "",
      email: answers["Email address (optional)"] || "",
      phone: answers["WhatsApp phone number with country code"] || "",
    }),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(`RSVP DXB request sync failed (${response.getResponseCode()}): ${response.getContentText()}`);
  }
}
