import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays, Check, Download, ImagePlus, MapPin, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { api } from '../api.js';
import { EmptyState, PageIntro } from '../components/UI.jsx';
import { TRACKS, dateLabel } from '../lib/constants.js';
import { downloadCsv } from '../lib/downloadCsv.js';
export default function Events({ rows, guests, act, openModal }) {
  const [filter, setFilter] = useState('all');
  const [ticketRequests, setTicketRequests] = useState([]);
  const [busyTicket, setBusyTicket] = useState('');
  const [priceEvent, setPriceEvent] = useState(null);
  const [priceValue, setPriceValue] = useState('');
  const [priceError, setPriceError] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);
  const [rsvpEvent, setRsvpEvent] = useState(null);
  const [rsvpRows, setRsvpRows] = useState([]);
  const [loadingRsvps, setLoadingRsvps] = useState(false);
  const [rsvpLoadError, setRsvpLoadError] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [deletingEvent, setDeletingEvent] = useState('');
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
  const showRsvps = async (event) => {
    setRsvpEvent(event);
    setDeliveryNote('');
    setRsvpLoadError('');
    setLoadingRsvps(true);
    try { setRsvpRows(await api.eventRsvpRequests(event.id)); }
    catch (error) {
      setRsvpRows([]);
      setRsvpLoadError(error?.status === 404
        ? 'The RSVP API route is missing from the running server. Stop and restart npm run dev from RSVP_admin_dashboard.'
        : error.message || 'Could not load RSVP requests.');
    }
    finally { setLoadingRsvps(false); }
  };
  const reviewRsvp = async (request, status) => {
    await act(async () => {
      const result = await api.decideEventRsvp(request.id, status);
      setRsvpRows(await api.eventRsvpRequests(rsvpEvent.id));
      setDeliveryNote(result.delivery?.status === 'submitted' ? result.delivery.message : `Decision saved; email ${result.delivery?.status?.replaceAll('_', ' ') || 'not sent'}. ${result.delivery?.message || ''}`);
    }, `RSVP ${status}`);
  };
  const exportAccepted = () => downloadCsv(`rsvpdxb-${rsvpEvent.id}-accepted-rsvps.csv`, ['Name', 'Email', 'Track', 'Guest names', 'Party size', 'RSVP status', 'Requested at'], rsvpRows.filter((item) => item.status === 'accepted').map((item) => [item.name, item.email, item.track, (item.guestNames || []).join('; '), (item.guestNames || []).length + 1, item.status, item.createdAt]));
  const deleteEvent = async (event) => {
    const confirmed = window.confirm(`Permanently delete “${event.title}”? This also removes its RSVP requests, invitations, and ticket requests. This cannot be undone.`);
    if (!confirmed) return;
    setDeletingEvent(event.id);
    try { await act(() => api.deleteEvent(event.id), 'Event deleted'); }
    finally { setDeletingEvent(''); }
  };
  const shown = rows.filter((event) => filter === 'all' || event.status === filter);
  return <><PageIntro title="Event programme" detail="Create, review and publish experiences across Dubai." action={<div className="event-filter"><button className={filter === 'all' ? 'selected' : ''} onClick={() => setFilter('all')}>All events</button><button className={filter === 'published' ? 'selected' : ''} onClick={() => setFilter('published')}>Published</button><button className={filter === 'pending' ? 'selected' : ''} onClick={() => setFilter('pending')}>Needs review</button></div>} /><div className="panel table-panel table-scroll"><table><thead><tr><th>EVENT</th><th>HOST / ORGANISER</th><th>DATE & TIME</th><th>GUESTS</th><th>STATUS</th><th>AUDIENCE</th><th>TICKET PRICE</th><th /></tr></thead><tbody>{shown.map((event) => <tr key={event.id}><td><div className="event-name-cell"><span className="event-thumb">{event.imageGallery?.[0] || event.imageData ? <img src={event.imageGallery?.[0] || event.imageData} alt="" /> : event.category?.slice(0, 1) || 'E'}</span><div><strong>{event.title}</strong><span>{event.venue}{event.area ? " - " + event.area : ""}</span></div></div></td><td>{event.brand || <span className="muted-text">Not specified</span>}</td><td>{dateLabel(event.date)}<span className="table-subline">{event.time || (event.gatesOpenTime ? `Gates open ${event.gatesOpenTime}` : "")}</span>{event.applicationDeadline ? <span className="table-subline">Nominations close {dateLabel(event.applicationDeadline)}</span> : null}</td><td>{(event.tracks || []).length ? <><strong>{event.confirmed || 0}</strong><span className="muted-text"> / {event.capacity}</span></> : <span className="muted-text">No RSVP capacity</span>}</td><td><span className={`status-tag status-${event.status}`}>{event.status}</span></td><td>{(event.tracks || []).map((name) => name === 'Private Circle' ? 'Private' : name).join(', ') || 'None'}</td><td>{Number(event.ticketPrice || 0).toFixed(2)} {event.ticketCurrency || 'AED'}</td><td><div className="table-actions"><button className="small-action" onClick={() => openModal({ type: 'edit-event', event })}>Edit event</button><button className="small-action" onClick={() => setEventPrice(event)}>Edit price</button>{event.status === 'pending' ? <button className="small-action publish-action" onClick={() => act(() => api.updateEvent(event.id, 'published'), 'Event published')}>Publish</button> : <button className="small-action" onClick={() => act(() => api.updateEvent(event.id, 'closed'), 'RSVPs closed')}>Close RSVPs</button>}<button className="small-action" onClick={() => openModal({ type: 'guest-list', event })}>Guest list</button><button className="small-action" onClick={() => showRsvps(event)}>Review RSVPs{event.pendingRsvpCount ? ` · ${event.pendingRsvpCount}` : ''}</button><button className="small-action delete-action" disabled={deletingEvent === event.id} onClick={() => deleteEvent(event)}><Trash2 size={13} />{deletingEvent === event.id ? "Deleting..." : "Delete"}</button></div></td></tr>)}</tbody></table>{shown.length === 0 && <EmptyState title="No events in this view" detail="Create an event to fill your programme." />}</div>{ticketRequests.length > 0 && <section className="panel table-panel table-scroll" style={{ marginTop: 24 }}><h2 style={{ padding: 20 }}>WhatsApp ticket requests</h2><table><thead><tr><th>GUEST</th><th>EVENT</th><th>PHONE</th><th>PRICE</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{ticketRequests.map((item) => <tr key={item.id}><td>{item.guestName || "WhatsApp guest"}</td><td>{item.eventTitle}</td><td>{item.phone}</td><td>{Number(item.amount).toFixed(2)} {item.currency}</td><td>{item.status}{item.ticketDeliveredAt ? ' · PDF sent' : ''}</td><td>{Number(item.amount) === 0 && ['pending', 'approved'].includes(item.status) && !item.ticketDeliveredAt ? <button className="small-action publish-action" disabled={busyTicket === item.id} onClick={() => approveFreeTicket(item)}>{busyTicket === item.id ? 'Sending…' : item.status === 'pending' ? 'Approve & send PDF' : 'Retry PDF'}</button> : Number(item.amount) > 0 && item.status === 'awaiting_payment' ? 'Awaiting payment' : Number(item.amount) > 0 && item.status === 'paid' ? 'Payment confirmed' : '—'}</td></tr>)}</tbody></table></section>}{priceEvent && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !savingPrice) setPriceEvent(null); }}><section className="modal-card price-modal" role="dialog" aria-modal="true" aria-labelledby="price-modal-title"><div className="modal-header"><div><div className="eyebrow">EVENT PRICING</div><h2 id="price-modal-title">Update ticket price</h2><p>{priceEvent.title}</p></div><button className="icon-button" onClick={() => setPriceEvent(null)} disabled={savingPrice} aria-label="Close"><X size={18} /></button></div><div className="modal-body price-modal-body"><label className="field"><span>Ticket price</span><div className="price-input-wrap"><span>AED</span><input autoFocus type="number" min="0" step="0.01" value={priceValue} onChange={(e) => { setPriceValue(e.target.value); setPriceError(''); }} onKeyDown={(e) => { if (e.key === 'Enter') saveEventPrice(); }} /></div></label><p className="price-help">Set 0.00 for a complimentary ticket. Customers will see this price before requesting a ticket.</p>{priceError && <p className="price-error" role="alert">{priceError}</p>}</div><div className="modal-footer"><button className="button button-secondary" disabled={savingPrice} onClick={() => setPriceEvent(null)}>Cancel</button><button className="button button-primary" disabled={savingPrice} onClick={saveEventPrice}>{savingPrice ? 'Saving…' : 'Save price'}</button></div></section></div>}{rsvpEvent && <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setRsvpEvent(null); }}><section className="modal-card guest-modal" role="dialog" aria-modal="true" aria-labelledby="rsvp-queue-title"><div className="modal-header"><div><div className="eyebrow">MEMBER RSVP REVIEW</div><h2 id="rsvp-queue-title">{rsvpEvent.title}</h2><p>Review every request before a guest is confirmed.</p></div><button className="icon-button" onClick={() => setRsvpEvent(null)} aria-label="Close"><X size={18} /></button></div><div className="modal-body"><div className="flex justify-end pb-3"><button className="small-action" disabled={!rsvpRows.some((item) => item.status === 'accepted')} onClick={exportAccepted}><Download size={14} /> Export accepted list</button></div>{deliveryNote ? <p className="price-help" role="status">{deliveryNote}</p> : null}{rsvpLoadError ? <p className="price-error" role="alert">{rsvpLoadError}</p> : null}<div className="panel table-panel table-scroll"><table><thead><tr><th>MEMBER</th><th>TRACK</th><th>GUESTS</th><th>STATUS</th><th>REVIEW</th></tr></thead><tbody>{rsvpRows.map((item) => <tr key={item.id}><td><strong>{item.name}</strong><span className="table-subline">{item.email}</span><span className="table-subline">{new Date(item.createdAt).toLocaleString()}</span></td><td>{item.track}</td><td>{item.guestNames?.length ? item.guestNames.join(', ') : 'Just the member'}{item.deliverablesAgreed ? <span className="table-subline">Deliverables agreed</span> : null}</td><td><span className={`status-tag status-${item.status === 'accepted' ? 'approved' : item.status === 'declined' ? 'rejected' : 'pending'}`}>{item.status}</span></td><td><div className="table-actions">{item.status !== 'accepted' && <button className="small-action publish-action" onClick={() => reviewRsvp(item, 'accepted')}>Accept</button>}{item.status !== 'waitlisted' && <button className="small-action" onClick={() => reviewRsvp(item, 'waitlisted')}>Waitlist</button>}{item.status !== 'declined' && <button className="small-action" onClick={() => reviewRsvp(item, 'declined')}>Decline</button>}</div></td></tr>)}</tbody></table>{loadingRsvps ? <EmptyState title="Loading RSVP requests" detail="Fetching this event’s review queue." /> : !rsvpLoadError && rsvpRows.length === 0 ? <EmptyState title="No RSVP requests yet" detail="Member requests for this event will appear here." /> : null}</div></div><div className="modal-footer"><span className="muted-text">{rsvpRows.filter((item) => item.status === 'pending').length} pending · {rsvpRows.filter((item) => item.status === 'accepted').length} accepted</span><button className="button button-secondary" onClick={() => setRsvpEvent(null)}>Done</button></div></section></div>}</>;
}

