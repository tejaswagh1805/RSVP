import { useState } from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { api } from '../api.js';
import { TRACKS } from '../lib/constants.js';

const initialForm = { name: '', email: '', mobile: '', track: 'Creators', profileUrl: '', handle: '', platform: '', followers: '', city: 'Dubai', outlet: '', role: '', allProfiles: '', password: '', confirmPassword: '' };

function TextField({ label, name, form, update, type = 'text', required = false, placeholder = '' }) {
  return <label className="field"><span>{label}</span><input type={type} name={name} required={required} value={form[name]} onChange={update} placeholder={placeholder} /></label>;
}

export default function Register() {
  const [form, setForm] = useState(initialForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const update = (event) => setForm((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setSuccess('');
    if (form.password.length < 12) { setError('Use a password with at least 12 characters.'); setBusy(false); return; }
    if (form.password !== form.confirmPassword) { setError('The passwords do not match.'); setBusy(false); return; }
    try {
      const { confirmPassword, ...member } = form;
      const result = await api.register({ ...member, followers: member.followers || '0' });
      setSuccess(result.message);
      setForm(initialForm);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  };

  return <main className="register-screen"><section className="register-card"><div className="signin-brand"><span className="brand-mark">R</span><span className="brand-name">RSVP <b>DXB</b></span></div><div className="signin-heading"><div className="signin-shield"><ShieldCheck size={21} /></div><span className="eyebrow">MEMBER APPLICATION</span><h1>Join the circle</h1><p>Share your details for review. Your profile will be added to the member directory after approval.</p></div>
    <form className="register-form" onSubmit={submit}>
      <h2><UserRound size={15} /> Personal details</h2>
      <div className="register-grid"><TextField label="Full name" name="name" form={form} update={update} required /><TextField label="Email address" name="email" form={form} update={update} type="email" required /><TextField label="Mobile" name="mobile" form={form} update={update} type="tel" /><label className="field"><span>Member track</span><select name="track" value={form.track} onChange={update}>{TRACKS.map((track) => <option key={track}>{track}</option>)}</select></label><TextField label="City" name="city" form={form} update={update} required /><TextField label="Outlet / publication" name="outlet" form={form} update={update} /><TextField label="Role" name="role" form={form} update={update} /><TextField label="Platform" name="platform" form={form} update={update} placeholder="Instagram, TikTok…" /><TextField label="Handle" name="handle" form={form} update={update} /><TextField label="Profile URL" name="profileUrl" form={form} update={update} type="url" /><TextField label="Followers" name="followers" form={form} update={update} type="number" /></div>
      <label className="field"><span>Other profile links</span><textarea name="allProfiles" value={form.allProfiles} onChange={update} rows="3" placeholder="Add any additional profile URLs" /></label>
      <h2><LockKeyhole size={15} /> Account password</h2>
      <div className="register-grid"><TextField label="Password (12 characters minimum)" name="password" form={form} update={update} type="password" required /><TextField label="Confirm password" name="confirmPassword" form={form} update={update} type="password" required /></div>
      {error && <div className="signin-error" role="alert">{error}</div>}{success && <div className="signin-notice" role="status">{success}</div>}
      <button className="button button-primary signin-submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit application'} {!busy && <ArrowRight size={15} />}</button>
    </form>
    <div className="signin-footer">Your password is securely hashed before it is stored. Existing members can contact the platform administrator.</div>
  </section></main>;
}
