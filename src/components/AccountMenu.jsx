import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, Users } from 'lucide-react';

const initials = (name = 'Admin') => name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();

export default function AccountMenu({ admin, variant = 'topbar', onSignOut, onSwitchAccount }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  useEffect(() => {
    const closeOutside = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    const closeOnEscape = (event) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('pointerdown', closeOutside); document.removeEventListener('keydown', closeOnEscape); };
  }, []);
  const handle = (action) => { setOpen(false); action?.(); };

  return <div className={`account-menu-wrap account-menu-wrap--${variant}`} ref={root}>
    {variant === 'sidebar' ? <button type="button" className="admin-profile" aria-label={`Open account menu for ${admin?.name || 'admin'}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}><div className="avatar avatar-gold">{initials(admin?.name)}</div><span className="admin-copy"><strong>{admin?.name}</strong><span>{admin?.role || 'Admin'} · RSVP DXB</span></span><ChevronDown className={`profile-chevron ${open ? 'is-open' : ''}`} size={15} /></button> : <button type="button" className="top-avatar" aria-label={`Account menu for ${admin?.name || 'admin'}`} title="Account menu" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((value) => !value)}>{initials(admin?.name)}</button>}
    {open && <div className="account-menu-popover" role="menu"><div className="account-menu-heading"><span className="avatar avatar-gold">{initials(admin?.name)}</span><span><strong>{admin?.name}</strong><small>{admin?.email}</small><small>{admin?.role || 'Admin'}</small></span></div><div className="account-menu-separator" /><button role="menuitem" onClick={() => handle(onSwitchAccount)}><Users size={15} /><span><strong>Switch admin</strong><small>Sign in with the other admin account</small></span></button><button role="menuitem" className="account-logout" onClick={() => handle(onSignOut)}><LogOut size={15} /><span><strong>Sign out</strong><small>End this admin session</small></span></button></div>}
  </div>;
}
