import { useEffect, useState } from 'react';
import { ArrowUpRight, Check, Plus, X } from 'lucide-react';
import { api } from '../api.js';
import { EmptyState, PageIntro } from '../components/UI.jsx';
import { TRACKS, dateLabel } from '../lib/constants.js';
export default function Events({ rows, guests, act, openModal }) {
  const [filter, setFilter] = useState('all');
  const [ticketRequests, setTicketRequests] = useState([]);
  const [busyTicket, setBusyTicket] = useState('');
  const [priceEvent, setPriceEvent] = useState(null);
  const [priceValue, setPriceValue] = useState('');
  const [priceError, setPriceError] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);
  useEffect(() => { api.ticketRequests().then(setTicketRequests).catch(() => setTicketRequests([])); }, []);
  const setEventPrice = (event) => {
    setPriceEvent(event);
    setPriceValue(String(event.ticketPrice ?? 0));
    setPriceError('');
  };
  const saveEventPrice = async () => {
    const ticketPrice = Number(priceValue);
    if (priceValue.trim() === '' || !Number.isFinite(ticketPrice) || ticketPrice < 0) {
      setPriceError('Enter a valid price of AED 0 or more.');
      return;
    }
    setSavingPrice(true);
    let saved = false;
    await act(async () => { await api.updateEvent(priceEvent.id, { ticketPrice, ticketCurrency: 'AED' }); saved = true; }, 'Ticket price updated');
    setSavingPrice(false);
    if (saved) setPriceEvent(null);
  };
  const approveFreeTicket = async (ticket) => {
    setBusyTicket(ticket.id);
    await act(() => api.approveTicketRequest(ticket.id), 'Ticket approved and sent by WhatsApp');
    try { setTicketRequests(await api.ticketRequests()); } catch { /* The action result is already shown by the dashboard. */ }
    setBusyTicket('');
  };
  const shown = rows.filter((event) => filter === 'all' || event.status === filter);
  return <><PageIntro title="Event programme" detail="Create, review and publish experiences across Dubai." action={<div className="event-filter"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All events</button><button className={filter === 'published' ? 'selected' : ''} onClick={() => setFilter('published')}>Published</button><button className={filter === 'pending' ? 'selected' : ''} onClick={() => setFilter('pending')}>Needs review</button></div>} /><div className="panel table-panel table-scroll"><table><thead><tr><th>EVENT</th><th>BRAND</th><th>DATE & TIME</th><th>GUESTS</th><th>STATUS</th><th>AUDIENCE</th><th>TICKET PRICE</th><th /></tr></thead><tbody>{shown.map((event) => <tr key={event.id}><td><div className="event-name-cell"><span className="event-thumb">{event.category?.slice(0, 1) || 'E'}</span><div><strong>{event.title}</strong><span>{event.venue}</span></div></div></td><td>{event.brand}</td><td>{dateLabel(event.date)}<span className="table-subline">{event.time}</span></td><td><strong>{event.confirmed || 0}</strong><span className="muted-text"> / {event.capacity}</span></td><td><span className={`status-tag status-${event.status}`}>{event.status}</span></td><td>{(event.tracks || []).map((name) => name === 'Private Circle' ? 'Private' : name).join(', ')}</td><td>{Number(event.ticketPrice || 0).toFixed(2)} {event.ticketCurrency || 'AED'}</td><td><div className="table-actions"><button className="small-action" onClick={() => setEventPrice(event)}>Edit price</button>{event.status === 'pending' ? <button className="small-action publish-action" onClick={() => act(() => api.updateEvent(event.id, 'published'), 'Event published')}>Publish</button> : <button className="small-action" onClick={() => act(() => api.updateEvent(event.id, 'closed'), 'RSVPs closed')}>Close RSVPs</button>}<button className="small-action" onClick={() => openModal({ type: 'guest-list', event })}>Guest list</button></div></td></tr>)}</tbody></table>{shown.length === 0 && <EmptyState title="No events in this view" detail="Create an event to fill your programme." />}</div>{ticketRequests.length > 0 && <section className="panel table-panel table-scroll" style={{ marginTop: 24 }}><h2 style={{ padding: 20 }}>WhatsApp ticket requests</h2><table><thead><tr><th>GUEST</th><th>EVENT</th><th>PHONE</th><th>PRICE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{ticketRequests.map((item) => <tr key={item.id}><td>{item.guestName || "WhatsApp guest"}</td><td>{item.eventTitle}</td><td>{item.phone}</td><td>{Number(item.amount).toFixed(2)} {item.currency}</td><td>{item.status}{item.ticketDeliveredAt ? ' · PDF sent' : ''}</td><td>{Number(item.amount) === 0 && ['pending', 'approved'].includes(item.status) && !item.ticketDeliveredAt ? <button className="small-action publish-action" disabled={busyTicket === item.id} onClick={() => approveFreeTicket(item)}>{busyTicket === item.id ? 'Sending…' : item.status === 'pending' ? 'Approve & send PDF' : 'Retry PDF'}</button> : Number(item.amount) > 0 && item.status === 'awaiting_payment' ? 'Awaiting payment' : Number(item.amount) > 0 && item.status === 'paid' ? 'Payment confirmed' : '—'}</td></tr>)}</tbody></table></section>}{priceEvent && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !savingPrice) setPriceEvent(null); }}><section className="modal-card price-modal" role="dialog" aria-modal="true" aria-labelledby="price-modal-title"><div className="modal-header"><div><div className="eyebrow">EVENT PRICING</div><h2 id="price-modal-title">Update ticket price</h2><p>{priceEvent.title}</p></div><button className="icon-button" onClick={() => setPriceEvent(null)} disabled={savingPrice} aria-label="Close"><X size={18} /></button></div><div className="modal-body price-modal-body"><label className="field"><span>Ticket price</span><div className="price-input-wrap"><span>AED</span><input autoFocus type="number" min="0" step="0.01" value={priceValue} onChange={(e) => { setPriceValue(e.target.value); setPriceError(''); }} onKeyDown={(e) => { if (e.key === 'Enter') saveEventPrice(); }} /></div></label><p className="price-help">Set 0.00 for a complimentary ticket. Customers will see this price before requesting a ticket.</p>{priceError && <p className="price-error" role="alert">{priceError}</p>}</div><div className="modal-footer"><button className="button button-secondary" disabled={savingPrice} onClick={() => setPriceEvent(null)}>Cancel</button><button className="button button-primary" disabled={savingPrice} onClick={saveEventPrice}>{savingPrice ? 'Saving…' : 'Save price'}</button></div></section></div>}</>;
}

