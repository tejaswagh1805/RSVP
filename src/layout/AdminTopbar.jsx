import { Bell, ChevronRight, Menu, Search } from 'lucide-react';
import { TITLES } from '../lib/constants.js';
import AccountMenu from '../components/AccountMenu.jsx';

export default function AdminTopbar({ page, search, setSearch, onOpenMenu, onNotify, admin, onSignOut, onSwitchAccount }) {
  return <header className="topbar"><div className="topbar-left"><button className="icon-button mobile-menu" onClick={onOpenMenu} aria-label="Open menu"><Menu size={19} /></button><div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{TITLES[page] || 'Dashboard'}</strong></div></div><div className="topbar-actions"><label className="search-box"><Search size={16} /><input placeholder="Search applications and members" value={search} onChange={(e) => setSearch(e.target.value)} /><kbd>⌘ K</kbd></label><button className="icon-button notification-button" title="Application alerts" onClick={onNotify}><Bell size={17} /><i /></button><span className="topbar-divider" /><AccountMenu admin={admin} onSignOut={onSignOut} onSwitchAccount={onSwitchAccount} /></div></header>;
}
