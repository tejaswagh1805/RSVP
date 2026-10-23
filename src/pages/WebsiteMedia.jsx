import { useState } from 'react';
import { ImagePlus, Eye, EyeOff } from 'lucide-react';
import { api } from '../api.js';
import { EmptyState, PageIntro } from '../components/UI.jsx';

export default function WebsiteMedia({ rows, act }) {
  const [slot, setSlot] = useState('gallery');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const chooseFile = (next) => {
    if (preview) URL.revokeObjectURL(preview);
    setError('');
    if (!next) { setFile(null); setPreview(''); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type) || next.size > 12 * 1024 * 1024) {
      setFile(null); setPreview(''); setError('Choose a JPG, PNG or WebP image up to 12 MB.'); return;
    }
    setFile(next); setPreview(URL.createObjectURL(next));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!file || !title.trim()) { setError('Choose an image and enter a title.'); return; }
    setBusy(true); setError('');
    try {
      const { uploadUrl, publicUrl, key } = await api.mediaUploadUrl(file);
      const response = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
      if (!response.ok) throw new Error('Image upload to S3 failed.');
      await api.createSiteMedia({ slot, title: title.trim(), caption: caption.trim(), linkUrl: linkUrl.trim(), imageUrl: publicUrl, objectKey: key });
      await act(() => Promise.resolve(), `${slot === 'gallery' ? 'Gallery image' : 'Top Pick'} published to the customer site`);
      setTitle(''); setCaption(''); setLinkUrl(''); setFile(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview('');
    } catch (uploadError) { setError(uploadError.message || 'Could not save website media.'); }
    finally { setBusy(false); }
  };

  return <>
    <PageIntro title="Website Media" detail="Upload images for the customer homepage Gallery and RSVP Top Picks. New active items appear on the site after saving." />
    <section className="panel" style={{ padding: 22, marginBottom: 24 }}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 14, maxWidth: 760 }}>
        <div className="form-grid">
          <label className="field"><span>Homepage section</span><select value={slot} onChange={(e) => setSlot(e.target.value)}><option value="gallery">Gallery</option><option value="top_pick">RSVP Top Pick</option></select></label>
          <label className="field"><span>Image title *</span><input maxLength={180} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short title shown with the image" /></label>
        </div>
        <label className="field"><span>Caption</span><textarea rows="2" maxLength={500} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Optional supporting text" /></label>
        {slot === 'top_pick' ? <label className="field"><span>Link (optional)</span><input type="url" maxLength={500} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" /></label> : null}
        <label className="field"><span>Image (JPG, PNG or WebP, up to 12 MB) *</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { chooseFile(e.target.files?.[0] || null); e.target.value = ''; }} /></label>
        {preview ? <img src={preview} alt="Selected upload preview" style={{ maxWidth: 360, maxHeight: 220, objectFit: 'cover', borderRadius: 8 }} /> : null}
        {error ? <p className="event-image-error" role="alert">{error}</p> : null}
        <div><button className="button button-primary" disabled={busy || !file || !title.trim()}>{busy ? 'Uploading…' : <><ImagePlus size={16} /> Upload & publish</>}</button></div>
      </form>
    </section>
    <PageIntro title="Homepage images" detail="Hide an item to remove it from the customer site without deleting its S3 file." />
    <div className="panel table-panel table-scroll"><table><thead><tr><th>PREVIEW</th><th>SECTION</th><th>TITLE</th><th>CAPTION</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td><img src={item.imageUrl} alt="" style={{ width: 84, height: 54, objectFit: 'cover', borderRadius: 5 }} /></td><td>{item.slot === 'gallery' ? 'Gallery' : 'RSVP Top Pick'}</td><td><strong>{item.title}</strong></td><td>{item.caption || '—'}</td><td><span className={`status-tag ${item.active ? 'status-published' : 'status-closed'}`}>{item.active ? 'Active' : 'Hidden'}</span></td><td><button className="small-action" onClick={() => act(() => api.setSiteMediaActive(item.id, !item.active), item.active ? 'Image hidden from customer site' : 'Image shown on customer site')}>{item.active ? <><EyeOff size={13} /> Hide</> : <><Eye size={13} /> Show</>}</button></td></tr>)}</tbody></table>{rows.length === 0 ? <EmptyState title="No homepage images yet" detail="Upload an image above to populate Gallery or RSVP Top Picks." /> : null}</div>
  </>;
}