export function EventModal({ close, act }) {
  const [form, setForm] = useState({ title: '', brand: '', venue: '', area: '', date: '', time: '', capacity: 80, ticketPrice: 0, ticketCurrency: 'AED', category: 'Dining', tracks: ['Creators'], dressCode: '', about: '', included: '', whoIsInvited: '', hostNote: '', imageFiles: [], videoFile: null });
  const [busy, setBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const onImages = async (fileList) => {
    setImageError('');
    const files = Array.from(fileList || []);
    if (form.imageFiles.length + files.length > 5) { setImageError('Choose up to 5 event images.'); return; }
    if (files.some((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) { setImageError('Choose JPG, PNG or WebP images.'); return; }
    if (files.some((file) => file.size > 12 * 1024 * 1024) || [...files, ...form.imageFiles.map((item) => item.file)].reduce((total, file) => total + file.size, 0) > 40 * 1024 * 1024) {
      setImageError('Each image must be 12 MB or smaller, with up to 40 MB total.');
      return;
    }
    set('imageFiles', [...form.imageFiles, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  };
  const upload = async (file) => {
    const { uploadUrl, publicUrl } = await api.mediaUploadUrl(file);
    const response = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
    if (!response.ok) throw new Error('Upload to media storage failed.');
    return publicUrl;
  };
  const submit = async (status) => {
    if (!form.title.trim() || !form.brand.trim() || !form.date || imageError) return;
    setBusy(true);
    try {
      const imageDataList = await Promise.all(form.imageFiles.map(({ file }) => upload(file)));
      const videoUrl = form.videoFile ? await upload(form.videoFile) : '';
      await act(() => api.createEvent({ ...form, imageFiles: undefined, videoFile: undefined, imageData: imageDataList[0] || '', imageDataList, videoUrl, included: form.included.split(/\n|,/).map((item) => item.trim()).filter(Boolean), status, confirmed: 0 }), status === 'published' ? 'Event created and published' : 'Event saved as draft');
      close();
    } catch (error) { setImageError(error.message || 'Media upload failed. Please try again.'); }
    finally { setBusy(false); }
  };
  const toggle = (name) => set('tracks', form.tracks.includes(name) ? form.tracks.filter((track) => track !== name) : [...form.tracks, name]);
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><section className="modal-card"><div className="modal-header"><div><div className="eyebrow">EVENT SETUP</div><h2>Create an event</h2></div><button className="icon-button" onClick={close}><X size={18} /></button></div><div className="modal-body">
    <label className="field"><span>Event title *</span><input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Sunset Listening Session" /></label>
    <div className="form-grid"><label className="field"><span>Host brand *</span><input value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Brand name" /></label><label className="field"><span>Category</span><select value={form.category} onChange={(e) => set('category', e.target.value)}>{['Dining', 'Fashion', 'Property', 'Music', 'Art', 'Nightlife', 'Wellness', 'Travel'].map((name) => <option key={name}>{name}</option>)}</select></label><label className="field"><span>Date *</span><input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></label><label className="field"><span>Time</span><input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} /></label><label className="field"><span>Venue</span><input value={form.venue} onChange={(e) => set('venue', e.target.value)} placeholder="Venue" /></label><label className="field"><span>Area</span><input value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="e.g. DIFC" /></label><label className="field"><span>Guest capacity</span><input type="number" min="1" value={form.capacity} onChange={(e) => set('capacity', Number(e.target.value))} /></label><label className="field"><span>Ticket price (AED)</span><input type="number" min="0" step="0.01" value={form.ticketPrice} onChange={(e) => set('ticketPrice', Number(e.target.value))} /></label><label className="field"><span>Dress code</span><input value={form.dressCode} onChange={(e) => set('dressCode', e.target.value)} placeholder="e.g. Smart elegant" /></label></div>
    <label className="field"><span>Event photos (up to 5 JPG, PNG or WebP images)</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { onImages(e.target.files); e.target.value = ''; }} /><small className="muted-text">Up to 12 MB per image and 40 MB total. Images upload securely to S3; the first is used as the event cover.</small>{form.imageFiles.length > 0 ? <div className="event-image-gallery">{form.imageFiles.map((item, index) => <div className="event-image-tile" key={`${index}-${item.file.name}`}><img src={item.preview} alt={`Event preview ${index + 1}`} /><span>{index === 0 ? 'Cover' : `Photo ${index + 1}`}</span><button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => { URL.revokeObjectURL(item.preview); set('imageFiles', form.imageFiles.filter((_, imageIndex) => imageIndex !== index)); }}><X size={14} /></button></div>)}</div> : null}</label>
    <label className="field"><span>Event video (optional, up to 100 MB)</span><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => { const file = e.target.files?.[0] || null; if (file && (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type) || file.size > 100 * 1024 * 1024)) setImageError('Choose an MP4, WebM or MOV video up to 100 MB.'); else { setImageError(''); set('videoFile', file); } e.target.value = ''; }} />{form.videoFile ? <small className="muted-text">Selected: {form.videoFile.name}</small> : null}</label>
    {imageError ? <small className="event-image-error" role="alert">{imageError}</small> : null}
    <label className="field"><span>About this event</span><textarea rows="3" value={form.about} onChange={(e) => set('about', e.target.value)} placeholder="Describe the event" /></label>
    <label className="field"><span>What is included (one item per line or comma separated)</span><textarea rows="2" value={form.included} onChange={(e) => set('included', e.target.value)} placeholder="Welcome drink, tasting menu" /></label>
    <label className="field"><span>Who is invited</span><textarea rows="2" value={form.whoIsInvited} onChange={(e) => set('whoIsInvited', e.target.value)} placeholder="Guest eligibility" /></label>
    <label className="field"><span>Host note</span><textarea rows="2" value={form.hostNote} onChange={(e) => set('hostNote', e.target.value)} placeholder="Arrival or event notes" /></label>
    <div className="field"><span>Invited tracks</span><div className="track-checks">{TRACKS.map((name) => <button key={name} className={form.tracks.includes(name) ? 'checked' : ''} onClick={() => toggle(name)} type="button">{form.tracks.includes(name) && <Check size={13} />}{name}</button>)}</div></div>
  </div><div className="modal-footer"><button className="button button-secondary" onClick={close}>Cancel</button><button className="button button-secondary" disabled={busy || !form.title || !form.brand || !form.date || Boolean(imageError)} onClick={() => submit('draft')}>Save draft</button><button className="button button-primary" disabled={busy || !form.title || !form.brand || !form.date || Boolean(imageError)} onClick={() => submit('published')}>{busy ? 'Saving?' : 'Publish event'} <ArrowUpRight size={15} /></button></div></section></div>;
}

export function GuestModal({ event, guests, close }) {
  const rows = guests.filter((guest) => guest.eventId === event.id);
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><section className="modal-card guest-modal"><div className="modal-header"><div><div className="eyebrow">GUEST LIST</div><h2>{event.title}</h2><p>{dateLabel(event.date)} · {event.venue}</p></div><button className="icon-button" onClick={close}><X size={18} /></button></div><div className="panel table-panel table-scroll"><table><thead><tr><th>GUEST</th><th>TRACK</th><th>PARTY SIZE</th><th>ENTRY CODE</th><th>STATUS</th></tr></thead><tbody>{rows.map((guest) => <tr key={guest.id}><td><strong>{guest.name}</strong></td><td>{guest.track}</td><td>{guest.plusOnes + 1}</td><td><code>{guest.code}</code></td><td><span className={`status-tag ${guest.checkedInAt ? 'status-approved' : 'status-pending'}`}>{guest.checkedInAt ? `Checked in ${guest.checkedInAt}` : 'Confirmed'}</span></td></tr>)}</tbody></table>{rows.length === 0 && <EmptyState title="Guest list is empty" detail="Confirmed RSVPs will appear here." />}</div><div className="modal-footer"><span className="muted-text">{rows.length} confirmed guests</span><button className="button button-secondary" onClick={close}>Done</button></div></section></div>;
}

