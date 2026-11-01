const RSVP_PUBLIC_INTAKE = {
  baseUrl: "https://admin.rsvpdxb.com/api/integrations/google-forms/public-intake",
  secretProperty: "GOOGLE_FORM_WEBHOOK_SECRET",
  configProperty: "RSVP_DXB_PUBLIC_FORMS",
  eventsQuestion: "Which upcoming events are you interested in?",
};

/** Run once from Apps Script to create both live forms and install submit triggers. */
function createRsvpDxbPublicIntakeForms() {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty(RSVP_PUBLIC_INTAKE.secretProperty) || "";
  if (secret.length < 32) throw new Error("Add GOOGLE_FORM_WEBHOOK_SECRET (32+ characters) in Project Settings > Script Properties first.");
  const events = fetchPublicIntakeEvents_();
  if (!events.length) throw new Error("There are no published upcoming events to add to the Google Forms yet.");
  const eventChoices = {};
  events.forEach((event) => { eventChoices[publicEventLabel_(event)] = event.id; });

  const existing = JSON.parse(props.getProperty(RSVP_PUBLIC_INTAKE.configProperty) || "{}");
  if (existing.newAccountFormId && existing.eventInterestFormId) {
    console.log("Forms already exist. Edit them here:");
    console.log(`New member form: https://docs.google.com/forms/d/${existing.newAccountFormId}/edit`);
    console.log(`Event enquiry form: https://docs.google.com/forms/d/${existing.eventInterestFormId}/edit`);
    console.log("To create replacement forms, remove the RSVP_DXB_PUBLIC_FORMS script property and run this function again.");
    return;
  }

  const memberForm = FormApp.create("RSVP DXB — New Member Application", true)
    .setDescription("For people who do not already have an RSVP DXB account. Applications are reviewed by our membership team. Do not enter a password here.")
    .setConfirmationMessage("Your application has been received for review. If you already have an RSVP DXB account, please sign in instead.");
  addText_(memberForm, "Full name", true);
  addText_(memberForm, "Email", true);
  memberForm.addListItem().setTitle("Membership track").setChoiceValues(["Media", "Creators", "Tastemakers", "Private Circle"]).setRequired(true);
  addText_(memberForm, "City", true);
  addText_(memberForm, "WhatsApp number with country code", false);
  addText_(memberForm, "Instagram profile or username", true);
  addText_(memberForm, "Instagram follower count", true);
  addText_(memberForm, "Publication or company", false);
  addText_(memberForm, "Role", false);
  memberForm.addCheckboxItem().setTitle(RSVP_PUBLIC_INTAKE.eventsQuestion).setChoiceValues(Object.keys(eventChoices)).setRequired(false);
  memberForm.addParagraphTextItem().setTitle("Anything else you would like the team to know?").setRequired(false);

  const interestForm = FormApp.create("RSVP DXB — Event Interest & Enquiry", true)
    .setDescription("Tell the RSVP DXB team which events interest you. This form does not purchase or confirm a ticket.")
    .setConfirmationMessage("Thank you. Your event enquiry has been sent to the RSVP DXB team.");
  addText_(interestForm, "Full name", true);
  addText_(interestForm, "Email", true);
  addText_(interestForm, "WhatsApp number with country code", false);
  interestForm.addCheckboxItem().setTitle(RSVP_PUBLIC_INTAKE.eventsQuestion).setChoiceValues(Object.keys(eventChoices)).setRequired(true);
  interestForm.addParagraphTextItem().setTitle("Your enquiry or event interest").setRequired(false);

  const config = {
    newAccountFormId: memberForm.getId(),
    eventInterestFormId: interestForm.getId(),
    eventChoices,
  };
  props.setProperty(RSVP_PUBLIC_INTAKE.configProperty, JSON.stringify(config));
  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === "submitRsvpPublicIntake")
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));
  [memberForm, interestForm].forEach((form) => ScriptApp.newTrigger("submitRsvpPublicIntake").forForm(form).onFormSubmit().create());

  console.log("Created RSVP DXB public Google Forms:");
  console.log(`New member application (for new users only): ${memberForm.getPublishedUrl()}`);
  console.log(`Event interest and enquiry: ${interestForm.getPublishedUrl()}`);
  console.log("Share the published URLs above. The form editor URLs are in the Forms list in your Google Drive.");
}

