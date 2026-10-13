import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { EmptyState, PageIntro } from '../components/UI.jsx';
import { downloadCsv } from '../lib/downloadCsv.js';

const normalizeWhatsAppNumber = (value = '') => {
  let digits = String(value).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = `971${digits.slice(1)}`;
  return /^\d{8,15}$/.test(digits) ? digits : '';
};

export default function Invitations({ events }) {
  const activeEvents = useMemo(() => events.filter((event) => ['published', 'closed'].includes(event.status)), [events]);
  const [eventId, setEventId] = useState('');
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ guestName: '', email: '', phone: '', tableNo: '' });
  const [link, setLink] = useState('');
  const [delivery, setDelivery] = useState(null);
  const [lastGuest, setLastGuest] = useState(null);
  const [passCode, setPassCode] = useState('');
  const [passResult, setPassResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!eventId) return undefined;
    let current = true;
    api.guestInvitations(eventId).then((invitations) => { if (current) setRows(invitations); }).catch((cause) => { if (current) setError(cause.message); });
    return () => { current = false; };
  }, [eventId]);

  const selected = activeEvents.find((event) => event.id === eventId);
  const create = async (event) => {
    event.preventDefault();
    if (!eventId) return setError('Select an event first.');
    if (!form.email.trim() && !form.phone.trim()) return setError('Enter an email address or WhatsApp number.');
    setBusy(true); setError('');
    try {
      const created = await api.createGuestInvitation({ eventId, ...form });
      setLink(created.invitationUrl);
      setDelivery(created.delivery);
      setLastGuest({ ...form, eventTitle: selected?.title || 'RSVP DXB event' });
      setForm({ guestName: '', email: '', phone: '', tableNo: '' });
      try { await navigator.clipboard.writeText(created.invitationUrl); } catch { /* The link remains visible for manual copying. */ }
      setRows(await api.guestInvitations(eventId));
    } catch (cause) { setError(cause.message); }
    finally { setBusy(false); }
  };
  const exportList = () => downloadCsv(`rsvpdxb-${eventId}-invitations.csv`, ['Name', 'Email', 'Phone', 'Table', 'RSVP status', 'Additional guests', 'Checked in'], rows.map((guest) => [guest.guestName, guest.email, guest.phone, guest.tableNo, guest.status, guest.plusOnes, guest.checkedInAt || '']));
  const checkIn = async (guest) => {
    try { await api.checkInGuestInvitation(guest.id); setRows(await api.guestInvitations(eventId)); setPassResult(`${guest.guestName} checked in.`); }
    catch (cause) { setPassResult(cause.message); }
  };
  const scanPass = async (event) => {
    event.preventDefault(); setPassResult('');
    try { const guest = await api.scanGuestPass(passCode, eventId); setPassResult(`${guest.guestName} checked in.`); setPassCode(''); setRows(await api.guestInvitations(eventId)); }
    catch (cause) { setPassResult(cause.message); }
  };

  return <>
    <PageIntro title="Guest invitations" detail="Create private RSVP links and manage invited guests for each event." />
    <section className="panel invitations-panel">
      <label className="field"><span>Event</span><select value={eventId} onChange={(event) => { setEventId(event.target.value); setRows([]); setLink(''); setDelivery(null); setLastGuest(null); setError(''); }}><option value="">Select an event</option>{activeEvents.map((event) => <option key={event.id} value={event.id}>{event.title}</option>)}</select></label>
      {selected && <form className="invitation-form" onSubmit={create}>
        <label className="field"><span>Guest name *</span><input required minLength="2" maxLength="120" value={form.guestName} onChange={(event) => setForm({ ...form, guestName: event.target.value })} /></label>
        <label className="field"><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label className="field"><span>Phone / WhatsApp</span><input type="tel" autoComplete="tel" placeholder="+971 50 123 4567" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label className="field"><span>Table</span><input value={form.tableNo} onChange={(event) => setForm({ ...form, tableNo: event.target.value })} /></label>
        <button className="button button-primary" disabled={busy}>{busy ? 'Creating & sending…' : 'Create & send invitation'}</button>
      </form>}
      <p className="invitation-note">Enter an email, a WhatsApp number, or both. Configured providers send automatically; delivery results appear below.</p>
      {link && <div className="invitation-link">
        <strong>New RSVP link</strong><a href={link} target="_blank" rel="noreferrer">{link}</a>
        {delivery && <div className="invitation-delivery" role="status" aria-live="polite">
          <p><strong>Email:</strong> {delivery.email.message}</p>
          <p><strong>WhatsApp:</strong> {delivery.whatsapp.message}</p>
        </div>}
        {lastGuest && <div className="invitation-actions">
          {lastGuest.email && delivery?.email.status !== 'submitted' && <a className="button button-secondary" href={`mailto:${encodeURIComponent(lastGuest.email).replace(/%40/gi, '@')}?subject=${encodeURIComponent(`You're invited to ${lastGuest.eventTitle} | RSVP DXB`)}&body=${encodeURIComponent(`Dear ${lastGuest.guestName},\n\nYou are invited to ${lastGuest.eventTitle} with RSVP DXB.\n\nPlease respond using your private RSVP link:\n${link}\n\nRSVP DXB`)}`}>Open email draft</a>}
          {lastGuest.phone && delivery?.whatsapp.status !== 'submitted' && normalizeWhatsAppNumber(lastGuest.phone) && <a className="button button-secondary" href={`https://wa.me/${normalizeWhatsAppNumber(lastGuest.phone)}?text=${encodeURIComponent(`Hi ${lastGuest.guestName}, you are invited to ${lastGuest.eventTitle} with RSVP DXB. Please respond here: ${link}`)}`} target="_blank" rel="noreferrer">Open WhatsApp</a>}
        </div>}
      </div>}
      {error && <div className="alert-banner" role="alert">{error}</div>}
    </section>
    {selected && <section className="panel invitations-list">
      <div className="invitations-list-heading"><div><h2>{selected.title}</h2><span className="muted-text">{rows.length} invitations</span></div><button className="button button-secondary" disabled={!rows.length} onClick={exportList}>Export CSV</button></div>
      <form className="invitation-scan" onSubmit={scanPass}><label className="field"><span>Guest QR or RSVP link</span><input value={passCode} onChange={(event) => setPassCode(event.target.value)} placeholder="Paste scanned QR content or invitation URL" /></label><button className="button button-primary" disabled={!passCode.trim()}>Verify & check in</button></form>
      {passResult && <p className="invitation-note" role="status">{passResult}</p>}
      <div className="table-scroll"><table><thead><tr><th>GUEST</th><th>CONTACT</th><th>TABLE</th><th>PARTY</th><th>STATUS</th><th>CHECK-IN</th><th /></tr></thead><tbody>{rows.map((guest) => <tr key={guest.id}><td><strong>{guest.guestName}</strong></td><td>{guest.email || guest.phone || '—'}</td><td>{guest.tableNo || '—'}</td><td>{Number(guest.plusOnes || 0) + 1}</td><td><span className={`status-tag ${guest.status === 'accepted' ? 'status-published' : guest.status === 'declined' ? 'status-closed' : 'status-pending'}`}>{guest.status}</span></td><td>{guest.checkedInAt || '—'}</td><td>{guest.status === 'accepted' && !guest.checkedInAt && <button className="small-action" onClick={() => checkIn(guest)}>Check in</button>}</td></tr>)}</tbody></table>{rows.length === 0 && <EmptyState title="No invitations yet" detail="Add a guest above to create their private RSVP link." />}</div>
    </section>}
  </>;
}