export function EventModal({ close, act, event = null }) {
  const [form, setForm] = useState({ title: '', brand: '', venue: '', area: '', date: '', endDate: '', time: '', endTime: '', gatesOpenTime: '', capacity: 0, ticketPrice: 0, ticketCurrency: 'AED', ticketUrl: '', actionLabel: '', applicationDeadline: '', reservationPhone: '', creatorPassNote: '', ageRestriction: '', hashtag: '', category: 'Other', tracks: [], trackCapacities: {}, influencerDeliverables: '', mapUrl: '', dressCode: '', about: '', included: '', whoIsInvited: '', hostNote: '', imageFiles: [], videoFile: null });
  const [busy, setBusy] = useState(false);
  const [imageError, setImageError] = useState('');
  const [existingImages, setExistingImages] = useState([]);
  useEffect(() => {
    if (!event) return;
    const images = event.imageGallery?.length ? event.imageGallery : event.imageData ? [event.imageData] : [];
    setExistingImages(images);
    setForm({ title: event.title || '', brand: event.brand || '', venue: event.venue || '', area: event.area || '', date: event.date || '', endDate: event.endDate || '', time: event.time || '', endTime: event.endTime || '', gatesOpenTime: event.gatesOpenTime || '', capacity: event.capacity ?? 0, ticketPrice: event.ticketPrice ?? 0, ticketCurrency: event.ticketCurrency || 'AED', ticketUrl: event.ticketUrl || '', actionLabel: event.actionLabel || '', applicationDeadline: event.applicationDeadline || '', reservationPhone: event.reservationPhone || '', creatorPassNote: event.creatorPassNote || '', ageRestriction: event.ageRestriction || '', hashtag: event.hashtag || '', category: event.category || 'Other', tracks: event.tracks || [], trackCapacities: event.trackCapacities || {}, influencerDeliverables: event.influencerDeliverables || '', mapUrl: event.mapUrl || '', dressCode: event.dressCode || '', about: event.about || '', included: (event.included || []).join('\n'), whoIsInvited: event.whoIsInvited || '', hostNote: event.hostNote || '', imageFiles: [], videoFile: null });
  }, [event]);
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const onImages = async (fileList) => {
    setImageError('');
    const files = Array.from(fileList || []);
    if (existingImages.length + form.imageFiles.length + files.length > 5) { setImageError('Choose up to 5 event images.'); return; }
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
    if (!form.title.trim() || !form.date || imageError) return;
    setBusy(true);
    try {
      const uploadedImages = await Promise.all(form.imageFiles.map(({ file }) => upload(file)));
      const imageDataList = [...existingImages, ...uploadedImages];
      const videoUrl = form.videoFile ? await upload(form.videoFile) : '';
      const payload = { ...form, imageFiles: undefined, videoFile: undefined, imageData: imageDataList[0] || '', imageDataList, videoUrl: form.videoFile ? videoUrl : event?.videoUrl || '', included: form.included.split(/\n|,/).map((item) => item.trim()).filter(Boolean), status, confirmed: event?.confirmed || 0 };
      const save = () => event ? api.updateEventDetails(event.id, payload) : api.createEvent(payload);
      await act(save, event ? 'Event updated' : status === 'published' ? 'Event created and published' : 'Event saved as draft');
      close();
    } catch (error) { setImageError(error.message || 'Media upload failed. Please try again.'); }
    finally { setBusy(false); }
  };
  const toggle = (name) => {
    const tracks = form.tracks.includes(name) ? form.tracks.filter((track) => track !== name) : [...form.tracks, name];
    set('tracks', tracks);
    set('trackCapacities', Object.fromEntries(tracks.map((track) => [track, form.trackCapacities[track] || form.capacity])));
  };
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><section className="modal-card event-create-modal" role="dialog" aria-modal="true" aria-labelledby="event-modal-title"><div className="modal-header event-create-header"><div><div className="eyebrow">{event ? 'EVENT EDIT' : 'EVENT SETUP'}</div><h2 id="event-modal-title">{event ? 'Edit event' : 'Create an event'}</h2><p>Set the scene, share the details, and bring your guest list together.</p></div><button className="icon-button" onClick={close}><X size={18} /></button></div><div className="modal-body event-create-body"><div className="event-live-preview"><div className="event-preview-image">{(form.imageFiles[0]?.preview || existingImages[0]) ? <img src={form.imageFiles[0]?.preview || existingImages[0]} alt="Event cover preview" /> : <ImagePlus size={22} />}</div><div className="event-preview-copy"><span><Sparkles size={12} /> LIVE LISTING PREVIEW</span><strong>{form.title.trim() || 'Your event title'}</strong><small><CalendarDays size={13} /> {form.date ? dateLabel(form.date) : 'Choose an event date'} <i /> <MapPin size={13} /> {form.venue.trim() || 'Add a venue'}</small></div><span className="event-preview-category">{form.category}</span></div><nav className="event-form-jumpnav" aria-label="Jump to event form section"><button type="button" onClick={() => document.getElementById('event-basics-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>01 <span>Event details</span></button><button type="button" onClick={() => document.getElementById('event-media')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>02 <span>Media</span></button><button type="button" onClick={() => document.getElementById('event-copy')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>03 <span>Guest experience</span></button><button type="button" onClick={() => document.getElementById('event-audience')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>04 <span>Audience</span></button></nav>
    <label className="field"><span>Event title *</span><input autoFocus value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Sunset Listening Session" /></label>
    <div className="form-grid" id="event-basics-grid"><label className="field"><span>Host / organiser (if supplied)</span><input value={form.brand} onChange={(e) => set('brand', e.target.value)} placeholder="Optional; do not guess" /></label><label className="field"><span>Listing type</span><select value={form.category} onChange={(e) => set('category', e.target.value)}>{['Dining', 'Fashion', 'Property', 'Music', 'Comedy', 'Awards', 'Campaign', 'Art', 'Nightlife', 'Wellness', 'Travel', 'Other'].map((name) => <option key={name}>{name}</option>)}</select></label><label className="field"><span>Event / awards date *</span><input type="date" value={form.date} onChange={(e) => set('date', e.target.value)} /></label><label className="field"><span>Application / nomination deadline</span><input type="date" value={form.applicationDeadline} onChange={(e) => set('applicationDeadline', e.target.value)} /></label><label className="field"><span>Start time</span><input type="time" value={form.time} onChange={(e) => set('time', e.target.value)} /></label><label className="field"><span>Venue</span><input value={form.venue} onChange={(e) => set('venue', e.target.value)} placeholder="Optional venue" /></label><label className="field"><span>Area / city</span><input value={form.area} onChange={(e) => set('area', e.target.value)} placeholder="Area or city" /></label><label className="field"><span>Member RSVP capacity (0 when not applicable)</span><input type="number" min="0" value={form.capacity} onChange={(e) => { const capacity = Number(e.target.value); set('capacity', capacity); set('trackCapacities', Object.fromEntries(form.tracks.map((track) => [track, capacity]))); }} /></label><label className="field"><span>Ticket price (AED, for platform checkout)</span><input type="number" min="0" step="0.01" value={form.ticketPrice} onChange={(e) => set('ticketPrice', Number(e.target.value))} /></label><label className="field"><span>Ticket / application URL</span><input type="url" value={form.ticketUrl} onChange={(e) => set('ticketUrl', e.target.value)} placeholder="https://…" /></label><label className="field"><span>Link button label</span><input value={form.actionLabel} onChange={(e) => set('actionLabel', e.target.value)} placeholder="e.g. Buy tickets, Get nominated" /></label><label className="field"><span>Reservation phone</span><input type="tel" value={form.reservationPhone} onChange={(e) => set('reservationPhone', e.target.value)} placeholder="Optional" /></label><label className="field"><span>Age restriction</span><input value={form.ageRestriction} onChange={(e) => set('ageRestriction', e.target.value)} placeholder="e.g. 21+" /></label><label className="field"><span>Event hashtag</span><input value={form.hashtag} onChange={(e) => set('hashtag', e.target.value)} placeholder="#EventName" /></label></div>
    <label className="field" id="event-media"><span>Event photos (up to 5 JPG, PNG or WebP images)</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => { onImages(e.target.files); e.target.value = ''; }} /><small className="muted-text">Up to 12 MB per image and 40 MB total. Images upload securely to S3; the first is used as the event cover.</small>{existingImages.length > 0 ? <div className="event-image-gallery">{existingImages.map((image, index) => <div className="event-image-tile" key={`existing-${image}`}><img src={image} alt={`Current event photo ${index + 1}`} /><span>{index === 0 ? 'Current cover' : `Current photo ${index + 1}`}</span><button type="button" aria-label={`Remove current photo ${index + 1}`} onClick={() => setExistingImages(existingImages.filter((_, imageIndex) => imageIndex !== index))}><X size={14} /></button></div>)}</div> : null}{form.imageFiles.length > 0 ? <div className="event-image-gallery">{form.imageFiles.map((item, index) => <div className="event-image-tile" key={`${index}-${item.file.name}`}><img src={item.preview} alt={`Event preview ${index + 1}`} /><span>{index === 0 ? 'Cover' : `Photo ${index + 1}`}</span><button type="button" aria-label={`Remove photo ${index + 1}`} onClick={() => { URL.revokeObjectURL(item.preview); set('imageFiles', form.imageFiles.filter((_, imageIndex) => imageIndex !== index)); }}><X size={14} /></button></div>)}</div> : null}</label>
    <label className="field"><span>Event video (optional, up to 100 MB)</span><input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={(e) => { const file = e.target.files?.[0] || null; if (file && (!['video/mp4', 'video/webm', 'video/quicktime'].includes(file.type) || file.size > 100 * 1024 * 1024)) setImageError('Choose an MP4, WebM or MOV video up to 100 MB.'); else { setImageError(''); set('videoFile', file); } e.target.value = ''; }} />{form.videoFile ? <small className="muted-text">Selected: {form.videoFile.name}</small> : null}</label>
    <div className="form-grid"><label className="field"><span>Event end date (optional)</span><input type="date" min={form.date || undefined} value={form.endDate} onChange={(e) => set('endDate', e.target.value)} /></label><label className="field"><span>Event end time (optional)</span><input type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} /></label><label className="field"><span>Gates open time (optional)</span><input type="time" value={form.gatesOpenTime} onChange={(e) => set('gatesOpenTime', e.target.value)} /></label><label className="field"><span>Google Maps link (optional)</span><input type="url" value={form.mapUrl} onChange={(e) => set('mapUrl', e.target.value)} placeholder="https://maps.google.com/..." /></label></div>
    {imageError ? <small className="event-image-error" role="alert">{imageError}</small> : null}
    <label className="field" id="event-copy"><span>About this event</span><textarea rows="3" value={form.about} onChange={(e) => set('about', e.target.value)} placeholder="Describe the event" /></label>
    <label className="field"><span>What is included (one item per line or comma separated)</span><textarea rows="2" value={form.included} onChange={(e) => set('included', e.target.value)} placeholder="Welcome drink, tasting menu" /></label>
    <label className="field"><span>Who is invited</span><textarea rows="2" value={form.whoIsInvited} onChange={(e) => set('whoIsInvited', e.target.value)} placeholder="Guest eligibility" /></label>
    <label className="field"><span>Creator deliverables (optional)</span><textarea rows="3" value={form.influencerDeliverables} onChange={(e) => set('influencerDeliverables', e.target.value)} placeholder="Content requirements for attending creators" /></label>
    <label className="field"><span>Creator pass / nomination note</span><textarea rows="2" value={form.creatorPassNote} onChange={(e) => set('creatorPassNote', e.target.value)} placeholder="Optional creator application details" /></label>
    <label className="field"><span>Host note</span><textarea rows="2" value={form.hostNote} onChange={(e) => set('hostNote', e.target.value)} placeholder="Arrival or event notes" /></label>
    <div className="field" id="event-audience"><span>Invited tracks and track capacity</span><div className="track-checks">{TRACKS.map((name) => <button key={name} className={form.tracks.includes(name) ? 'checked' : ''} onClick={() => toggle(name)} type="button">{form.tracks.includes(name) && <Check size={13} />}{name}</button>)}</div>{form.tracks.map((track) => <label key={track} className="field"><span>{track} RSVP spots</span><input type="number" min="1" max={form.capacity} value={form.trackCapacities[track] || form.capacity} onChange={(e) => set('trackCapacities', { ...form.trackCapacities, [track]: Number(e.target.value) })} /></label>)}<small className="muted-text">Accepted guests count against both their track limit and the total event capacity.</small></div>
  </div><div className="modal-footer"><button className="button button-secondary" onClick={close}>Cancel</button><button className="button button-primary" disabled={busy || !form.title || !form.date || Boolean(imageError)} onClick={() => submit(event?.status || 'published')}>{busy ? 'Saving…' : event ? 'Save changes' : 'Publish event'} <ArrowUpRight size={15} /></button></div></section></div>;
}

