import { useState } from 'react';
import { Eye, EyeOff, Pencil, UserRoundPlus, X } from 'lucide-react';
import { api } from '../api.js';
import { EmptyState, PageIntro } from '../components/UI.jsx';

const SOCIALS = [['instagramUrl', 'Instagram URL'], ['tiktokUrl', 'TikTok URL'], ['youtubeUrl', 'YouTube URL'], ['xUrl', 'X URL']];
const blankForm = (category = 'artist') => ({ category, name: '', role: '', bio: '', instagramUrl: '', tiktokUrl: '', youtubeUrl: '', xUrl: '' });

export default function PeopleProfiles({ rows, act }) {
  const [form, setForm] = useState(blankForm());
  const [editing, setEditing] = useState(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const clearForm = (category = 'artist') => {
    if (preview) URL.revokeObjectURL(preview);
    setForm(blankForm(category)); setEditing(null); setFile(null); setPreview(''); setError('');
  };
  const chooseFile = (next) => {
    if (preview) URL.revokeObjectURL(preview);
    setError('');
    if (!next) { setFile(null); setPreview(''); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type) || next.size > 12 * 1024 * 1024) {
      setFile(null); setPreview(''); setError('Choose a JPG, PNG or WebP portrait up to 12 MB.'); return;
    }
    setFile(next); setPreview(URL.createObjectURL(next));
  };
  const startEdit = (person) => {
    if (preview) URL.revokeObjectURL(preview);
    setEditing(person);
    setForm({ category: person.category, name: person.name || '', role: person.role || '', bio: person.bio || '', instagramUrl: person.instagramUrl || '', tiktokUrl: person.tiktokUrl || '', youtubeUrl: person.youtubeUrl || '', xUrl: person.xUrl || '' });
    setFile(null); setPreview(''); setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim() || !form.role.trim() || (!editing && !file)) { setError('Name, role and a portrait are required.'); return; }
    setBusy(true); setError('');
    try {
      let imageUrl = editing?.imageUrl || '';
      let objectKey = editing?.objectKey || '';
      if (file) {
        const upload = await api.mediaUploadUrl(file);
        const response = await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file });
        if (!response.ok) throw new Error('Portrait upload to S3 failed.');
        imageUrl = upload.publicUrl; objectKey = upload.key;
      }
      const payload = { ...form, name: form.name.trim(), role: form.role.trim(), bio: form.bio.trim(), imageUrl, objectKey };
      if (editing) {
        await act(() => api.updatePeopleProfile(editing.id, payload), 'Profile updated on the customer site');
        clearForm(form.category);
      } else {
        await api.createPeopleProfile(payload);
        await act(() => Promise.resolve(), `${form.category === 'artist' ? 'Artist' : 'Influencer'} profile added to the customer site`);
        clearForm(form.category);
      }
    } catch (saveError) { setError(saveError.message || 'Could not save the profile.'); }
    finally { setBusy(false); }
  };
  return <>
    <PageIntro title="Artists & Influencers" detail="Create profiles with an S3 portrait, bio and social links. Active profiles appear on the homepage and Artists page." />
    <section className="panel" style={{ padding: 22, marginBottom: 24 }}>
      <form onSubmit={submit} style={{ display: 'grid', gap: 14, maxWidth: 900 }}>
        <div className="form-grid">
          <label className="field"><span>Profile type</span><select value={form.category} onChange={(e) => set('category', e.target.value)}><option value="artist">Artist</option><option value="influencer">Influencer</option></select></label>
          <label className="field"><span>Name *</span><input maxLength={140} value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Name shown on the profile" /></label>
          <label className="field"><span>Role or category *</span><input maxLength={180} value={form.role} onChange={(e) => set('role', e.target.value)} placeholder="DJ / Sound & culture" /></label>
        </div>
        <label className="field"><span>Bio</span><textarea rows="3" maxLength={1000} value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder="Short profile introduction" /></label>
        <div className="form-grid">{SOCIALS.map(([key, label]) => <label className="field" key={key}><span>{label}</span><input type="url" maxLength={500} value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder="https://…" /></label>)}</div>
        <label className="field"><span>Portrait (JPG, PNG or WebP, up to 12 MB) {editing ? '(optional; choose a file to replace the current image)' : '*'}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => { chooseFile(e.target.files?.[0] || null); e.target.value = ''; }} /></label>
        {(preview || (editing && !file)) ? <img src={preview || editing.imageUrl} alt="Portrait preview" style={{ width: 150, height: 180, objectFit: 'cover', borderRadius: 8 }} /> : null}
        {error ? <p className="event-image-error" role="alert">{error}</p> : null}
        <div style={{ display: 'flex', gap: 10 }}><button className="button button-primary" disabled={busy || (!editing && !file) || !form.name.trim() || !form.role.trim()}>{busy ? 'Saving…' : editing ? 'Save changes' : <><UserRoundPlus size={16} /> Add profile</>}</button>{editing ? <button type="button" className="button button-secondary" disabled={busy} onClick={() => clearForm()}><X size={16} /> Cancel edit</button> : null}</div>
      </form>
    </section>
    <PageIntro title="Published profiles" detail="Edit profile details or hide a profile from customer pages without deleting its S3 image." />
    <div className="panel table-panel table-scroll"><table><thead><tr><th>PHOTO</th><th>TYPE</th><th>NAME</th><th>ROLE</th><th>SOCIAL LINKS</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{rows.map((person) => <tr key={person.id}><td><img src={person.imageUrl} alt="" style={{ width: 54, height: 64, objectFit: 'cover', borderRadius: 5 }} /></td><td>{person.category === 'artist' ? 'Artist' : 'Influencer'}</td><td><strong>{person.name}</strong></td><td>{person.role}</td><td>{[['Instagram', person.instagramUrl], ['TikTok', person.tiktokUrl], ['YouTube', person.youtubeUrl], ['X', person.xUrl]].filter(([, url]) => url).map(([name, url]) => <a key={name} href={url} target="_blank" rel="noreferrer" style={{ marginRight: 8 }}>{name}</a>)}</td><td><span className={`status-tag ${person.active ? 'status-published' : 'status-closed'}`}>{person.active ? 'Active' : 'Hidden'}</span></td><td><div style={{ display: 'flex', gap: 6 }}><button className="small-action" onClick={() => startEdit(person)}><Pencil size={13} /> Edit</button><button className="small-action" onClick={() => act(() => api.setPeopleProfileActive(person.id, !person.active), person.active ? 'Profile hidden' : 'Profile shown')}>{person.active ? <><EyeOff size={13} /> Hide</> : <><Eye size={13} /> Show</>}</button></div></td></tr>)}</tbody></table>{rows.length === 0 ? <EmptyState title="No profiles yet" detail="Add an artist or influencer above." /> : null}</div>
  </>;
}
