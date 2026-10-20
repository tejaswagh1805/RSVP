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
  decideApplication: (id, status) => request(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  createEvent: (event) => request('/events', { method: 'POST', body: JSON.stringify(event) }),
  updateEvent: (id, update) => request(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(typeof update === 'string' ? { status: update } : update) }),
  approveTicketRequest: (id) => request(`/ticket-requests/${encodeURIComponent(id)}/approve`, { method: 'POST' }),
  moderatePost: (id, action) => request(`/wall/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) }),
  addCredits: (id, amount) => request(`/clients/${id}/credits`, { method: 'POST', body: JSON.stringify({ amount }) }),
  scan: (code) => request('/door/scan', { method: 'POST', body: JSON.stringify({ code }) }),
  walkIn: (guest) => request('/door/walk-ins', { method: 'POST', body: JSON.stringify(guest) }),
  guestInvitations: (eventId) => request(`/guest-invitations?eventId=${encodeURIComponent(eventId)}`),
  createGuestInvitation: (guest) => request('/guest-invitations', { method: 'POST', body: JSON.stringify(guest) }),
  checkInGuestInvitation: (id) => request(`/door/guest-invitations/${encodeURIComponent(id)}/check-in`, { method: 'POST' }),
  scanGuestPass: (code, eventId) => request('/door/guest-pass', { method: 'POST', body: JSON.stringify({ code, eventId }) }),
};