export function GuestModal({ event, guests, close }) {
  const rows = guests.filter((guest) => guest.eventId === event.id);
  return <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}><section className="modal-card guest-modal"><div className="modal-header"><div><div className="eyebrow">GUEST LIST</div><h2>{event.title}</h2><p>{dateLabel(event.date)} · {event.venue}</p></div><button className="icon-button" onClick={close}><X size={18} /></button></div><div className="panel table-panel table-scroll"><table><thead><tr><th>GUEST</th><th>TRACK</th><th>PARTY SIZE</th><th>ENTRY CODE</th><th>STATUS</th></tr></thead><tbody>{rows.map((guest) => <tr key={guest.id}><td><strong>{guest.name}</strong></td><td>{guest.track}</td><td>{guest.plusOnes + 1}</td><td><code>{guest.code}</code></td><td><span className={`status-tag ${guest.checkedInAt ? 'status-approved' : 'status-pending'}`}>{guest.checkedInAt ? `Checked in ${guest.checkedInAt}` : 'Confirmed'}</span></td></tr>)}</tbody></table>{rows.length === 0 && <EmptyState title="Guest list is empty" detail="Confirmed RSVPs will appear here." />}</div><div className="modal-footer"><span className="muted-text">{rows.length} confirmed guests</span><button className="button button-secondary" onClick={close}>Done</button></div></section></div>;
}

