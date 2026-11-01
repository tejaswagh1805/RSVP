ALTER TABLE event_ticket_inquiries
  ADD COLUMN IF NOT EXISTS request_notes TEXT NOT NULL DEFAULT '';
