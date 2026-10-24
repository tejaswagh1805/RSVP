const API = '/api';

export async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    credentials: 'same-origin',
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }
  return data;
}

export const api = {
  me: () => request('/auth/me'),
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  register: (member) => request('/register', { method: 'POST', body: JSON.stringify(member) }),
  dashboard: () => request('/dashboard'),
  list: (resource) => request(`/${resource}`),
  ticketRequests: () => request('/ticket-requests'),
  deleteMember: (id) => request(`/members/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  deleteApplication: (id) => request(`/applications/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  decideApplication: (id, status) => request(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  createEvent: (event) => request('/events', { method: 'POST', body: JSON.stringify(event) }),
  mediaUploadUrl: (file) => request('/media/upload-url', { method: 'POST', body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }) }),
  createSiteMedia: (item) => request('/site-media', { method: 'POST', body: JSON.stringify(item) }),
  setSiteMediaActive: (id, active) => request(`/site-media/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ active }) }),
  createVenue: (venue) => request('/venues', { method: 'POST', body: JSON.stringify(venue) }),
  updateVenue: (id, venue) => request(`/venues/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(venue) }),
  setVenueActive: (id, active) => request(`/venues/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ active }) }),
  setVenueFeatured: (id, featured) => request(`/venues/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ featured }) }),
  createPeopleProfile: (profile) => request('/people-profiles', { method: 'POST', body: JSON.stringify(profile) }),
  updatePeopleProfile: (id, profile) => request(`/people-profiles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(profile) }),
  setPeopleProfileActive: (id, active) => request(`/people-profiles/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ active }) }),
  updateEvent: (id, update) => request(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(typeof update === 'string' ? { status: update } : update) }),
  deleteEvent: (id) => request(`/events/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  approveTicketRequest: (id) => request(`/ticket-requests/${encodeURIComponent(id)}/approve`, { method: 'POST' }),
  moderatePost: (id, action) => request(`/wall/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) }),
  addCredits: (id, amount) => request(`/clients/${id}/credits`, { method: 'POST', body: JSON.stringify({ amount }) }),
  scan: (code, eventId) => request('/door/scan', { method: 'POST', body: JSON.stringify({ code, eventId }) }),
  walkIn: (guest) => request('/door/walk-ins', { method: 'POST', body: JSON.stringify(guest) }),
  guestInvitations: (eventId) => request(`/guest-invitations?eventId=${encodeURIComponent(eventId)}`),
  eventRsvpRequests: (eventId) => request(`/event-rsvp-requests?eventId=${encodeURIComponent(eventId)}`),
  decideEventRsvp: (id, status) => request(`/event-rsvp-requests/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  createGuestInvitation: (guest) => request('/guest-invitations', { method: 'POST', body: JSON.stringify(guest) }),
  checkInGuestInvitation: (id) => request(`/door/guest-invitations/${encodeURIComponent(id)}/check-in`, { method: 'POST' }),
  scanGuestPass: (code, eventId) => request('/door/guest-pass', { method: 'POST', body: JSON.stringify({ code, eventId }) }),
};
