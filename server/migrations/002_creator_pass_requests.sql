ALTER TABLE event_ticket_inquiries
  ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'ticket';

ALTER TABLE event_ticket_inquiries
  DROP CONSTRAINT IF EXISTS event_ticket_inquiries_status_check;

ALTER TABLE event_ticket_inquiries
  ADD CONSTRAINT event_ticket_inquiries_status_check
  CHECK (status IN ('pending', 'contacted', 'closed', 'accepted', 'waitlisted', 'declined'));

CREATE INDEX IF NOT EXISTS event_ticket_inquiries_type_status_idx
  ON event_ticket_inquiries(event_id, request_type, status, created_at DESC);
