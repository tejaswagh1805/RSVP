// Paste this file into a new Google Apps Script project and fill in the config.
const CREATOR_PASS_FORM_CONFIG = {
  // Use the client's existing Google Form; do not create a replacement.
  formId: "1VvAsWM2fEU_4NILdJvtKy0D4cPkzTRbG9ODfe7bTwcM",
  webhookUrl: "https://admin.rsvpdxb.com/api/integrations/google-forms/creator-pass",
  // Used only for responses submitted before the event dropdown is added.
  legacyEventId: "client-pataakha-2026",
};

const CREATOR_PASS_EVENT_QUESTION = "Which event are you requesting a creator pass for?";

function connectExistingCreatorPassForm() {
  const config = CREATOR_PASS_FORM_CONFIG;
  const properties = PropertiesService.getScriptProperties();
  const webhookSecret = properties.getProperty("CREATOR_PASS_WEBHOOK_SECRET") || "";
  if (config.formId.startsWith("REPLACE_") || config.webhookUrl.includes("REPLACE_") || webhookSecret.length < 32) {
    throw new Error("Set CREATOR_PASS_WEBHOOK_SECRET in Apps Script Project Settings > Script Properties (32+ characters) before running this function.");
  }

  const form = FormApp.openById(config.formId);
  PropertiesService.getScriptProperties().setProperties({
    CREATOR_PASS_FORM_ID: form.getId(),
    CREATOR_PASS_LEGACY_EVENT_ID: config.legacyEventId || "",
    CREATOR_PASS_WEBHOOK_URL: config.webhookUrl,
  });
  syncCreatorPassEventChoices();
  // Avoid duplicate webhook delivery and refresh triggers if setup is repeated.
  ScriptApp.getProjectTriggers()
    .filter((trigger) => ["forwardCreatorPassRequest", "syncCreatorPassEventChoices"].includes(trigger.getHandlerFunction()))
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  ScriptApp.newTrigger("forwardCreatorPassRequest").forForm(form).onFormSubmit().create();
  ScriptApp.newTrigger("syncCreatorPassEventChoices").timeBased().everyHours(6).create();

  console.log(`Connected guest form: ${form.getPublishedUrl()}`);
  console.log(`Form editor: ${form.getEditUrl()}`);
}

// Keep the Google Form event dropdown current for every published event accepting creator passes.
function syncCreatorPassEventChoices() {
  const properties = PropertiesService.getScriptProperties();
  const formId = properties.getProperty("CREATOR_PASS_FORM_ID");
  const webhookUrl = properties.getProperty("CREATOR_PASS_WEBHOOK_URL");
  const secret = properties.getProperty("CREATOR_PASS_WEBHOOK_SECRET");
  if (!formId || !webhookUrl || !secret) throw new Error("Run connectExistingCreatorPassForm first.");

  const response = UrlFetchApp.fetch(`${webhookUrl}/events`, {
    method: "get",
    headers: { Authorization: `Bearer ${secret}` },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(`Could not load creator-pass events (${response.getResponseCode()}): ${response.getContentText()}`);
  }
  const events = JSON.parse(response.getContentText());
  if (!Array.isArray(events) || !events.length) throw new Error("No published events are currently accepting creator-pass requests.");

  const labelsToIds = {};
  const labels = events.map((event) => {
    const label = [event.title, event.date, event.venue].filter(Boolean).join(" · ");
    labelsToIds[label] = event.id;
    return label;
  });
  const form = FormApp.openById(formId);
  const item = form.getItems(FormApp.ItemType.LIST).find((candidate) => candidate.getTitle() === CREATOR_PASS_EVENT_QUESTION);
  const eventQuestion = item ? item.asListItem() : form.addListItem().setTitle(CREATOR_PASS_EVENT_QUESTION);
  eventQuestion.setRequired(true).setChoiceValues(labels);
  properties.setProperty("CREATOR_PASS_EVENT_CHOICES", JSON.stringify(labelsToIds));
  // The customer site uses this entry ID to preselect the clicked event.
  console.log(`Customer site VITE_CREATOR_PASS_EVENT_ENTRY_ID=${eventQuestion.getId()}`);
  console.log(`Updated event choices: ${labels.join(", ")}`);
}

function forwardCreatorPassRequest(event) {
  sendCreatorPassResponse_(event.response);
}

// Run once after setup to import responses Google already recorded.
function syncExistingCreatorPassResponses() {
  const formId = PropertiesService.getScriptProperties().getProperty("CREATOR_PASS_FORM_ID");
  if (!formId) throw new Error("Run connectExistingCreatorPassForm first.");
  const responses = FormApp.openById(formId).getResponses();
  let synced = 0;
  responses.forEach((response) => {
    sendCreatorPassResponse_(response);
    synced += 1;
  });
  console.log(`Processed ${synced} recorded form responses. Existing pending requests are safely ignored as duplicates.`);
}

function sendCreatorPassResponse_(formResponse) {
  const properties = PropertiesService.getScriptProperties();
  const answers = Object.fromEntries(formResponse.getItemResponses().map((itemResponse) => [
    itemResponse.getItem().getTitle(),
    String(itemResponse.getResponse() || "").trim(),
  ]));
  // Support common client-form labels without changing the form itself.
  const findAnswer = (labels) => {
    const key = Object.keys(answers).find((title) => labels.some((label) => title.toLowerCase().includes(label)));
    return key ? answers[key] : "";
  };
  const selectedEvent = findAnswer(["which event", "event"]);
  const eventChoices = JSON.parse(properties.getProperty("CREATOR_PASS_EVENT_CHOICES") || "{}");
  const eventId = eventChoices[selectedEvent] || (!selectedEvent ? properties.getProperty("CREATOR_PASS_LEGACY_EVENT_ID") : "");
  if (!eventId) throw new Error(`Could not match the selected event "${selectedEvent}". Refresh the form's event choices and retry.`);
  const response = UrlFetchApp.fetch(properties.getProperty("CREATOR_PASS_WEBHOOK_URL"), {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${properties.getProperty("CREATOR_PASS_WEBHOOK_SECRET")}` },
    payload: JSON.stringify({
      eventId,
      name: findAnswer(["full name", "your name", "name"]),
      email: findAnswer(["email"]) || String(formResponse.getRespondentEmail() || "").trim(),
      phone: findAnswer(["whatsapp", "phone", "mobile", "contact number"]),
    }),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error(`RSVP DXB request sync failed (${response.getResponseCode()}): ${response.getContentText()}`);
  }
}