/** Run after publishing events to refresh the event choices without replacing the forms. */
function refreshRsvpDxbPublicIntakeEventChoices() {
  const props = PropertiesService.getScriptProperties();
  const config = JSON.parse(props.getProperty(RSVP_PUBLIC_INTAKE.configProperty) || "{}");
  if (!config.newAccountFormId || !config.eventInterestFormId) throw new Error("Run createRsvpDxbPublicIntakeForms first.");
  const events = fetchPublicIntakeEvents_();
  const choices = {};
  events.forEach((event) => { choices[publicEventLabel_(event)] = event.id; });
  [config.newAccountFormId, config.eventInterestFormId].forEach((id) => {
    const form = FormApp.openById(id);
    const question = form.getItems(FormApp.ItemType.CHECKBOX)
      .find((item) => item.getTitle() === RSVP_PUBLIC_INTAKE.eventsQuestion);
    if (question) question.asCheckboxItem().setChoiceValues(Object.keys(choices));
  });
  config.eventChoices = choices;
  props.setProperty(RSVP_PUBLIC_INTAKE.configProperty, JSON.stringify(config));
  console.log(`Refreshed event choices in both forms (${events.length} published upcoming events).`);
}

function addText_(form, title, required) {
  return form.addTextItem().setTitle(title).setRequired(required);
}

function fetchPublicIntakeEvents_() {
  const secret = PropertiesService.getScriptProperties().getProperty(RSVP_PUBLIC_INTAKE.secretProperty) || "";
  const response = UrlFetchApp.fetch(`${RSVP_PUBLIC_INTAKE.baseUrl}/events`, {
    method: "get",
    headers: { Authorization: `Bearer ${secret}` },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300)
    throw new Error(`Could not load event choices (${response.getResponseCode()}): ${response.getContentText()}`);
  const events = JSON.parse(response.getContentText());
  if (!Array.isArray(events)) throw new Error("The event list response was invalid.");
  return events;
}

function publicEventLabel_(event) {
  return [event.title, event.date, event.venue, String(event.id).slice(-6)].filter(Boolean).join(" · ");
}

function submitRsvpPublicIntake(event) {
  const config = JSON.parse(PropertiesService.getScriptProperties().getProperty(RSVP_PUBLIC_INTAKE.configProperty) || "{}");
  const formId = event.source && event.source.getId ? event.source.getId() : "";
  const kind = formId === config.newAccountFormId ? "new_account"
    : formId === config.eventInterestFormId ? "event_interest" : "";
  if (!kind) throw new Error(`Unrecognized RSVP DXB intake form: ${formId}`);

  const answers = Object.fromEntries(event.response.getItemResponses().map((item) => [
    item.getItem().getTitle(), item.getResponse(),
  ]));
  const answer = (title) => answers[title] == null ? "" : answers[title];
  const eventLabels = Array.isArray(answer(RSVP_PUBLIC_INTAKE.eventsQuestion))
    ? answer(RSVP_PUBLIC_INTAKE.eventsQuestion) : [answer(RSVP_PUBLIC_INTAKE.eventsQuestion)].filter(Boolean);
  const eventIds = eventLabels.map((label) => config.eventChoices[label]).filter(Boolean);
  const payload = {
    kind,
    formId,
    responseId: event.response.getId(),
    name: answer("Full name"),
    email: answer("Email"),
    phone: answer("WhatsApp number with country code"),
    track: answer("Membership track"),
    city: answer("City"),
    instagramProfile: answer("Instagram profile or username"),
    instagramFollowers: answer("Instagram follower count"),
    outlet: answer("Publication or company"),
    role: answer("Role"),
    eventIds,
    notes: answer("Your enquiry or event interest") || answer("Anything else you would like the team to know?"),
  };
  const secret = PropertiesService.getScriptProperties().getProperty(RSVP_PUBLIC_INTAKE.secretProperty) || "";
  const response = UrlFetchApp.fetch(RSVP_PUBLIC_INTAKE.baseUrl, {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: `Bearer ${secret}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300)
    throw new Error(`RSVP DXB could not save this form response (${response.getResponseCode()}): ${response.getContentText()}`);
  const result = JSON.parse(response.getContentText());
  if (result.duplicate && kind === "new_account") {
    MailApp.sendEmail(payload.email, "RSVP DXB account already exists", "This Google Form is only for new account applications. If you already have an RSVP DXB account, please sign in. If you have an application under review, our team will contact you.");
  }
  console.log(`Synced ${kind} response ${event.response.getId()}: ${JSON.stringify(result)}`);
}
