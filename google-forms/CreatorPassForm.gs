// Paste this file into a new Google Apps Script project and fill in the config.
const CREATOR_PASS_FORM_CONFIG = {
  // Use the client's existing Google Form; do not create a replacement.
  formId: "1VvAsWM2fEU_4NILdJvtKy0D4cPkzTRbG9ODfe7bTwcM",
  eventId: "REPLACE_WITH_EVENT_ID",
  webhookUrl: "https://REPLACE_WITH_ADMIN_HOST/api/integrations/google-forms/creator-pass",
  webhookSecret: "REPLACE_WITH_THE_SAME_32_PLUS_CHARACTER_SECRET_AS_GOOGLE_FORM_WEBHOOK_SECRET",
};

function connectExistingCreatorPassForm() {
  const config = CREATOR_PASS_FORM_CONFIG;
  if (config.formId.startsWith("REPLACE_") || config.eventId.startsWith("REPLACE_") || config.webhookUrl.includes("REPLACE_") || config.webhookSecret.includes("REPLACE_") || config.webhookSecret.length < 32) {
    throw new Error("Fill in formId, eventId, webhookUrl, and webhookSecret before running this function.");
  }

  const form = FormApp.openById(config.formId);
  PropertiesService.getScriptProperties().setProperties({
    CREATOR_PASS_FORM_ID: form.getId(),
    CREATOR_PASS_EVENT_ID: config.eventId,
    CREATOR_PASS_WEBHOOK_URL: config.webhookUrl,
    CREATOR_PASS_WEBHOOK_SECRET: config.webhookSecret,
  });
  // Avoid duplicate webhook delivery if this setup function is run again.
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "forwardCreatorPassRequest")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger("forwardCreatorPassRequest").forForm(form).onFormSubmit().create();

  console.log(`Connected guest form: ${form.getPublishedUrl()}`);
  console.log(`Form editor: ${form.getEditUrl()}`);
}

function forwardCreatorPassRequest(event) {
  const properties = PropertiesService.getScriptProperties();
  const answers = Object.fromEntries(event.response.getItemResponses().map((itemResponse) => [
    itemResponse.getItem().getTitle(),
    String(itemResponse.getResponse() || "").trim(),
  ]));
  // Support common client-form labels without changing the form itself.
  const findAnswer = (labels) => {
    const key = Object.keys(answers).find((title) => labels.some((label) => title.toLowerCase().includes(label)));
    return key ? answers[key] : "";
  };
  const response = UrlFetchApp.fetch(properties.getProperty("CREATOR_PASS_WEBHOOK_URL"), {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${properties.getProperty("CREATOR_PASS_WEBHOOK_SECRET")}` },
    payload: JSON.stringify({
      eventId: properties.getProperty("CREATOR_PASS_EVENT_ID"),
      name: findAnswer(["full name", "your name", "name"]),
      email: findAnswer(["email"]),
      phone: findAnswer(["whatsapp", "phone", "mobile", "contact number"]),
    }),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(`RSVP DXB request sync failed (${response.getResponseCode()}): ${response.getContentText()}`);
  }
}
